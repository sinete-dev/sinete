/**
 * Transporte de Node e Bun (ADR 0004, decisão 4): uma implementação só, sobre `node:https` + `https.Agent`.
 *
 * - HTTP/1.1 sempre (o `node:https` não fala h2; o h2 do undici quebra os hosts que renegociam).
 * - Confiança somada por Agent, sem mexer no processo: `ca` = raízes da runtime (ou a loja do sistema, com
 *   `trust: 'system'`) + conjunto ICP-Brasil do `@sinete/cert` + `additionalCa`. Nada de `NODE_EXTRA_CA_CERTS`,
 *   `setDefaultCACertificates` ou `rejectUnauthorized: false`.
 * - Identidade em PEM na memória (nunca o PFX: o OpenSSL 3 recusa o legado). Renegociação iniciada pelo servidor
 *   fica permitida (é como o IIS da SEFAZ pede o certificado).
 * - Falha barulhenta: depois do handshake, o certificado local do socket tem de ser o da identidade.
 */

import https from 'node:https';
import tls from 'node:tls';
import { icpBrasilTlsPem, pemToDers } from '@sinete/cert';
import { ConfigError, TimeoutError, UnsupportedError } from '@sinete/core';
import { classifyTransportFailure, http403Error } from './classify.ts';
import { assertSupported, audited, detectRuntime, makeResponse, prepareRequest, sendViaHelper } from './common.ts';
import { TransportError } from './errors.ts';
import type {
  Transport,
  TransportCapabilities,
  TransportOptions,
  TransportRequest,
  TransportResponse,
} from './types.ts';

export interface NodeTransportOptions extends TransportOptions {
  /** `bundled` (padrão): raízes embutidas na runtime; `system`: loja do sistema (proxy corporativo). */
  readonly trust?: 'bundled' | 'system';
  /**
   * Algoritmos de assinatura do handshake (formato OpenSSL, ex.: `RSA+SHA256:RSA+SHA384:RSA+SHA512`). Com isso o
   * TLS fica limitado a 1.2, onde PKCS#1 v1.5 é permitido (ADR 0004, seção 5).
   */
  readonly sigalgs?: string;
  /** Padrão: `true` (pool keep-alive por host). */
  readonly keepAlive?: boolean;
}

interface LocalCert {
  raw?: Uint8Array;
}

function sameBytes(a: Uint8Array | undefined, b: Uint8Array | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function trustStore(trust: 'bundled' | 'system'): string[] {
  if (trust === 'bundled') return [...tls.rootCertificates];
  const get = (tls as { getCACertificates?: (type: string) => string[] }).getCACertificates;
  if (typeof get !== 'function') {
    throw new UnsupportedError('trust: "system" precisa de tls.getCACertificates (Node 22.15+ ou 23.5+)');
  }
  return get('system');
}

/**
 * Confere se o socket carregou o certificado da identidade. `undefined` quando a runtime não expõe o certificado
 * local (o transporte então não afirma nada).
 */
export function checkLocalCertificate(
  socket: { getCertificate?: () => LocalCert | null | undefined },
  expectedLeaf: Uint8Array,
): boolean | undefined {
  if (typeof socket.getCertificate !== 'function') return undefined;
  const local = socket.getCertificate();
  if (local === undefined) return undefined;
  return sameBytes(local?.raw ? new Uint8Array(local.raw) : undefined, expectedLeaf);
}

/** Cria o transporte de Node e Bun. */
export function createNodeTransport(options: NodeTransportOptions): Transport {
  const rt = detectRuntime();
  const runtime = rt === 'bun' ? 'bun' : 'node';
  const capabilities: TransportCapabilities = {
    runtime,
    renegotiation: true,
    tls12Cbc: true,
    // BoringSSL (Bun) não tem suítes DHE: GO produção fica fora do Bun (achado do laboratório TLS).
    tls12Dhe: runtime === 'node',
    sigalgsControl: true,
    clientCertificateCheck: true,
  };
  const id = options.identity;
  let agent: https.Agent | undefined;
  let expectedLeaf: Uint8Array | undefined;
  if (id.kind === 'pem') {
    expectedLeaf = pemToDers(id.certChain)[0];
    if (!expectedLeaf) throw new ConfigError('identidade pem sem certificado');
    agent = new https.Agent({
      keepAlive: options.keepAlive ?? true,
      cert: id.certChain,
      key: id.key,
      ca: [...trustStore(options.trust ?? 'bundled'), ...icpBrasilTlsPem(), ...(options.additionalCa ?? [])],
      minVersion: 'TLSv1.2',
      ...(options.sigalgs === undefined ? {} : { sigalgs: options.sigalgs, maxVersion: 'TLSv1.2' as const }),
    });
  }
  let closed = false;

  function sendPem(
    prepared: Awaited<ReturnType<typeof prepareRequest>>,
    signal: AbortSignal | undefined,
  ): Promise<TransportResponse> {
    return new Promise<TransportResponse>((resolve, reject) => {
      let loaded: boolean | undefined;
      let tlsInfo: { protocol: string | undefined; cipher: string | undefined; resumed: boolean | undefined } = {
        protocol: undefined,
        cipher: undefined,
        resumed: undefined,
      };
      let settled = false;
      // Prazo total da requisição. O `timeout` do https.request é só de inatividade do socket: um servidor que pinga
      // pedaços da resposta o manteria vivo para sempre.
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const fail = (e: unknown): void => {
        clearTimeout(deadline);
        if (settled) return;
        settled = true;
        reject(e);
      };
      let req: ReturnType<typeof https.request>;
      try {
        req = https.request(
          prepared.url,
          { method: prepared.method, agent, headers: prepared.headers, timeout: prepared.timeoutMs },
          (res) => {
            const chunks: Uint8Array[] = [];
            res.on('data', (d: Uint8Array) => chunks.push(d));
            res.on('error', (e) => fail(classifyTransportFailure(e, { host: prepared.host })));
            res.on('end', () => {
              if (settled) return;
              const status = res.statusCode ?? 0;
              if (status === 403 && options.rejectOn403 !== false) return fail(http403Error(prepared.host));
              const size = chunks.reduce((n, c) => n + c.length, 0);
              const body = new Uint8Array(size);
              let o = 0;
              for (const c of chunks) {
                body.set(c, o);
                o += c.length;
              }
              const headers: Record<string, string> = {};
              for (const [k, v] of Object.entries(res.headers)) {
                if (v !== undefined) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
              }
              settled = true;
              clearTimeout(deadline);
              resolve(makeResponse(status, headers, body, { ...tlsInfo, clientCertificateLoaded: loaded }));
            });
          },
        );
      } catch (e) {
        // Identidade inválida (chave que não casa com o certificado, PEM corrompido) estoura aqui, ao criar o contexto.
        fail(classifyTransportFailure(e, { host: prepared.host }));
        return;
      }
      // Lido logo depois do handshake: com `connection: close` o socket já foi destruído quando a resposta termina.
      const verify = (s: tls.TLSSocket): void => {
        tlsInfo = {
          protocol: s.getProtocol?.() ?? undefined,
          cipher: s.getCipher?.()?.name,
          resumed: s.isSessionReused?.() ?? undefined,
        };
        loaded = checkLocalCertificate(s as never, expectedLeaf as Uint8Array);
        if (loaded === false) {
          req.destroy(
            new TransportError(
              'certificado_nao_carregado',
              `${prepared.host}: o socket TLS não carregou o certificado da identidade`,
              { details: { host: prepared.host } },
            ),
          );
        }
      };
      req.on('socket', (socket) => {
        const s = socket as tls.TLSSocket;
        // Socket novo: confere depois do handshake; reaproveitado do pool: já passou pelo handshake.
        if (s.connecting || !(s as { encrypted?: boolean }).encrypted || s.getProtocol?.() == null) {
          s.once('secureConnect', () => verify(s));
        } else verify(s);
      });
      const timedOut = (): void => {
        req.destroy(new TimeoutError(`${prepared.host}: sem resposta em ${prepared.timeoutMs} ms`, prepared.timeoutMs));
      };
      req.on('timeout', timedOut);
      deadline = setTimeout(timedOut, prepared.timeoutMs);
      const onAbort = (): void => {
        req.destroy(new TransportError('cancelado', `${prepared.host}: envio cancelado`, { cause: signal?.reason }));
      };
      if (signal?.aborted) onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      req.on('close', () => signal?.removeEventListener('abort', onAbort));
      req.on('error', (e) => fail(classifyTransportFailure(e, { host: prepared.host })));
      req.end(prepared.body);
    });
  }

  return {
    capabilities,
    async send(request: TransportRequest): Promise<TransportResponse> {
      if (closed) throw new ConfigError('transporte já fechado');
      const prepared = await prepareRequest(request, options);
      if (id.kind === 'pem') assertSupported(prepared, capabilities);
      return audited(runtime, prepared, options, async () => {
        if (id.kind === 'helper') {
          const res = await sendViaHelper(options, prepared, request.signal);
          if (res.status === 403 && options.rejectOn403 !== false) throw http403Error(prepared.host);
          return res;
        }
        return sendPem(prepared, request.signal);
      });
    },
    async close(): Promise<void> {
      closed = true;
      agent?.destroy();
    },
  };
}
