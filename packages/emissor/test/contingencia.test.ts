/**
 * Contingência automática (ADR 0013) pelo `createNfeEmissor` contra o `@sinete/sefaz-sim` em HTTPS com mTLS: a UF fora
 * (108 ou sem resposta), a conta de falhas que decide quando consultar a SVC, a entrada só com a SVC ativada pela SEFAZ
 * de origem (107 no status da SVC; NT 2013.007 v1.03, item 04.7), a NF-e nova na SVC da UF (SP: SVC-AN, tpEmis 6), a
 * saída pelo 107 da UF, pelo 113 na hora marcada e pelo 114, a NFC-e nova off-line (tpEmis 9) gravada sem envio e sem
 * depender da SVC, e a nota pendente em emissão normal, que nunca muda de tipo de emissão (Ajuste SINIEF 07/05,
 * cláusula décima primeira, § 14).
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { RelogioManual } from '@sinete/core';
import { contextoDeTempo, relogioManual } from '@sinete/core';
import type { NfeInput } from '@sinete/nfe';
import type { SefazSim, SyntheticCertificate } from '@sinete/sefaz-sim';
import {
  createSefazSim,
  redirectToSim,
  startSefazSimServer,
  syntheticCertificate,
  syntheticPfx,
} from '@sinete/sefaz-sim';
import { createTransport } from '@sinete/transport';
import type { Desfecho, MudancaContingencia, TransmissaoStore } from '../src/index.ts';
import { retomarPendentes } from '../src/index.ts';
import { createMdfeEmissor } from '../src/mdfe.ts';
import { createBancoMemoria, createMemoriaStore } from '../src/memoria.ts';
import type { DesfechoNfe, NfeEmissor, NfeEmissorOptions } from '../src/nfe.ts';
import { createNfeEmissor } from '../src/nfe.ts';
import { fimDaSvcPeloMotivo } from '../src/svc.ts';
import { CNPJ_EMIT, EMISSAO, IE_SP, item, nota } from './helpers/nota.ts';

const SENHA = 'senha-sintetica';
const MINUTO = 60_000;

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

const nfce = (nNF: number): NfeInput => {
  const { destinatario: _semDestinatario, ...base } = nota({
    modelo: '65',
    serie: 1,
    nNF,
    itens: [item()],
    pagamento: { detPag: [{ tPag: '01', vPag: '20.00' }] },
  });
  return base;
};

interface Cenario {
  readonly clock: RelogioManual;
  readonly sim: SefazSim;
  readonly emissor: NfeEmissor;
  readonly store: TransmissaoStore;
  /** Caminhos pedidos ao simulador, na ordem. */
  readonly caminhos: string[];
  readonly mudancas: MudancaContingencia[];
  /** Chamado a cada pedido, antes de ele sair (para mexer no relógio no meio de uma sonda). */
  aoPedir: ((caminho: string) => void) | undefined;
  novoEmissor(extra?: Partial<NfeEmissorOptions>): Promise<NfeEmissor>;
}

const CONTINGENCIA = { automatica: true, limiteFalhas: 2, janelaMs: 5 * MINUTO, sondaMs: 5 * MINUTO } as const;

async function cenario(extra: Partial<NfeEmissorOptions> = {}): Promise<Cenario> {
  const clock = relogioManual(EMISSAO);
  const sim = createSefazSim({
    clock,
    uf: 'SP',
    cadastro: [{ UF: 'SP', IE: IE_SP, CNPJ: CNPJ_EMIT, xNome: 'EMPRESA SINTETICA LTDA' }],
  });
  const server = await startSefazSimServer(sim, { cert: servidor.pem, key: servidor.keyPem });
  const banco = createBancoMemoria();
  const caminhos: string[] = [];
  const mudancas: MudancaContingencia[] = [];
  const emissores: NfeEmissor[] = [];
  const ganchos: { aoPedir: ((caminho: string) => void) | undefined } = { aoPedir: undefined };
  const novoEmissor = async (mais: Partial<NfeEmissorOptions> = {}): Promise<NfeEmissor> => {
    const e = await createNfeEmissor({
      pfx,
      senha: SENHA,
      uf: 'SP',
      ambiente: 'homologacao',
      clock,
      store: createMemoriaStore({ clock, banco }),
      aoDecidir: () => undefined,
      contingencia: CONTINGENCIA,
      aoMudarContingencia: (m) => {
        mudancas.push(m);
      },
      transporte: (o) => {
        // A política padrão é a allowlist dos hosts reais; o simulador em 127.0.0.1 fica fora dela.
        const { policy: _policy, ...semPolitica } = o;
        const real = createTransport({ ...semPolitica, additionalCa: [ac.pem] });
        return redirectToSim(
          {
            capabilities: real.capabilities,
            send: (r) => {
              const caminho = new URL(r.url).pathname;
              caminhos.push(caminho);
              ganchos.aoPedir?.(caminho);
              return real.send(r);
            },
            close: () => real.close(),
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
    emissor,
    store: createMemoriaStore({ clock, banco }),
    caminhos,
    mudancas,
    get aoPedir() {
      return ganchos.aoPedir;
    },
    set aoPedir(f) {
      ganchos.aoPedir = f;
    },
    novoEmissor,
  };
}

function autorizado(d: Desfecho | undefined): Extract<DesfechoNfe, { tipo: 'autorizado' }> {
  if (d?.tipo !== 'autorizado') throw new Error(`esperava autorizado, veio ${JSON.stringify(d)}`);
  return d as Extract<DesfechoNfe, { tipo: 'autorizado' }>;
}

const tpEmisDa = (chave: string): string => chave.slice(34, 35);

/** Quantas consultas de status foram à SVC. */
const consultasSvc = (c: Cenario): number => c.caminhos.filter((p) => p === '/svc/ws/NFeStatusServico4').length;
const envioSvc = '/svc/ws/NFeAutorizacao4';

/** A UF sem resposta nenhuma: autorização, consulta e status caem antes de chegar. */
function ufFora(sim: SefazSim): void {
  for (const servico of ['NFeAutorizacao', 'NfeConsultaProtocolo', 'NfeStatusServico'] as const) {
    sim.injectFault({ kind: 'drop', phase: 'before' }, { servico, autorizador: 'uf', times: Infinity });
  }
}

describe('contingência automática da NF-e: SVC da UF', () => {
  test('UF em 108 e SVC ativada (107 no status da SVC): entra, a nota nova sai com tpEmis 6, e a sonda volta à UF', async () => {
    const c = await cenario();
    // A UF responde 108 e a SVC-AN está ativada para SP (o simulador liga as duas coisas juntas).
    c.sim.setContingencia('SVC-AN');
    const r1 = await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    const r2 = await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    expect([r1.tipo, r2.tipo]).toEqual(['recusado', 'recusado']);
    expect(consultasSvc(c)).toBe(1);
    expect(c.mudancas).toHaveLength(1);
    const entrou = c.mudancas[0];
    if (entrou?.tipo !== 'entrou') throw new Error('esperava a entrada');
    expect(entrou.escopo).toEqual({ documento: 'nfe', modelo: '55', uf: 'SP' });
    expect(entrou.motivo).toContain('SVC ativada para a UF (status da SVC: 107');

    c.clock.avancar(MINUTO);
    const d3 = autorizado(await c.emissor.emitir('nota-3', nota({ nNF: 3 })));
    expect(tpEmisDa(d3.id)).toBe('6');
    expect(d3.proc).toContain('<tpEmis>6</tpEmis>');
    expect(d3.proc).toContain(`<xJust>SEFAZ autorizadora sem resposta: contingencia automatica</xJust>`);
    expect(d3.proc).toContain('<dhCont>2026-09-26T10:00:00-03:00</dhCont>');
    expect(c.caminhos.at(-1)).toBe(envioSvc);

    // Depois do intervalo, a sonda ainda vê 108 na UF e 107 na SVC: a nota nova continua na SVC.
    c.clock.avancar(5 * MINUTO);
    expect(tpEmisDa(autorizado(await c.emissor.emitir('nota-4', nota({ nNF: 4 }))).id)).toBe('6');
    // A UF volta; depois do intervalo, a sonda vê 107 na UF e sai: a nota nova volta à emissão normal.
    c.sim.setContingencia(undefined);
    c.clock.avancar(5 * MINUTO);
    const d5 = autorizado(await c.emissor.emitir('nota-5', nota({ nNF: 5 })));
    expect(tpEmisDa(d5.id)).toBe('1');
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou', 'saiu']);
    expect(c.mudancas[1]?.motivo).toContain('autorizador normal em operação');
  });

  test('UF fora e SVC não ativada (114): não entra, nada vai à SVC além do status, e o aviso diz por quê', async () => {
    const c = await cenario();
    ufFora(c.sim);
    const p1 = await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    const p2 = await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    expect([p1.tipo, p2.tipo]).toEqual(['pendente', 'pendente']);
    expect(c.mudancas).toHaveLength(1);
    const aviso = c.mudancas[0];
    if (aviso?.tipo !== 'svc-indisponivel') throw new Error(`esperava svc-indisponivel, veio ${aviso?.tipo}`);
    expect(aviso.escopo).toEqual({ documento: 'nfe', modelo: '55', uf: 'SP' });
    expect(aviso.motivo).toContain('autorizador indisponível e SVC não ativada pela SEFAZ');
    expect(aviso.motivo).toContain('114');

    const p3 = await c.emissor.emitir('nota-3', nota({ nNF: 3 }));
    expect(p3.tipo).toBe('pendente');
    expect(tpEmisDa(p3.id)).toBe('1');
    expect(c.caminhos.filter((p) => p.startsWith('/svc/'))).toEqual(['/svc/ws/NFeStatusServico4']);
  });

  test('SVC não ativada: a consulta à SVC vale por sondaMs, também para outro processo, e a seguinte pode entrar', async () => {
    const c = await cenario();
    c.sim.setParalisacao('108');
    for (const n of [1, 2, 3, 4]) await c.emissor.emitir(`nota-${n}`, nota({ nNF: n }));
    const outro = await c.novoEmissor();
    await outro.emitir('nota-5', nota({ nNF: 5 }));
    expect(consultasSvc(c)).toBe(1);
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['svc-indisponivel']);

    // A SEFAZ de origem ativa a SVC; dentro do intervalo, ninguém consulta de novo, e a nota segue normal.
    c.sim.setAtivacaoSvc({ situacao: 'ativa' });
    c.clock.avancar(4 * MINUTO);
    expect(tpEmisDa((await outro.emitir('nota-6', nota({ nNF: 6 }))).id)).toBe('1');
    expect(consultasSvc(c)).toBe(1);
    // Passado o intervalo, a falha seguinte consulta, vê 107 e entra; a nota nova vai à SVC.
    c.clock.avancar(MINUTO);
    await c.emissor.emitir('nota-7', nota({ nNF: 7 }));
    expect(consultasSvc(c)).toBe(2);
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['svc-indisponivel', 'entrou']);
    expect(tpEmisDa(autorizado(await outro.emitir('nota-8', nota({ nNF: 8 }))).id)).toBe('6');
  });

  test('113 na sonda: a nota nova vai à SVC até a hora informada, e depois dela volta à emissão normal', async () => {
    const c = await cenario();
    c.sim.setContingencia('SVC-AN');
    await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    // A SEFAZ de origem avisa que a SVC deixa de atender SP às 10:15; a UF ainda responde 108.
    c.sim.setAtivacaoSvc({ situacao: 'desativando', ate: new Date('2026-09-26T10:15:00-03:00') });
    c.clock.avancar(5 * MINUTO);
    const d3 = autorizado(await c.emissor.emitir('nota-3', nota({ nNF: 3 })));
    expect(tpEmisDa(d3.id)).toBe('6');
    expect((await c.store.contingenciaAtiva?.('homologacao:nfe:55:SP'))?.fimDaSvc?.toISOString()).toBe(
      '2026-09-26T13:15:00.000Z',
    );
    c.clock.avancar(9 * MINUTO);
    expect(tpEmisDa(autorizado(await c.emissor.emitir('nota-4', nota({ nNF: 4 }))).id)).toBe('6');

    // Às 10:15, sem esperar a sonda: a nota nova sai em emissão normal e não vai à SVC.
    c.clock.avancar(MINUTO);
    const antes = c.caminhos.length;
    const r5 = await c.emissor.emitir('nota-5', nota({ nNF: 5 }));
    expect(tpEmisDa(r5.id)).toBe('1');
    expect(c.caminhos.slice(antes)).not.toContain(envioSvc);
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou', 'saiu']);
    expect(c.mudancas[1]?.motivo).toContain('113');
  });

  test('113 e depois 107 na SVC antes da hora: a hora anunciada deixa de valer', async () => {
    const c = await cenario();
    c.sim.setContingencia('SVC-AN');
    await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    c.sim.setAtivacaoSvc({ situacao: 'desativando', ate: new Date('2026-09-26T10:15:00-03:00') });
    c.clock.avancar(5 * MINUTO);
    await c.emissor.emitir('nota-3', nota({ nNF: 3 }));
    // A SEFAZ de origem mantém a SVC: a sonda seguinte vê 107 e apaga a hora.
    c.sim.setAtivacaoSvc({ situacao: 'ativa' });
    c.clock.avancar(5 * MINUTO);
    await c.emissor.emitir('nota-4', nota({ nNF: 4 }));
    expect((await c.store.contingenciaAtiva?.('homologacao:nfe:55:SP'))?.fimDaSvc).toBeUndefined();
    c.clock.avancar(6 * MINUTO);
    expect(tpEmisDa(autorizado(await c.emissor.emitir('nota-5', nota({ nNF: 5 }))).id)).toBe('6');
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou']);
  });

  test('113 e a sonda seguinte sem resposta, passando da hora: a nota nova não vai à SVC', async () => {
    const c = await cenario();
    c.sim.setContingencia('SVC-AN');
    await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    c.sim.setAtivacaoSvc({ situacao: 'desativando', ate: new Date('2026-09-26T10:15:00-03:00') });
    c.clock.avancar(5 * MINUTO);
    await c.emissor.emitir('nota-3', nota({ nNF: 3 }));
    // 10:14:59: a sonda venceu e começa antes da hora; as duas consultas caem, e o relógio passa das 10:15.
    c.clock.avancar(10 * MINUTO - 1000);
    c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NfeStatusServico', times: 2 });
    c.aoPedir = (caminho) => {
      if (caminho.endsWith('/NFeStatusServico4')) c.clock.avancar(1000);
    };
    const r4 = await c.emissor.emitir('nota-4', nota({ nNF: 4 }));
    expect(tpEmisDa(r4.id)).toBe('1');
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou', 'saiu']);
  });

  test('113 com a hora já passada: sai na hora da sonda', async () => {
    const c = await cenario();
    c.sim.setContingencia('SVC-AN');
    await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    // O 113 diz 10:05 e a sonda roda às 10:05:00 do relógio do emissor, mas a SVC só aceita até 10:05:30 no simulador:
    // a hora do xMotivo (sem segundos) já chegou, e o emissor sai sem esperar.
    c.sim.setAtivacaoSvc({ situacao: 'desativando', ate: new Date('2026-09-26T10:05:30-03:00') });
    c.clock.avancar(5 * MINUTO);
    const r3 = await c.emissor.emitir('nota-3', nota({ nNF: 3 }));
    expect(tpEmisDa(r3.id)).toBe('1');
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou', 'saiu']);
    expect(c.mudancas[1]?.motivo).toContain('SVC em desativação');
  });

  test('114 no meio: a nota enviada à SVC volta recusada, sai na hora, e a próxima vai à UF sem consultar a SVC', async () => {
    const c = await cenario();
    c.sim.setContingencia('SVC-AN');
    await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    // A SEFAZ de origem desliga a SVC antes da sonda; a UF segue em 108.
    c.sim.setAtivacaoSvc({ situacao: 'inativa' });
    const r3 = await c.emissor.emitir('nota-3', nota({ nNF: 3 }));
    if (r3.tipo !== 'recusado') throw new Error(`esperava recusado, veio ${r3.tipo}`);
    expect([r3.cStat, tpEmisDa(r3.id)]).toEqual(['114', '6']);
    // A SVC não aceitou a nota: os bytes são descartados, e o número pode ir à UF.
    expect(await c.store.ler('nfe', 'nota-3')).toBeUndefined();
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou', 'saiu']);
    expect(c.mudancas[1]?.motivo).toContain('114');

    const consultas = consultasSvc(c);
    const antes = c.caminhos.length;
    for (const n of [3, 4, 5]) expect(tpEmisDa((await c.emissor.emitir(`nota-${n}`, nota({ nNF: n }))).id)).toBe('1');
    expect(c.caminhos.slice(antes)).not.toContain(envioSvc);
    // O 114 vale como a consulta da SVC: as falhas seguintes na UF não a consultam dentro do intervalo.
    expect(consultasSvc(c)).toBe(consultas);
  });

  test('nota presa na SVC sem resposta: a sonda imediata volta à UF, e a retomada recebe 114 e descarta os bytes', async () => {
    const c = await cenario();
    c.sim.setContingencia('SVC-AN');
    await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    // A UF volta e a SVC é desligada, mas o envio à SVC cai antes de chegar.
    c.sim.setContingencia(undefined);
    for (const servico of ['NFeAutorizacao', 'NfeConsultaProtocolo'] as const) {
      c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico, autorizador: 'svc', times: Infinity });
    }
    const p3 = await c.emissor.emitir('nota-3', nota({ nNF: 3 }));
    expect(p3.tipo).toBe('pendente');
    expect(tpEmisDa(p3.id)).toBe('6');
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou', 'saiu']);
    expect(tpEmisDa(autorizado(await c.emissor.emitir('nota-4', nota({ nNF: 4 }))).id)).toBe('1');

    // A SVC volta a responder: a consulta não acha a nota, o reenvio dos mesmos bytes recebe 114, e eles saem.
    c.sim.clearFaults();
    const r3 = await c.emissor.retomar('nota-3');
    if (r3?.tipo !== 'recusado') throw new Error(`esperava recusado, veio ${r3?.tipo}`);
    expect([r3.cStat, r3.id]).toEqual(['114', p3.id]);
    expect(await c.store.ler('nfe', 'nota-3')).toBeUndefined();
  });

  test('a nota pendente em emissão normal nunca vai à SVC: a retomada consulta a UF com os mesmos bytes', async () => {
    const c = await cenario();
    c.sim.setAtivacaoSvc({ situacao: 'ativa' });
    ufFora(c.sim);
    const p1 = await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    const p2 = await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    expect([p1.tipo, p2.tipo]).toEqual(['pendente', 'pendente']);
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou']);
    const gravada = await c.store.ler('nfe', 'nota-1');
    if (gravada === undefined) throw new Error('nota-1 sem bytes');
    expect(tpEmisDa(gravada.id)).toBe('1');

    // Em contingência: a SVC atende a nota nova; emitir de novo a nota-1 retoma os bytes normais na UF, que segue fora.
    const svc = autorizado(await c.emissor.emitir('nota-3', nota({ nNF: 3 })));
    expect(tpEmisDa(svc.id)).toBe('6');
    const antes = c.caminhos.length;
    const outraVez = await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    expect(outraVez.tipo).toBe('pendente');
    expect(c.caminhos.slice(antes).every((p) => p.startsWith('/uf/'))).toBe(true);
    expect((await c.store.ler('nfe', 'nota-1'))?.xml).toBe(gravada.xml);
    expect(c.sim.inspect.nfe(gravada.id)).toBeUndefined();

    // A UF volta: a retomada autoriza os mesmos bytes, em emissão normal.
    c.sim.clearFaults();
    c.sim.setContingencia(undefined);
    const r = autorizado(await c.emissor.retomar('nota-1'));
    expect(r.id).toBe(gravada.id);
    expect(r.proc).toContain(gravada.xml.replace(/^<\?xml[^>]*\?>/, ''));
  });

  test('envio sem resposta e consulta com 108: conta como falha, e o dhCont respeita o relógio da montagem', async () => {
    const c = await cenario();
    c.sim.setAtivacaoSvc({ situacao: 'ativa' });
    c.sim.injectFault({ kind: 'drop', phase: 'before' }, { servico: 'NFeAutorizacao', autorizador: 'uf', times: 2 });
    c.sim.setParalisacao('108');
    const p1 = await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    if (p1.tipo !== 'pendente') throw new Error(`esperava pendente, veio ${p1.tipo}`);
    expect([p1.motivo, p1.cStat]).toEqual(['consulta-indefinida', '108']);
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou']);

    // A nota com o relógio de emissão dela, um minuto antes da entrada em contingência: dhCont é a emissão.
    const antes = relogioManual('2026-09-26T09:59:00-03:00');
    const d = autorizado(
      await c.emissor.emitir('nota-3', {
        nfe: nota({ nNF: 3 }),
        montagem: { time: contextoDeTempo({ emissao: antes }) },
      }),
    );
    expect(tpEmisDa(d.id)).toBe('6');
    expect(d.proc).toContain('<dhCont>2026-09-26T09:59:00-03:00</dhCont>');
  });

  test('dois processos sobre o mesmo banco: um entra e avisa, o outro já emite na SVC', async () => {
    const c = await cenario();
    c.sim.setContingencia('SVC-AN');
    await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    const outro = await c.novoEmissor();
    const d = autorizado(await outro.emitir('nota-3', nota({ nNF: 3 })));
    expect(tpEmisDa(d.id)).toBe('6');
    expect(c.mudancas).toHaveLength(1);
  });

  test('desligada por padrão: as falhas não mudam o tipo de emissão', async () => {
    const c = await cenario({ contingencia: { automatica: false } });
    c.sim.setContingencia('SVC-AN');
    for (const n of [1, 2, 3]) await c.emissor.emitir(`nota-${n}`, nota({ nNF: n }));
    expect(c.mudancas).toEqual([]);
    expect(c.caminhos.some((p) => p.startsWith('/svc/'))).toBe(false);
  });

  test('store sem os métodos da contingência: o estado fica na memória do processo', async () => {
    const clock = relogioManual(EMISSAO);
    const {
      registrarFalhaDoAutorizador: _a,
      contingenciaAtiva: _b,
      entrarEmContingencia: _c,
      sairDaContingencia: _d,
      reservarSonda: _e,
      marcarFimDaSvc: _f,
      ...semContingencia
    } = createMemoriaStore({ clock });
    const c = await cenario({ store: semContingencia as TransmissaoStore, clock });
    c.sim.setContingencia('SVC-AN');
    await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    expect(tpEmisDa(autorizado(await c.emissor.emitir('nota-3', nota({ nNF: 3 }))).id)).toBe('6');
  });

  test('aoMudarContingencia que lança não derruba a emissão', async () => {
    const c = await cenario({
      aoMudarContingencia: () => {
        throw new Error('alerta fora do ar');
      },
    });
    c.sim.setContingencia('SVC-AN');
    await c.emissor.emitir('nota-1', nota({ nNF: 1 }));
    await c.emissor.emitir('nota-2', nota({ nNF: 2 }));
    expect(tpEmisDa(autorizado(await c.emissor.emitir('nota-3', nota({ nNF: 3 }))).id)).toBe('6');
  });

  test('configuração: xJust curto, limites inválidos, store com parte dos métodos, MDF-e', async () => {
    const recusa = async (extra: Partial<NfeEmissorOptions>): Promise<unknown> =>
      cenario(extra).then(
        () => undefined,
        (e: unknown) => e,
      );
    expect(await recusa({ contingencia: { automatica: true, xJust: 'curta' } })).toMatchObject({
      code: 'config_invalida',
    });
    expect(await recusa({ contingencia: { automatica: true, limiteFalhas: 0 } })).toMatchObject({
      code: 'config_invalida',
    });
    const store = createMemoriaStore();
    const { marcarFimDaSvc: _m, ...parcial } = store;
    expect(await recusa({ store: parcial as TransmissaoStore })).toMatchObject({ code: 'config_invalida' });
    await expect(
      createMdfeEmissor({
        pfx,
        senha: SENHA,
        ambiente: 'homologacao',
        store: createMemoriaStore(),
        aoDecidir: () => undefined,
        contingencia: { automatica: true },
      }),
    ).rejects.toMatchObject({ code: 'config_invalida' });
  });
});

describe('hora do 113 no xMotivo', () => {
  const agora = relogioManual('2026-09-26T10:00:00-03:00');
  const fim = (xMotivo: string, clock = agora): string | undefined => fimDaSvcPeloMotivo(xMotivo, clock)?.toISOString();

  test('com data (item 04.7) e só com a hora (K05.3), no horário de Brasília', () => {
    expect(
      fim('SVC em processo de desativação. SVC será desabilitada para a SEFAZ-SP em 26/09/26 às 10:15 horas'),
    ).toBe('2026-09-26T13:15:00.000Z');
    expect(fim('Rejeicao: SVC-AN será desabilitada para a UF informada às 10:12')).toBe('2026-09-26T13:12:00.000Z');
    expect(fim('SVC sera desabilitada para a SEFAZ-SP em 26/09/2026 as 10h20 horas')).toBe('2026-09-26T13:20:00.000Z');
  });

  test('sem data, perto da meia-noite: a ocorrência mais próxima', () => {
    expect(
      fim('SVC-AN será desabilitada para a UF informada às 00:05', relogioManual('2026-09-26T23:55:00-03:00')),
    ).toBe('2026-09-27T03:05:00.000Z');
    expect(
      fim('SVC-AN será desabilitada para a UF informada às 23:58', relogioManual('2026-09-27T00:02:00-03:00')),
    ).toBe('2026-09-27T02:58:00.000Z');
  });

  test('sem hora legível, ou com data impossível: undefined', () => {
    expect(fim('SVC em processo de desativação')).toBeUndefined();
    expect(fim('SVC será desabilitada às 25:00')).toBeUndefined();
    expect(fim('SVC será desabilitada em 31/02/26 às 10:15 horas')).toBeUndefined();
  });
});

describe('contingência automática da NFC-e: off-line', () => {
  test('sem resposta e sem status: a NFC-e nova é gravada com tpEmis 9 e sem envio; a retomada transmite na volta', async () => {
    const c = await cenario({ contingencia: { ...CONTINGENCIA, limiteFalhas: 1 } });
    ufFora(c.sim);
    const p1 = await c.emissor.emitir('cupom-1', nfce(1));
    expect(p1.tipo).toBe('pendente');
    const entrou = c.mudancas[0];
    if (entrou?.tipo !== 'entrou') throw new Error('esperava a entrada');
    expect(entrou.escopo).toEqual({ documento: 'nfe', modelo: '65', uf: 'SP' });

    const antes = c.caminhos.length;
    const p2 = await c.emissor.emitir('cupom-2', nfce(2));
    if (p2.tipo !== 'pendente') throw new Error(`esperava pendente, veio ${p2.tipo}`);
    expect(p2.motivo).toBe('contingencia');
    expect(c.caminhos.length).toBe(antes);
    const off = await c.store.ler('nfe', 'cupom-2');
    if (off === undefined) throw new Error('cupom-2 sem bytes');
    expect(tpEmisDa(off.id)).toBe('9');
    expect(off.xml).toContain('<dhCont>');

    // A retomada automática, com a UF fora e antes da sonda, não envia nem conta tentativa da off-line.
    const resumo = await retomarPendentes({
      store: c.store,
      clock: c.clock,
      usarEmissor: (_r, f) => f(c.emissor),
      aoAlertar: () => undefined,
      politica: { paradaHaMs: 0 },
    });
    expect(resumo.adiadas).toBeGreaterThanOrEqual(1);
    expect((await c.store.ler('nfe', 'cupom-2'))?.tentativas).toBe(0);

    // A UF volta; depois do intervalo, a sonda vê 107 e a retomada transmite os mesmos bytes.
    c.sim.clearFaults();
    c.clock.avancar(5 * MINUTO);
    const r2 = autorizado(await c.emissor.retomar('cupom-2'));
    expect(r2.id).toBe(off.id);
    expect(r2.proc).toContain(off.xml.replace(/^<\?xml[^>]*\?>/, ''));
    expect(c.mudancas.map((m) => m.tipo)).toEqual(['entrou', 'saiu']);
    // O cupom-1, pendente em emissão normal, é retomado normal.
    expect(tpEmisDa(autorizado(await c.emissor.retomar('cupom-1')).id)).toBe('1');
    // A off-line é decisão do emitente: nada foi perguntado à SVC (a NFC-e não tem SVC).
    expect(c.caminhos.some((p) => p.startsWith('/svc/'))).toBe(false);
  });
});
