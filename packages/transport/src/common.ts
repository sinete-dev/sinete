/** Partes comuns às implementações: preparo da requisição, política, capacidade da runtime, auditoria e helper. */

import type { Logger } from '@sinete/core';
import { ErroDeConfiguracao, ehErroSinete, loggerSilencioso } from '@sinete/core';
import type { TlsProfile } from './endpoints.ts';
import { tlsProfileForHost } from './endpoints.ts';
import { PolicyError, TransportUnsupportedError } from './errors.ts';
import type {
  TlsInfo,
  TransportCapabilities,
  TransportOptions,
  TransportRequest,
  TransportResponse,
  TransportRuntime,
} from './types.ts';

export const DEFAULT_TIMEOUT_MS = 60_000;

export interface PreparedRequest {
  readonly url: URL;
  readonly host: string;
  readonly method: 'POST' | 'GET';
  readonly headers: Record<string, string>;
  readonly body: Uint8Array | undefined;
  readonly timeoutMs: number;
  readonly profile: TlsProfile | undefined;
}

/** Detecta a runtime pelo global, sem depender de condição de export. */
export function detectRuntime(): TransportRuntime | 'browser' | 'desconhecida' {
  const g = globalThis as {
    Deno?: { version?: { deno?: string } };
    Bun?: unknown;
    process?: { versions?: { node?: string } };
    window?: unknown;
  };
  if (typeof g.Deno?.version?.deno === 'string') return 'deno';
  if (g.Bun !== undefined) return 'bun';
  if (typeof g.process?.versions?.node === 'string') return 'node';
  if (g.window !== undefined) return 'browser';
  return 'desconhecida';
}

/** Travas fixas (https, sem credencial na URL) e a política do chamador, antes de qualquer socket. */
export async function prepareRequest(req: TransportRequest, options: TransportOptions): Promise<PreparedRequest> {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch (cause) {
    throw new ErroDeConfiguracao(`URL inválida: ${JSON.stringify(req.url)}`, { cause });
  }
  if (url.protocol !== 'https:')
    throw new ErroDeConfiguracao(`só https é aceito: ${url.protocol}`, { detalhes: { url: url.origin } });
  if (url.username !== '' || url.password !== '') throw new PolicyError('credencial na URL', { host: url.hostname });
  const method = req.method ?? (req.body === undefined ? 'GET' : 'POST');
  const body = typeof req.body === 'string' ? new TextEncoder().encode(req.body) : req.body;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers ?? {})) headers[k.toLowerCase()] = v;
  // A política aprova o host da URL; um Host diferente mudaria o SNI no node:https e levaria o certificado de cliente
  // e o documento a outro virtual host do mesmo IP. Só se aceita Host igual à autoridade da URL.
  if (headers.host !== undefined && headers.host.trim().toLowerCase() !== url.host.toLowerCase()) {
    throw new PolicyError(`cabeçalho Host diferente do host da URL: ${JSON.stringify(headers.host)}`, {
      host: url.hostname,
    });
  }
  if (options.policy) await options.policy.check({ url, method, body: req.body, endpoint: req.endpoint });
  const host = url.hostname.toLowerCase();
  const timeoutMs = req.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new ErroDeConfiguracao(`prazo inválido: ${timeoutMs} ms`);
  return { url, host, method, headers, body, timeoutMs, profile: req.endpoint?.tls ?? tlsProfileForHost(host) };
}

/** Motivos pelos quais uma runtime não fala com um host, pelo perfil TLS medido. Vazio: compatível. */
export function unsupportedReasons(profile: TlsProfile | undefined, capabilities: TransportCapabilities): string[] {
  if (!profile) return [];
  const reasons: string[] = [];
  if (profile.clientCert === 'renegotiation' && !capabilities.renegotiation) {
    reasons.push(`o host pede o certificado numa renegociação TLS (${profile.clientCertEvidence})`);
  }
  if (!profile.ecdheAead) {
    if (profile.keyExchange === 'dhe' && !capabilities.tls12Dhe) {
      reasons.push(`o host só oferece troca DHE (${profile.cipher})`);
    } else if (profile.keyExchange !== 'dhe' && !capabilities.tls12Cbc) {
      reasons.push(`o host só oferece suítes CBC (${profile.cipher})`);
    }
  }
  return reasons;
}

export const UNSUPPORTED_ALTERNATIVE =
  'Use Node ou Bun para este host, ou injete um Transport próprio (por exemplo, o helper sinete-signer do ADR 0005).';

/** Lança `TransportUnsupportedError` quando o perfil do host exige o que a runtime não faz. */
export function assertSupported(prepared: PreparedRequest, capabilities: TransportCapabilities): void {
  const reasons = unsupportedReasons(prepared.profile, capabilities);
  if (reasons.length > 0) throw new TransportUnsupportedError(prepared.host, reasons, UNSUPPORTED_ALTERNATIVE);
}

export function makeResponse(
  status: number,
  headers: Record<string, string>,
  body: Uint8Array,
  tls: TlsInfo,
): TransportResponse {
  return { status, headers, body, tls, text: (): string => new TextDecoder().decode(body) };
}

/** Mede, audita e loga um envio. `run` devolve a resposta ou lança o erro já tipado. */
export async function audited(
  runtime: TransportRuntime,
  prepared: PreparedRequest,
  options: TransportOptions,
  run: () => Promise<TransportResponse>,
): Promise<TransportResponse> {
  const logger: Logger = options.logger ?? loggerSilencioso;
  const started = performance.now();
  const base = { runtime, host: prepared.host, path: prepared.url.pathname, method: prepared.method };
  try {
    const res = await run();
    const durationMs = Math.round(performance.now() - started);
    options.audit?.({ ...base, status: res.status, errorCode: undefined, durationMs });
    logger.debug('transporte: resposta', { ...base, status: res.status, durationMs });
    return res;
  } catch (e) {
    const durationMs = Math.round(performance.now() - started);
    const errorCode = ehErroSinete(e) ? e.code : 'desconhecido';
    options.audit?.({ ...base, status: undefined, errorCode, durationMs });
    logger.warn('transporte: falha', { ...base, errorCode, durationMs });
    throw e;
  }
}

/** Envio pela identidade `helper`: a política já rodou, o helper faz o mTLS. */
export function sendViaHelper(
  options: TransportOptions,
  prepared: PreparedRequest,
  signal: AbortSignal | undefined,
): Promise<TransportResponse> {
  const id = options.identity;
  if (id.kind !== 'helper') throw new ErroDeConfiguracao('identidade não é helper');
  return id.helper.request(
    id.identity,
    {
      url: prepared.url.href,
      method: prepared.method,
      headers: prepared.headers,
      body: prepared.body,
      timeoutMs: prepared.timeoutMs,
    },
    signal,
  );
}
