import { describe, expect, test } from 'bun:test';
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import type { TaxContent } from '@sinete/ibs-cbs-dados';
import { loadDataset } from '@sinete/ibs-cbs-dados';
import { BUNDLED_DATASET } from '@sinete/ibs-cbs-dados/bundled';
import { officialRates } from '../../src/aliquotas/index.ts';
import { calculateAt } from '../../src/calcular/index.ts';
import type { DeterminationReason, ItemConstraints, OperationFacts, Resolver } from '../../src/determinar/index.ts';
import {
  ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR,
  askUser,
  constrain,
  constrainAt,
  DeterminationError,
  determine,
  determineAt,
  factDate,
  fromProfile,
  LEGAL_RULES,
  questionId,
  toClassified,
  uniqueCandidate,
} from '../../src/determinar/index.ts';

const dataset = loadDataset(BUNDLED_DATASET);
const DATE = '2026-10-10';
const content: TaxContent = dataset.at(DATE);
const clock = relogioFixo('2026-10-10T15:00:00-03:00');
const time = contextoDeTempo({ emissao: clock });

/** NCM do Anexo I (arroz) e NBS de serviço de construção. */
const RICE = '10063021';
const NBS_SERVICE = '110011100';

function op(partial: Partial<OperationFacts> = {}): OperationFacts {
  return { modelo: 55, kind: 'venda', items: [{ n: 1 }], ...partial };
}

function one(facts: OperationFacts): ItemConstraints {
  return constrainAt(facts, content)[0] as ItemConstraints;
}

function codes(c: ItemConstraints): string[] {
  return c.candidates.map((x) => x.cClassTrib);
}

function reasonOf(c: ItemConstraints, code: string): string | undefined {
  return c.exclusions.find((e) => e.cClassTrib === code)?.reason;
}

function fails(fn: () => unknown, reason: DeterminationReason): void {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DeterminationError);
    expect((e as DeterminationError).reason).toBe(reason);
    expect((e as DeterminationError).code).toBe('ibscbs_determinacao_invalida');
    return;
  }
  throw new Error('esperava DeterminationError');
}

async function rejects(p: Promise<unknown>, reason: DeterminationReason): Promise<void> {
  const e = await p.then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(DeterminationError);
  expect((e as DeterminationError).reason).toBe(reason);
}

describe('constrain: restrições oficiais com o motivo de cada exclusão', () => {
  test('todo cClassTrib do IBS/CBS sai como candidato ou como exclusão, uma vez só', () => {
    const c = one(op({ items: [{ n: 1, ncm: RICE }] }));
    const seen = [...codes(c), ...c.exclusions.map((e) => e.cClassTrib)];
    const all = new Set(dataset.tables.classTrib.filter((x) => x.family === 'CBS_IBS').map((x) => x.code));
    expect(new Set(seen).size).toBe(seen.length);
    expect(new Set(seen)).toEqual(all);
    for (const e of c.exclusions) {
      expect(e.detail.length).toBeGreaterThan(0);
      expect(e.source.length).toBeGreaterThan(0);
    }
  });

  test('vigência: código que existe mas não vale na data', () => {
    const c = one(op());
    const expired = c.exclusions.filter((e) => e.reason === 'vigencia');
    expect(expired.map((e) => e.cClassTrib)).toEqual(['220001', '220002', '220003']);
    expect(expired[0]?.detail).toContain('fora de vigência em 2026-10-10');
  });

  test('DF-e: código não habilitado no modelo', () => {
    expect(reasonOf(one(op({ modelo: 65 })), '000003')).toBe('dfe');
    expect(codes(one(op({ modelo: 55 })))).toContain('000003');
  });

  test('NCM do Anexo I: 200003 fica, 200034 (Anexo VII) sai com o anexo na fonte', () => {
    const c = one(op({ items: [{ n: 1, ncm: RICE }] }));
    expect(codes(c)).toContain('200003');
    expect(codes(c)).toContain('000001');
    const e = c.exclusions.find((x) => x.cClassTrib === '200034');
    expect(e?.reason).toBe('ncm');
    expect(e?.source).toContain('Anexo VII da LC 214/2025');
  });

  test('NCM numa exceção do anexo diz qual exceção', () => {
    const c = one(op({ items: [{ n: 1, ncm: '03061100' }] }));
    const e = c.exclusions.find((x) => x.cClassTrib === '200034');
    expect(e?.reason).toBe('ncm');
    expect(e?.detail).toContain('exceção');
  });

  test('NCM incompleto não exclui pelo anexo', () => {
    expect(codes(one(op({ items: [{ n: 1, ncm: '1006' }] })))).toContain('200034');
  });

  test('nomenclatura: item só com NBS não fica com código que pede NCM, e o contrário', () => {
    const service = one(op({ items: [{ n: 1, nbs: NBS_SERVICE }] }));
    expect(reasonOf(service, '410002')).toBe('nomenclatura');
    expect(reasonOf(service, '200038')).toBe('nbs');
    const goods = one(op({ items: [{ n: 1, ncm: RICE }] }));
    expect(reasonOf(goods, '410027')).toBe('nomenclatura');
  });

  test('atores: vínculo do fornecedor e do adquirente', () => {
    const rural = one(op({ supplier: { actors: [ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR] } }));
    expect(codes(rural)).toContain('410014');
    const regular = one(op({ supplier: { actors: [22] } }));
    expect(reasonOf(regular, '410014')).toBe('atores');
    expect(regular.exclusions.find((e) => e.cClassTrib === '410014')?.detail).toContain('fornecedor');
    const buyer = one(op({ buyer: { actors: [22] } }));
    expect(buyer.exclusions.find((e) => e.cClassTrib === '200002')?.detail).toContain('adquirente');
    expect(codes(one(op({ supplier: { actors: [] } })))).toContain('410014');
  });

  test('tipo de nota: o tipo exige o código e o código exige o tipo (UB14-60/70/80)', () => {
    expect(codes(one(op({ tpNFDebito: '01' })))).toEqual(['800002']);
    expect(one(op({ tpNFDebito: '01' })).exclusions.find((e) => e.cClassTrib === '000001')?.source).toContain(
      'UB14-70',
    );
    expect(codes(one(op({ tpNFCredito: '02' })))).toEqual(['810001']);
    const normal = one(op());
    expect(reasonOf(normal, '800002')).toBe('tipo-de-nota');
    expect(normal.exclusions.find((e) => e.cClassTrib === '800002')?.source).toContain('UB14-60');
    expect(codes(one(op({ tpNFDebito: '05' })))).toContain('800001');
    // Fora da NF-e e da NFC-e a NT não vale.
    expect(one(op({ modelo: 57 })).exclusions.some((e) => e.reason === 'tipo-de-nota')).toBe(false);
  });

  test('constrain lê a data do relógio de fato gerador', () => {
    const early = contextoDeTempo({ emissao: clock, fatoGerador: relogioFixo('2026-01-01T03:00:00Z') });
    expect(factDate(early)).toBe('2026-01-01');
    expect(factDate(time)).toBe(DATE);
    expect(constrain(op(), { dataset, time })).toEqual(constrainAt(op(), content));
  });

  test('fatos inválidos', () => {
    fails(() => constrainAt({ modelo: 55, kind: 'venda' } as unknown as OperationFacts, content), 'fatos_invalidos');
    fails(() => constrainAt(op({ modelo: 5.5 }), content), 'fatos_invalidos');
    fails(() => constrainAt(op({ items: [{ n: 1 }, { n: 1 }] }), content), 'fatos_invalidos');
    fails(() => constrainAt(op({ items: [{ n: 0 }] }), content), 'fatos_invalidos');
    fails(() => constrainAt(op({ items: [{ n: 1, ncm: '1006.30' }] }), content), 'fatos_invalidos');
    fails(() => constrainAt(op({ items: [{ n: 1, nbs: 'x' }] }), content), 'fatos_invalidos');
    fails(() => constrainAt(op({ buyer: { actors: [99999] } }), content), 'fatos_invalidos');
    fails(() => constrainAt(op({ tpNFCredito: '99' }), content), 'fatos_invalidos');
  });
});

describe('regras legais', () => {
  test('cada regra tem fonte, vigência e id único', () => {
    const ids = LEGAL_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of LEGAL_RULES) {
      expect(r.source).toMatch(/^LC 214\/2025, art/);
      expect(r.validity.from).toBe('2026-01-01');
    }
  });

  test('o ator do produtor rural não contribuinte é o da tabela', () => {
    expect(content.actor(ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR)?.description).toBe('Produtor rural não contribuinte');
  });

  const cases: [string, Partial<OperationFacts>, string][] = [
    ['bonificacao-no-documento', { kind: 'bonificacao' }, '410001'],
    ['transferencia-mesmo-contribuinte', { kind: 'transferencia' }, '410002'],
    ['doacao-sem-contraprestacao', { kind: 'doacao' }, '410003'],
    ['exportacao-imune', { kind: 'exportacao' }, '410004'],
    ['produtor-rural-nao-contribuinte', { supplier: { actors: [ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR] } }, '410014'],
  ];
  for (const [rule, facts, code] of cases) {
    test(`${rule} decide ${code} com proveniência de regra`, async () => {
      const det = await determineAt(op({ ...facts, items: [{ n: 1, ncm: RICE }] }), content, { clock });
      const item = det.items[0];
      expect(item?.decided?.candidate.cClassTrib).toBe(code);
      expect(item?.decided?.provenance).toMatchObject({
        by: 'rule',
        name: rule,
        at: '2026-10-10T18:00:00.000Z',
        contentVersion: dataset.contentVersion,
        asOf: DATE,
      });
      expect(item?.decided?.provenance.source).toContain('LC 214/2025');
      expect(item?.exclusions.some((e) => e.reason === 'regra-legal')).toBe(true);
      expect(det.complete).toBe(true);
    });
  }

  test('exportação de serviço fica entre 410004 e 410027 e pergunta', async () => {
    const det = await determineAt(op({ kind: 'exportacao', items: [{ n: 1, nbs: NBS_SERVICE }] }), content, { clock });
    expect(det.items[0]?.candidates.map((c) => c.cClassTrib)).toEqual(['410004', '410027']);
    expect(det.items[0]?.pending?.[0]?.options.map((o) => o.cClassTrib)).toEqual(['410004', '410027']);
    expect(det.complete).toBe(false);
  });

  test('natureza por item sobrepõe a da operação; devolução espelha o original', async () => {
    const det = await determineAt(
      op({
        items: [
          { n: 1, ncm: RICE, kind: 'bonificacao' },
          { n: 2, ncm: RICE, kind: 'devolucao', referenced: { cst: '200', cClassTrib: '200003' } },
          { n: 3, ncm: RICE, kind: 'devolucao' },
        ],
      }),
      content,
      { clock },
    );
    expect(det.items[0]?.decided?.candidate.cClassTrib).toBe('410001');
    expect(det.items[1]?.decided?.provenance.name).toBe('devolucao-espelha-original');
    expect(det.items[1]?.decided?.candidate.cClassTrib).toBe('200003');
    expect(det.items[2]?.rules).toEqual([]);
    expect(det.items[2]?.pending).toHaveLength(1);
  });

  test('regra que pede código já excluído marca conflito e deixa o item sem candidato', async () => {
    const det = await determineAt(
      op({ modelo: 65, items: [{ n: 1, kind: 'devolucao', referenced: { cst: '000', cClassTrib: '000002' } }] }),
      content,
      { clock },
    );
    const item = det.items[0];
    expect(item?.rules[0]).toMatchObject({ rule: 'devolucao-espelha-original', conflict: true });
    expect(item?.candidates).toEqual([]);
    expect(item?.decided).toBeUndefined();
    expect(item?.pending).toBeUndefined();
    expect(det.complete).toBe(false);
  });

  test('regra fora de vigência não se aplica', async () => {
    const rules = [{ ...(LEGAL_RULES[1] as (typeof LEGAL_RULES)[number]), validity: { from: '2030-01-01', to: null } }];
    const det = await determineAt(op({ kind: 'transferencia', items: [{ n: 1, ncm: RICE }] }), content, {
      clock,
      rules,
    });
    expect(det.items[0]?.rules).toEqual([]);
  });
});

describe('determine: respostas e resolvedores', () => {
  const facts = op({ items: [{ n: 1, ncm: RICE, description: 'arroz' }] });

  test('sem decisão, askUser pergunta entre os candidatos', async () => {
    const det = await determine(facts, { dataset, time });
    const q = det.items[0]?.pending?.[0];
    expect(q?.id).toBe(questionId(1));
    expect(q?.text).toContain('arroz');
    expect(q?.options.map((o) => o.cClassTrib)).toEqual(det.items[0]?.candidates.map((c) => c.cClassTrib) ?? []);
    expect(det.complete).toBe(false);
    expect(det.contentVersion).toBe(dataset.contentVersion);
    expect(det.asOf).toBe(DATE);
  });

  test('a resposta do usuário decide, com proveniência de usuário', async () => {
    const det = await determine(facts, { dataset, time, answers: { [questionId(1)]: '200003' } });
    expect(det.items[0]?.decided?.candidate).toMatchObject({
      cst: '200',
      cClassTrib: '200003',
      requiresRegular: false,
    });
    expect(det.items[0]?.decided?.provenance).toMatchObject({ by: 'user', name: 'cClassTrib:1' });
    await rejects(
      determine(facts, { dataset, time, answers: { [questionId(1)]: '200034' } }),
      'resposta_fora_dos_candidatos',
    );
  });

  test('o cadastro do item decide enquanto o código seguir entre os candidatos', async () => {
    const withProfile = op({ items: [{ n: 1, ncm: RICE, profile: { cClassTrib: '200003', decidedBy: 'contadora' } }] });
    const det = await determineAt(withProfile, content, { clock });
    expect(det.items[0]?.decided?.provenance).toMatchObject({
      by: 'resolver',
      name: 'item-profile',
      confidence: 1,
      evidence: { decidedBy: 'contadora' },
    });
    const noAuthor = op({ items: [{ n: 1, ncm: RICE, profile: { cClassTrib: '200003' } }] });
    expect((await determineAt(noAuthor, content, { clock })).items[0]?.decided?.provenance.evidence).toEqual({
      decidedBy: null,
    });
    const stale = op({ items: [{ n: 1, ncm: RICE, profile: { cClassTrib: '200034' } }] });
    expect((await determineAt(stale, content, { clock })).items[0]?.pending).toHaveLength(1);
  });

  test('uniqueCandidate decide quando sobra um só; askUser se abstém sem candidato', async () => {
    const single = op({ tpNFDebito: '01' });
    const det = await determineAt(single, content, { clock, resolvers: [uniqueCandidate()] });
    expect(det.items[0]?.decided?.provenance.name).toBe('unique-candidate');
    const none = await determineAt(facts, content, { clock, resolvers: [uniqueCandidate(), askUser()], rules: [] });
    expect(none.items[0]?.pending).toHaveLength(1);
    const empty = await askUser().resolve({ facts, item: { n: 1 }, candidates: [], content, answers: {} });
    expect(empty).toEqual({ kind: 'abstain' });
    const abstain = await determineAt(facts, content, { clock, resolvers: [fromProfile()] });
    expect(abstain.items[0]?.decided).toBeUndefined();
    expect(abstain.items[0]?.pending).toBeUndefined();
  });

  test('resolvedor plugável recebe os candidatos e o sinal; não sai dos candidatos', async () => {
    let seen = 0;
    const ai: Resolver = {
      name: 'ia',
      resolve: async (ctx, signal) => {
        seen = ctx.candidates.length;
        expect(signal).toBeDefined();
        return { kind: 'decided', cClassTrib: '200003', confidence: 0.8, evidence: { model: 'x' } };
      },
    };
    const controller = new AbortController();
    const det = await determineAt(facts, content, { clock, resolvers: [ai], signal: controller.signal });
    expect(seen).toBeGreaterThan(1);
    expect(det.items[0]?.decided?.provenance).toMatchObject({ by: 'resolver', name: 'ia', confidence: 0.8 });
    const noEvidence: Resolver = {
      name: 'sem-evidencia',
      resolve: async () => ({ kind: 'decided', cClassTrib: '200003', confidence: 1 }),
    };
    const plain = await determineAt(facts, content, { clock, resolvers: [noEvidence] });
    expect(plain.items[0]?.decided?.provenance).not.toHaveProperty('evidence');

    const outside: Resolver = {
      name: 'fora',
      resolve: async () => ({ kind: 'decided', cClassTrib: '200034', confidence: 1 }),
    };
    await rejects(determineAt(facts, content, { clock, resolvers: [outside] }), 'resolvedor_fora_dos_candidatos');
    const badConfidence: Resolver = {
      name: 'confianca',
      resolve: async () => ({ kind: 'decided', cClassTrib: '200003', confidence: 2 }),
    };
    await rejects(determineAt(facts, content, { clock, resolvers: [badConfidence] }), 'resolvedor_invalido');
  });

  test('pergunta com id próprio do resolvedor recebe a resposta em answers[id]', async () => {
    let seenAnswers: Readonly<Record<string, string>> | undefined;
    const review: Resolver = {
      name: 'revisao',
      resolve: async (ctx) => {
        seenAnswers = ctx.answers;
        return {
          kind: 'ask',
          questions: [
            {
              id: `review:${ctx.item.n}`,
              item: ctx.item.n,
              text: 'confirme',
              options: ctx.candidates.map((c) => ({ label: c.cClassTrib, cClassTrib: c.cClassTrib })),
            },
          ],
        };
      },
    };
    const pending = await determineAt(facts, content, { clock, resolvers: [review] });
    expect(pending.items[0]?.pending?.[0]?.id).toBe('review:1');
    const det = await determineAt(facts, content, { clock, resolvers: [review], answers: { 'review:1': '200003' } });
    expect(seenAnswers).toEqual({ 'review:1': '200003' });
    expect(det.items[0]?.decided?.candidate.cClassTrib).toBe('200003');
    expect(det.items[0]?.decided?.provenance).toMatchObject({ by: 'user', name: 'review:1' });
    expect(det.items[0]?.pending).toBeUndefined();
    await rejects(
      determineAt(facts, content, { clock, resolvers: [review], answers: { 'review:1': '200034' } }),
      'resposta_fora_dos_candidatos',
    );
  });

  test('sinal abortado interrompe antes do resolvedor', async () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelado'));
    const out = await determineAt(facts, content, { clock, signal: controller.signal }).catch((e: unknown) => e);
    expect((out as Error).message).toBe('cancelado');
  });
});

describe('toClassified', () => {
  test('monta a entrada do motor e calcula', async () => {
    const det = await determineAt(op({ kind: 'venda', items: [{ n: 1, ncm: RICE }] }), content, {
      clock,
      answers: { [questionId(1)]: '000001' },
    });
    const classified = toClassified(det, { modelo: 55, place: { uf: 'SP', cMun: '3550308' } }, () => ({
      base: '100.00',
    }));
    expect(classified.items[0]).toEqual({ n: 1, cst: '000', cClassTrib: '000001', base: '100.00' });
    const roc = calculateAt(classified, { dataset, rates: officialRates(), date: DATE });
    expect(roc.items[0]?.IBSCBS.gIBSCBS?.gCBS.vCBS).toBe('0.90');
  });

  test('falha com item sem decisão', async () => {
    const det = await determineAt(op({ items: [{ n: 1, ncm: RICE }] }), content, { clock });
    fails(
      () => toClassified(det, { modelo: 55, place: { uf: 'SP', cMun: '3550308' } }, () => ({ base: '1' })),
      'determinacao_incompleta',
    );
  });
});

describe('fonte da exclusão por NBS', () => {
  test('cita o anexo da LC 214/2025 que não cobre a NBS', () => {
    const c = one(op({ items: [{ n: 1, nbs: NBS_SERVICE }] }));
    expect(c.exclusions.find((e) => e.cClassTrib === '200038')?.source).toStartWith('Anexo IX da LC 214/2025;');
  });
});
