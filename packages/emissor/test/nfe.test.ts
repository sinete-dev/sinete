/**
 * `createNfeEmissor` contra o `@sinete/sefaz-sim` em HTTPS com mTLS, com os bytes gravados no adaptador em memória. Os
 * cenários são os de transmissão e retomada de um integrador em produção, que são a especificação: a SEFAZ
 * autoriza e a rede cai (a retomada, depois de um "reinício", guarda a nota com os mesmos bytes, sem montar de novo);
 * não chegou (217, os mesmos bytes vão de novo); 204 e 539; recibo 103; divergente; cancelada fora; retomada em SVC
 * pela chave; dois cliques e o job concorrendo; rejeição que descarta; cancelamento com 573 ou 580.
 *
 * O "reinício" é um emissor novo sobre o mesmo `BancoMemoria`: nada em memória, só o que o store gravou. Nada é
 * certificado real: AC, e-CNPJ e servidor são gerados na hora.
 */

import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { RelogioManual } from '@sinete/core';
import {
  contextoDeTempo,
  ErroDeConfiguracao,
  ErroDeValidacao,
  ehErroSinete,
  relogioFixo,
  relogioManual,
} from '@sinete/core';
import * as da from '@sinete/da/nfe';
import type { NfeInput } from '@sinete/nfe';
import type { Contribuinte, SefazSim, SefazSimOptions, SyntheticCertificate } from '@sinete/sefaz-sim';
import {
  createSefazSim,
  redirectToSim,
  startSefazSimServer,
  syntheticCertificate,
  syntheticPfx,
} from '@sinete/sefaz-sim';
import type { CriarTransporteOpcoes } from '@sinete/transport';
import { criarTransporte, ErroPolitica, ErroTransporte } from '@sinete/transport';
import { conteudoNfe } from '../src/conteudo.ts';
import type { Desfecho, RegistroTransmissao, TransmissaoStore } from '../src/index.ts';
import {
  createPoolDeEmissores,
  RecusaRepetidaError,
  retomarPendentes,
  TransmissaoEmAndamentoError,
} from '../src/index.ts';
import type { BancoMemoria } from '../src/memoria.ts';
import { createBancoMemoria, createMemoriaStore } from '../src/memoria.ts';
import type { DesfechoNfe, NfeEmissor, NfeEmissorOptions } from '../src/nfe.ts';
import { createNfeEmissor, perfilNfe } from '../src/nfe.ts';
import { CNPJ_DEST, CNPJ_EMIT, EMISSAO, IE_SP, nota } from './helpers/nota.ts';

const SENHA = 'senha-sintetica';

let ac: SyntheticCertificate;
let servidor: SyntheticCertificate;
let pfx: Uint8Array;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const clock = relogioManual(EMISSAO);
  ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
  const emitente = await syntheticCertificate({ clock, role: 'titular', cnpj: CNPJ_EMIT, issuer: ac });
  servidor = await syntheticCertificate({ clock, role: 'servidor', issuer: ac });
  pfx = syntheticPfx(emitente, SENHA, { chain: [ac] });
}, 60_000);

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
});

const DEST: NonNullable<NfeInput['destinatario']> = {
  CNPJ: CNPJ_DEST,
  xNome: 'DESTINATARIO SINTETICO LTDA',
  indIEDest: '9',
  endereco: { xLgr: 'AVENIDA FICTICIA', nro: '1', xBairro: 'BAIRRO', cMun: '3550308', xMun: 'SAO PAULO', UF: 'SP' },
};

const n = (nNF: number, extra: Partial<NfeInput> = {}): NfeInput => nota({ nNF, destinatario: DEST, ...extra });

interface Cenario {
  readonly clock: RelogioManual;
  readonly sim: SefazSim;
  readonly banco: BancoMemoria;
  readonly store: TransmissaoStore;
  readonly emissor: NfeEmissor;
  /** Documentos guardados pelo `aoDecidir`, por ref, na ordem. */
  readonly guardados: { readonly ref: string; readonly desfecho: Desfecho }[];
  /** Para cada gravação: o simulador já conhecia a chave? */
  readonly conhecidaAoGravar: boolean[];
  /** Caminhos pedidos ao simulador, na ordem. */
  readonly caminhos: string[];
  readonly padrao: () => CriarTransporteOpcoes;
  /** "Reinício": emissor novo sobre o mesmo banco, sem nada em memória. */
  novoEmissor(extra?: Partial<NfeEmissorOptions>): Promise<NfeEmissor>;
}

interface OpcoesCenario {
  /** Roda depois de cada resposta do simulador; lançar aqui simula a falha depois do envio. */
  readonly depois?: (caminho: string) => void;
  readonly sim?: Pick<SefazSimOptions, 'respostaSincrona' | 'atrasoProcessamentoMs' | 'cadastro'>;
  /** A espera do recibo avança o relógio injetado em vez de dormir. */
  readonly esperaAvancaRelogio?: boolean;
}

async function cenario(extra: Partial<NfeEmissorOptions> = {}, opcoes: OpcoesCenario = {}): Promise<Cenario> {
  const clock = relogioManual(EMISSAO);
  const sim = createSefazSim({
    clock,
    uf: 'SP',
    cadastro: [{ UF: 'SP', IE: IE_SP, CNPJ: CNPJ_EMIT, xNome: 'EMPRESA SINTETICA LTDA' }],
    ...opcoes.sim,
  });
  const server = await startSefazSimServer(sim, { cert: servidor.pem, key: servidor.keyPem });
  const banco = createBancoMemoria();
  const guardados: Cenario['guardados'] = [];
  const conhecidaAoGravar: boolean[] = [];
  const caminhos: string[] = [];
  let padrao: CriarTransporteOpcoes | undefined;
  const emissores: NfeEmissor[] = [];

  const storeDoProcesso = (): TransmissaoStore => {
    const s = createMemoriaStore({ clock, banco });
    return {
      ...s,
      async gravar(t, g) {
        conhecidaAoGravar.push(sim.inspect.nfe(g.id) !== undefined);
        return s.gravar(t, g);
      },
    };
  };

  const novoEmissor = async (mais: Partial<NfeEmissorOptions> = {}): Promise<NfeEmissor> => {
    const e = await createNfeEmissor({
      pfx,
      senha: SENHA,
      uf: 'SP',
      ambiente: 'homologacao',
      clock,
      store: storeDoProcesso(),
      aoDecidir: (r: RegistroTransmissao, desfecho) => {
        guardados.push({ ref: r.ref, desfecho });
      },
      ...(opcoes.esperaAvancaRelogio === true
        ? {
            cliente: {
              sleep: async (ms: number): Promise<void> => {
                clock.avancar(ms);
              },
            },
          }
        : {}),
      transporte: (o) => {
        padrao = o;
        // A política padrão é a allowlist dos hosts reais; o simulador em 127.0.0.1 fica fora dela.
        const { politica: _policy, ...semPolitica } = o;
        const real = criarTransporte({ ...semPolitica, acsAdicionais: [ac.pem] });
        return redirectToSim(
          {
            capacidades: real.capacidades,
            enviar: async (r) => {
              const caminho = new URL(r.url).pathname;
              caminhos.push(caminho);
              const resposta = await real.enviar(r);
              opcoes.depois?.(caminho);
              return resposta;
            },
            fechar: () => real.fechar(),
          },
          server.baseUrl,
        );
      },
      ...extra,
      ...mais,
    });
    emissores.push(e);
    return e;
  };

  const emissor = await novoEmissor();
  fechar.push(async () => {
    for (const e of emissores) await e.fechar();
    await server.close();
  });
  return {
    clock,
    sim,
    banco,
    store: createMemoriaStore({ clock, banco }),
    emissor,
    guardados,
    conhecidaAoGravar,
    caminhos,
    padrao: () => {
      if (padrao === undefined) throw new Error('transporte ainda não criado');
      return padrao;
    },
    novoEmissor,
  };
}

const autorizacoes = (c: Cenario): number => c.caminhos.filter((p) => p.endsWith('/NFeAutorizacao4')).length;
const noSim = (c: Cenario, nNF: number) => c.sim.inspect.nfes().filter((x) => x.nNF === String(nNF));

function autorizado(d: Desfecho | undefined): Extract<DesfechoNfe, { tipo: 'autorizado' }> {
  if (d?.tipo !== 'autorizado') throw new Error(`esperava autorizado, veio ${JSON.stringify(d?.tipo)}`);
  return d as Extract<DesfechoNfe, { tipo: 'autorizado' }>;
}

describe('createNfeEmissor contra a SEFAZ simulada, HTTPS com mTLS', () => {
  test('emitir grava antes do envio, guarda pelo aoDecidir e conclui; consulta, CC-e, cancelamento e PDF', async () => {
    const c = await cenario();
    expect(c.emissor.titular.cnpj).toBe(CNPJ_EMIT);
    const d = autorizado(await c.emissor.emitir('nota-1', n(1), { meta: { pedido: 'P-1' } }));
    expect([d.documento, d.cStat, d.situacaoAtual]).toEqual(['nfe', '100', undefined]);
    // Gravado antes do envio: o simulador ainda não conhecia a chave.
    expect(c.conhecidaAoGravar).toEqual([false]);
    expect(c.guardados).toHaveLength(1);
    expect(c.guardados[0]?.ref).toBe('nota-1');
    expect(d.proc).toBe(d.protocolo.nfeProc as string);
    expect(noSim(c, 1)[0]?.xml).toBeDefined();
    expect(d.proc).toContain(noSim(c, 1)[0]?.xml as string);
    expect(await c.store.ler('nfe', 'nota-1')).toBeUndefined();
    expect(autorizacoes(c)).toBe(1);

    // O transporte padrão vem do certificado, com a allowlist do ambiente e o tpAmb do corpo.
    const o = c.padrao();
    expect(o.identidade.tipo).toBe('pem');
    const politica = o.politica;
    if (politica === undefined) throw new Error('sem política');
    const pedido = (url: string, body: string) =>
      politica.conferir({ url: new URL(url), metodo: 'POST', corpo: body, endpoint: undefined });
    expect(() => pedido('https://127.0.0.1/ws', '<tpAmb>2</tpAmb>')).toThrow(ErroPolitica);
    expect(() => pedido('https://homologacao.nfe.fazenda.sp.gov.br/ws', '<tpAmb>1</tpAmb>')).toThrow(ErroPolitica);
    expect(() => pedido('https://homologacao.nfe.fazenda.sp.gov.br/ws', '<tpAmb>2</tpAmb>')).not.toThrow();

    const chave = d.id;
    const consulta = await c.emissor.consultar(chave);
    expect(consulta.tipo).toBe('autorizado');
    c.clock.avancar(60_000);
    const cce = await c.emissor.cartaCorrecao({ chave, xCorrecao: 'CORRECAO DE TESTE', nSeqEvento: 1 });
    expect([cce.tipo, cce.cStat]).toEqual(['autorizado', '135']);
    const canc = await c.emissor.cancelar({
      chave,
      nProt: d.protocolo.nProt,
      xJust: 'CANCELAMENTO DE TESTE SINTETICO',
    });
    if (canc.tipo !== 'registrado') throw new Error(`esperava registrado, veio ${canc.tipo}`);
    expect([canc.cStat, canc.recuperado, canc.evento.tpEvento]).toEqual(['135', false, '110111']);
    expect(canc.procEvento).toStartWith('<procEventoNFe');

    const pdf = await c.emissor.pdf(d.proc, { formato: 'paisagem' });
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
    const cancelado = await c.emissor.pdfCancelado(d.proc, canc.procEvento);
    expect(new TextDecoder().decode(cancelado.subarray(0, 5))).toBe('%PDF-');
    expect(cancelado).toEqual(da.toPdf(da.danfe(d.proc, { cancelamento: canc.procEvento })));
    expect(cancelado).not.toEqual(pdf);
    expect((await c.emissor.cliente.statusServico()).tipo).toBe('autorizado');
  });

  test('a SEFAZ autoriza e a rede cai: a retomada, depois de reiniciar, guarda a nota com os mesmos bytes', async () => {
    const c = await cenario();
    // A autorização é processada e a resposta se perde; a consulta de recuperação também não chega.
    c.sim.injectFault({ kind: 'drop', phase: 'after' }, { servico: 'NFeAutorizacao', times: 1 });
    c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NfeConsultaProtocolo', times: Infinity });
    const d = await c.emissor.emitir('nota-2', n(2));
    if (d.tipo !== 'pendente') throw new Error(`esperava pendente, veio ${d.tipo}`);
    expect(d.motivo).toBe('sem-resposta');
    expect(d.causa).toBeInstanceOf(ErroTransporte);
    // Na SEFAZ: autorizada. No integrador: nada guardado, com os bytes gravados.
    const naSefaz = noSim(c, 2);
    expect(naSefaz).toHaveLength(1);
    const gravado = await c.store.ler('nfe', 'nota-2');
    expect(gravado?.id).toBe(naSefaz[0]?.chave as string);
    expect(gravado?.xml).toBe(naSefaz[0]?.xml as string);
    expect(c.guardados).toHaveLength(0);

    // "Reinício": emissor novo, rede de volta, relógio adiantado. A nota "editada" pede outro número: vale o gravado.
    c.sim.clearFaults();
    c.clock.avancar(10 * 60_000);
    const depois = await c.novoEmissor();
    const r = autorizado(await depois.emitir('nota-2', n(9)));
    expect(r.id).toBe(gravado?.id as string);
    expect(r.proc).toContain(gravado?.xml as string);
    expect(noSim(c, 2)).toHaveLength(1);
    expect(noSim(c, 9)).toHaveLength(0);
    expect(autorizacoes(c)).toBe(1);
    expect(c.guardados.map((g) => g.ref)).toEqual(['nota-2']);
    expect(await c.store.ler('nfe', 'nota-2')).toBeUndefined();
  });

  test('não chegou: a consulta diz 217 e os mesmos bytes vão de novo', async () => {
    const c = await cenario();
    c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NFeAutorizacao', times: 1 });
    const r = autorizado(await c.emissor.emitir('nota-3', n(3)));
    expect(c.caminhos).toEqual(['/uf/ws/NFeAutorizacao4', '/uf/ws/NFeConsultaProtocolo4', '/uf/ws/NFeAutorizacao4']);
    expect(noSim(c, 3)).toHaveLength(1);
    expect(r.proc).toContain(noSim(c, 3)[0]?.xml as string);
  });

  test('envio cancelado depois de sair: conta como sem resposta e a consulta conclui', async () => {
    let cancelou = false;
    const c = await cenario(
      {},
      {
        depois: (caminho) => {
          if (!caminho.endsWith('/NFeAutorizacao4') || cancelou) return;
          cancelou = true;
          throw new ErroTransporte('cancelado', 'envio cancelado');
        },
      },
    );
    autorizado(await c.emissor.emitir('nota-4', n(4)));
    expect(cancelou).toBe(true);
    expect(autorizacoes(c)).toBe(1);
    expect(c.caminhos.at(-1)).toBe('/uf/ws/NFeConsultaProtocolo4');
  });

  test('lote recebido (103): espera o recibo; recibo que não sai de pendente mantém os bytes com o nRec', async () => {
    const c = await cenario(
      {},
      { sim: { respostaSincrona: 'assincrona', atrasoProcessamentoMs: 3000 }, esperaAvancaRelogio: true },
    );
    autorizado(await c.emissor.emitir('nota-5', n(5)));
    expect(c.caminhos.filter((p) => p.endsWith('/NFeRetAutorizacao4')).length).toBeGreaterThan(0);

    const lento = await cenario(
      { recibo: { maxTentativas: 2, esperaMinimaMs: 0 } },
      { sim: { respostaSincrona: 'assincrona', atrasoProcessamentoMs: 60_000 }, esperaAvancaRelogio: true },
    );
    const d = await lento.emissor.emitir('nota-6', n(6));
    if (d.tipo !== 'pendente') throw new Error(`esperava pendente, veio ${d.tipo}`);
    expect([d.motivo, d.cStat]).toEqual(['lote-em-processamento', '105']);
    expect(d.nRec).toMatch(/^[0-9]{15}$/);
    expect(await lento.store.ler('nfe', 'nota-6')).toBeDefined();
    // Com o lote processado, a retomada consulta a chave e guarda.
    lento.clock.avancar(60_000);
    await lento.sim.settle();
    autorizado(await lento.emissor.retomar('nota-6'));
    expect(await lento.store.ler('nfe', 'nota-6')).toBeUndefined();
  });

  test('não chegou e o reenvio cai em lote: o reenvio também espera o recibo', async () => {
    const c = await cenario({}, { sim: { respostaSincrona: 'assincrona' }, esperaAvancaRelogio: true });
    c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NFeAutorizacao', times: 1 });
    autorizado(await c.emissor.emitir('nota-7', n(7)));
    expect(c.caminhos).toEqual([
      '/uf/ws/NFeAutorizacao4',
      '/uf/ws/NFeConsultaProtocolo4',
      '/uf/ws/NFeAutorizacao4',
      '/uf/ws/NFeRetAutorizacao4',
    ]);
  });

  test('204 no envio: a consulta da chave conclui com os bytes que a SEFAZ já tem', async () => {
    const c = await cenario();
    const a = await c.emissor.assinar(n(8));
    expect((await c.emissor.cliente.autorizar(a.xml)).tipo).toBe('autorizado');
    const d = autorizado(await perfilNfe().enviar(c.emissor.cliente, a.xml, 'primeiro'));
    expect(d.proc).toContain(a.xml);
    expect(c.caminhos.slice(-2)).toEqual(['/uf/ws/NFeAutorizacao4', '/uf/ws/NFeConsultaProtocolo4']);
  });

  test('outra nota no número (539): divergente com a chave registrada, e os bytes ficam', async () => {
    const c = await cenario();
    const primeira = autorizado(await c.emissor.emitir('a', n(10, { cNF: '31415926' })));
    const d = await c.emissor.emitir('b', n(10, { cNF: '27182818' }));
    if (d.tipo !== 'divergente') throw new Error(`esperava divergente, veio ${d.tipo}`);
    expect([d.cStat, d.chaveRegistrada]).toEqual(['539', primeira.id]);
    expect(await c.store.ler('nfe', 'b')).toBeDefined();
    expect(c.guardados.map((g) => g.ref)).toEqual(['a']);
  });

  test('retomada dos bytes de uma nota cujo número já tem outra chave (562): divergente, sem reenviar', async () => {
    const c = await cenario();
    const primeira = autorizado(await c.emissor.emitir('a', n(13, { cNF: '31415926' })));
    expect((await c.emissor.emitir('b', n(13, { cNF: '27182818' }))).tipo).toBe('divergente');
    const d = await c.emissor.retomar('b');
    if (d?.tipo !== 'divergente') throw new Error(`esperava divergente, veio ${d?.tipo}`);
    expect([d.cStat, d.chaveRegistrada]).toEqual(['562', primeira.id]);
    expect(await c.store.ler('nfe', 'b')).toBeDefined();
    expect(noSim(c, 13)).toHaveLength(1);
  });

  test('mesma chave com outro conteúdo: a retomada não reenvia e mantém os bytes', async () => {
    const c = await cenario();
    // A que a SEFAZ tem (montada antes, como um caminho que remontava) e a que o integrador gravou, com outro conteúdo.
    const naSefaz = await c.emissor.assinar(n(11, { cNF: '31415926' }));
    expect((await c.emissor.cliente.autorizar(naSefaz.xml)).tipo).toBe('autorizado');
    const t = await c.store.travar('nfe', 'local', 60_000);
    if (t === undefined) throw new Error('sem trava');
    const local = await c.emissor.assinar(n(11, { cNF: '31415926', natOp: 'OUTRA NATUREZA' }));
    expect(local.id).toBe(naSefaz.id);
    await c.store.gravar(t, { xml: local.xml, id: local.id, meta: {} });
    await c.store.soltar(t);
    const d = await c.emissor.retomar('local');
    if (d?.tipo !== 'divergente') throw new Error(`esperava divergente, veio ${d?.tipo}`);
    expect([d.cStat, d.chaveRegistrada]).toEqual([undefined, local.id]);
    expect(await c.store.ler('nfe', 'local')).toBeDefined();
    expect(autorizacoes(c)).toBe(1);
  });

  test('primeiro envio sem resposta e outra NF-e na chave: divergente, não erro de rede', async () => {
    const c = await cenario();
    const naSefaz = await c.emissor.assinar(n(12, { cNF: '31415926' }));
    expect((await c.emissor.cliente.autorizar(naSefaz.xml)).tipo).toBe('autorizado');
    c.sim.injectFault({ kind: 'drop', phase: 'after' }, { servico: 'NFeAutorizacao', times: 1 });
    const d = await c.emissor.emitir('local', n(12, { cNF: '31415926', natOp: 'OUTRA NATUREZA' }));
    expect(d.tipo).toBe('divergente');
    expect(noSim(c, 12)).toHaveLength(1);
    expect(await c.store.ler('nfe', 'local')).toBeDefined();
  });

  test('cancelada fora antes da retomada: guarda com situacaoAtual cancelado, nunca como nota ativa', async () => {
    const c = await cenario();
    c.sim.injectFault({ kind: 'drop', phase: 'after' }, { servico: 'NFeAutorizacao', times: 1 });
    c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NfeConsultaProtocolo', times: 1 });
    expect((await c.emissor.emitir('nota-13', n(13))).tipo).toBe('pendente');
    const naSefaz = noSim(c, 13)[0];
    if (naSefaz === undefined) throw new Error('não autorizou');
    c.clock.avancar(60_000);
    const canc = await c.emissor.cliente.cancelar({
      chave: naSefaz.chave,
      nProt: naSefaz.nProt as string,
      xJust: 'CANCELAMENTO FORA DO FLUXO DE TESTE',
    });
    expect(canc.tipo).toBe('autorizado');
    const d = autorizado(await c.emissor.retomar('nota-13'));
    expect([d.cStat, d.situacaoAtual]).toEqual(['100', 'cancelado']);
    expect(d.proc).toContain(naSefaz.xml);
    expect(c.guardados).toHaveLength(1);
    expect(await c.store.ler('nfe', 'nota-13')).toBeUndefined();
  });

  test('a retomada vai ao autorizador da chave (SVC), depois de reiniciar, sem opção de contingência', async () => {
    const c = await cenario();
    c.sim.setContingencia('SVC-AN');
    const contingencia = { tpEmis: '6', dhCont: c.clock.agora(), xJust: 'SEFAZ DA UF FORA DO AR NO TESTE' } as const;
    c.sim.injectFault({ kind: 'drop', phase: 'after' }, { servico: 'NFeAutorizacao', times: 1 });
    c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NfeConsultaProtocolo', times: 1 });
    expect((await c.emissor.emitir('nota-14', n(14, { contingencia }))).tipo).toBe('pendente');
    // A UF segue fora do ar (108): só o autorizador da chave responde.
    const depois = await c.novoEmissor();
    const d = autorizado(await depois.retomar('nota-14'));
    expect(d.id.charAt(34)).toBe('6');
    expect(c.caminhos.at(-1)).toBe('/svc/ws/NFeConsultaProtocolo4');
    expect(c.caminhos.filter((p) => p.startsWith('/uf/'))).toEqual([]);
  });

  test('rejeição da SEFAZ descarta os bytes; a próxima monta de novo e autoriza', async () => {
    const c = await cenario();
    c.sim.setParalisacao('108');
    const d = await c.emissor.emitir('nota-15', n(15));
    expect([d.tipo, d.tipo === 'recusado' && d.cStat]).toEqual(['recusado', '108']);
    expect(await c.store.ler('nfe', 'nota-15')).toBeUndefined();
    c.sim.setParalisacao(undefined);
    autorizado(await c.emissor.emitir('nota-15', n(15)));
    expect(c.conhecidaAoGravar).toEqual([false, false]);
  });

  test('dois cliques ao mesmo tempo: um transmite, o outro é recusado sem tocar a SEFAZ', async () => {
    const c = await cenario();
    c.sim.injectFault({ kind: 'delay', ms: 400 }, { servico: 'NFeAutorizacao', times: 1 });
    const outro = await c.novoEmissor();
    const r = await Promise.allSettled([
      c.emissor.emitir('nota-16', n(16)),
      Bun.sleep(100).then(() => outro.emitir('nota-16', n(16))),
    ]);
    expect(r[0].status).toBe('fulfilled');
    expect(r[1].status === 'rejected' && r[1].reason).toBeInstanceOf(TransmissaoEmAndamentoError);
    expect(noSim(c, 16)).toHaveLength(1);
    expect(autorizacoes(c)).toBe(1);
  });

  describe('retomada automática (o job pelo mesmo caminho do clique)', () => {
    /** Sem resposta: a SEFAZ autoriza e a resposta e a consulta se perdem. A gravação fica parada há 10 minutos. */
    async function semResposta(c: Cenario, ref: string, nNF: number): Promise<void> {
      c.sim.injectFault({ kind: 'drop', phase: 'after' }, { servico: 'NFeAutorizacao', times: 1 });
      c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NfeConsultaProtocolo', times: 1 });
      expect((await c.emissor.emitir(ref, n(nNF))).tipo).toBe('pendente');
      c.sim.clearFaults();
      c.clock.avancar(10 * 60_000);
    }

    test('guarda sozinho a nota que a SEFAZ autorizou e cuja resposta se perdeu, pelo pool', async () => {
      const c = await cenario();
      await semResposta(c, 'nota-17', 17);
      const pool = createPoolDeEmissores({ clock: c.clock, criar: () => c.novoEmissor() });
      const r = await retomarPendentes({
        store: c.store,
        clock: c.clock,
        usarEmissor: (_r, fn) => pool.usar({ pfx, senha: SENHA }, fn),
        aoAlertar: () => {
          throw new Error('não devia alertar');
        },
      });
      await pool.fechar();
      expect(r.desfechos).toEqual({ resolvida: 1 });
      expect(c.guardados.map((g) => g.ref)).toEqual(['nota-17']);
      expect(noSim(c, 17)).toHaveLength(1);
      expect(await c.store.ler('nfe', 'nota-17')).toBeUndefined();
    });

    test('o job e o clique ao mesmo tempo: um guarda, o outro é recusado sem tocar a SEFAZ', async () => {
      const c = await cenario();
      await semResposta(c, 'nota-18', 18);
      c.sim.injectFault({ kind: 'delay', ms: 400 }, { servico: 'NfeConsultaProtocolo', times: 1 });
      const clique = await c.novoEmissor();
      const antes = c.caminhos.length;
      const [job, usuario] = await Promise.allSettled([
        retomarPendentes({
          store: c.store,
          clock: c.clock,
          usarEmissor: (_r, fn) => fn(c.emissor),
          aoAlertar: () => {},
        }),
        Bun.sleep(100).then(() => clique.emitir('nota-18', n(18))),
      ]);
      expect(job.status === 'fulfilled' && job.value.desfechos).toEqual({ resolvida: 1 });
      expect(usuario.status === 'rejected' && usuario.reason).toBeInstanceOf(TransmissaoEmAndamentoError);
      expect(c.caminhos.length - antes).toBe(1);
      expect(c.guardados.map((g) => g.ref)).toEqual(['nota-18']);
    });

    test('o clique primeiro: o job não pega a nota com a trava em vigor', async () => {
      const c = await cenario();
      await semResposta(c, 'nota-19', 19);
      c.sim.injectFault({ kind: 'delay', ms: 400 }, { servico: 'NfeConsultaProtocolo', times: 1 });
      const clique = c.emissor.emitir('nota-19', n(19));
      await Bun.sleep(100);
      const r = await retomarPendentes({
        store: c.store,
        clock: c.clock,
        usarEmissor: (_r, fn) => fn(c.emissor),
        aoAlertar: () => {},
      });
      autorizado(await clique);
      expect(r.candidatas).toBe(0);
      expect(noSim(c, 19)).toHaveLength(1);
    });

    test('divergente alerta na primeira tentativa e mantém os bytes', async () => {
      const c = await cenario();
      // A SEFAZ tem a chave com outro conteúdo; o integrador gravou a versão local.
      const naSefaz = await c.emissor.assinar(n(20, { cNF: '31415926' }));
      expect((await c.emissor.cliente.autorizar(naSefaz.xml)).tipo).toBe('autorizado');
      c.sim.injectFault({ kind: 'drop', phase: 'after' }, { servico: 'NFeAutorizacao', times: 1 });
      c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NfeConsultaProtocolo', times: 1 });
      const local = await c.emissor.emitir('b', n(20, { cNF: '31415926', natOp: 'OUTRA NATUREZA' }));
      expect(local.tipo).toBe('pendente');
      c.clock.avancar(10 * 60_000);
      const alertas: Desfecho[] = [];
      const r = await retomarPendentes({
        store: c.store,
        clock: c.clock,
        usarEmissor: (_r, fn) => fn(c.emissor),
        aoAlertar: (_r, ultimo) => {
          alertas.push(ultimo as Desfecho);
        },
      });
      expect(r).toEqual({ candidatas: 1, desfechos: { 'sem-desfecho': 1 }, alertas: 1, adiadas: 0 });
      expect(alertas[0]?.tipo).toBe('divergente');
      expect((await c.store.ler('nfe', 'b'))?.tentativas).toBe(1);
    });
  });

  describe('protocolo sem digVal (o digVal é opcional no protNFe)', () => {
    const IRREGULAR: Contribuinte[] = [
      { UF: 'SP', IE: IE_SP, CNPJ: CNPJ_EMIT, xNome: 'EMPRESA SINTETICA LTDA', situacao: 'irregular' },
    ];

    function denegado(d: Desfecho | undefined): Extract<DesfechoNfe, { tipo: 'denegado' }> {
      if (d?.tipo !== 'denegado') throw new Error(`esperava denegado, veio ${JSON.stringify(d?.tipo)}`);
      return d as Extract<DesfechoNfe, { tipo: 'denegado' }>;
    }

    test('denegada na resposta: definitiva e guardada, com ou sem digVal, sem consultar', async () => {
      const c = await cenario({}, { sim: { cadastro: IRREGULAR } });
      const com = denegado(await c.emissor.emitir('nota-30', n(30)));
      expect([com.cStat, com.conteudo]).toEqual(['301', 'confere']);
      expect(com.proc).toBe(com.protocolo.nfeProc as string);
      expect(com.proc).toContain(com.xml);

      c.sim.setProtocoloSemDigVal('denegacao');
      const antes = c.caminhos.length;
      const sem = denegado(await c.emissor.emitir('nota-31', n(31)));
      expect([sem.cStat, sem.conteudo, sem.proc]).toEqual(['301', 'sem-digval', undefined]);
      expect(sem.protocolo.digVal).toBeUndefined();
      expect(sem.protocolo.protNFe).toContain('<cStat>301</cStat>');
      expect(sem.protocolo.nProt).toMatch(/^[0-9]{15}$/);
      // Os bytes do desfecho são os gravados, e o simulador registrou a denegação com eles.
      expect(sem.xml).toBe(noSim(c, 31)[0]?.xml as string);
      expect(c.caminhos.slice(antes)).toEqual(['/uf/ws/NFeAutorizacao4']);
      expect(c.guardados.map((g) => [g.ref, g.desfecho.tipo])).toEqual([
        ['nota-30', 'denegado'],
        ['nota-31', 'denegado'],
      ]);
      expect(await c.store.ler('nfe', 'nota-31')).toBeUndefined();
    });

    test('denegada, resposta perdida e consulta sem digVal: a retomada conclui, sem repetir para sempre', async () => {
      const c = await cenario({}, { sim: { cadastro: IRREGULAR } });
      c.sim.setProtocoloSemDigVal('denegacao');
      c.sim.injectFault({ kind: 'drop', phase: 'after' }, { servico: 'NFeAutorizacao', times: 1 });
      c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NfeConsultaProtocolo', times: 1 });
      expect((await c.emissor.emitir('nota-32', n(32))).tipo).toBe('pendente');
      c.clock.avancar(10 * 60_000);
      const r = await retomarPendentes({
        store: c.store,
        clock: c.clock,
        usarEmissor: (_r, fn) => fn(c.emissor),
        aoAlertar: () => {
          throw new Error('não devia alertar');
        },
      });
      expect(r.desfechos).toEqual({ resolvida: 1 });
      const d = denegado(c.guardados[0]?.desfecho);
      expect([d.conteudo, d.proc, d.cStat]).toEqual(['sem-digval', undefined, '301']);
      expect(await c.store.ler('nfe', 'nota-32')).toBeUndefined();
      expect(autorizacoes(c)).toBe(1);
    });

    test('a chave denegada com outro conteúdo: denegado com conteudo difere, e o número sai como denegado', async () => {
      const c = await cenario({}, { sim: { cadastro: IRREGULAR } });
      const naSefaz = await c.emissor.assinar(n(33, { cNF: '27182818' }));
      expect((await c.emissor.cliente.autorizar(naSefaz.xml)).tipo).toBe('denegado');
      c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NFeAutorizacao', times: 1 });
      const d = denegado(await c.emissor.emitir('nota-33', n(33, { cNF: '27182818', natOp: 'OUTRA NATUREZA' })));
      expect([d.conteudo, d.proc]).toEqual(['difere', undefined]);
      expect(d.xml).not.toBe(naSefaz.xml);
      expect(d.protocolo.digVal).toBe(noSim(c, 33)[0]?.digVal as string);
      expect(c.guardados.map((g) => g.ref)).toEqual(['nota-33']);
    });

    test('autorizada sem digVal na resposta e com digVal na consulta: a consulta prova e guarda', async () => {
      const c = await cenario();
      c.sim.setProtocoloSemDigVal('todos', 'autorizacao');
      const d = autorizado(await c.emissor.emitir('nota-34', n(34)));
      expect(d.proc).toContain(noSim(c, 34)[0]?.xml as string);
      expect(c.caminhos).toEqual(['/uf/ws/NFeAutorizacao4', '/uf/ws/NFeConsultaProtocolo4']);
    });

    test('autorizada sem digVal nem na consulta: divergente sem-digval, bytes mantidos, alerta na primeira retomada', async () => {
      const c = await cenario();
      c.sim.setProtocoloSemDigVal('todos');
      const d = await c.emissor.emitir('nota-35', n(35));
      if (d.tipo !== 'divergente') throw new Error(`esperava divergente, veio ${d.tipo}`);
      expect([d.conteudo, d.cStat, d.chaveRegistrada]).toEqual(['sem-digval', '100', undefined]);
      expect(c.guardados).toHaveLength(0);
      expect((await c.store.ler('nfe', 'nota-35'))?.xml).toBe(noSim(c, 35)[0]?.xml as string);
      expect(autorizacoes(c)).toBe(1);

      c.clock.avancar(10 * 60_000);
      const alertas: Desfecho[] = [];
      const job = () =>
        retomarPendentes({
          store: c.store,
          clock: c.clock,
          usarEmissor: (_r, fn) => fn(c.emissor),
          aoAlertar: (_r, ultimo) => {
            alertas.push(ultimo as Desfecho);
          },
        });
      expect((await job()).alertas).toBe(1);
      expect(alertas[0]).toMatchObject({ tipo: 'divergente', conteudo: 'sem-digval' });
      // Se a SEFAZ passa a mandar o digVal, a próxima tentativa prova o conteúdo e guarda.
      c.sim.setProtocoloSemDigVal(undefined);
      c.clock.avancar(2 * 60 * 60_000);
      expect((await job()).desfechos).toEqual({ resolvida: 1 });
      expect(autorizado(c.guardados[0]?.desfecho).id).toBe(d.id);
      expect(autorizacoes(c)).toBe(1);
    });
  });

  describe('cancelamento com recuperação', () => {
    test('sem resposta e depois 573 ou 580: o evento vem da consulta, nunca do cStat', async () => {
      const c = await cenario({ timeoutMs: 400 });
      const d = autorizado(await c.emissor.emitir('nota-21', n(21)));
      c.clock.avancar(60_000);
      c.sim.injectFault({ kind: 'hang', phase: 'after' }, { servico: 'RecepcaoEvento' });
      const pedido = { chave: d.id, nProt: d.protocolo.nProt, xJust: 'CANCELAMENTO DE TESTE SINTETICO' };
      const r = await c.emissor.cancelar(pedido);
      if (r.tipo !== 'registrado') throw new Error(`esperava registrado, veio ${r.tipo}`);
      expect([r.recuperado, r.cStat, r.evento.nProt]).toEqual([true, '135', c.sim.inspect.eventos(d.id)[0]?.nProt]);
      // De novo: a SEFAZ responde 573 ou 580, e a consulta confirma o mesmo evento.
      const denovo = await c.emissor.cancelar(pedido);
      if (denovo.tipo !== 'registrado') throw new Error(`esperava registrado, veio ${denovo.tipo}`);
      // A segunda resposta foi recusa (senão viria `recuperado: false`), e o evento é o mesmo, lido da consulta.
      expect([denovo.recuperado, denovo.procEvento]).toEqual([true, r.procEvento]);
      expect(c.caminhos.filter((p) => p.endsWith('/NFeRecepcaoEvento4'))).toHaveLength(2);
    });

    test('sem nProt: tira da consulta; já cancelada, devolve o evento; não consta, recusa', async () => {
      const c = await cenario();
      const d = autorizado(await c.emissor.emitir('nota-22', n(22)));
      c.clock.avancar(60_000);
      const r = await c.emissor.cancelar({ chave: d.id, xJust: 'CANCELAMENTO DE TESTE SINTETICO' });
      expect(r.tipo === 'registrado' && r.recuperado).toBe(false);
      const outra = await c.emissor.cancelar({ chave: d.id, xJust: 'CANCELAMENTO DE TESTE SINTETICO' });
      expect(outra.tipo === 'registrado' && outra.recuperado).toBe(true);
      expect(c.caminhos.filter((p) => p.endsWith('/NFeRecepcaoEvento4'))).toHaveLength(1);
      const inedita = await c.emissor.assinar(n(23));
      const nada = await c.emissor.cancelar({ chave: inedita.id, xJust: 'CANCELAMENTO DE TESTE SINTETICO' });
      expect([nada.tipo, nada.tipo === 'recusado' && nada.cStat]).toEqual(['recusado', '217']);
    });

    test('sem resposta e sem o evento na consulta: pendente, com o erro do pedido', async () => {
      const c = await cenario({ timeoutMs: 400 });
      const d = autorizado(await c.emissor.emitir('nota-24', n(24)));
      c.sim.injectFault({ kind: 'hang', phase: 'before' }, { servico: 'RecepcaoEvento' });
      const r = await c.emissor.cancelar({ chave: d.id, nProt: d.protocolo.nProt, xJust: 'CANCELAMENTO DE TESTE' });
      expect([r.tipo, r.tipo === 'pendente' && r.motivo]).toEqual(['pendente', 'sem-resposta']);
      c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'RecepcaoEvento' });
      c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NfeConsultaProtocolo' });
      const semNada = await c.emissor.cancelar({
        chave: d.id,
        nProt: d.protocolo.nProt,
        xJust: 'CANCELAMENTO DE TESTE',
      });
      expect(semNada.tipo).toBe('pendente');
      c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NfeConsultaProtocolo' });
      const semConsulta = await c.emissor.cancelar({ chave: d.id, xJust: 'CANCELAMENTO DE TESTE' });
      expect(semConsulta.tipo).toBe('pendente');
    });
  });

  test('pdf pelo @sinete/da injetado', async () => {
    let chamadas = 0;
    const c = await cenario({
      da: {
        danfe: (xml: string, o?: object) => {
          chamadas++;
          return da.danfe(xml, o);
        },
        toPdf: da.toPdf,
      },
    });
    const d = autorizado(await c.emissor.emitir('nota-25', n(25)));
    expect(await c.emissor.pdf(d.proc)).toEqual(da.toPdf(da.danfe(d.proc)));
    expect(chamadas).toBe(1);
  });

  test('emitente de outro CNPJ-base que o certificado: ErroDeValidacao antes de gravar (F03, rejeição 213)', async () => {
    const c = await cenario();
    const outro = n(46, { emitente: { ...n(46).emitente, CNPJ: CNPJ_DEST } as NfeInput['emitente'] });
    const e = await c.emissor.emitir('nota-46', outro).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroDeValidacao);
    expect((e as ErroDeValidacao).ocorrencias).toEqual([
      expect.objectContaining({ caminho: 'emitente.CNPJ', code: 'emitente_difere_do_certificado', origem: 'entrada' }),
    ]);
    expect(await c.store.ler('nfe', 'nota-46')).toBeUndefined();
    expect(autorizacoes(c)).toBe(0);
  });

  describe('recusa repetida: a mesma nota recusada volta à SEFAZ até o limite dentro da janela', () => {
    /** Emitente fora do cadastro habilitado: a SEFAZ responde 203 (MOC 7.0 Anexo I, RV 1C17-34). */
    const cadastro = (): Contribuinte[] => [
      { UF: 'SP', IE: IE_SP, CNPJ: CNPJ_EMIT, xNome: 'EMPRESA SINTETICA LTDA', situacao: 'nao-habilitado' },
    ];
    /** Mesmos bytes a cada montagem: cNF e data de emissão fixos. */
    const fixa = (nNF: number, extra: Partial<NfeInput> = {}) => ({
      nfe: n(nNF, { cNF: '31415926', ...extra }),
      montagem: { time: contextoDeTempo({ emissao: relogioFixo(EMISSAO) }) },
    });
    const repetida = async (p: Promise<unknown>): Promise<RecusaRepetidaError> => {
      try {
        await p;
      } catch (e) {
        if (e instanceof RecusaRepetidaError) return e;
        throw e;
      }
      throw new Error('esperava RecusaRepetidaError');
    };

    /** Emite a mesma entrada `vezes` vezes e confere que cada uma foi à SEFAZ e voltou recusada. */
    const recusadas = async (e: { emitir: NfeEmissor['emitir'] }, ref: string, entrada: () => unknown, vezes = 3) => {
      for (let i = 0; i < vezes; i++) {
        const d = await e.emitir(ref, entrada() as Parameters<NfeEmissor['emitir']>[1]);
        expect([d.tipo, d.tipo === 'recusado' && d.cStat]).toEqual(['recusado', '203']);
      }
    };

    test('três recusas iguais vão à SEFAZ; a quarta é barrada, também em outro processo; a nota corrigida vai', async () => {
      const c = await cenario({}, { sim: { cadastro: cadastro() } });
      await recusadas(c.emissor, 'nota-40', () => fixa(40));
      expect(autorizacoes(c)).toBe(3);
      const outro = await c.novoEmissor();
      const e = await repetida(outro.emitir('nota-40', fixa(40)));
      expect(ehErroSinete(e, 'recusa_repetida')).toBe(true);
      expect(e.detalhes).toMatchObject({ tipo: 'nfe', cStat: '203', vezes: 3, limite: 3, janelaMs: 3_600_000 });
      expect(autorizacoes(c)).toBe(3);
      expect(await c.store.ler('nfe', 'nota-40')).toBeUndefined();
      // A nota mudou (outro conteúdo): vai à SEFAZ e recomeça a conta.
      const corrigida = await outro.emitir('nota-40', fixa(40, { natOp: 'VENDA DE MERCADORIA ADQUIRIDA' }));
      expect(corrigida.tipo).toBe('recusado');
      expect(autorizacoes(c)).toBe(4);
      expect((await c.store.recusaRecente?.('nfe', 'nota-40', 3_600_000))?.vezes).toBe(1);
    });

    test('quem remonta a cada tentativa (hora de agora, cNF novo) também é contado; o conteúdo corrigido vai', async () => {
      const c = await cenario({}, { sim: { cadastro: cadastro() } });
      const agora = () => ({ nfe: n(47), montagem: { time: contextoDeTempo({ emissao: c.clock }) } });
      const primeira = await c.emissor.assinar(agora());
      for (let i = 0; i < 3; i++) {
        c.clock.avancar(90_000);
        expect((await c.emissor.emitir('nota-47', agora())).tipo).toBe('recusado');
      }
      c.clock.avancar(90_000);
      const outra = await c.emissor.assinar(agora());
      expect(outra.xml).not.toBe(primeira.xml);
      const e = await repetida(c.emissor.emitir('nota-47', agora()));
      expect(e.detalhes).toMatchObject({ cStat: '203', vezes: 3 });
      expect(autorizacoes(c)).toBe(3);
      const corrigida = await c.emissor.emitir('nota-47', {
        nfe: n(47, { natOp: 'VENDA DE MERCADORIA ADQUIRIDA' }),
        montagem: { time: contextoDeTempo({ emissao: c.clock }) },
      });
      expect(corrigida.tipo).toBe('recusado');
      expect(autorizacoes(c)).toBe(4);
    });

    test('depois de corrigir o cadastro, a mesma nota vai abaixo do limite; acima, com reenviarRecusado', async () => {
      const cad = cadastro();
      const c = await cenario({}, { sim: { cadastro: cad } });
      expect((await c.emissor.emitir('nota-41', fixa(41))).tipo).toBe('recusado');
      cad[0] = { ...(cad[0] as Contribuinte), situacao: 'habilitado' };
      autorizado(await c.emissor.emitir('nota-41', fixa(41)));
      expect(autorizacoes(c)).toBe(2);

      cad[0] = { ...(cad[0] as Contribuinte), situacao: 'nao-habilitado' };
      await recusadas(c.emissor, 'nota-48', () => fixa(48));
      cad[0] = { ...(cad[0] as Contribuinte), situacao: 'habilitado' };
      await repetida(c.emissor.emitir('nota-48', fixa(48)));
      autorizado(await c.emissor.emitir('nota-48', fixa(48), { reenviarRecusado: true }));
      expect(autorizacoes(c)).toBe(6);
    });

    test('a janela conta desde a primeira recusa, pelo relógio do banco; janela e limite são configuráveis', async () => {
      const c = await cenario({}, { sim: { cadastro: cadastro() } });
      await recusadas(c.emissor, 'nota-42', () => fixa(42));
      c.clock.avancar(59 * 60_000);
      await repetida(c.emissor.emitir('nota-42', fixa(42)));
      c.clock.avancar(2 * 60_000);
      // Passou uma hora desde a primeira: a conta recomeça.
      expect((await c.emissor.emitir('nota-42', fixa(42))).tipo).toBe('recusado');
      expect((await c.store.recusaRecente?.('nfe', 'nota-42', 3_600_000))?.vezes).toBe(1);
      await recusadas(c.emissor, 'nota-42', () => fixa(42), 2);
      await repetida(c.emissor.emitir('nota-42', fixa(42)));
      const curta = await c.novoEmissor({ recusaRepetida: { janelaMs: 60_000 } });
      c.clock.avancar(61_000);
      expect((await curta.emitir('nota-42', fixa(42))).tipo).toBe('recusado');
      const rigida = await c.novoEmissor({ recusaRepetida: { limite: 1 } });
      await repetida(rigida.emitir('nota-42', fixa(42)));
      expect(autorizacoes(c)).toBe(7);
      await expect(c.novoEmissor({ recusaRepetida: { limite: 0 } })).rejects.toBeInstanceOf(ErroDeConfiguracao);
      await expect(c.novoEmissor({ recusaRepetida: { limite: 1.5 } })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    });

    test('serviço paralisado (108) não é da nota: os mesmos bytes vão de novo', async () => {
      const c = await cenario();
      c.sim.setParalisacao('108');
      expect((await c.emissor.emitir('nota-43', fixa(43))).tipo).toBe('recusado');
      c.sim.setParalisacao(undefined);
      autorizado(await c.emissor.emitir('nota-43', fixa(43)));
    });

    test('recusaRepetida: false desliga; store com um método só é recusado', async () => {
      const c = await cenario({ recusaRepetida: false }, { sim: { cadastro: cadastro() } });
      expect((await c.emissor.emitir('nota-44', fixa(44))).tipo).toBe('recusado');
      expect((await c.emissor.emitir('nota-44', fixa(44))).tipo).toBe('recusado');
      expect(autorizacoes(c)).toBe(2);
      const { recusaRecente: _r, ...meio } = createMemoriaStore();
      await expect(c.novoEmissor({ store: meio })).rejects.toBeInstanceOf(ErroDeConfiguracao);
    });

    test('a retomada dos bytes gravados nunca é barrada', async () => {
      const c = await cenario();
      const { xml, id } = await c.emissor.assinar(fixa(45));
      const t = await c.store.travar('nfe', 'nota-45', 60_000);
      if (t === undefined) throw new Error('sem trava');
      await c.store.gravar(t, { xml, id, meta: {} });
      await c.store.soltar(t);
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(conteudoNfe(xml)))),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('');
      for (let i = 0; i < 3; i++) {
        await c.store.registrarRecusa?.('nfe', 'nota-45', { digest, cStat: '203', xMotivo: 'x' }, 3_600_000);
      }
      autorizado(await c.emissor.retomar('nota-45'));
    });
  });
});
