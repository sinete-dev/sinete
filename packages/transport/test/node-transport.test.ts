/** Transporte `node:https` em processo (Bun): respostas HTTP, falhas de conexão, prazos, auditoria e identidades. */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import tls from 'node:tls';
import { ErroDeTempoEsgotado, ErroNaoSuportado, loggerEmMemoria } from '@sinete/core';
import type { EventoDeAuditoria, HelperTlsExterno, RespostaTransporte } from '../src/index.node.ts';
import {
  classificarFalhaDeTransporte,
  conferirCertificadoLocal,
  criarTransporte,
  criarTransporteNode,
  identidadePem,
  politicaDeHostsPermitidos,
} from '../src/index.node.ts';
import type { Pki } from './lab/pki.ts';
import { createPki, findOpenssl } from './lab/pki.ts';
import { wwwServer } from './lab/servers.ts';

const openssl = findOpenssl();

describe.skipIf(!openssl)('transporte node:https', () => {
  let pki: Pki;
  let serverPem: { cert: string; key: string };
  const servers: { stop(): void }[] = [];
  const identity = (): { tipo: 'pem'; cadeia: string; chave: string } => ({
    tipo: 'pem',
    cadeia: pki.clientCertPem,
    chave: pki.clientKeyPem,
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
    const events: EventoDeAuditoria[] = [];
    const logger = loggerEmMemoria();
    const t = criarTransporteNode({
      identidade: identity(),
      acsAdicionais: [pki.caPem],
      auditoria: (e) => events.push(e),
      logger,
    });
    expect(t.capacidades).toMatchObject({ runtime: 'bun', renegociacao: true, tls12Cbc: true, tls12Dhe: false });
    const a = await t.enviar({
      url: `${url}/ws`,
      corpo: '<x/>',
      cabecalhos: { 'Content-Type': 'application/soap+xml' },
    });
    const b = await t.enviar({ url: `${url}/ws`, corpo: new TextEncoder().encode('<y/>') });
    expect(a.status).toBe(200);
    expect(a.texto()).toBe('<ok n="1"><x/></ok>');
    expect(b.texto()).toBe('<ok n="2"><y/></ok>');
    expect(a.cabecalhos['content-type']).toBe('application/soap+xml');
    expect(a.tls.certificadoLocalCarregado).toBe(true);
    expect(b.tls.certificadoLocalCarregado).toBe(true);
    expect(events.map((e) => [e.metodo, e.status, e.caminho, e.runtime])).toEqual([
      ['POST', 200, '/ws', 'bun'],
      ['POST', 200, '/ws', 'bun'],
    ]);
    expect(logger.entradas.every((e) => !JSON.stringify(e).includes('PRIVATE'))).toBe(true);
    await t.fechar();
    await expect(t.enviar({ url })).rejects.toMatchObject({ code: 'config_invalida' });
  });

  test('NODE_TLS_REJECT_UNAUTHORIZED=0 no processo não desliga a conferência do servidor', async () => {
    const url = bunServer(() => new Response('ok'));
    const antes = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const t = criarTransporteNode({ identidade: identity() });
    try {
      await expect(t.enviar({ url })).rejects.toMatchObject({ code: 'cadeia_servidor_nao_confiavel' });
    } finally {
      if (antes === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = antes;
      await t.fechar();
    }
  });

  test('HTTP 403 vira certificado_ausente_ou_recusado, salvo recusarEm403: false', async () => {
    const url = bunServer(() => new Response('403.7 Forbidden', { status: 403 }));
    const events: EventoDeAuditoria[] = [];
    const t = criarTransporteNode({
      identidade: identity(),
      acsAdicionais: [pki.caPem],
      auditoria: (e) => events.push(e),
    });
    await expect(t.enviar({ url })).rejects.toMatchObject({
      code: 'certificado_ausente_ou_recusado',
      detalhes: { host: '127.0.0.1', status: 403 },
    });
    expect(events[0]).toMatchObject({ status: undefined, codigoDoErro: 'certificado_ausente_ou_recusado' });
    const lax = criarTransporteNode({ identidade: identity(), acsAdicionais: [pki.caPem], recusarEm403: false });
    expect((await lax.enviar({ url })).status).toBe(403);
    await t.fechar();
    await lax.fechar();
  });

  test('conexão derrubada depois da requisição vira conexao_recusada', async () => {
    const url = await tlsServer((s) => s.on('data', () => s.destroy()));
    const t = criarTransporteNode({ identidade: identity(), acsAdicionais: [pki.caPem] });
    await expect(t.enviar({ url })).rejects.toMatchObject({ code: 'conexao_recusada' });
    await t.fechar();
  });

  test('servidor mudo: ErroDeTempoEsgotado com o prazo', async () => {
    const url = await tlsServer(() => {});
    const t = criarTransporteNode({ identidade: identity(), acsAdicionais: [pki.caPem], timeoutMs: 200 });
    const e = await t.enviar({ url }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErroDeTempoEsgotado);
    expect((e as ErroDeTempoEsgotado).timeoutMs).toBe(200);
    await expect(t.enviar({ url, timeoutMs: 100 })).rejects.toMatchObject({ code: 'tempo_esgotado', timeoutMs: 100 });
    await t.fechar();
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
    const t = criarTransporteNode({ identidade: identity(), acsAdicionais: [pki.caPem], timeoutMs: 300 });
    const started = performance.now();
    await expect(t.enviar({ url })).rejects.toBeInstanceOf(ErroDeTempoEsgotado);
    expect(performance.now() - started).toBeLessThan(2000);
    await t.fechar();
  });

  test('redirecionamento não é seguido: o 3xx volta para quem chamou', async () => {
    let hits = 0;
    const url = bunServer(() => {
      hits++;
      return new Response('', { status: 307, headers: { location: 'http://outro.invalid/' } });
    });
    const t = criarTransporteNode({ identidade: identity(), acsAdicionais: [pki.caPem] });
    const r = await t.enviar({ url, corpo: '<x/>' });
    expect(r.status).toBe(307);
    expect(r.cabecalhos.location).toBe('http://outro.invalid/');
    expect(hits).toBe(1);
    await t.fechar();
  });

  test('cancelamento pelo AbortSignal', async () => {
    const url = await tlsServer(() => {});
    const t = criarTransporteNode({ identidade: identity(), acsAdicionais: [pki.caPem] });
    const ac = new AbortController();
    setTimeout(() => ac.abort(new Error('usuário desistiu')), 50);
    await expect(t.enviar({ url, signal: ac.signal })).rejects.toMatchObject({ code: 'cancelado' });
    await expect(t.enviar({ url, signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'cancelado' });
    await t.fechar();
  });

  test('porta fechada vira conexao_recusada', async () => {
    const t = criarTransporteNode({ identidade: identity(), acsAdicionais: [pki.caPem] });
    await expect(t.enviar({ url: 'https://127.0.0.1:1/' })).rejects.toMatchObject({ code: 'conexao_recusada' });
    await t.fechar();
  });

  test('chave que não casa com o certificado vira ErroDeConfiguracao', async () => {
    const other = createPki();
    try {
      const url = bunServer(() => new Response('x'));
      const t = criarTransporteNode({
        identidade: { tipo: 'pem', cadeia: pki.clientCertPem, chave: other.clientKeyPem },
        acsAdicionais: [pki.caPem],
      });
      await expect(t.enviar({ url })).rejects.toMatchObject({ code: 'config_invalida' });
      await t.fechar();
    } finally {
      other.cleanup();
    }
  });

  test('travas fixas e política antes do socket', async () => {
    const t = criarTransporteNode({
      identidade: identity(),
      politica: politicaDeHostsPermitidos({ hosts: ['hom.exemplo.invalid'] }),
    });
    await expect(t.enviar({ url: 'http://hom.exemplo.invalid/' })).rejects.toMatchObject({ code: 'config_invalida' });
    await expect(t.enviar({ url: 'nada' })).rejects.toMatchObject({ code: 'config_invalida' });
    await expect(t.enviar({ url: 'https://u:p@hom.exemplo.invalid/' })).rejects.toMatchObject({
      code: 'politica_recusou',
    });
    await expect(t.enviar({ url: 'https://127.0.0.1/' })).rejects.toMatchObject({ code: 'politica_recusou' });
    await expect(t.enviar({ url: 'https://hom.exemplo.invalid/', timeoutMs: 0 })).rejects.toMatchObject({
      code: 'config_invalida',
    });
    await expect(
      t.enviar({ url: 'https://hom.exemplo.invalid/', cabecalhos: { HOST: 'outro.exemplo.invalid' } }),
    ).rejects.toMatchObject({ code: 'politica_recusou', message: expect.stringContaining('Host') });
    await t.fechar();
  });

  test('Host igual à autoridade da URL passa', async () => {
    const url = bunServer((req) => new Response(req.headers.get('host') ?? ''));
    const t = criarTransporteNode({ identidade: identity(), acsAdicionais: [pki.caPem] });
    const host = new URL(url).host;
    const r = await t.enviar({ url: `${url}/ws`, cabecalhos: { Host: host.toUpperCase() } });
    expect(r.texto().toLowerCase()).toBe(host);
    await t.fechar();
  });

  test('perfil DHE nos dados é recusado no Bun antes do socket', async () => {
    const t = criarTransporteNode({ identidade: identity() });
    // GO produção: só DHE (ADR 0004, seção 2)
    await expect(t.enviar({ url: 'https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4' })).rejects.toMatchObject(
      {
        name: 'ErroTransporteNaoSuportado',
        code: 'nao_suportado',
        host: 'nfe.sefaz.go.gov.br',
      },
    );
    await t.fechar();
  });

  test('sigalgs PKCS#1 limita a TLS 1.2 e conecta', async () => {
    const url = bunServer(() => new Response('ok'));
    const t = criarTransporteNode({
      identidade: identity(),
      acsAdicionais: [pki.caPem],
      sigalgs: 'RSA+SHA256:RSA+SHA384',
    });
    const r = await t.enviar({ url });
    expect(r.tls.protocolo).toBe('TLSv1.2');
    await t.fechar();
  });

  test('trust system: usa a loja do sistema ou diz que a runtime não tem', () => {
    try {
      criarTransporteNode({ identidade: identity(), confianca: 'sistema' });
    } catch (e) {
      expect(e).toBeInstanceOf(ErroNaoSuportado);
    }
  });

  test('identidade pem vazia', () => {
    expect(() => criarTransporteNode({ identidade: { tipo: 'pem', cadeia: '', chave: '' } })).toThrow(
      expect.objectContaining({ code: 'config_invalida' }),
    );
  });

  test('identidade helper: política aplicada e requisição delegada', async () => {
    const calls: string[] = [];
    const helper: HelperTlsExterno = {
      versaoDoProtocolo: 1,
      enviar: async (id, req): Promise<RespostaTransporte> => {
        calls.push(`${id} ${req.metodo} ${req.url} ${req.timeoutMs}`);
        const status = req.url.endsWith('/proibido') ? 403 : 200;
        const body = new TextEncoder().encode('ok');
        return {
          status,
          cabecalhos: {},
          corpo: body,
          tls: { protocolo: 'TLSv1.2', cifra: undefined, retomada: undefined, certificadoLocalCarregado: true },
          texto: () => 'ok',
        };
      },
      fechar: async () => {},
    };
    const t = criarTransporte({
      identidade: { tipo: 'helper', helper, identidade: 'a3-token' },
      politica: politicaDeHostsPermitidos({ hosts: ['hom.exemplo.invalid'] }),
      timeoutMs: 1234,
    });
    expect((await t.enviar({ url: 'https://hom.exemplo.invalid/ws' })).status).toBe(200);
    await expect(t.enviar({ url: 'https://hom.exemplo.invalid/proibido' })).rejects.toMatchObject({
      code: 'certificado_ausente_ou_recusado',
    });
    await expect(t.enviar({ url: 'https://outro.invalid/' })).rejects.toMatchObject({ code: 'politica_recusou' });
    expect(calls).toEqual([
      'a3-token GET https://hom.exemplo.invalid/ws 1234',
      'a3-token GET https://hom.exemplo.invalid/proibido 1234',
    ]);
    await t.fechar();
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
    expect(classificarFalhaDeTransporte(err, { host: '127.0.0.1' }).code).toBe('certificado_nao_apresentado');
  });
});

describe('conferirCertificadoLocal', () => {
  const leaf = Uint8Array.of(1, 2, 3);
  test('sem API na runtime, não afirma nada', () => {
    expect(conferirCertificadoLocal({}, leaf)).toBeUndefined();
    expect(conferirCertificadoLocal({ getCertificate: () => undefined }, leaf)).toBeUndefined();
  });
  test('certificado ausente ou diferente é false; o mesmo é true', () => {
    expect(conferirCertificadoLocal({ getCertificate: () => null }, leaf)).toBe(false);
    expect(conferirCertificadoLocal({ getCertificate: () => ({}) }, leaf)).toBe(false);
    expect(conferirCertificadoLocal({ getCertificate: () => ({ raw: Uint8Array.of(1, 2, 4) }) }, leaf)).toBe(false);
    expect(conferirCertificadoLocal({ getCertificate: () => ({ raw: Uint8Array.of(1, 2) }) }, leaf)).toBe(false);
    expect(conferirCertificadoLocal({ getCertificate: () => ({ raw: Uint8Array.of(1, 2, 3) }) }, leaf)).toBe(true);
  });
});

describe('identidadePem', () => {
  test('usa o tlsPem do Certificado', () => {
    const ks = { tlsPem: (o?: unknown) => ({ cadeia: `c${o ? '+cadeia' : ''}`, chave: 'k' }) };
    expect(identidadePem(ks as never)).toEqual({ tipo: 'pem', cadeia: 'c', chave: 'k' });
    expect(identidadePem(ks as never, { cadeia: [] })).toEqual({ tipo: 'pem', cadeia: 'c+cadeia', chave: 'k' });
  });
});
