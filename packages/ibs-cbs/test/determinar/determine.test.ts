import { describe, expect, test } from 'bun:test';
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import type { ConteudoTributario } from '@sinete/ibs-cbs-dados';
import { carregarDataset } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO } from '@sinete/ibs-cbs-dados/bundled';
import { aliquotasOficiais } from '../../src/aliquotas/index.ts';
import { calcularEm } from '../../src/calcular/index.ts';
import type {
  FatosDaOperacao,
  MotivoErroDeterminacao,
  Resolvedor,
  RestricoesDoItem,
} from '../../src/determinar/index.ts';
import {
  ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE,
  candidatoUnico,
  dataDoFato,
  determinar,
  determinarEm,
  doPerfil,
  ErroDeterminacao,
  idDaPergunta,
  paraClassificado,
  perguntarAoUsuario,
  REGRAS_LEGAIS,
  restringir,
  restringirEm,
} from '../../src/determinar/index.ts';

const dataset = carregarDataset(DATASET_EMBARCADO);
const DATE = '2026-10-10';
const content: ConteudoTributario = dataset.em(DATE);
const clock = relogioFixo('2026-10-10T15:00:00-03:00');
const time = contextoDeTempo({ emissao: clock });

/** NCM do Anexo I (arroz) e NBS de serviço de construção. */
const RICE = '10063021';
const NBS_SERVICE = '110011100';

function op(partial: Partial<FatosDaOperacao> = {}): FatosDaOperacao {
  return { modelo: 55, tipo: 'venda', itens: [{ n: 1 }], ...partial };
}

function one(facts: FatosDaOperacao): RestricoesDoItem {
  return restringirEm(facts, content)[0] as RestricoesDoItem;
}

function codes(c: RestricoesDoItem): string[] {
  return c.candidatos.map((x) => x.cClassTrib);
}

function reasonOf(c: RestricoesDoItem, code: string): string | undefined {
  return c.exclusoes.find((e) => e.cClassTrib === code)?.motivo;
}

function fails(fn: () => unknown, reason: MotivoErroDeterminacao): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ErroDeterminacao);
    expect((e as ErroDeterminacao).motivo).toBe(reason);
    expect((e as ErroDeterminacao).code).toBe('ibscbs_determinacao_invalida');
    return;
  }
  throw new Error('esperava ErroDeterminacao');
}

async function rejects(p: Promise<unknown>, reason: MotivoErroDeterminacao): Promise<void> {
  const e = await p.then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErroDeterminacao);
  expect((e as ErroDeterminacao).motivo).toBe(reason);
}

describe('restringir: restrições oficiais com o motivo de cada exclusão', () => {
  test('todo cClassTrib do IBS/CBS sai como candidato ou como exclusão, uma vez só', () => {
    const c = one(op({ itens: [{ n: 1, ncm: RICE }] }));
    const seen = [...codes(c), ...c.exclusoes.map((e) => e.cClassTrib)];
    const all = new Set(dataset.tabelas.classTrib.filter((x) => x.familia === 'CBS_IBS').map((x) => x.codigo));
    expect(new Set(seen).size).toBe(seen.length);
    expect(new Set(seen)).toEqual(all);
    for (const e of c.exclusoes) {
      expect(e.detalhe.length).toBeGreaterThan(0);
      expect(e.fonte.length).toBeGreaterThan(0);
    }
  });

  test('vigência: código que existe mas não vale na data', () => {
    const c = one(op());
    const expired = c.exclusoes.filter((e) => e.motivo === 'vigencia');
    expect(expired.map((e) => e.cClassTrib)).toEqual(['220001', '220002', '220003']);
    expect(expired[0]?.detalhe).toContain('fora de vigência em 2026-10-10');
  });

  test('DF-e: código não habilitado no modelo', () => {
    expect(reasonOf(one(op({ modelo: 65 })), '000003')).toBe('dfe');
    expect(codes(one(op({ modelo: 55 })))).toContain('000003');
  });

  test('NCM do Anexo I: 200003 fica, 200034 (Anexo VII) sai com o anexo na fonte', () => {
    const c = one(op({ itens: [{ n: 1, ncm: RICE }] }));
    expect(codes(c)).toContain('200003');
    expect(codes(c)).toContain('000001');
    const e = c.exclusoes.find((x) => x.cClassTrib === '200034');
    expect(e?.motivo).toBe('ncm');
    expect(e?.fonte).toContain('Anexo VII da LC 214/2025');
  });

  test('NCM numa exceção do anexo diz qual exceção', () => {
    const c = one(op({ itens: [{ n: 1, ncm: '03061100' }] }));
    const e = c.exclusoes.find((x) => x.cClassTrib === '200034');
    expect(e?.motivo).toBe('ncm');
    expect(e?.detalhe).toContain('exceção');
  });

  test('NCM incompleto não exclui pelo anexo', () => {
    expect(codes(one(op({ itens: [{ n: 1, ncm: '1006' }] })))).toContain('200034');
  });

  test('nomenclatura: item só com NBS não fica com código que pede NCM, e o contrário', () => {
    const service = one(op({ itens: [{ n: 1, nbs: NBS_SERVICE }] }));
    expect(reasonOf(service, '410002')).toBe('nomenclatura');
    expect(reasonOf(service, '200038')).toBe('nbs');
    const goods = one(op({ itens: [{ n: 1, ncm: RICE }] }));
    expect(reasonOf(goods, '410027')).toBe('nomenclatura');
  });

  test('atores: vínculo do fornecedor e do adquirente', () => {
    const rural = one(op({ fornecedor: { atores: [ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE] } }));
    expect(codes(rural)).toContain('410014');
    const regular = one(op({ fornecedor: { atores: [22] } }));
    expect(reasonOf(regular, '410014')).toBe('atores');
    expect(regular.exclusoes.find((e) => e.cClassTrib === '410014')?.detalhe).toContain('fornecedor');
    const buyer = one(op({ adquirente: { atores: [22] } }));
    expect(buyer.exclusoes.find((e) => e.cClassTrib === '200002')?.detalhe).toContain('adquirente');
    expect(codes(one(op({ fornecedor: { atores: [] } })))).toContain('410014');
  });

  test('tipo de nota: o tipo exige o código e o código exige o tipo (UB14-60/70/80)', () => {
    expect(codes(one(op({ tpNFDebito: '01' })))).toEqual(['800002']);
    expect(one(op({ tpNFDebito: '01' })).exclusoes.find((e) => e.cClassTrib === '000001')?.fonte).toContain('UB14-70');
    expect(codes(one(op({ tpNFCredito: '02' })))).toEqual(['810001']);
    const normal = one(op());
    expect(reasonOf(normal, '800002')).toBe('tipo-de-nota');
    expect(normal.exclusoes.find((e) => e.cClassTrib === '800002')?.fonte).toContain('UB14-60');
    expect(codes(one(op({ tpNFDebito: '05' })))).toContain('800001');
    // Fora da NF-e e da NFC-e a NT não vale.
    expect(one(op({ modelo: 57 })).exclusoes.some((e) => e.motivo === 'tipo-de-nota')).toBe(false);
  });

  test('restringir lê a data do relógio de fato gerador', () => {
    const early = contextoDeTempo({ emissao: clock, fatoGerador: relogioFixo('2026-01-01T03:00:00Z') });
    expect(dataDoFato(early)).toBe('2026-01-01');
    expect(dataDoFato(time)).toBe(DATE);
    expect(restringir(op(), { dataset, tempo: time })).toEqual(restringirEm(op(), content));
  });

  test('fatos inválidos', () => {
    fails(() => restringirEm({ modelo: 55, tipo: 'venda' } as unknown as FatosDaOperacao, content), 'fatos_invalidos');
    fails(() => restringirEm(op({ modelo: 5.5 }), content), 'fatos_invalidos');
    fails(() => restringirEm(op({ itens: [{ n: 1 }, { n: 1 }] }), content), 'fatos_invalidos');
    fails(() => restringirEm(op({ itens: [{ n: 0 }] }), content), 'fatos_invalidos');
    fails(() => restringirEm(op({ itens: [{ n: 1, ncm: '1006.30' }] }), content), 'fatos_invalidos');
    fails(() => restringirEm(op({ itens: [{ n: 1, nbs: 'x' }] }), content), 'fatos_invalidos');
    fails(() => restringirEm(op({ adquirente: { atores: [99999] } }), content), 'fatos_invalidos');
    fails(() => restringirEm(op({ tpNFCredito: '99' }), content), 'fatos_invalidos');
  });
});

describe('regras legais', () => {
  test('cada regra tem fonte, vigência e id único', () => {
    const ids = REGRAS_LEGAIS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of REGRAS_LEGAIS) {
      expect(r.fonte).toMatch(/^LC 214\/2025, art/);
      expect(r.vigencia.inicio).toBe('2026-01-01');
    }
  });

  test('o ator do produtor rural não contribuinte é o da tabela', () => {
    expect(content.ator(ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE)?.descricao).toBe('Produtor rural não contribuinte');
  });

  const cases: [string, Partial<FatosDaOperacao>, string][] = [
    ['bonificacao-no-documento', { tipo: 'bonificacao' }, '410001'],
    ['transferencia-mesmo-contribuinte', { tipo: 'transferencia' }, '410002'],
    ['doacao-sem-contraprestacao', { tipo: 'doacao' }, '410003'],
    ['exportacao-imune', { tipo: 'exportacao' }, '410004'],
    ['produtor-rural-nao-contribuinte', { fornecedor: { atores: [ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE] } }, '410014'],
  ];
  for (const [rule, facts, code] of cases) {
    test(`${rule} decide ${code} com proveniência de regra`, async () => {
      const det = await determinarEm(op({ ...facts, itens: [{ n: 1, ncm: RICE }] }), content, { relogio: clock });
      const item = det.itens[0];
      expect(item?.decidido?.candidato.cClassTrib).toBe(code);
      expect(item?.decidido?.procedencia).toMatchObject({
        por: 'regra',
        nome: rule,
        em: '2026-10-10T18:00:00.000Z',
        versaoDoConteudo: dataset.versaoDoConteudo,
        dataDeReferencia: DATE,
      });
      expect(item?.decidido?.procedencia.fonte).toContain('LC 214/2025');
      expect(item?.exclusoes.some((e) => e.motivo === 'regra-legal')).toBe(true);
      expect(det.completa).toBe(true);
    });
  }

  test('exportação de serviço fica entre 410004 e 410027 e pergunta', async () => {
    const det = await determinarEm(op({ tipo: 'exportacao', itens: [{ n: 1, nbs: NBS_SERVICE }] }), content, {
      relogio: clock,
    });
    expect(det.itens[0]?.candidatos.map((c) => c.cClassTrib)).toEqual(['410004', '410027']);
    expect(det.itens[0]?.pendente?.[0]?.opcoes.map((o) => o.cClassTrib)).toEqual(['410004', '410027']);
    expect(det.completa).toBe(false);
  });

  test('natureza por item sobrepõe a da operação; devolução espelha o original', async () => {
    const det = await determinarEm(
      op({
        itens: [
          { n: 1, ncm: RICE, tipo: 'bonificacao' },
          { n: 2, ncm: RICE, tipo: 'devolucao', referenciado: { cst: '200', cClassTrib: '200003' } },
          { n: 3, ncm: RICE, tipo: 'devolucao' },
        ],
      }),
      content,
      { relogio: clock },
    );
    expect(det.itens[0]?.decidido?.candidato.cClassTrib).toBe('410001');
    expect(det.itens[1]?.decidido?.procedencia.nome).toBe('devolucao-espelha-original');
    expect(det.itens[1]?.decidido?.candidato.cClassTrib).toBe('200003');
    expect(det.itens[2]?.regras).toEqual([]);
    expect(det.itens[2]?.pendente).toHaveLength(1);
  });

  test('regra que pede código já excluído marca conflito e deixa o item sem candidato', async () => {
    const det = await determinarEm(
      op({ modelo: 65, itens: [{ n: 1, tipo: 'devolucao', referenciado: { cst: '000', cClassTrib: '000002' } }] }),
      content,
      { relogio: clock },
    );
    const item = det.itens[0];
    expect(item?.regras[0]).toMatchObject({ regra: 'devolucao-espelha-original', conflito: true });
    expect(item?.candidatos).toEqual([]);
    expect(item?.decidido).toBeUndefined();
    expect(item?.pendente).toBeUndefined();
    expect(det.completa).toBe(false);
  });

  test('regra fora de vigência não se aplica', async () => {
    const rules = [
      { ...(REGRAS_LEGAIS[1] as (typeof REGRAS_LEGAIS)[number]), vigencia: { inicio: '2030-01-01', fim: null } },
    ];
    const det = await determinarEm(op({ tipo: 'transferencia', itens: [{ n: 1, ncm: RICE }] }), content, {
      relogio: clock,
      regras: rules,
    });
    expect(det.itens[0]?.regras).toEqual([]);
  });
});

describe('determinar: respostas e resolvedores', () => {
  const facts = op({ itens: [{ n: 1, ncm: RICE, descricao: 'arroz' }] });

  test('sem decisão, perguntarAoUsuario pergunta entre os candidatos', async () => {
    const det = await determinar(facts, { dataset, tempo: time });
    const q = det.itens[0]?.pendente?.[0];
    expect(q?.id).toBe(idDaPergunta(1));
    expect(q?.texto).toContain('arroz');
    expect(q?.opcoes.map((o) => o.cClassTrib)).toEqual(det.itens[0]?.candidatos.map((c) => c.cClassTrib) ?? []);
    expect(det.completa).toBe(false);
    expect(det.versaoDoConteudo).toBe(dataset.versaoDoConteudo);
    expect(det.dataDeReferencia).toBe(DATE);
  });

  test('a resposta do usuário decide, com proveniência de usuário', async () => {
    const det = await determinar(facts, { dataset, tempo: time, respostas: { [idDaPergunta(1)]: '200003' } });
    expect(det.itens[0]?.decidido?.candidato).toMatchObject({
      cst: '200',
      cClassTrib: '200003',
      exigeRegular: false,
    });
    expect(det.itens[0]?.decidido?.procedencia).toMatchObject({ por: 'usuario', nome: 'cClassTrib:1' });
    await rejects(
      determinar(facts, { dataset, tempo: time, respostas: { [idDaPergunta(1)]: '200034' } }),
      'resposta_fora_dos_candidatos',
    );
  });

  test('o cadastro do item decide enquanto o código seguir entre os candidatos', async () => {
    const withProfile = op({
      itens: [{ n: 1, ncm: RICE, perfil: { cClassTrib: '200003', decididoPor: 'contadora' } }],
    });
    const det = await determinarEm(withProfile, content, { relogio: clock });
    expect(det.itens[0]?.decidido?.procedencia).toMatchObject({
      por: 'resolvedor',
      nome: 'item-profile',
      confianca: 1,
      evidencia: { decididoPor: 'contadora' },
    });
    const noAuthor = op({ itens: [{ n: 1, ncm: RICE, perfil: { cClassTrib: '200003' } }] });
    expect(
      (await determinarEm(noAuthor, content, { relogio: clock })).itens[0]?.decidido?.procedencia.evidencia,
    ).toEqual({
      decididoPor: null,
    });
    const stale = op({ itens: [{ n: 1, ncm: RICE, perfil: { cClassTrib: '200034' } }] });
    expect((await determinarEm(stale, content, { relogio: clock })).itens[0]?.pendente).toHaveLength(1);
  });

  test('candidatoUnico decide quando sobra um só; perguntarAoUsuario se abstém sem candidato', async () => {
    const single = op({ tpNFDebito: '01' });
    const det = await determinarEm(single, content, { relogio: clock, resolvedores: [candidatoUnico()] });
    expect(det.itens[0]?.decidido?.procedencia.nome).toBe('unique-candidate');
    const none = await determinarEm(facts, content, {
      relogio: clock,
      resolvedores: [candidatoUnico(), perguntarAoUsuario()],
      regras: [],
    });
    expect(none.itens[0]?.pendente).toHaveLength(1);
    const empty = await perguntarAoUsuario().resolver({
      fatos: facts,
      item: { n: 1 },
      candidatos: [],
      conteudo: content,
      respostas: {},
    });
    expect(empty).toEqual({ tipo: 'abster' });
    const abstain = await determinarEm(facts, content, { relogio: clock, resolvedores: [doPerfil()] });
    expect(abstain.itens[0]?.decidido).toBeUndefined();
    expect(abstain.itens[0]?.pendente).toBeUndefined();
  });

  test('resolvedor plugável recebe os candidatos e o sinal; não sai dos candidatos', async () => {
    let seen = 0;
    const ai: Resolvedor = {
      nome: 'ia',
      resolver: async (ctx, signal) => {
        seen = ctx.candidatos.length;
        expect(signal).toBeDefined();
        return { tipo: 'decidido', cClassTrib: '200003', confianca: 0.8, evidencia: { model: 'x' } };
      },
    };
    const controller = new AbortController();
    const det = await determinarEm(facts, content, { relogio: clock, resolvedores: [ai], signal: controller.signal });
    expect(seen).toBeGreaterThan(1);
    expect(det.itens[0]?.decidido?.procedencia).toMatchObject({ por: 'resolvedor', nome: 'ia', confianca: 0.8 });
    const noEvidence: Resolvedor = {
      nome: 'sem-evidencia',
      resolver: async () => ({ tipo: 'decidido', cClassTrib: '200003', confianca: 1 }),
    };
    const plain = await determinarEm(facts, content, { relogio: clock, resolvedores: [noEvidence] });
    expect(plain.itens[0]?.decidido?.procedencia).not.toHaveProperty('evidence');

    const outside: Resolvedor = {
      nome: 'fora',
      resolver: async () => ({ tipo: 'decidido', cClassTrib: '200034', confianca: 1 }),
    };
    await rejects(
      determinarEm(facts, content, { relogio: clock, resolvedores: [outside] }),
      'resolvedor_fora_dos_candidatos',
    );
    const badConfidence: Resolvedor = {
      nome: 'confianca',
      resolver: async () => ({ tipo: 'decidido', cClassTrib: '200003', confianca: 2 }),
    };
    await rejects(
      determinarEm(facts, content, { relogio: clock, resolvedores: [badConfidence] }),
      'resolvedor_invalido',
    );
  });

  test('pergunta com id próprio do resolvedor recebe a resposta em answers[id]', async () => {
    let seenAnswers: Readonly<Record<string, string>> | undefined;
    const review: Resolvedor = {
      nome: 'revisao',
      resolver: async (ctx) => {
        seenAnswers = ctx.respostas;
        return {
          tipo: 'perguntar',
          perguntas: [
            {
              id: `review:${ctx.item.n}`,
              item: ctx.item.n,
              texto: 'confirme',
              opcoes: ctx.candidatos.map((c) => ({ rotulo: c.cClassTrib, cClassTrib: c.cClassTrib })),
            },
          ],
        };
      },
    };
    const pending = await determinarEm(facts, content, { relogio: clock, resolvedores: [review] });
    expect(pending.itens[0]?.pendente?.[0]?.id).toBe('review:1');
    const det = await determinarEm(facts, content, {
      relogio: clock,
      resolvedores: [review],
      respostas: { 'review:1': '200003' },
    });
    expect(seenAnswers).toEqual({ 'review:1': '200003' });
    expect(det.itens[0]?.decidido?.candidato.cClassTrib).toBe('200003');
    expect(det.itens[0]?.decidido?.procedencia).toMatchObject({ por: 'usuario', nome: 'review:1' });
    expect(det.itens[0]?.pendente).toBeUndefined();
    await rejects(
      determinarEm(facts, content, { relogio: clock, resolvedores: [review], respostas: { 'review:1': '200034' } }),
      'resposta_fora_dos_candidatos',
    );
  });

  test('sinal abortado interrompe antes do resolvedor', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelado'));
    const out = await determinarEm(facts, content, { relogio: clock, signal: controller.signal }).catch(
      (e: unknown) => e,
    );
    expect((out as Error).message).toBe('cancelado');
  });
});

describe('paraClassificado', () => {
  test('monta a entrada do motor e calcula', async () => {
    const det = await determinarEm(op({ tipo: 'venda', itens: [{ n: 1, ncm: RICE }] }), content, {
      relogio: clock,
      respostas: { [idDaPergunta(1)]: '000001' },
    });
    const classified = paraClassificado(det, { modelo: 55, local: { uf: 'SP', cMun: '3550308' } }, () => ({
      base: '100.00',
    }));
    expect(classified.itens[0]).toEqual({ n: 1, cst: '000', cClassTrib: '000001', base: '100.00' });
    const roc = calcularEm(classified, { dataset, aliquotas: aliquotasOficiais(), data: DATE });
    expect(roc.itens[0]?.IBSCBS.gIBSCBS?.gCBS.vCBS).toBe('0.90');
  });

  test('falha com item sem decisão', async () => {
    const det = await determinarEm(op({ itens: [{ n: 1, ncm: RICE }] }), content, { relogio: clock });
    fails(
      () => paraClassificado(det, { modelo: 55, local: { uf: 'SP', cMun: '3550308' } }, () => ({ base: '1' })),
      'determinacao_incompleta',
    );
  });
});

describe('fonte da exclusão por NBS', () => {
  test('cita o anexo da LC 214/2025 que não cobre a NBS', () => {
    const c = one(op({ itens: [{ n: 1, nbs: NBS_SERVICE }] }));
    expect(c.exclusoes.find((e) => e.cClassTrib === '200038')?.fonte).toStartWith('Anexo IX da LC 214/2025;');
  });
});
