/** Transporte `node:https` em processo (Bun): respostas HTTP, falhas de conexão, prazos, auditoria e identidades. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import tls from 'node:tls';
import { ErroDeTempoEsgotado, ErroNaoSuportado, loggerEmMemoria } from '@sinete/core';
import type { AuditEvent, ExternalTlsHelper, TransportResponse } from '../src/index.node.ts';
import {
  allowlistPolicy,
  checkLocalCertificate,
  classifyTransportFailure,
  createNodeTransport,
  createTransport,
  pemIdentity,
} from '../src/index.node.ts';
import type { Pki } from './lab/pki.ts';
import { createPki, findOpenssl } from './lab/pki.ts';
import { wwwServer } from './lab/servers.ts';

const openssl = findOpenssl();

describe.skipIf(!openssl)('transporte node:https', () => {
  let pki: Pki;
  let serverPem: { cert: string; key: string };
  const servers: { stop(): void }[] = [];
  const identity = (): { kind: 'pem'; certChain: string; key: string } => ({
    kind: 'pem',
    certChain: pki.clientCertPem,
    key: pki.clientKeyPem,
  });

  beforeAll(async () => {
    pki = createPki();
    serverPem = { cert: await Bun.file(pki.files.srv).text(), key: await Bun.file(pki.files.srvKey).text() };
  });
  afterAll(() => {
    for (const s of servers) s.stop();
    pki?.cleanup();
  });

  function bunServer(fetch: (req: Request) => Response | Promise<Response>): string {
    const s = Bun.serve({ hostname: '127.0.0.1', port: 0, tls: serverPem, fetch });
    servers.push({ stop: () => s.stop(true) });
    return `https://127.0.0.1:${s.port}`;
  }

  function tlsServer(onSocket: (s: tls.TLSSocket) => void): Promise<string> {
    const srv = tls.createServer({ ...serverPem }, onSocket);
    servers.push({ stop: () => srv.close() });
    return new Promise((resolve) => {
      srv.listen(0, '127.0.0.1', () => resolve(`https://127.0.0.1:${(srv.address() as { port: number }).port}`));
    });
  }

  test('POST com corpo, cabeçalhos e keep-alive: o socket reaproveitado também é conferido', async () => {
    let n = 0;
    const url = bunServer(async (req) => {
      n++;
      return new Response(`<ok n="${n}">${await req.text()}</ok>`, {
        headers: { 'content-type': 'application/soap+xml', 'x-dup': 'a' },
      });
    });
    const events: AuditEvent[] = [];
    const logger = loggerEmMemoria();
    const t = createNodeTransport({
      identity: identity(),
      additionalCa: [pki.caPem],
      audit: (e) => events.push(e),
      logger,
    });
    expect(t.capabilities).toMatchObject({ runtime: 'bun', renegotiation: true, tls12Cbc: true, tls12Dhe: false });
    const a = await t.send({ url: `${url}/ws`, body: '<x/>', headers: { 'Content-Type': 'application/soap+xml' } });
    const b = await t.send({ url: `${url}/ws`, body: new TextEncoder().encode('<y/>') });
    expect(a.status).toBe(200);
    expect(a.text()).toBe('<ok n="1"><x/></ok>');
    expect(b.text()).toBe('<ok n="2"><y/></ok>');
    expect(a.headers['content-type']).toBe('application/soap+xml');
    expect(a.tls.clientCertificateLoaded).toBe(true);
    expect(b.tls.clientCertificateLoaded).toBe(true);
    expect(events.map((e) => [e.method, e.status, e.path, e.runtime])).toEqual([
      ['POST', 200, '/ws', 'bun'],
      ['POST', 200, '/ws', 'bun'],
    ]);
    expect(logger.entradas.every((e) => !JSON.stringify(e).includes('PRIVATE'))).toBe(true);
    await t.close();
    await expect(t.send({ url })).rejects.toMatchObject({ code: 'config_invalida' });
  });

  test('NODE_TLS_REJECT_UNAUTHORIZED=0 no processo não desliga a conferência do servidor', async () => {
    const url = bunServer(() => new Response('ok'));
    const antes = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const t = createNodeTransport({ identity: identity() });
    try {
      await expect(t.send({ url })).rejects.toMatchObject({ code: 'cadeia_servidor_nao_confiavel' });
    } finally {
      if (antes === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = antes;
      await t.close();
    }
  });

  test('HTTP 403 vira certificado_ausente_ou_recusado, salvo rejectOn403: false', async () => {
    const url = bunServer(() => new Response('403.7 Forbidden', { status: 403 }));
    const events: AuditEvent[] = [];
    const t = createNodeTransport({ identity: identity(), additionalCa: [pki.caPem], audit: (e) => events.push(e) });
    await expect(t.send({ url })).rejects.toMatchObject({
      code: 'certificado_ausente_ou_recusado',
      details: { host: '127.0.0.1', status: 403 },
    });
    expect(events[0]).toMatchObject({ status: undefined, errorCode: 'certificado_ausente_ou_recusado' });
    const lax = createNodeTransport({ identity: identity(), additionalCa: [pki.caPem], rejectOn403: false });
    expect((await lax.send({ url })).status).toBe(403);
    await t.close();
    await lax.close();
  });

  test('conexão derrubada depois da requisição vira conexao_recusada', async () => {
    const url = await tlsServer((s) => s.on('data', () => s.destroy()));
    const t = createNodeTransport({ identity: identity(), additionalCa: [pki.caPem] });
    await expect(t.send({ url })).rejects.toMatchObject({ code: 'conexao_recusada' });
    await t.close();
  });

  test('servidor mudo: TimeoutError com o prazo', async () => {
    const url = await tlsServer(() => {});
    const t = createNodeTransport({ identity: identity(), additionalCa: [pki.caPem], timeoutMs: 200 });
    const e = await t.send({ url }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroDeTempoEsgotado);
    expect((e as ErroDeTempoEsgotado).timeoutMs).toBe(200);
    await expect(t.send({ url, timeoutMs: 100 })).rejects.toMatchObject({ code: 'tempo_esgotado', timeoutMs: 100 });
    await t.close();
  });

  test('prazo total: servidor que pinga pedaços não segura o envio além do timeoutMs', async () => {
    const url = await tlsServer((s) => {
      s.once('data', () => {
        s.write('HTTP/1.1 200 OK\r\ntransfer-encoding: chunked\r\n\r\n');
        const t = setInterval(() => s.write('1\r\nx\r\n'), 40);
        s.on('close', () => clearInterval(t));
        s.on('error', () => clearInterval(t));
      });
    });
    const t = createNodeTransport({ identity: identity(), additionalCa: [pki.caPem], timeoutMs: 300 });
    const started = performance.now();
    await expect(t.send({ url })).rejects.toBeInstanceOf(ErroDeTempoEsgotado);
    expect(performance.now() - started).toBeLessThan(2000);
    await t.close();
  });

  test('redirecionamento não é seguido: o 3xx volta para quem chamou', async () => {
    let hits = 0;
    const url = bunServer(() => {
      hits++;
      return new Response('', { status: 307, headers: { location: 'http://outro.invalid/' } });
    });
    const t = createNodeTransport({ identity: identity(), additionalCa: [pki.caPem] });
    const r = await t.send({ url, body: '<x/>' });
    expect(r.status).toBe(307);
    expect(r.headers.location).toBe('http://outro.invalid/');
    expect(hits).toBe(1);
    await t.close();
  });

  test('cancelamento pelo AbortSignal', async () => {
    const url = await tlsServer(() => {});
    const t = createNodeTransport({ identity: identity(), additionalCa: [pki.caPem] });
    const ac = new AbortController();
    setTimeout(() => ac.abort(new Error('usuário desistiu')), 50);
    await expect(t.send({ url, signal: ac.signal })).rejects.toMatchObject({ code: 'cancelado' });
    await expect(t.send({ url, signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'cancelado' });
    await t.close();
  });

  test('porta fechada vira conexao_recusada', async () => {
    const t = createNodeTransport({ identity: identity(), additionalCa: [pki.caPem] });
    await expect(t.send({ url: 'https://127.0.0.1:1/' })).rejects.toMatchObject({ code: 'conexao_recusada' });
    await t.close();
  });

  test('chave que não casa com o certificado vira ConfigError', async () => {
    const other = createPki();
    try {
      const url = bunServer(() => new Response('x'));
      const t = createNodeTransport({
        identity: { kind: 'pem', certChain: pki.clientCertPem, key: other.clientKeyPem },
        additionalCa: [pki.caPem],
      });
      await expect(t.send({ url })).rejects.toMatchObject({ code: 'config_invalida' });
      await t.close();
    } finally {
      other.cleanup();
    }
  });

  test('travas fixas e política antes do socket', async () => {
    const t = createNodeTransport({
      identity: identity(),
      policy: allowlistPolicy({ hosts: ['hom.exemplo.invalid'] }),
    });
    await expect(t.send({ url: 'http://hom.exemplo.invalid/' })).rejects.toMatchObject({ code: 'config_invalida' });
    await expect(t.send({ url: 'nada' })).rejects.toMatchObject({ code: 'config_invalida' });
    await expect(t.send({ url: 'https://u:p@hom.exemplo.invalid/' })).rejects.toMatchObject({
      code: 'politica_recusou',
    });
    await expect(t.send({ url: 'https://127.0.0.1/' })).rejects.toMatchObject({ code: 'politica_recusou' });
    await expect(t.send({ url: 'https://hom.exemplo.invalid/', timeoutMs: 0 })).rejects.toMatchObject({
      code: 'config_invalida',
    });
    await expect(
      t.send({ url: 'https://hom.exemplo.invalid/', headers: { HOST: 'outro.exemplo.invalid' } }),
    ).rejects.toMatchObject({ code: 'politica_recusou', message: expect.stringContaining('Host') });
    await t.close();
  });

  test('Host igual à autoridade da URL passa', async () => {
    const url = bunServer((req) => new Response(req.headers.get('host') ?? ''));
    const t = createNodeTransport({ identity: identity(), additionalCa: [pki.caPem] });
    const host = new URL(url).host;
    const r = await t.send({ url: `${url}/ws`, headers: { Host: host.toUpperCase() } });
    expect(r.text().toLowerCase()).toBe(host);
    await t.close();
  });

  test('perfil DHE nos dados é recusado no Bun antes do socket', async () => {
    const t = createNodeTransport({ identity: identity() });
    // GO produção: só DHE (ADR 0004, seção 2)
    await expect(t.send({ url: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4' })).rejects.toMatchObject({
      name: 'TransportUnsupportedError',
      code: 'nao_suportado',
      host: 'nfe.sefaz.go.gov.br',
    });
    await t.close();
  });

  test('sigalgs PKCS#1 limita a TLS 1.2 e conecta', async () => {
    const url = bunServer(() => new Response('ok'));
    const t = createNodeTransport({
      identity: identity(),
      additionalCa: [pki.caPem],
      sigalgs: 'RSA+SHA256:RSA+SHA384',
    });
    const r = await t.send({ url });
    expect(r.tls.protocol).toBe('TLSv1.2');
    await t.close();
  });

  test('trust system: usa a loja do sistema ou diz que a runtime não tem', () => {
    try {
      createNodeTransport({ identity: identity(), trust: 'system' });
    } catch (e) {
      expect(e).toBeInstanceOf(ErroNaoSuportado);
    }
  });

  test('identidade pem vazia', () => {
    expect(() => createNodeTransport({ identity: { kind: 'pem', certChain: '', key: '' } })).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
  });

  test('identidade helper: política aplicada e requisição delegada', async () => {
    const calls: string[] = [];
    const helper: ExternalTlsHelper = {
      protocolVersion: 1,
      request: async (id, req): Promise<TransportResponse> => {
        calls.push(`${id} ${req.method} ${req.url} ${req.timeoutMs}`);
        const status = req.url.endsWith('/proibido') ? 403 : 200;
        const body = new TextEncoder().encode('ok');
        return {
          status,
          headers: {},
          body,
          tls: { protocol: 'TLSv1.2', cipher: undefined, resumed: undefined, clientCertificateLoaded: true },
          text: () => 'ok',
        };
      },
      close: async () => {},
    };
    const t = createTransport({
      identity: { kind: 'helper', helper, identity: 'a3-token' },
      policy: allowlistPolicy({ hosts: ['hom.exemplo.invalid'] }),
      timeoutMs: 1234,
    });
    expect((await t.send({ url: 'https://hom.exemplo.invalid/ws' })).status).toBe(200);
    await expect(t.send({ url: 'https://hom.exemplo.invalid/proibido' })).rejects.toMatchObject({
      code: 'certificado_ausente_ou_recusado',
    });
    await expect(t.send({ url: 'https://outro.invalid/' })).rejects.toMatchObject({ code: 'politica_recusou' });
    expect(calls).toEqual([
      'a3-token GET https://hom.exemplo.invalid/ws 1234',
      'a3-token GET https://hom.exemplo.invalid/proibido 1234',
    ]);
    await t.close();
  });

  // TLS 1.2: o alerta chega como erro. No TLS 1.3 o Bun só fecha o socket (vira conexao_recusada no transporte).
  test.each(['-tls1_2'])('cliente sem certificado contra servidor que exige (%s)', async (version) => {
    const srv = await wwwServer(pki, [
      version,
      '-Verify',
      '1',
      '-verify_return_error',
      '-CAfile',
      pki.files.ca,
      '-naccept',
      '1',
    ]);
    const err = await new Promise<unknown>((resolve) => {
      const s = tls.connect({ host: '127.0.0.1', port: srv.port, ca: [pki.caPem], servername: 'localhost' }, () =>
        s.write('GET / HTTP/1.1\r\n\r\n'),
      );
      s.on('data', () => {});
      s.on('error', resolve);
      s.on('close', () => resolve(new Error('fechou sem erro')));
    });
    await srv.finished(500);
    expect(classifyTransportFailure(err, { host: '127.0.0.1' }).code).toBe('certificado_nao_apresentado');
  });
});

describe('checkLocalCertificate', () => {
  const leaf = Uint8Array.of(1, 2, 3);
  test('sem API na runtime, não afirma nada', () => {
    expect(checkLocalCertificate({}, leaf)).toBeUndefined();
    expect(checkLocalCertificate({ getCertificate: () => undefined }, leaf)).toBeUndefined();
  });
  test('certificado ausente ou diferente é false; o mesmo é true', () => {
    expect(checkLocalCertificate({ getCertificate: () => null }, leaf)).toBe(false);
    expect(checkLocalCertificate({ getCertificate: () => ({}) }, leaf)).toBe(false);
    expect(checkLocalCertificate({ getCertificate: () => ({ raw: Uint8Array.of(1, 2, 4) }) }, leaf)).toBe(false);
    expect(checkLocalCertificate({ getCertificate: () => ({ raw: Uint8Array.of(1, 2) }) }, leaf)).toBe(false);
    expect(checkLocalCertificate({ getCertificate: () => ({ raw: Uint8Array.of(1, 2, 3) }) }, leaf)).toBe(true);
  });
});

describe('pemIdentity', () => {
  test('usa o tlsPem do KeyStore', () => {
    const ks = { tlsPem: (o?: unknown) => ({ certChain: `c${o ? '+cadeia' : ''}`, key: 'k' }) };
    expect(pemIdentity(ks as never)).toEqual({ kind: 'pem', certChain: 'c', key: 'k' });
    expect(pemIdentity(ks as never, { chain: [] })).toEqual({ kind: 'pem', certChain: 'c+cadeia', key: 'k' });
  });
});
