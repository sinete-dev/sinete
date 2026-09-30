/**
 * Transporte do Deno (ADR 0004, decisões 4 e 5): `fetch` com `Deno.createHttpClient({ cert, key, caCerts,
 * http2: false })`. O rustls não renegocia nem fala CBC ou DHE, e nenhuma opção contorna isso; então o transporte
 * recusa, antes de abrir socket e com `TransportUnsupportedError`, os hosts cujo perfil medido exige uma dessas
 * coisas (SP, BA, PR, GO produção, SVAN, SVC-AN, AN, MT homologação e a Sefin da NFS-e).
 *
 * `caCerts` do Deno soma à loja padrão (verificado no S2), então basta passar o conjunto ICP-Brasil.
 */

import { icpBrasilTlsPem } from '@sinete/cert';
import { ErroDeConfiguracao, ErroDeTempoEsgotado, ErroNaoSuportado } from '@sinete/core';
import { classifyTransportFailure, http403Error } from './classify.ts';
import { assertSupported, audited, makeResponse, prepareRequest, sendViaHelper } from './common.ts';
import { TransportError, TransportUnsupportedError } from './errors.ts';
import type {
  Transport,
  TransportCapabilities,
  TransportOptions,
  TransportRequest,
  TransportResponse,
} from './types.ts';

/** O pedaço da API do Deno que o transporte usa (injetável nos testes). */
export interface DenoHttpApi {
  createHttpClient(options: { cert?: string; key?: string; caCerts?: string[]; http1?: boolean; http2?: boolean }): {
    close(): void;
  };
}

export interface DenoTransportOptions extends TransportOptions {
  /** `refuse`: recusa host sem perfil TLS nos dados. Padrão: `allow` (endpoint próprio do chamador). */
  readonly unknownHosts?: 'allow' | 'refuse';
  /** Para testes: a API do Deno e o `fetch`. Padrão: os globais. */
  readonly deno?: DenoHttpApi;
  readonly fetch?: typeof fetch;
}

export const DENO_CAPABILITIES: TransportCapabilities = {
  runtime: 'deno',
  renegotiation: false,
  tls12Cbc: false,
  tls12Dhe: false,
  sigalgsControl: false,
  clientCertificateCheck: false,
};

/** Cria o transporte do Deno. Fora do Deno, só com `deno` e `fetch` injetados. */
export function createDenoTransport(options: DenoTransportOptions): Transport {
  const deno = options.deno ?? (globalThis as { Deno?: DenoHttpApi }).Deno;
  const doFetch = options.fetch ?? globalThis.fetch;
  if (!deno || typeof deno.createHttpClient !== 'function') {
    throw new ErroNaoSuportado('Deno.createHttpClient não existe nesta runtime');
  }
  const id = options.identity;
  const client =
    id.kind === 'pem'
      ? deno.createHttpClient({
          cert: id.certChain,
          key: id.key,
          caCerts: [...icpBrasilTlsPem(), ...(options.additionalCa ?? [])],
          http1: true,
          http2: false,
        })
      : undefined;
  let closed = false;

  async function send(request: TransportRequest): Promise<TransportResponse> {
    if (closed) throw new ErroDeConfiguracao('transporte já fechado');
    const prepared = await prepareRequest(request, options);
    if (id.kind === 'pem') assertSupported(prepared, DENO_CAPABILITIES);
    if (id.kind === 'pem' && !prepared.profile && options.unknownHosts === 'refuse') {
      throw new TransportUnsupportedError(
        prepared.host,
        ['host sem perfil TLS nos dados do sinete'],
        'Passe unknownHosts: "allow" para aceitar endpoints próprios.',
      );
    }
    return audited('deno', prepared, options, async () => {
      if (id.kind === 'helper') {
        const res = await sendViaHelper(options, prepared, request.signal);
        if (res.status === 403 && options.rejectOn403 !== false) throw http403Error(prepared.host);
        return res;
      }
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), prepared.timeoutMs);
      const signal = request.signal ? AbortSignal.any([request.signal, timeout.signal]) : timeout.signal;
      try {
        const res = await doFetch(prepared.url.href, {
          method: prepared.method,
          // Redirecionamento não é seguido: a política e a trava de https só valeram para a URL original, e um 307/308
          // reenviaria o documento fiscal para outro destino. O 3xx volta como resposta para quem chamou.
          redirect: 'manual',
          headers: prepared.headers,
          body: prepared.body as Uint8Array<ArrayBuffer> | undefined,
          signal,
          client,
        } as RequestInit);
        const body = new Uint8Array(await res.arrayBuffer());
        if (res.status === 403 && options.rejectOn403 !== false) throw http403Error(prepared.host);
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          headers[k.toLowerCase()] = v;
        });
        return makeResponse(res.status, headers, body, {
          protocol: undefined,
          cipher: undefined,
          resumed: undefined,
          clientCertificateLoaded: undefined,
        });
      } catch (e) {
        if (request.signal?.aborted) {
          throw new TransportError('cancelado', `${prepared.host}: envio cancelado`, { cause: e });
        }
        if (timeout.signal.aborted) {
          throw new ErroDeTempoEsgotado(
            `${prepared.host}: sem resposta em ${prepared.timeoutMs} ms`,
            prepared.timeoutMs,
            {
              cause: e,
            },
          );
        }
        throw classifyTransportFailure(e, { host: prepared.host });
      } finally {
        clearTimeout(timer);
      }
    });
  }

  return {
    capabilities: DENO_CAPABILITIES,
    send,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      // A conexão com o helper é do chamador, que a fecha quando quiser.
      client?.close();
    },
  };
}
