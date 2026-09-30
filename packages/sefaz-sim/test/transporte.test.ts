/** Rotas, SOAP, falhas injetadas e o `Transport` em processo. */
import { describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao, ErroDeTempoEsgotado } from '@sinete/core';
import type { TransportRequest } from '@sinete/transport';
import {
  allowlistPolicy,
  mdfeEndpoint,
  nfceEndpoint,
  nfeEndpoint,
  PolicyError,
  soap12ContentType,
  TransportError,
} from '@sinete/transport';
import { NFE_SERVICES, redirectToSim, SIM_BASE_URL, simAutorizadorOf, simTransport, soapAction } from '../src/index.ts';
import { consStatServ, envelope, enviNFe, harness, nfe, tag, unwrap } from './helpers.ts';

const STATUS_CT = soap12ContentType(soapAction(NFE_SERVICES.NfeStatusServico));

describe('rotas e envelope SOAP', () => {
  test('404, 405 e 403 sem certificado', async () => {
    const h = await harness();
    const path = h.sim.path('NfeStatusServico');
    expect(path).toBe('/uf/ws/NFeStatusServico4');
    expect((await h.raw({ path: '/uf/ws/Nada4' })).status).toBe(404);
    expect((await h.raw({ path: '/xx/ws/NFeStatusServico4' })).status).toBe(404);
    expect((await h.raw({ path: '/an/ws/NFeInutilizacao4' })).status).toBe(404);
    expect((await h.raw({ path, method: 'GET' })).status).toBe(405);
    expect((await h.sim.handle({ path, body: '' })).status).toBe(403);
    expect(h.sim.path('NFeDistribuicaoDFe')).toBe('/an/ws/NFeDistribuicaoDFe');
    expect(h.sim.url('https://x/', 'NFeAutorizacao', 'svc')).toBe('https://x/svc/ws/NFeAutorizacao4');
  });

  test('SOAP Fault 500 para Content-Type, action, versão, Body e nfeDadosMsg errados', async () => {
    const h = await harness();
    const path = h.sim.path('NfeStatusServico');
    const ok = envelope('NfeStatusServico', consStatServ());
    const fault = async (body: string, ct: string | null = STATUS_CT): Promise<string> => {
      const r = await h.raw({ path, body, headers: ct === null ? {} : { 'content-type': ct } });
      expect(r.status).toBe(500);
      return r.body;
    };
    expect(await fault(ok, 'text/xml')).toContain('SOAP 1.2');
    expect(await fault(ok, null)).toContain('nenhum');
    expect(await fault(ok, soap12ContentType(`${soapAction(NFE_SERVICES.NfeStatusServico)}X`))).toContain('action');
    expect(await fault('<a>')).toContain('malformado');
    expect(await fault('<Envelope/>')).toContain('Envelope');
    expect(await fault('<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/"/>')).toContain('VersionMismatch');
    const soap = (inner: string): string =>
      `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">${inner}</s:Envelope>`;
    expect(await fault(soap('<s:Header/>'))).toContain('sem Body');
    expect(await fault(soap('<s:Body><x/></s:Body>'))).toContain('nfeDadosMsg');
    const ns = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4';
    expect(await fault(soap(`<s:Body><nfeDadosMsg xmlns="${ns}"><a/><b/></nfeDadosMsg></s:Body>`))).toContain(
      'exatamente',
    );
    // A action é opcional no SOAP 1.2; sem ela o pedido segue.
    const semAction = await h.raw({ path, body: ok, headers: { 'content-type': 'application/soap+xml' } });
    expect(semAction.status).toBe(200);
    // Distribuição usa o elemento da operação em volta do nfeDadosMsg.
    const distPath = h.sim.path('NFeDistribuicaoDFe');
    const distCt = soap12ContentType(soapAction(NFE_SERVICES.NFeDistribuicaoDFe));
    const r = await h.raw({
      path: distPath,
      body: soap('<s:Body><nfeDadosMsg/></s:Body>'),
      headers: { 'content-type': distCt },
    });
    expect(r.body).toContain('nfeDistDFeInteresse');
  });

  test('corpo em bytes e reason com caracteres escapados', async () => {
    const h = await harness();
    const path = h.sim.path('NfeStatusServico');
    const r = await h.raw({
      path,
      body: new TextEncoder().encode(envelope('NfeStatusServico', consStatServ())),
      headers: { 'content-type': STATUS_CT },
    });
    expect(tag(unwrap('NfeStatusServico', r.body), 'cStat')).toBe('107');
    const f = await h.raw({ path, body: '<a>', headers: { 'content-type': 'x/<y>&' } });
    expect(f.body).toContain('x/&lt;y&gt;&amp;');
  });
});

describe('falhas injetadas', () => {
  test('http, drop e hang antes de processar não mudam o estado; times e alvo', async () => {
    const h = await harness();
    h.sim.injectFault({ kind: 'http', status: 503 }, { servico: 'NfeStatusServico', times: 2 });
    h.sim.injectFault({ kind: 'drop', phase: 'before' }, { autorizador: 'an' });
    const path = h.sim.path('NfeStatusServico');
    const body = envelope('NfeStatusServico', consStatServ());
    const headers = { 'content-type': STATUS_CT };
    expect((await h.raw({ path, body, headers })).status).toBe(503);
    expect((await h.raw({ path, body, headers })).status).toBe(503);
    expect((await h.raw({ path, body, headers })).status).toBe(200);
    const an = await h.raw({ path: h.sim.path('NFeDistribuicaoDFe'), body: '' });
    expect([an.status, an.effect]).toEqual([0, 'drop']);
    h.sim.injectFault({ kind: 'hang', phase: 'before' }, { times: Number.POSITIVE_INFINITY });
    expect((await h.raw({ path, body, headers })).effect).toBe('hang');
    expect((await h.raw({ path, body, headers })).effect).toBe('hang');
    h.sim.clearFaults();
    expect((await h.raw({ path, body, headers })).effect).toBe('respond');
  });

  test('transporte em processo: drop vira conexao_recusada, hang e atraso longo viram TimeoutError, atraso curto responde', async () => {
    const h = await harness();
    const t = simTransport(h.sim, { clientCertificate: h.c.terceiro.der, timeoutMs: 20 });
    const req = {
      url: h.sim.url(SIM_BASE_URL, 'NfeStatusServico'),
      headers: { 'Content-Type': STATUS_CT },
      body: envelope('NfeStatusServico', consStatServ()),
    };
    h.sim.injectFault({ kind: 'drop', phase: 'after' });
    const drop = await t.send(req).catch((e: unknown) => e);
    expect(drop).toBeInstanceOf(TransportError);
    expect((drop as TransportError).code).toBe('conexao_recusada');
    h.sim.injectFault({ kind: 'hang', phase: 'after' });
    expect(await t.send(req).catch((e: unknown) => e)).toBeInstanceOf(ErroDeTempoEsgotado);
    h.sim.injectFault({ kind: 'delay', ms: 50 });
    expect(await t.send(req).catch((e: unknown) => e)).toBeInstanceOf(ErroDeTempoEsgotado);
    h.sim.injectFault({ kind: 'delay', ms: 5 });
    const res = await t.send(req);
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(res.body)).toBe(res.text());
    expect(t.capabilities.runtime).toBe('custom');
    // Cancelamento pelo sinal durante a espera.
    h.sim.injectFault({ kind: 'delay', ms: 10 });
    const ac = new AbortController();
    const p = t.send({ ...req, signal: ac.signal, timeoutMs: 1000 });
    ac.abort();
    const cancel = await p.catch((e: unknown) => e);
    expect((cancel as TransportError).code).toBe('cancelado');
    // Cancelamento logo depois do envio, sem falha injetada: o prazo e o sinal cobrem o atendimento inteiro.
    const logo = new AbortController();
    const semFalha = t.send({ ...req, signal: logo.signal, timeoutMs: 1000 });
    logo.abort();
    expect(((await semFalha.catch((e: unknown) => e)) as TransportError).code).toBe('cancelado');
    // Sinal já cancelado e cancelamento no meio da espera.
    expect(
      ((await t.send({ ...req, signal: AbortSignal.abort() }).catch((e: unknown) => e)) as TransportError).code,
    ).toBe('cancelado');
    h.sim.injectFault({ kind: 'delay', ms: 500 });
    const meio = new AbortController();
    setTimeout(() => meio.abort(), 5);
    const noMeio = await t.send({ ...req, signal: meio.signal, timeoutMs: 1000 }).catch((e: unknown) => e);
    expect((noMeio as TransportError).code).toBe('cancelado');
    await t.close();
    expect(await t.send(req).catch((e: unknown) => (e as Error).name)).toBe('ConfigError');
  });

  test('403 vira erro tipado ou resposta, e a política de hosts roda antes', async () => {
    const h = await harness();
    const req = { url: h.sim.url(SIM_BASE_URL, 'NfeStatusServico'), body: 'x' };
    const e = await simTransport(h.sim)
      .send(req)
      .catch((x: unknown) => x);
    expect((e as TransportError).code).toBe('certificado_ausente_ou_recusado');
    expect((await simTransport(h.sim, { rejectOn403: false }).send(req)).status).toBe(403);
    // Cancelado enquanto a política decide: o simulador não chega a ver o pedido.
    const ac = new AbortController();
    const lenta = {
      async check(): Promise<void> {
        ac.abort();
      },
    };
    const n = await nfe();
    const t = simTransport(h.sim, { clientCertificate: h.c.emitente.der, policy: lenta });
    const cancelado = await t
      .send({
        url: h.sim.url(SIM_BASE_URL, 'NFeAutorizacao'),
        headers: { 'content-type': soap12ContentType(soapAction(NFE_SERVICES.NFeAutorizacao)) },
        body: envelope('NFeAutorizacao', enviNFe([n.xml])),
        signal: ac.signal,
      })
      .catch((e: unknown) => e);
    expect((cancelado as TransportError).code).toBe('cancelado');
    expect(h.sim.inspect.nfe(n.chave)).toBeUndefined();
    const policy = allowlistPolicy({ hosts: ['outro.invalid'] });
    expect(
      await simTransport(h.sim, { policy })
        .send(req)
        .catch((x: unknown) => x),
    ).toBeInstanceOf(PolicyError);
    // GET sem corpo chega como 405.
    const get = await simTransport(h.sim, { clientCertificate: h.c.terceiro.der }).send({ url: req.url });
    expect(get.status).toBe(405);
  });

  test('certificado do canal recusado responde a rejeição do transmissor (280, 281, 282)', async () => {
    const h = await harness();
    const c = h.c;
    expect(tag(await h.send('NfeStatusServico', consStatServ(), { canal: c.ac }), 'cStat')).toBe('280');
    expect(tag(await h.send('NfeStatusServico', consStatServ(), { canal: c.vencido }), 'cStat')).toBe('281');
    expect(tag(await h.send('NfeStatusServico', consStatServ(), { canal: c.semDocumento }), 'cStat')).toBe('282');
    const lixo = await h.raw({
      path: h.sim.path('NfeStatusServico'),
      body: envelope('NfeStatusServico', consStatServ()),
      headers: { 'content-type': STATUS_CT },
      clientCertificate: new Uint8Array([1, 2, 3]),
    });
    expect(tag(unwrap('NfeStatusServico', lixo.body), 'cStat')).toBe('280');
    // Sem exigir certificado, o pedido sem canal é atendido.
    const aberto = await harness({ exigirCertificado: false });
    expect(tag(await aberto.send('NfeStatusServico', consStatServ(), { canal: null }), 'cStat')).toBe('107');
  });
});

describe('redirectToSim', () => {
  test('troca a URL do endpoint pelo caminho do autorizador simulado e atende pelo transporte envolvido', async () => {
    const h = await harness();
    const vistos: TransportRequest[] = [];
    const inner = simTransport(h.sim, { clientCertificate: h.c.emitente.der });
    const t = redirectToSim(
      {
        capabilities: inner.capabilities,
        send: (r) => {
          vistos.push(r);
          return inner.send(r);
        },
        close: () => inner.close(),
      },
      `${SIM_BASE_URL}/qualquer/coisa`,
    );
    const endpoint = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
    const res = await t.send({
      url: endpoint.url,
      endpoint,
      headers: { 'content-type': STATUS_CT },
      body: envelope('NfeStatusServico', consStatServ()),
    });
    expect(tag(unwrap('NfeStatusServico', res.text()), 'cStat')).toBe('107');
    expect(vistos[0]?.url).toBe(`${SIM_BASE_URL}/uf/ws/NFeStatusServico4`);
    expect(vistos[0]?.endpoint).toMatchObject({ host: 'sefaz-sim.invalid', tls: undefined, autorizador: 'SP' });
    await t.close();
    await expect(inner.send({ url: `${SIM_BASE_URL}/uf/ws/NFeStatusServico4` })).rejects.toBeInstanceOf(
      ErroDeConfiguracao,
    );
  });

  test('autorizador simulado: AN, SVC e UF (inclusive NFC-e e SVRS)', () => {
    const q = { ambiente: 'producao', servico: 'RecepcaoEvento' } as const;
    expect(simAutorizadorOf(nfeEndpoint({ ...q, autorizador: 'AN' }))).toBe('an');
    expect(simAutorizadorOf(nfeEndpoint({ ...q, uf: 'BA', contingencia: 'svc' }))).toBe('svc');
    expect(simAutorizadorOf(nfeEndpoint({ ...q, uf: 'SP', contingencia: 'svc' }))).toBe('svc');
    expect(simAutorizadorOf(nfeEndpoint({ ...q, uf: 'SC' }))).toBe('uf');
    expect(simAutorizadorOf(nfceEndpoint({ ...q, uf: 'SP' }))).toBe('uf');
  });

  test('sem endpoint, documento ou serviço que o simulador não atende, ou base sem https: ConfigError', async () => {
    const nunca = {
      capabilities: simTransport((await harness()).sim).capabilities,
      send: (): never => {
        throw new Error('não deveria enviar');
      },
      close: async (): Promise<void> => undefined,
    };
    const t = redirectToSim(nunca, SIM_BASE_URL);
    await expect(t.send({ url: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx' })).rejects.toBeInstanceOf(
      ErroDeConfiguracao,
    );
    // O MDF-e é atendido; a distribuição de DF-e do MDF-e, não.
    const mdfe = mdfeEndpoint({ ambiente: 'homologacao', servico: 'MDFeDistribuicaoDFe' });
    await expect(t.send({ url: mdfe.url, endpoint: mdfe })).rejects.toThrow('não atende mdfe MDFeDistribuicaoDFe');
    expect(() => redirectToSim(nunca, 'http://127.0.0.1:1')).toThrow(ErroDeConfiguracao);
  });
});
