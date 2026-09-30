/**
 * `criarEmissorMdfe` contra o `@sinete/sefaz-sim` em HTTPS com mTLS, com o PFX sintético de um produtor rural (e-CPF) e
 * os bytes gravados no adaptador em memória. Os cenários são os de transmissão de um integrador em produção (autorizado
 * e sem resposta, a retomada depois de reiniciar guarda com os mesmos bytes; dois cliques) e os do protocolo do MDF-e:
 * encerrado ou cancelado fora, divergente, cancelamento com recuperação.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { RelogioManual } from '@sinete/core';
import { ErroDeValidacao, relogioManual } from '@sinete/core';
import * as da from '@sinete/da/mdfe';
import type { CertificadoSintetico, SefazSim } from '@sinete/sefaz-sim';
import {
  certificadoSintetico,
  criarSefazSim,
  iniciarServidorSefazSim,
  pfxSintetico,
  redirecionarParaSim,
} from '@sinete/sefaz-sim';
import { criarTransporte, ErroTransporte } from '@sinete/transport';
import type { Desfecho, TransmissaoStore } from '../src/index.ts';
import { ErroTransmissaoEmAndamento } from '../src/index.ts';
import type { DesfechoMdfe, EmissorMdfe, EmissorMdfeOpcoes } from '../src/mdfe.ts';
import { criarEmissorMdfe } from '../src/mdfe.ts';
import type { BancoMemoria } from '../src/memoria.ts';
import { criarBancoMemoria, criarMemoriaStore } from '../src/memoria.ts';
import { CPF_EMIT, cargaPropria, EMISSAO } from './helpers/mdfe.ts';

const SENHA = 'senha-sintetica';

let ac: CertificadoSintetico;
let servidor: CertificadoSintetico;
let pfx: Uint8Array;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const clock = relogioManual(EMISSAO);
  ac = await certificadoSintetico({ relogio: clock, papel: 'ac', diasDeValidade: 3650 });
  const produtor = await certificadoSintetico({ relogio: clock, papel: 'titular', cpf: CPF_EMIT, emissor: ac });
  servidor = await certificadoSintetico({ relogio: clock, papel: 'servidor', emissor: ac });
  pfx = pfxSintetico(produtor, SENHA, { cadeia: [ac] });
}, 60_000);

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
});

interface Cenario {
  readonly clock: RelogioManual;
  readonly sim: SefazSim;
  readonly banco: BancoMemoria;
  readonly store: TransmissaoStore;
  readonly emissor: EmissorMdfe;
  readonly guardados: { readonly ref: string; readonly desfecho: Desfecho }[];
  readonly caminhos: string[];
  novoEmissor(): Promise<EmissorMdfe>;
}

async function cenario(extra: Partial<EmissorMdfeOpcoes> = {}, depois?: (caminho: string) => void): Promise<Cenario> {
  const clock = relogioManual(EMISSAO);
  const sim = criarSefazSim({ relogio: clock, uf: 'MT' });
  const server = await iniciarServidorSefazSim(sim, { certificado: servidor.pem, chave: servidor.chavePem });
  const banco = criarBancoMemoria();
  const guardados: Cenario['guardados'] = [];
  const caminhos: string[] = [];
  const emissores: EmissorMdfe[] = [];
  const novoEmissor = async (): Promise<EmissorMdfe> => {
    const e = await criarEmissorMdfe({
      pfx,
      senha: SENHA,
      ambiente: 'homologacao',
      relogio: clock,
      store: criarMemoriaStore({ relogio: clock, banco }),
      aoDecidir: (r, desfecho) => {
        guardados.push({ ref: r.ref, desfecho });
      },
      transporte: ({ politica: _policy, ...o }) => {
        const real = criarTransporte({ ...o, acsAdicionais: [ac.pem] });
        return redirecionarParaSim(
          {
            capacidades: real.capacidades,
            enviar: async (r) => {
              const caminho = new URL(r.url).pathname;
              caminhos.push(caminho);
              const resposta = await real.enviar(r);
              depois?.(caminho);
              return resposta;
            },
            fechar: () => real.fechar(),
          },
          server.urlBase,
        );
      },
      ...extra,
    });
    emissores.push(e);
    return e;
  };
  const emissor = await novoEmissor();
  fechar.push(async () => {
    for (const e of emissores) await e.fechar();
    await server.fechar();
  });
  return {
    clock,
    sim,
    banco,
    store: criarMemoriaStore({ relogio: clock, banco }),
    emissor,
    guardados,
    caminhos,
    novoEmissor,
  };
}

const recepcoes = (c: Cenario): number => c.caminhos.filter((p) => p.endsWith('/MDFeRecepcaoSinc')).length;

function autorizado(d: Desfecho | undefined): Extract<DesfechoMdfe, { tipo: 'autorizado' }> {
  if (d?.tipo !== 'autorizado') throw new Error(`esperava autorizado, veio ${JSON.stringify(d?.tipo)}`);
  return d as Extract<DesfechoMdfe, { tipo: 'autorizado' }>;
}

const encerramento = (d: Extract<DesfechoMdfe, { tipo: 'autorizado' }>) => ({
  chave: d.id,
  nProt: d.protocolo.nProt ?? '',
  uf: 'SP',
  cMun: '3550308',
});

describe('criarEmissorMdfe contra a SEFAZ simulada, HTTPS com mTLS', () => {
  test('emitir guarda com os bytes gravados; consulta, encerramento, DAMDFE e não encerrados pelo emissor', async () => {
    const c = await cenario();
    expect(c.emissor.titular.cpf).toBe(CPF_EMIT);
    const d = autorizado(await c.emissor.emitir('mdfe-1', cargaPropria()));
    expect(c.guardados.map((g) => g.ref)).toEqual(['mdfe-1']);
    expect(d.proc).toContain(c.sim.inspecao.mdfe(d.id)?.xml as string);
    expect(await c.store.ler('mdfe', 'mdfe-1')).toBeUndefined();
    const q = await c.emissor.consultar(d.id);
    expect(q.tipo).toBe('autorizado');
    const abertos = await c.emissor.cliente.consultarNaoEncerrados();
    expect(abertos.tipo === 'autorizado' && abertos.valor.map((m) => m.chMDFe)).toEqual([d.id]);
    c.clock.avancar(3_600_000);
    const enc = await c.emissor.encerrar(encerramento(d));
    expect([enc.tipo, enc.cStat]).toEqual(['registrado', '135']);
    const pdf = await c.emissor.pdf(d.proc);
    expect(pdf).toEqual(da.gerarPdf(da.damdfe(d.proc)));
  });

  test('a SEFAZ autoriza e a rede cai: a retomada, depois de reiniciar, guarda o MDF-e com os mesmos bytes', async () => {
    const c = await cenario();
    c.sim.injetarFalha({ tipo: 'derrubar', fase: 'depois' }, { servico: 'MDFeRecepcaoSinc', vezes: 1 });
    c.sim.injetarFalha({ tipo: 'derrubar', fase: 'antes' }, { servico: 'MDFeConsulta', vezes: Infinity });
    const p = await c.emissor.emitir('mdfe-2', cargaPropria({ nMDF: 2 }));
    expect([p.tipo, p.tipo === 'pendente' && p.motivo]).toEqual(['pendente', 'sem-resposta']);
    const gravado = await c.store.ler('mdfe', 'mdfe-2');
    expect(c.sim.inspecao.mdfe(gravado?.id as string)?.xml).toBe(gravado?.xml as string);
    c.sim.limparFalhas();
    c.clock.avancar(5 * 60_000);
    const depois = await c.novoEmissor();
    const d = autorizado(await depois.emitir('mdfe-2', cargaPropria({ nMDF: 9 })));
    expect(d.id).toBe(gravado?.id as string);
    expect(d.proc).toContain(gravado?.xml as string);
    expect(recepcoes(c)).toBe(1);
    expect(c.guardados.map((g) => g.ref)).toEqual(['mdfe-2']);
    expect(await c.store.ler('mdfe', 'mdfe-2')).toBeUndefined();
  });

  test('dois cliques ao mesmo tempo: um transmite, o outro é recusado', async () => {
    const c = await cenario();
    c.sim.injetarFalha({ tipo: 'atraso', ms: 400 }, { servico: 'MDFeRecepcaoSinc', vezes: 1 });
    const outro = await c.novoEmissor();
    const r = await Promise.allSettled([
      c.emissor.emitir('mdfe-3', cargaPropria({ nMDF: 3 })),
      Bun.sleep(100).then(() => outro.emitir('mdfe-3', cargaPropria({ nMDF: 3 }))),
    ]);
    expect(r[0].status).toBe('fulfilled');
    expect(r[1].status === 'rejected' && r[1].reason).toBeInstanceOf(ErroTransmissaoEmAndamento);
    expect(recepcoes(c)).toBe(1);
  });

  test('não chegou, e envio cancelado depois de sair: a consulta decide', async () => {
    let cancelou = false;
    const c = await cenario({}, (caminho) => {
      if (!caminho.endsWith('/MDFeRecepcaoSinc') || cancelou) return;
      cancelou = true;
      throw new ErroTransporte('cancelado', 'envio cancelado');
    });
    autorizado(await c.emissor.emitir('mdfe-4', cargaPropria({ nMDF: 4 })));
    expect(recepcoes(c)).toBe(1);
    expect(c.caminhos.at(-1)?.endsWith('/MDFeConsulta')).toBe(true);

    const d = await cenario();
    d.sim.injetarFalha({ tipo: 'derrubar', fase: 'antes' }, { servico: 'MDFeRecepcaoSinc', vezes: 1 });
    autorizado(await d.emissor.emitir('mdfe-5', cargaPropria({ nMDF: 5 })));
    expect(recepcoes(d)).toBe(2);
  });

  test('encerrado ou cancelado fora: guarda com situacaoAtual', async () => {
    const c = await cenario();
    c.sim.injetarFalha({ tipo: 'derrubar', fase: 'depois' }, { servico: 'MDFeRecepcaoSinc', vezes: 1 });
    c.sim.injetarFalha({ tipo: 'derrubar', fase: 'antes' }, { servico: 'MDFeConsulta', vezes: 1 });
    expect((await c.emissor.emitir('mdfe-6', cargaPropria({ nMDF: 6 }))).tipo).toBe('pendente');
    const gravado = await c.store.ler('mdfe', 'mdfe-6');
    const noSim = c.sim.inspecao.mdfe(gravado?.id as string);
    c.clock.avancar(3_600_000);
    const enc = await c.emissor.encerrar({
      chave: noSim?.chave as string,
      nProt: noSim?.nProt as string,
      uf: 'SP',
      cMun: '3550308',
    });
    expect(enc.tipo).toBe('registrado');
    const d = autorizado(await c.emissor.retomar('mdfe-6'));
    expect(d.situacaoAtual).toBe('encerrado');
    expect(c.guardados).toHaveLength(1);

    const outro = await cenario();
    outro.sim.injetarFalha({ tipo: 'derrubar', fase: 'depois' }, { servico: 'MDFeRecepcaoSinc', vezes: 1 });
    outro.sim.injetarFalha({ tipo: 'derrubar', fase: 'antes' }, { servico: 'MDFeConsulta', vezes: 1 });
    expect((await outro.emissor.emitir('mdfe-7', cargaPropria({ nMDF: 7 }))).tipo).toBe('pendente');
    const g = await outro.store.ler('mdfe', 'mdfe-7');
    const canc = await outro.emissor.cancelar({ chave: g?.id as string, xJust: 'CANCELAMENTO DE TESTE SINTETICO' });
    expect(canc.tipo === 'registrado' && canc.recuperado).toBe(false);
    expect(autorizado(await outro.emissor.retomar('mdfe-7')).situacaoAtual).toBe('cancelado');
  });

  test('mesma chave com outro conteúdo: divergente, sem reenviar, e os bytes ficam', async () => {
    const c = await cenario();
    const primeiro = autorizado(await c.emissor.emitir('a', cargaPropria({ nMDF: 8, cMDF: '31415926' })));
    const outro = await c.emissor.assinar(
      cargaPropria({ nMDF: 8, cMDF: '31415926', informacoesAdicionais: { infCpl: 'OUTRO CONTEUDO' } }),
    );
    expect(outro.id).toBe(primeiro.id);
    const t = await c.store.travar('mdfe', 'b', 60_000);
    if (t === undefined) throw new Error('sem trava');
    await c.store.gravar(t, { xml: outro.xml, id: outro.id, meta: {} });
    await c.store.soltar(t);
    const d = await c.emissor.retomar('b');
    expect([d?.tipo, d?.tipo === 'divergente' && d.chaveRegistrada]).toEqual(['divergente', outro.id]);
    expect(await c.store.ler('mdfe', 'b')).toBeDefined();
    expect(recepcoes(c)).toBe(1);

    const invalido = await c.emissor.emitir('c', cargaPropria({ nMDF: 9, percurso: [] })).catch((e: unknown) => e);
    expect(invalido).toBeInstanceOf(ErroDeValidacao);
    expect(await c.store.ler('mdfe', 'c')).toBeUndefined();
  });

  test('protocolo sem digVal: a consulta prova e guarda; sem digVal nem na consulta, divergente com os bytes', async () => {
    const c = await cenario();
    c.sim.definirProtocoloSemDigVal('todos', 'autorizacao');
    const d = autorizado(await c.emissor.emitir('mdfe-20', cargaPropria({ nMDF: 20 })));
    expect(d.proc).toContain(c.sim.inspecao.mdfe(d.id)?.xml as string);
    expect(c.caminhos.at(-1)?.endsWith('/MDFeConsulta')).toBe(true);

    // Outro cenário: o MDF-e não encerrado do primeiro barraria o segundo com a mesma placa (611).
    const o = await cenario();
    o.sim.definirProtocoloSemDigVal('todos');
    const sem = await o.emissor.emitir('mdfe-21', cargaPropria({ nMDF: 21 }));
    if (sem.tipo !== 'divergente') throw new Error(`esperava divergente, veio ${sem.tipo}`);
    expect([sem.conteudo, sem.cStat, sem.situacaoAtual]).toEqual(['sem-digval', '100', undefined]);
    expect((await o.store.ler('mdfe', 'mdfe-21'))?.id).toBe(sem.id);
    expect(o.guardados).toHaveLength(0);
    // Com o digVal de volta na consulta, a retomada prova o conteúdo e guarda, sem reenviar.
    o.sim.definirProtocoloSemDigVal(undefined);
    expect(autorizado(await o.emissor.retomar('mdfe-21')).id).toBe(sem.id);
    expect(recepcoes(o)).toBe(1);
  });

  test('cancelamento sem resposta e duplicado: o evento vem da consulta; DAMDFE com a marca', async () => {
    const c = await cenario({ timeoutMs: 400 });
    const d = autorizado(await c.emissor.emitir('mdfe-10', cargaPropria({ nMDF: 10 })));
    c.clock.avancar(60_000);
    c.sim.injetarFalha({ tipo: 'travar', fase: 'depois' }, { servico: 'MDFeRecepcaoEvento' });
    const pedido = { chave: d.id, nProt: d.protocolo.nProt, xJust: 'CANCELAMENTO DE TESTE SINTETICO' };
    const r = await c.emissor.cancelar(pedido);
    if (r.tipo !== 'registrado') throw new Error(`esperava registrado, veio ${r.tipo}`);
    expect([r.recuperado, r.cStat, r.evento.tpEvento]).toEqual([true, '135', '110111']);
    const denovo = await c.emissor.cancelar(pedido);
    expect(denovo.tipo === 'registrado' && [denovo.recuperado, denovo.procEvento]).toEqual([true, r.procEvento]);
    const pdf = await c.emissor.pdfCancelado(d.proc, r.procEvento);
    expect(pdf).toEqual(da.gerarPdf(da.damdfe(d.proc, { cancelado: r.procEvento })));
    const sem = await c.emissor.cancelar({ chave: d.id, xJust: 'CANCELAMENTO DE TESTE SINTETICO' });
    expect(sem.tipo === 'registrado' && sem.recuperado).toBe(true);
  });

  test('encerramento sem resposta e duplicado: o evento vem da consulta, nunca do cStat', async () => {
    const c = await cenario({ timeoutMs: 400 });
    const d = autorizado(await c.emissor.emitir('mdfe-13', cargaPropria({ nMDF: 13 })));
    c.clock.avancar(60_000);
    c.sim.injetarFalha({ tipo: 'travar', fase: 'depois' }, { servico: 'MDFeRecepcaoEvento' });
    const r = await c.emissor.encerrar(encerramento(d));
    if (r.tipo !== 'registrado') throw new Error(`esperava registrado, veio ${r.tipo}`);
    expect([r.recuperado, r.cStat, r.evento.tpEvento]).toEqual([true, '135', '110112']);
    // De novo: a SEFAZ recusa com 631 (duplicidade de evento), e a consulta confirma o mesmo encerramento.
    const denovo = await c.emissor.encerrar(encerramento(d));
    expect(denovo.tipo === 'registrado' && [denovo.recuperado, denovo.procEvento]).toEqual([true, r.procEvento]);
  });

  test('encerramento recusado por evento já registrado em outro município: recusado, com o 631', async () => {
    const c = await cenario();
    const d = autorizado(await c.emissor.emitir('mdfe-14', cargaPropria({ nMDF: 14 })));
    c.clock.avancar(60_000);
    const r = await c.emissor.encerrar(encerramento(d));
    expect([r.tipo, r.tipo === 'registrado' && r.recuperado]).toEqual(['registrado', false]);
    const outro = await c.emissor.encerrar({ ...encerramento(d), cMun: '3509502' });
    expect([outro.tipo, outro.tipo === 'recusado' && outro.cStat]).toEqual(['recusado', '631']);
    // O 631 não decide sozinho: a consulta mostrou o encerramento em outro município.
    expect(outro.tipo === 'recusado' && outro.bruto.tipo === 'autorizado' && 'situacao' in outro.bruto.valor).toBe(
      true,
    );
  });

  test('encerramento sem resposta e sem o evento na consulta: pendente, com o erro do pedido', async () => {
    const c = await cenario({ timeoutMs: 400 });
    const d = autorizado(await c.emissor.emitir('mdfe-15', cargaPropria({ nMDF: 15 })));
    c.sim.injetarFalha({ tipo: 'travar', fase: 'antes' }, { servico: 'MDFeRecepcaoEvento' });
    const r = await c.emissor.encerrar(encerramento(d));
    expect([r.tipo, r.tipo === 'pendente' && r.motivo]).toEqual(['pendente', 'sem-resposta']);
    expect(r.tipo === 'pendente' && r.causa).toBeInstanceOf(Error);
  });

  test('cancelamento: chave que não consta é recusada; sem resposta nenhuma fica pendente', async () => {
    const c = await cenario({ timeoutMs: 400 });
    const inedito = await c.emissor.assinar(cargaPropria({ nMDF: 11 }));
    const nada = await c.emissor.cancelar({ chave: inedito.id, xJust: 'CANCELAMENTO DE TESTE SINTETICO' });
    expect([nada.tipo, nada.tipo === 'recusado' && nada.cStat]).toEqual(['recusado', '217']);
    const d = autorizado(await c.emissor.emitir('mdfe-12', cargaPropria({ nMDF: 12 })));
    c.sim.injetarFalha({ tipo: 'travar', fase: 'antes' }, { servico: 'MDFeRecepcaoEvento' });
    const r = await c.emissor.cancelar({ chave: d.id, nProt: d.protocolo.nProt, xJust: 'CANCELAMENTO DE TESTE' });
    expect([r.tipo, r.tipo === 'pendente' && r.motivo]).toEqual(['pendente', 'sem-resposta']);
    c.sim.injetarFalha({ tipo: 'derrubar', fase: 'antes' }, { servico: 'MDFeConsulta' });
    const semConsulta = await c.emissor.cancelar({ chave: d.id, xJust: 'CANCELAMENTO DE TESTE' });
    expect(semConsulta.tipo).toBe('pendente');
  });
});
