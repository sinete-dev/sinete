/** Rotas, SOAP, falhas injetadas e o `Transporte` em processo. */
import { describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao, ErroDeTempoEsgotado } from '@sinete/core';
import type { PedidoTransporte } from '@sinete/transport';
import {
  contentTypeSoap12,
  ErroPolitica,
  ErroTransporte,
  mdfeEndpoint,
  nfceEndpoint,
  nfeEndpoint,
  politicaDeHostsPermitidos,
} from '@sinete/transport';
import { NFE_SERVICES, redirectToSim, SIM_BASE_URL, simAutorizadorOf, simTransport, soapAction } from '../src/index.ts';
import { consStatServ, envelope, enviNFe, harness, nfe, tag, unwrap } from './helpers.ts';

const STATUS_CT = contentTypeSoap12(soapAction(NFE_SERVICES.NfeStatusServico));

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
    expect(await fault(ok, contentTypeSoap12(`${soapAction(NFE_SERVICES.NfeStatusServico)}X`))).toContain('action');
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
    const distCt = contentTypeSoap12(soapAction(NFE_SERVICES.NFeDistribuicaoDFe));
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

  test('transporte em processo: drop vira conexao_recusada, hang e atraso longo viram ErroDeTempoEsgotado, atraso curto responde', async () => {
    const h = await harness();
    const t = simTransport(h.sim, { clientCertificate: h.c.terceiro.der, timeoutMs: 20 });
    const req = {
      url: h.sim.url(SIM_BASE_URL, 'NfeStatusServico'),
      cabecalhos: { 'Content-Type': STATUS_CT },
      corpo: envelope('NfeStatusServico', consStatServ()),
    };
    h.sim.injectFault({ kind: 'drop', phase: 'after' });
    const drop = await t.enviar(req).catch((e: unknown) => e);
    expect(drop).toBeInstanceOf(ErroTransporte);
    expect((drop as ErroTransporte).code).toBe('conexao_recusada');
    h.sim.injectFault({ kind: 'hang', phase: 'after' });
    expect(await t.enviar(req).catch((e: unknown) => e)).toBeInstanceOf(ErroDeTempoEsgotado);
    h.sim.injectFault({ kind: 'delay', ms: 50 });
    expect(await t.enviar(req).catch((e: unknown) => e)).toBeInstanceOf(ErroDeTempoEsgotado);
    h.sim.injectFault({ kind: 'delay', ms: 5 });
    const res = await t.enviar(req);
    expect(res.status).toBe(200);
    expect(new TextDecoder().decode(res.corpo)).toBe(res.texto());
    expect(t.capacidades.runtime).toBe('personalizada');
    // Cancelamento pelo sinal durante a espera.
    h.sim.injectFault({ kind: 'delay', ms: 10 });
    const ac = new AbortController();
    const p = t.enviar({ ...req, signal: ac.signal, timeoutMs: 1000 });
    ac.abort();
    const cancel = await p.catch((e: unknown) => e);
    expect((cancel as ErroTransporte).code).toBe('cancelado');
    // Cancelamento logo depois do envio, sem falha injetada: o prazo e o sinal cobrem o atendimento inteiro.
    const logo = new AbortController();
    const semFalha = t.enviar({ ...req, signal: logo.signal, timeoutMs: 1000 });
    logo.abort();
    expect(((await semFalha.catch((e: unknown) => e)) as ErroTransporte).code).toBe('cancelado');
    // Sinal já cancelado e cancelamento no meio da espera.
    expect(
      ((await t.enviar({ ...req, signal: AbortSignal.abort() }).catch((e: unknown) => e)) as ErroTransporte).code,
    ).toBe('cancelado');
    h.sim.injectFault({ kind: 'delay', ms: 500 });
    const meio = new AbortController();
    setTimeout(() => meio.abort(), 5);
    const noMeio = await t.enviar({ ...req, signal: meio.signal, timeoutMs: 1000 }).catch((e: unknown) => e);
    expect((noMeio as ErroTransporte).code).toBe('cancelado');
    await t.fechar();
    expect(await t.enviar(req).catch((e: unknown) => (e as Error).name)).toBe('ErroDeConfiguracao');
  });

  test('403 vira erro tipado ou resposta, e a política de hosts roda antes', async () => {
    const h = await harness();
    const req = { url: h.sim.url(SIM_BASE_URL, 'NfeStatusServico'), corpo: 'x' };
    const e = await simTransport(h.sim)
      .enviar(req)
      .catch((x: unknown) => x);
    expect((e as ErroTransporte).code).toBe('certificado_ausente_ou_recusado');
    expect((await simTransport(h.sim, { rejectOn403: false }).enviar(req)).status).toBe(403);
    // Cancelado enquanto a política decide: o simulador não chega a ver o pedido.
    const ac = new AbortController();
    const lenta = {
      async conferir(): Promise<void> {
        ac.abort();
      },
    };
    const n = await nfe();
    const t = simTransport(h.sim, { clientCertificate: h.c.emitente.der, policy: lenta });
    const cancelado = await t
      .enviar({
        url: h.sim.url(SIM_BASE_URL, 'NFeAutorizacao'),
        cabecalhos: { 'content-type': contentTypeSoap12(soapAction(NFE_SERVICES.NFeAutorizacao)) },
        corpo: envelope('NFeAutorizacao', enviNFe([n.xml])),
        signal: ac.signal,
      })
      .catch((e: unknown) => e);
    expect((cancelado as ErroTransporte).code).toBe('cancelado');
    expect(h.sim.inspect.nfe(n.chave)).toBeUndefined();
    const policy = politicaDeHostsPermitidos({ hosts: ['outro.invalid'] });
    expect(
      await simTransport(h.sim, { policy })
        .enviar(req)
        .catch((x: unknown) => x),
    ).toBeInstanceOf(ErroPolitica);
    // GET sem corpo chega como 405.
    const get = await simTransport(h.sim, { clientCertificate: h.c.terceiro.der }).enviar({ url: req.url });
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
    const vistos: PedidoTransporte[] = [];
    const inner = simTransport(h.sim, { clientCertificate: h.c.emitente.der });
    const t = redirectToSim(
      {
        capacidades: inner.capacidades,
        enviar: (r) => {
          vistos.push(r);
          return inner.enviar(r);
        },
        fechar: () => inner.fechar(),
      },
      `${SIM_BASE_URL}/qualquer/coisa`,
    );
    const endpoint = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
    const res = await t.enviar({
      url: endpoint.url,
      endpoint,
      cabecalhos: { 'content-type': STATUS_CT },
      corpo: envelope('NfeStatusServico', consStatServ()),
    });
    expect(tag(unwrap('NfeStatusServico', res.texto()), 'cStat')).toBe('107');
    expect(vistos[0]?.url).toBe(`${SIM_BASE_URL}/uf/ws/NFeStatusServico4`);
    expect(vistos[0]?.endpoint).toMatchObject({ host: 'sefaz-sim.invalid', tls: undefined, autorizador: 'SP' });
    await t.fechar();
    await expect(inner.enviar({ url: `${SIM_BASE_URL}/uf/ws/NFeStatusServico4` })).rejects.toBeInstanceOf(
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

  test('sem endpoint, documento ou serviço que o simulador não atende, ou base sem https: ErroDeConfiguracao', async () => {
    const nunca = {
      capacidades: simTransport((await harness()).sim).capacidades,
      enviar: (): never => {
        throw new Error('não deveria enviar');
      },
      fechar: async (): Promise<void> => undefined,
    };
    const t = redirectToSim(nunca, SIM_BASE_URL);
    await expect(t.enviar({ url: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx' })).rejects.toBeInstanceOf(
      ErroDeConfiguracao,
    );
    // O MDF-e é atendido; a distribuição de DF-e do MDF-e, não.
    const mdfe = mdfeEndpoint({ ambiente: 'homologacao', servico: 'MDFeDistribuicaoDFe' });
    await expect(t.enviar({ url: mdfe.url, endpoint: mdfe })).rejects.toThrow('não atende mdfe MDFeDistribuicaoDFe');
    expect(() => redirectToSim(nunca, 'http://127.0.0.1:1')).toThrow(ErroDeConfiguracao);
  });
});
