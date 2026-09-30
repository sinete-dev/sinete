/**
 * Ponta a ponta: o `@sinete/mdfe` contra o `@sinete/sefaz-sim` pelo `@sinete/transport` real, em HTTPS com mTLS. A
 * AC, o e-CPF do produtor, o e-CNPJ da transportadora e o certificado do servidor são gerados na hora (nada vai para o
 * repo). O cliente resolve os endpoints do MDF-e (SVRS) pelos dados do transporte, como em produção; o `redirectToSim`
 * troca só a URL de cada pedido.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { RelogioManual } from '@sinete/core';
import { contextoDeTempo, ErroDeTempoEsgotado, relogioManual } from '@sinete/core';
import { conferirAssinatura } from '@sinete/core/xml';
import type { SefazSim, SyntheticCertificate } from '@sinete/sefaz-sim';
import { createSefazSim, redirectToSim, startSefazSimServer, syntheticCertificate } from '@sinete/sefaz-sim';
import type { Transporte } from '@sinete/transport';
import { criarTransporte } from '@sinete/transport';
import type { BuildMdfeOptions, MdfeClient, MdfeInput } from '../../src/index.ts';
import { buildMdfe, createMdfeClient, resolverEnvioSemResposta, signMdfe } from '../../src/index.ts';
import { CNPJ_EMIT, CPF_EMIT, cargaPropria, EMISSAO, opcoes, prestador } from '../helpers/mdfe.ts';

interface Certs {
  readonly ac: SyntheticCertificate;
  readonly servidor: SyntheticCertificate;
  readonly produtor: SyntheticCertificate;
  readonly transportadora: SyntheticCertificate;
}

let c: Certs;
const fechar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const clock = relogioManual(EMISSAO);
  const ac = await syntheticCertificate({ clock, role: 'ac', validDays: 3650 });
  const [servidor, produtor, transportadora] = await Promise.all([
    syntheticCertificate({ clock, role: 'servidor', issuer: ac }),
    syntheticCertificate({ clock, role: 'titular', cpf: CPF_EMIT, issuer: ac }),
    syntheticCertificate({ clock, role: 'titular', cnpj: CNPJ_EMIT, issuer: ac }),
  ]);
  c = { ac, servidor, produtor, transportadora };
}, 60_000);

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
});

interface Cenario {
  readonly clock: RelogioManual;
  readonly sim: SefazSim;
  /** Caminhos pedidos ao simulador, na ordem. */
  readonly caminhos: string[];
  cliente(canal: SyntheticCertificate, timeoutMs?: number): MdfeClient;
  emitir(
    input: MdfeInput,
    assinante: SyntheticCertificate,
    o?: Partial<BuildMdfeOptions>,
  ): Promise<{ chave: string; xml: string }>;
}

async function cenario(): Promise<Cenario> {
  const clock = relogioManual(EMISSAO);
  const sim = createSefazSim({ clock, uf: 'MT' });
  const server = await startSefazSimServer(sim, { cert: c.servidor.pem, key: c.servidor.keyPem });
  const caminhos: string[] = [];
  const transports: Transporte[] = [];
  fechar.push(async () => {
    for (const t of transports) await t.fechar();
    await server.close();
  });
  const cliente = (canal: SyntheticCertificate, timeoutMs = 10_000): MdfeClient => {
    const real = criarTransporte({ identidade: canal.tlsIdentity, acsAdicionais: [c.ac.pem], timeoutMs });
    const gravador: Transporte = {
      capacidades: real.capacidades,
      enviar: (r) => {
        caminhos.push(new URL(r.url).pathname);
        return real.enviar(r);
      },
      fechar: () => real.fechar(),
    };
    const transport = redirectToSim(gravador, server.baseUrl);
    transports.push(transport);
    return createMdfeClient({
      transport,
      signer: canal.signer,
      ambiente: 'homologacao',
      clock,
      autor: canal === c.produtor ? { CPF: CPF_EMIT } : { CNPJ: CNPJ_EMIT },
    });
  };
  const emitir: Cenario['emitir'] = async (input, assinante, o = {}) => {
    const b = buildMdfe(input, { ...opcoes(), time: contextoDeTempo({ emissao: clock }), ...o });
    if (!b.ok) throw new Error(b.issues.map((i) => `${i.caminho}: ${i.mensagem}`).join('\n'));
    return { chave: b.value.chave, xml: await signMdfe(b.value, assinante.signer) };
  };
  return { clock, sim, caminhos, cliente, emitir };
}

describe('MDF-e contra a SEFAZ simulada, HTTPS com mTLS', () => {
  test('produtor rural (e-CPF): status, autorização, consulta, não encerrados e encerramento', async () => {
    const cen = await cenario();
    const client = cen.cliente(c.produtor);
    expect((await client.statusServico()).cStat).toBe('107');
    const mdfe = await cen.emitir(cargaPropria(), c.produtor);
    const r = await client.autorizar(mdfe.xml);
    if (r.tipo !== 'autorizado') throw new Error(JSON.stringify(r));
    // O mdfeProc leva o MDF-e byte a byte e a assinatura continua conferindo dentro do envelope.
    expect(r.valor.mdfeProc).toContain(mdfe.xml);
    expect(
      (await conferirAssinatura(r.valor.mdfeProc ?? '', { id: `MDFe${mdfe.chave}`, elemento: 'infMDFe' })).ok,
    ).toBe(true);
    const q = await client.consultar(mdfe.chave, mdfe.xml);
    expect(q.tipo === 'autorizado' && q.valor.digValConfere).toBe(true);
    const abertos = await client.consultarNaoEncerrados();
    expect(abertos.tipo === 'autorizado' && abertos.valor.map((m) => m.chMDFe)).toEqual([mdfe.chave]);
    cen.clock.avancar(6 * 3_600_000);
    const enc = await client.encerrar({ chave: mdfe.chave, nProt: r.valor.nProt ?? '', uf: 'SP', cMun: '3550308' });
    if (enc.tipo !== 'autorizado') throw new Error(JSON.stringify(enc));
    expect(enc.valor.procEventoMDFe).toContain('<evEncMDFe>');
    const fim = await client.consultar(mdfe.chave);
    expect(fim.tipo === 'autorizado' && fim.valor.situacao).toBe('encerrado');
    expect(fim.tipo === 'autorizado' && fim.valor.eventos.length).toBe(1);
    expect(cen.caminhos).toEqual([
      '/uf/ws/MDFeStatusServico',
      '/uf/ws/MDFeRecepcaoSinc',
      '/uf/ws/MDFeConsulta',
      '/uf/ws/MDFeConsNaoEnc',
      '/uf/ws/MDFeRecepcaoEvento',
      '/uf/ws/MDFeConsulta',
    ]);
  });

  test('transportadora (e-CNPJ): contingência off-line autorizada depois, e cancelamento', async () => {
    const cen = await cenario();
    const client = cen.cliente(c.transportadora);
    const mdfe = await cen.emitir(prestador(), c.transportadora, { tpEmis: '2' });
    expect(mdfe.xml).toContain('&amp;sign=');
    cen.clock.avancar(48 * 3_600_000);
    const r = await client.autorizar(mdfe.xml);
    if (r.tipo !== 'autorizado') throw new Error(JSON.stringify(r));
    const canc = await client.cancelar({
      chave: mdfe.chave,
      nProt: r.valor.nProt ?? '',
      xJust: 'VIAGEM NAO REALIZADA TESTE',
    });
    expect(canc.tipo === 'autorizado' && canc.cStat).toBe('135');
    const q = await client.consultar(mdfe.chave);
    expect(q.tipo === 'autorizado' && q.valor.situacao).toBe('cancelado');
  });

  test('processou e não respondeu: timeout, e o resolvedor recupera o mdfeProc pela consulta', async () => {
    const cen = await cenario();
    const mdfe = await cen.emitir(cargaPropria(), c.produtor);
    cen.sim.injectFault({ kind: 'hang', phase: 'after' }, { servico: 'MDFeRecepcaoSinc' });
    const apressado = cen.cliente(c.produtor, 400);
    expect(await apressado.autorizar(mdfe.xml).catch((e: unknown) => e)).toBeInstanceOf(ErroDeTempoEsgotado);
    expect(cen.sim.inspect.mdfe(mdfe.chave)?.situacao).toBe('autorizado');
    const res = await resolverEnvioSemResposta(cen.cliente(c.produtor), mdfe.xml);
    expect(res.acao).toBe('concluida');
    if (res.acao === 'concluida')
      expect(res.outcome.tipo === 'autorizado' && res.outcome.valor.mdfeProc).toContain(mdfe.xml);
  });
});
