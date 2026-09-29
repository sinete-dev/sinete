/**
 * Ponta a ponta: o `@sinete/mdfe` contra o `@sinete/sefaz-sim` pelo `@sinete/transport` real, em HTTPS com mTLS. A
 * AC, o e-CPF do produtor, o e-CNPJ da transportadora e o certificado do servidor são gerados na hora (nada vai para o
 * repo). O cliente resolve os endpoints do MDF-e (SVRS) pelos dados do transporte, como em produção; o `redirectToSim`
 * troca só a URL de cada pedido.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import type { ManualClock } from '@sinete/core';
import { manualClock, TimeoutError, timeContext } from '@sinete/core';
import { verifySignature } from '@sinete/core/xml';
import type { SefazSim, SyntheticCertificate } from '@sinete/sefaz-sim';
import { createSefazSim, redirectToSim, startSefazSimServer, syntheticCertificate } from '@sinete/sefaz-sim';
import type { Transport } from '@sinete/transport';
import { createTransport } from '@sinete/transport';
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
  const clock = manualClock(EMISSAO);
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
  readonly clock: ManualClock;
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
  const clock = manualClock(EMISSAO);
  const sim = createSefazSim({ clock, uf: 'MT' });
  const server = await startSefazSimServer(sim, { cert: c.servidor.pem, key: c.servidor.keyPem });
  const caminhos: string[] = [];
  const transports: Transport[] = [];
  fechar.push(async () => {
    for (const t of transports) await t.close();
    await server.close();
  });
  const cliente = (canal: SyntheticCertificate, timeoutMs = 10_000): MdfeClient => {
    const real = createTransport({ identity: canal.tlsIdentity, additionalCa: [c.ac.pem], timeoutMs });
    const gravador: Transport = {
      capabilities: real.capabilities,
      send: (r) => {
        caminhos.push(new URL(r.url).pathname);
        return real.send(r);
      },
      close: () => real.close(),
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
    const b = buildMdfe(input, { ...opcoes(), time: timeContext({ emissao: clock }), ...o });
    if (!b.ok) throw new Error(b.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
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
    if (r.status !== 'authorized') throw new Error(JSON.stringify(r));
    // O mdfeProc leva o MDF-e byte a byte e a assinatura continua conferindo dentro do envelope.
    expect(r.value.mdfeProc).toContain(mdfe.xml);
    expect((await verifySignature(r.value.mdfeProc ?? '', { id: `MDFe${mdfe.chave}`, element: 'infMDFe' })).ok).toBe(
      true,
    );
    const q = await client.consultar(mdfe.chave, mdfe.xml);
    expect(q.status === 'authorized' && q.value.digValConfere).toBe(true);
    const abertos = await client.consultarNaoEncerrados();
    expect(abertos.status === 'authorized' && abertos.value.map((m) => m.chMDFe)).toEqual([mdfe.chave]);
    cen.clock.advance(6 * 3_600_000);
    const enc = await client.encerrar({ chave: mdfe.chave, nProt: r.value.nProt ?? '', uf: 'SP', cMun: '3550308' });
    if (enc.status !== 'authorized') throw new Error(JSON.stringify(enc));
    expect(enc.value.procEventoMDFe).toContain('<evEncMDFe>');
    const fim = await client.consultar(mdfe.chave);
    expect(fim.status === 'authorized' && fim.value.situacao).toBe('encerrado');
    expect(fim.status === 'authorized' && fim.value.eventos.length).toBe(1);
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
    cen.clock.advance(48 * 3_600_000);
    const r = await client.autorizar(mdfe.xml);
    if (r.status !== 'authorized') throw new Error(JSON.stringify(r));
    const canc = await client.cancelar({
      chave: mdfe.chave,
      nProt: r.value.nProt ?? '',
      xJust: 'VIAGEM NAO REALIZADA TESTE',
    });
    expect(canc.status === 'authorized' && canc.cStat).toBe('135');
    const q = await client.consultar(mdfe.chave);
    expect(q.status === 'authorized' && q.value.situacao).toBe('cancelado');
  });

  test('processou e não respondeu: timeout, e o resolvedor recupera o mdfeProc pela consulta', async () => {
    const cen = await cenario();
    const mdfe = await cen.emitir(cargaPropria(), c.produtor);
    cen.sim.injectFault({ kind: 'hang', phase: 'after' }, { servico: 'MDFeRecepcaoSinc' });
    const apressado = cen.cliente(c.produtor, 400);
    expect(await apressado.autorizar(mdfe.xml).catch((e: unknown) => e)).toBeInstanceOf(TimeoutError);
    expect(cen.sim.inspect.mdfe(mdfe.chave)?.situacao).toBe('autorizado');
    const res = await resolverEnvioSemResposta(cen.cliente(c.produtor), mdfe.xml);
    expect(res.acao).toBe('concluida');
    if (res.acao === 'concluida')
      expect(res.outcome.status === 'authorized' && res.outcome.value.mdfeProc).toContain(mdfe.xml);
  });
});
