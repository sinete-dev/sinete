/** Transporte do Deno com a API do Deno e o fetch injetados (a execução real está no laboratório TLS). */
import { describe, expect, test } from 'bun:test';
import { memoryLogger, TimeoutError, UnsupportedError } from '@sinete/core';
import * as nodeEntry from '../src/index.node.ts';
import type { DenoHttpApi, ExternalTlsHelper, TransportResponse } from '../src/index.ts';
import {
  allowlistPolicy,
  createDenoTransport,
  createTransport,
  DENO_CAPABILITIES,
  TransportUnsupportedError,
} from '../src/index.ts';

const identity = { kind: 'pem' as const, certChain: 'CERT', key: 'KEY' };

function fakeDeno() {
  const created: Record<string, unknown>[] = [];
  let closed = 0;
  const api: DenoHttpApi = {
    createHttpClient(o) {
      created.push(o);
      return { close: () => void closed++ };
    },
  };
  return { api, created, closed: () => closed };
}

describe('createDenoTransport', () => {
  test('cliente com identidade, ICP-Brasil somada e HTTP/1.1', async () => {
    const d = fakeDeno();
    const seen: RequestInit[] = [];
    const t = createDenoTransport({
      identity,
      additionalCa: ['EXTRA'],
      deno: d.api,
      fetch: (async (_url: string, init: RequestInit) => {
        seen.push(init);
        return new Response('<ok/>', { status: 200, headers: { 'X-Algo': '1' } });
      }) as unknown as typeof fetch,
    });
    expect(t.capabilities).toBe(DENO_CAPABILITIES);
    const created = d.created[0] as { cert: string; key: string; caCerts: string[]; http1: boolean; http2: boolean };
    expect(created).toMatchObject({ cert: 'CERT', key: 'KEY', http1: true, http2: false });
    expect(created.caCerts.at(-1)).toBe('EXTRA');
    expect(created.caCerts.length).toBe(8);
    const r = await t.send({ url: 'https://nfe-homologacao.svrs.rs.gov.br/ws/x', body: '<a/>' });
    expect(r.status).toBe(200);
    expect(r.text()).toBe('<ok/>');
    expect(r.headers['x-algo']).toBe('1');
    expect(r.tls.clientCertificateLoaded).toBeUndefined();
    expect(seen[0]?.method).toBe('POST');
    expect(seen[0]?.redirect).toBe('manual');
    expect((seen[0] as { client?: unknown }).client).toBeDefined();
    await t.close();
    await t.close();
    expect(d.closed()).toBe(1);
    await expect(t.send({ url: 'https://nfe-homologacao.svrs.rs.gov.br/' })).rejects.toMatchObject({
      code: 'config_invalida',
    });
  });

  test('recusa hosts que renegociam ou só têm CBC/DHE, antes do fetch', async () => {
    let calls = 0;
    const logger = memoryLogger();
    const t = createDenoTransport({
      identity,
      logger,
      deno: fakeDeno().api,
      fetch: (async () => {
        calls++;
        return new Response('x');
      }) as unknown as typeof fetch,
    });
    for (const url of [
      'https://homologacao.nfe.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx',
      'https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeStatusServico4',
      'https://nfe.sefaz.go.gov.br/nfe/services/NFeStatusServico4',
      'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/nfse',
    ]) {
      const e = await t.send({ url }).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(TransportUnsupportedError);
      expect(e).toBeInstanceOf(UnsupportedError);
      expect((e as TransportUnsupportedError).code).toBe('nao_suportado');
      expect((e as TransportUnsupportedError).reasons.length).toBeGreaterThan(0);
    }
    expect(calls).toBe(0);
    await t.close();
  });

  test('unknownHosts: refuse recusa host sem perfil', async () => {
    const t = createDenoTransport({
      identity,
      unknownHosts: 'refuse',
      deno: fakeDeno().api,
      fetch: (async () => new Response('x')) as never,
    });
    await expect(t.send({ url: 'https://meu-endpoint.invalid/' })).rejects.toMatchObject({ code: 'nao_suportado' });
    await t.close();
  });

  test('403, prazo, cancelamento e falha classificada', async () => {
    const t = createDenoTransport({
      identity,
      timeoutMs: 50,
      deno: fakeDeno().api,
      fetch: (async (url: string, init: RequestInit) => {
        if (url.endsWith('/403')) return new Response('', { status: 403 });
        if (url.endsWith('/erro'))
          throw new TypeError('error sending request: client error (Connect): invalid peer certificate: UnknownIssuer');
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('abortado', 'AbortError')));
        });
      }) as unknown as typeof fetch,
    });
    const base = 'https://nfe-homologacao.svrs.rs.gov.br';
    await expect(t.send({ url: `${base}/403` })).rejects.toMatchObject({ code: 'certificado_ausente_ou_recusado' });
    await expect(t.send({ url: `${base}/erro` })).rejects.toMatchObject({ code: 'cadeia_servidor_nao_confiavel' });
    await expect(t.send({ url: `${base}/lento` })).rejects.toBeInstanceOf(TimeoutError);
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 10);
    await expect(t.send({ url: `${base}/lento`, signal: ac.signal, timeoutMs: 5000 })).rejects.toMatchObject({
      code: 'cancelado',
    });
    const lax = createDenoTransport({
      identity,
      rejectOn403: false,
      deno: fakeDeno().api,
      fetch: (async () => new Response('', { status: 403 })) as never,
    });
    expect((await lax.send({ url: `${base}/403` })).status).toBe(403);
  });

  test('identidade helper não cria cliente nem checa perfil (o helper fala TLS por conta própria)', async () => {
    const d = fakeDeno();
    const helper: ExternalTlsHelper = {
      protocolVersion: 1,
      request: async (_id, req): Promise<TransportResponse> => ({
        status: req.url.endsWith('/403') ? 403 : 200,
        headers: {},
        body: new Uint8Array(),
        tls: { protocol: undefined, cipher: undefined, resumed: undefined, clientCertificateLoaded: undefined },
        text: () => '',
      }),
      close: async () => {},
    };
    const t = createDenoTransport({
      identity: { kind: 'helper', helper, identity: 'x' },
      policy: allowlistPolicy({ hosts: ['homologacao.nfe.fazenda.sp.gov.br'] }),
      deno: d.api,
    });
    expect(d.created).toHaveLength(0);
    expect((await t.send({ url: 'https://homologacao.nfe.fazenda.sp.gov.br/ws' })).status).toBe(200);
    await expect(t.send({ url: 'https://homologacao.nfe.fazenda.sp.gov.br/403' })).rejects.toMatchObject({
      code: 'certificado_ausente_ou_recusado',
    });
    await t.close();
  });

  test('sem Deno na runtime', () => {
    expect(() => createDenoTransport({ identity })).toThrow(UnsupportedError);
  });
});

describe('createTransport por entrada', () => {
  test('entrada default fora do Deno lança em vez de cair num fetch genérico', () => {
    expect(() => createTransport({ identity })).toThrow(expect.objectContaining({ code: 'nao_suportado' }));
  });

  test('entrada default e node escolhem o Deno quando o global existe', () => {
    const g = globalThis as { Deno?: unknown };
    g.Deno = { version: { deno: '2.9.1' }, ...fakeDeno().api };
    try {
      expect(createTransport({ identity }).capabilities.runtime).toBe('deno');
      expect(nodeEntry.createTransport({ identity }).capabilities.runtime).toBe('deno');
    } finally {
      delete g.Deno;
    }
    expect(nodeEntry.detectRuntime()).toBe('bun');
  });
});
