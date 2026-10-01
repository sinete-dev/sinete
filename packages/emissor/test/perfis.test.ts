/**
 * Os caminhos dos perfis que o simulador não produz sozinho, com clientes de mentira: o reenvio que volta de novo
 * como duplicidade ou sem resposta (não há um terceiro envio), o protocolo sem digVal, a consulta indecisa e os erros
 * que não são de rede (sobem como estão). Os bytes são assinados de verdade, pelo `assinar` de cada emissor.
 */
import { beforeAll, describe, expect, test } from 'bun:test';
import {
  contextoDeTempo,
  ErroDeConfiguracao,
  ErroDeTempoEsgotado,
  ehErroSinete,
  relogioFixo,
  relogioManual,
} from '@sinete/core';
import type { ClienteMdfe } from '@sinete/mdfe';
import type { ClienteNfe } from '@sinete/nfe';
import type { ClienteNfse } from '@sinete/nfse';
import { certificadoSintetico, pfxSintetico } from '@sinete/sefaz-sim';
import { ErroTransporte } from '@sinete/transport';
import type { Desfecho, DocumentoAssinado, EmissorOpcoes } from '../src/index.ts';
import { criarEmissorMdfe, perfilMdfe } from '../src/mdfe.ts';
import { criarMemoriaStore } from '../src/memoria.ts';
import { criarEmissorNfe, perfilNfe } from '../src/nfe.ts';
import { criarEmissorNfse, perfilNfse } from '../src/nfse.ts';
import { CPF_EMIT, cargaPropria } from './helpers/mdfe.ts';
import { dps, gerarCerts } from './helpers/nfse.ts';
import { CNPJ_DEST, CNPJ_EMIT, EMISSAO, nota } from './helpers/nota.ts';

const SENHA = 'senha-sintetica';
/** A NF-e (modelo 55) sempre leva o endereço do destinatário (MOC 7.0 Anexo I, RV E05-10). */
const DESTINATARIO = {
  CNPJ: CNPJ_DEST,
  xNome: 'DESTINATARIO SINTETICO LTDA',
  indIEDest: '9',
  endereco: { xLgr: 'RUA B', nro: '2', xBairro: 'CENTRO', cMun: '3550308', xMun: 'SAO PAULO', UF: 'SP' },
} as const;
let nfe: DocumentoAssinado;
let mdfe: DocumentoAssinado;
let nfse: DocumentoAssinado;
let emissorNfe: Awaited<ReturnType<typeof criarEmissorNfe>>;
let pfxNfe: Uint8Array;
let emissorMdfe: Awaited<ReturnType<typeof criarEmissorMdfe>>;

const comum = (pfx: Uint8Array): EmissorOpcoes => ({
  pfx,
  senha: SENHA,
  ambiente: 'homologacao',
  relogio: relogioManual(EMISSAO),
  store: criarMemoriaStore(),
  aoDecidir: () => {},
});

beforeAll(async () => {
  const clock = relogioManual(EMISSAO);
  const ac = await certificadoSintetico({ relogio: clock, papel: 'ac', diasDeValidade: 3650 });
  const emitente = await certificadoSintetico({ relogio: clock, papel: 'titular', cnpj: CNPJ_EMIT, emissor: ac });
  const produtor = await certificadoSintetico({ relogio: clock, papel: 'titular', cpf: CPF_EMIT, emissor: ac });
  const c = await gerarCerts();
  pfxNfe = pfxSintetico(emitente, SENHA, { cadeia: [ac] });
  const eNfe = await criarEmissorNfe(comum(pfxNfe));
  emissorNfe = eNfe;
  nfe = await eNfe.assinar(nota({ nNF: 1, destinatario: DESTINATARIO }));
  const eMdfe = await criarEmissorMdfe({
    ...comum(pfxSintetico(produtor, SENHA, { cadeia: [ac] })),
    relogio: relogioManual('2026-09-26T10:00:00-04:00'),
  });
  mdfe = await eMdfe.assinar(cargaPropria());
  emissorMdfe = eMdfe;
  const eNfse = await criarEmissorNfse({
    ...comum(pfxSintetico(c.prestador, SENHA, { cadeia: [c.ac] })),
    relogio: relogioManual('2026-09-25T10:00:00-03:00'),
  });
  nfse = await eNfse.assinar(dps());
}, 60_000);

const naoConsta = { tipo: 'recusado', cStat: '217', xMotivo: 'Rejeição: NF-e não consta na base de dados da SEFAZ' };
const duplicidade = { tipo: 'recusado', cStat: '204', xMotivo: 'Rejeição: Duplicidade de NF-e' };
const timeout = (): ErroDeTempoEsgotado => new ErroDeTempoEsgotado('sem resposta', 400);

/** Cliente de mentira: cada método devolve (ou lança) o próximo da fila. */
function cliente<C>(filas: Record<string, unknown[]>): C {
  const c: Record<string, () => Promise<unknown>> = {};
  for (const [nome, fila] of Object.entries(filas)) {
    c[nome] = async () => {
      const r = fila.shift();
      if (r instanceof Error) throw r;
      return r;
    };
  }
  return c as C;
}

const tipo = (d: Desfecho): string => (d.tipo === 'pendente' ? `pendente/${d.motivo}` : d.tipo);

describe('perfil da NF-e', () => {
  const enviar = (c: Partial<Record<string, unknown[]>>, modo: 'primeiro' | 'retomada' = 'primeiro') =>
    perfilNfe().enviar(cliente<ClienteNfe>(c as Record<string, unknown[]>), nfe.xml, modo);

  test('reenvio que volta 204 de novo: recusado com o 204, e os bytes ficam (indefinido)', async () => {
    const d = await enviar({ autorizar: [duplicidade, duplicidade], consultar: [naoConsta, naoConsta] });
    expect([tipo(d), d.tipo === 'recusado' && d.cStat]).toEqual(['recusado', '204']);
    expect(perfilNfe().indefinido('204')).toBe(true);
  });

  test('reenvio sem resposta: pendente com o erro do envio', async () => {
    const e = timeout();
    const d = await enviar({ autorizar: [timeout(), e], consultar: [naoConsta, naoConsta] });
    expect([tipo(d), d.tipo === 'pendente' && d.causa]).toEqual(['pendente/sem-resposta', e]);
  });

  test('protocolo sem digVal: a consulta decide; se a nota não consta depois do reenvio, pendente', async () => {
    const semDigVal = { tipo: 'autorizado', cStat: '100', xMotivo: 'Autorizado', valor: { chNFe: nfe.id } };
    const d = await enviar({ autorizar: [semDigVal], consultar: [naoConsta] });
    expect([tipo(d), d.tipo === 'pendente' && d.xMotivo]).toEqual([
      'pendente/consulta-indefinida',
      'a NF-e não consta depois do reenvio',
    ]);
  });

  test('autorização pendente sem recibo e consulta pendente: pendentes com o motivo certo', async () => {
    const lote = { tipo: 'pendente', cStat: '105', xMotivo: 'Lote em processamento' };
    expect(tipo(await enviar({ autorizar: [lote] }))).toBe('pendente/lote-em-processamento');
    const d = await enviar({ consultar: [lote] }, 'retomada');
    expect([tipo(d), d.tipo === 'pendente' && d.cStat]).toEqual(['pendente/consulta-indefinida', '105']);
  });

  test('204 que a consulta não decide: a pendência leva a recusa anterior', async () => {
    const lote = { tipo: 'pendente', cStat: '105', xMotivo: 'Lote em processamento' };
    const indecisa = await enviar({ autorizar: [duplicidade], consultar: [lote] });
    expect(indecisa).toMatchObject({
      tipo: 'pendente',
      motivo: 'consulta-indefinida',
      cStat: '105',
      anterior: { cStat: '204', xMotivo: duplicidade.xMotivo },
    });
    const semResposta = await enviar({ autorizar: [duplicidade], consultar: [timeout()] });
    expect(semResposta).toMatchObject({ tipo: 'pendente', motivo: 'sem-resposta', anterior: { cStat: '204' } });
    // Sem recusa antes, sem `anterior`.
    const d = await enviar({ consultar: [lote] }, 'retomada');
    expect(d.tipo === 'pendente' && d.anterior).toBeUndefined();
  });

  test('a montagem da nota vale sobre a do emissor (a data de emissão fixada pelo integrador)', async () => {
    const emissao = new Date('2026-09-27T08:30:00-03:00');
    const a = await emissorNfe.assinar({
      nfe: nota({ nNF: 2, destinatario: DESTINATARIO }),
      montagem: { tempo: contextoDeTempo({ emissao: relogioFixo(emissao) }) },
    });
    expect(a.xml).toContain('<dhEmi>2026-09-27T08:30:00-03:00</dhEmi>');
    expect(nfe.xml).not.toContain('<dhEmi>2026-09-27T08:30:00-03:00</dhEmi>');
  });

  test('erro que não é de rede sobe como está, no envio e na consulta', async () => {
    await expect(enviar({ autorizar: [new ErroDeConfiguracao('uf')] })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(enviar({ consultar: [new ErroDeConfiguracao('x')] }, 'retomada')).rejects.toBeInstanceOf(
      ErroDeConfiguracao,
    );
  });
});

describe('perfil do MDF-e', () => {
  const enviar = (c: Partial<Record<string, unknown[]>>, modo: 'primeiro' | 'retomada' = 'primeiro') =>
    perfilMdfe().enviar(cliente<ClienteMdfe>(c as Record<string, unknown[]>), mdfe.xml, modo);

  test('recusa comum, duplicidade no reenvio e reenvio sem resposta', async () => {
    const recusa = { tipo: 'recusado', cStat: '611', xMotivo: 'Rejeição: existe MDF-e não encerrado' };
    expect([tipo(await enviar({ autorizar: [recusa] }))]).toEqual(['recusado']);
    const dup = await enviar({ autorizar: [duplicidade, duplicidade], consultar: [naoConsta, naoConsta] });
    expect([tipo(dup), dup.tipo === 'recusado' && dup.cStat]).toEqual(['recusado', '204']);
    const semResposta = await enviar({ autorizar: [timeout(), timeout()], consultar: [naoConsta, naoConsta] });
    expect(tipo(semResposta)).toBe('pendente/sem-resposta');
  });

  test('protocolo sem digVal, pendência na recepção e consulta indecisa', async () => {
    const semDigVal = { tipo: 'autorizado', cStat: '100', xMotivo: 'Autorizado', valor: { chMDFe: mdfe.id } };
    expect(tipo(await enviar({ autorizar: [semDigVal], consultar: [naoConsta] }))).toBe('pendente/consulta-indefinida');
    const lote = { tipo: 'pendente', cStat: '105', xMotivo: 'Lote em processamento' };
    expect(tipo(await enviar({ autorizar: [lote] }))).toBe('pendente/lote-em-processamento');
    const paralisado = { tipo: 'recusado', cStat: '108', xMotivo: 'Serviço paralisado momentaneamente' };
    expect(tipo(await enviar({ consultar: [paralisado] }, 'retomada'))).toBe('pendente/consulta-indefinida');
    expect(tipo(await enviar({ consultar: [timeout()] }, 'retomada'))).toBe('pendente/sem-resposta');
  });

  test('duplicidade que a consulta não decide: a pendência leva a recusa anterior; a montagem do manifesto vale', async () => {
    const paralisado = { tipo: 'recusado', cStat: '108', xMotivo: 'Serviço paralisado momentaneamente' };
    const d = await enviar({ autorizar: [duplicidade], consultar: [paralisado] });
    expect(d).toMatchObject({ tipo: 'pendente', motivo: 'consulta-indefinida', anterior: { cStat: '204' } });
    const emissao = new Date('2026-09-26T08:15:00-04:00');
    const a = await emissorMdfe.assinar({
      mdfe: cargaPropria(),
      montagem: { tempo: contextoDeTempo({ emissao: relogioFixo(emissao) }) },
    });
    expect(a.xml).toContain('<dhEmi>2026-09-26T08:15:00-04:00</dhEmi>');
  });

  test('erro que não é de rede sobe como está', async () => {
    await expect(enviar({ autorizar: [new ErroDeConfiguracao('tpAmb')] })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    await expect(enviar({ consultar: [new ErroDeConfiguracao('x')] }, 'retomada')).rejects.toBeInstanceOf(
      ErroDeConfiguracao,
    );
  });
});

describe('perfil da NFS-e', () => {
  const enviar = (c: Partial<Record<string, unknown[]>>, modo: 'primeiro' | 'retomada' = 'primeiro') =>
    perfilNfse().enviar(
      { ...cliente<ClienteNfse>(c as Record<string, unknown[]>), ambiente: 'homologacao' } as ClienteNfse,
      nfse.xml,
      modo,
    );
  const e0014 = { tipo: 'recusado', cStat: 'E0014', xMotivo: 'DPS já gerou NFS-e', erros: [], statusHttp: 400 };

  test('recusa comum; duplicidade no reenvio; reenvio sem resposta', async () => {
    const recusa = { tipo: 'recusado', cStat: 'E0312', xMotivo: 'x', erros: [], statusHttp: 400 };
    expect(tipo(await enviar({ autorizar: [recusa] }))).toBe('recusado');
    const cli = { consultarDps: [undefined, undefined] };
    // E0014 e a consulta não acha a DPS: o resolvedor não decide (reenviar voltaria E0014), e os bytes ficam.
    const autorizar = [e0014, e0014];
    const dup = await enviar({ autorizar, consultarDps: [undefined] });
    expect([tipo(dup), dup.tipo === 'pendente' && dup.anterior?.cStat]).toEqual([
      'pendente/consulta-indefinida',
      'E0014',
    ]);
    expect(autorizar).toHaveLength(1);
    expect(tipo(await enviar({ autorizar: [timeout(), timeout()], ...cli }))).toBe('pendente/sem-resposta');
    expect(tipo(await enviar({ consultarDps: [timeout()] }, 'retomada'))).toBe('pendente/sem-resposta');
    await expect(enviar({ autorizar: [new ErroDeConfiguracao('x')] })).rejects.toBeInstanceOf(ErroDeConfiguracao);
  });

  test('DPS que consta sem a NFS-e: pendente com a consulta indefinida, sem exceção', async () => {
    const d = await enviar(
      { consultarDps: [{ idDps: 'DPS1', chaveAcesso: 'CHAVE' }], consultar: [undefined] },
      'retomada',
    );
    expect([tipo(d), d.tipo === 'pendente' && d.xMotivo]).toEqual([
      'pendente/consulta-indefinida',
      'a DPS consta como processada, mas a NFS-e não foi encontrada',
    ]);
  });

  test('DPS sem Id é erro de configuração', async () => {
    await expect(perfilNfse().enviar(cliente<ClienteNfse>({}), '<DPS/>', 'retomada')).rejects.toBeInstanceOf(
      ErroDeConfiguracao,
    );
  });
});

describe('recusa do serviço, que não entra na barreira da recusa repetida', () => {
  test('cada perfil marca como transitórios os códigos da tabela do documento', () => {
    expect(['108', '109', '999', '203'].map((c) => perfilNfe().transitorio?.(c))).toEqual([true, true, true, false]);
    expect(['108', '109', '611'].map((c) => perfilMdfe().transitorio?.(c))).toEqual([true, true, false]);
    expect(perfilNfse().transitorio?.('E0014')).toBe(false);
    // Recusa que se corrige no que muda a cada montagem: a barreira compara os bytes dela.
    expect(['228', '297', '978', '464', '203'].map((c) => perfilNfe().recusaPorCampoVolatil?.(c))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(['212', '611'].map((c) => perfilMdfe().recusaPorCampoVolatil?.(c))).toEqual([true, false]);
    expect(['E0008', 'E0014'].map((c) => perfilNfse().recusaPorCampoVolatil?.(c))).toEqual([true, false]);
    const dps = (dh: string) => `<DPS><infDPS Id="DPS1"><dhEmi>${dh}</dhEmi></infDPS><Signature>x</Signature></DPS>`;
    expect(perfilNfse().conteudoParaRecusa?.(dps('a'))).toBe(perfilNfse().conteudoParaRecusa?.(dps('b')));
    expect(perfilMdfe().conteudoParaRecusa?.('<MDFe><dhEmi>a</dhEmi></MDFe>')).toBe('<MDFe></MDFe>');
    expect(perfilNfe().conteudoParaRecusa?.('<NFe><dhEmi>a</dhEmi></NFe>')).toBe('<NFe></NFe>');
  });
});

describe('signal nos perfis: depois do abort, nenhuma chamada nova', () => {
  /** Cliente que guarda o `signal` de cada chamada e aborta `ctrl` na primeira, lançando o que o transporte lança. */
  function abortaNaPrimeira<C>(ctrl: AbortController, chamadas: string[]): C {
    const registrar =
      (nome: string) =>
      async (...args: unknown[]): Promise<never> => {
        const o = args.at(-1) as { signal?: AbortSignal } | undefined;
        chamadas.push(`${nome}:${o?.signal === ctrl.signal ? 'signal' : 'sem'}`);
        ctrl.abort();
        throw new ErroTransporte('cancelado', 'envio cancelado');
      };
    return new Proxy({ ambiente: 'homologacao' } as Record<string, unknown>, {
      get: (t, nome: string) => (nome in t ? t[nome] : registrar(nome)),
    }) as C;
  }

  test('NF-e, MDF-e e NFS-e: abort no envio vira pendente sem-resposta, sem consulta nem reenvio', async () => {
    const casos = [
      [
        'nfe',
        (c: unknown, env: { signal: AbortSignal }) => perfilNfe().enviar(c as ClienteNfe, nfe.xml, 'primeiro', env),
      ],
      [
        'mdfe',
        (c: unknown, env: { signal: AbortSignal }) => perfilMdfe().enviar(c as ClienteMdfe, mdfe.xml, 'primeiro', env),
      ],
      [
        'nfse',
        (c: unknown, env: { signal: AbortSignal }) => perfilNfse().enviar(c as ClienteNfse, nfse.xml, 'primeiro', env),
      ],
    ] as const;
    for (const [doc, enviar] of casos) {
      const ctrl = new AbortController();
      const chamadas: string[] = [];
      const d = await enviar(abortaNaPrimeira(ctrl, chamadas), { signal: ctrl.signal });
      expect({ doc, tipo: tipo(d), chamadas }).toEqual({
        doc,
        tipo: 'pendente/sem-resposta',
        chamadas: ['autorizar:signal'],
      });
      expect(d.tipo === 'pendente' && ehErroSinete(d.causa, 'cancelado')).toBe(true);
    }
  });

  test('NF-e: abort na espera do recibo (a espera rejeita com o reason do sinal) vira o cancelado', async () => {
    const ctrl = new AbortController();
    const lote = { tipo: 'pendente', cStat: '103', xMotivo: 'Lote recebido', referencia: '123' };
    const c = {
      autorizar: async () => lote,
      aguardarRecibo: async (_n: string, _x: string, o: { signal?: AbortSignal }) => {
        expect(o.signal).toBe(ctrl.signal);
        ctrl.abort();
        throw ctrl.signal.reason;
      },
      consultar: async () => {
        throw new Error('não devia consultar depois do abort');
      },
    } as unknown as ClienteNfe;
    const d = await perfilNfe().enviar(c, nfe.xml, 'primeiro', { signal: ctrl.signal });
    expect(tipo(d)).toBe('pendente/sem-resposta');
    expect(d.tipo === 'pendente' && ehErroSinete(d.causa, 'cancelado')).toBe(true);
  });

  test('timeout no envio e abort na consulta de recuperação: a causa é o cancelado, não o timeout', async () => {
    const casos = [
      [
        'nfe',
        (c: unknown, env: { signal: AbortSignal }) => perfilNfe().enviar(c as ClienteNfe, nfe.xml, 'primeiro', env),
      ],
      [
        'mdfe',
        (c: unknown, env: { signal: AbortSignal }) => perfilMdfe().enviar(c as ClienteMdfe, mdfe.xml, 'primeiro', env),
      ],
      [
        'nfse',
        (c: unknown, env: { signal: AbortSignal }) => perfilNfse().enviar(c as ClienteNfse, nfse.xml, 'primeiro', env),
      ],
    ] as const;
    for (const [doc, enviar] of casos) {
      const ctrl = new AbortController();
      const aborta = async (): Promise<never> => {
        ctrl.abort();
        throw new ErroTransporte('cancelado', 'envio cancelado');
      };
      const c = {
        ambiente: 'homologacao',
        autorizar: async () => {
          throw timeout();
        },
        consultar: aborta,
        consultarDps: aborta,
      };
      const d = await enviar(c, { signal: ctrl.signal });
      expect({ doc, tipo: tipo(d) }).toEqual({ doc, tipo: 'pendente/sem-resposta' });
      expect({ doc, cancelado: d.tipo === 'pendente' && ehErroSinete(d.causa, 'cancelado') }).toEqual({
        doc,
        cancelado: true,
      });
    }
  });

  test('retomada com o sinal: a consulta recebe o signal', async () => {
    const ctrl = new AbortController();
    const chamadas: string[] = [];
    const d = await perfilNfe().enviar(abortaNaPrimeira(ctrl, chamadas), nfe.xml, 'retomada', { signal: ctrl.signal });
    expect([tipo(d), chamadas]).toEqual(['pendente/sem-resposta', ['consultar:signal']]);
  });
});

describe('signal nos eventos do emissor', () => {
  test('abortado antes do pedido: cancelar, cartaCorrecao e encerrar lançam cancelado sem ir à rede', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const env = { signal: ctrl.signal };
    const chave = '3'.repeat(44);
    const erros = await Promise.all([
      emissorNfe.cancelar({ chave, nProt: '1', xJust: 'justificativa sintetica' }, env).catch((e: unknown) => e),
      emissorNfe
        .cartaCorrecao({ chave, xCorrecao: 'correcao sintetica do texto', nSeqEvento: 1 }, env)
        .catch((e: unknown) => e),
      emissorMdfe.cancelar({ chave, nProt: '1', xJust: 'justificativa sintetica' }, env).catch((e: unknown) => e),
      emissorMdfe.encerrar({ chave, nProt: '1', uf: 'SP', cMun: '3550308' }, env).catch((e: unknown) => e),
    ]);
    expect(erros.map((e) => ehErroSinete(e, 'cancelado'))).toEqual([true, true, true, true]);
  });
});

describe('signal na recuperação de evento', () => {
  test('timeout no pedido e abort na consulta de recuperação: pendente com o cancelado como causa', async () => {
    const ctrl = new AbortController();
    let n = 0;
    const e = await criarEmissorNfe({
      ...comum(pfxNfe),
      transporte: (padrao) => ({
        capacidades: { ...(padrao as unknown as { capacidades?: object }).capacidades } as never,
        async enviar() {
          n++;
          if (n === 1) throw timeout();
          ctrl.abort();
          throw new ErroTransporte('cancelado', 'envio cancelado');
        },
        fechar: async () => {},
      }),
    });
    const chave = nfe.id;
    const d = await e.cancelar(
      { chave, nProt: '135260000000001', xJust: 'justificativa sintetica' },
      { signal: ctrl.signal },
    );
    expect(d.tipo).toBe('pendente');
    expect(d.tipo === 'pendente' && ehErroSinete(d.causa, 'cancelado')).toBe(true);
    expect(n).toBe(2);
  });
});
