/** Partes comuns às implementações: preparo da requisição, política, capacidade da runtime, auditoria e helper. */

import type { Logger } from '@sinete/core';
import { ErroDeConfiguracao, ehErroSinete, loggerSilencioso } from '@sinete/core';
import type { PerfilTls } from './endpoints.ts';
import { perfilTlsDoHost } from './endpoints.ts';
import { ErroPolitica, ErroTransporteNaoSuportado } from './errors.ts';
import type {
  CapacidadesDoTransporte,
  DescricaoTls,
  PedidoTransporte,
  RespostaTransporte,
  RuntimeDoTransporte,
  TransporteOpcoes,
} from './types.ts';

export const DEFAULT_TIMEOUT_MS = 60_000;

export interface PreparedRequest {
  readonly url: URL;
  readonly host: string;
  readonly method: 'POST' | 'GET';
  readonly headers: Record<string, string>;
  readonly body: Uint8Array | undefined;
  readonly timeoutMs: number;
  readonly profile: PerfilTls | undefined;
}

/** Detecta a runtime pelo global, sem depender de condição de export. */
export function detectarRuntime(): RuntimeDoTransporte | 'navegador' | 'desconhecida' {
  const g = globalThis as {
    Deno?: { version?: { deno?: string } };
    Bun?: unknown;
    process?: { versions?: { node?: string } };
    window?: unknown;
  };
  if (typeof g.Deno?.version?.deno === 'string') return 'deno';
  if (g.Bun !== undefined) return 'bun';
  if (typeof g.process?.versions?.node === 'string') return 'node';
  if (g.window !== undefined) return 'navegador';
  return 'desconhecida';
}

/** Travas fixas (https, sem credencial na URL) e a política do chamador, antes de qualquer socket. */
export async function prepareRequest(req: PedidoTransporte, options: TransporteOpcoes): Promise<PreparedRequest> {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch (cause) {
    throw new ErroDeConfiguracao(`URL inválida: ${JSON.stringify(req.url)}`, { cause });
  }
  if (url.protocol !== 'https:')
    throw new ErroDeConfiguracao(`só https é aceito: ${url.protocol}`, { detalhes: { url: url.origin } });
  if (url.username !== '' || url.password !== '') throw new ErroPolitica('credencial na URL', { host: url.hostname });
  const method = req.metodo ?? (req.corpo === undefined ? 'GET' : 'POST');
  const body = typeof req.corpo === 'string' ? new TextEncoder().encode(req.corpo) : req.corpo;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.cabecalhos ?? {})) headers[k.toLowerCase()] = v;
  // A política aprova o host da URL; um Host diferente mudaria o SNI no node:https e levaria o certificado de cliente
  // e o documento a outro virtual host do mesmo IP. Só se aceita Host igual à autoridade da URL.
  if (headers.host !== undefined && headers.host.trim().toLowerCase() !== url.host.toLowerCase()) {
    throw new ErroPolitica(`cabeçalho Host diferente do host da URL: ${JSON.stringify(headers.host)}`, {
      host: url.hostname,
    });
  }
  if (options.politica)
    await options.politica.conferir({ url, metodo: method, corpo: req.corpo, endpoint: req.endpoint });
  const host = url.hostname.toLowerCase();
  const timeoutMs = req.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new ErroDeConfiguracao(`prazo inválido: ${timeoutMs} ms`);
  return { url, host, method, headers, body, timeoutMs, profile: req.endpoint?.tls ?? perfilTlsDoHost(host) };
}

/** Motivos pelos quais uma runtime não fala com um host, pelo perfil TLS medido. Vazio: compatível. */
export function motivosNaoSuportado(perfil: PerfilTls | undefined, capacidades: CapacidadesDoTransporte): string[] {
  if (!perfil) return [];
  const reasons: string[] = [];
  if (perfil.certificadoDoCliente === 'renegociacao' && !capacidades.renegociacao) {
    reasons.push(`o host pede o certificado numa renegociação TLS (${perfil.evidenciaDoCertificadoDoCliente})`);
  }
  if (!perfil.ecdheAead) {
    if (perfil.trocaDeChaves === 'dhe' && !capacidades.tls12Dhe) {
      reasons.push(`o host só oferece troca DHE (${perfil.cifra})`);
    } else if (perfil.trocaDeChaves !== 'dhe' && !capacidades.tls12Cbc) {
      reasons.push(`o host só oferece suítes CBC (${perfil.cifra})`);
    }
  }
  return reasons;
}

export const UNSUPPORTED_ALTERNATIVE =
  'Use Node ou Bun para este host, ou injete um Transporte próprio (por exemplo, o helper sinete-signer do ADR 0005).';

/** Lança `ErroTransporteNaoSuportado` quando o perfil do host exige o que a runtime não faz. */
export function assertSupported(prepared: PreparedRequest, capabilities: CapacidadesDoTransporte): void {
  const reasons = motivosNaoSuportado(prepared.profile, capabilities);
  if (reasons.length > 0) throw new ErroTransporteNaoSuportado(prepared.host, reasons, UNSUPPORTED_ALTERNATIVE);
}

export function makeResponse(
  status: number,
  headers: Record<string, string>,
  body: Uint8Array,
  tls: DescricaoTls,
): RespostaTransporte {
  return { status, cabecalhos: headers, corpo: body, tls, texto: (): string => new TextDecoder().decode(body) };
}

/** Mede, audita e loga um envio. `run` devolve a resposta ou lança o erro já tipado. */
export async function audited(
  runtime: RuntimeDoTransporte,
  prepared: PreparedRequest,
  options: TransporteOpcoes,
  run: () => Promise<RespostaTransporte>,
): Promise<RespostaTransporte> {
  const logger: Logger = options.logger ?? loggerSilencioso;
  const started = performance.now();
  const base = { runtime, host: prepared.host, caminho: prepared.url.pathname, metodo: prepared.method };
  try {
    const res = await run();
    const durationMs = Math.round(performance.now() - started);
    options.auditoria?.({ ...base, status: res.status, codigoDoErro: undefined, duracaoMs: durationMs });
    logger.debug('transporte: resposta', { ...base, status: res.status, durationMs });
    return res;
  } catch (e) {
    const durationMs = Math.round(performance.now() - started);
    const errorCode = ehErroSinete(e) ? e.code : 'desconhecido';
    options.auditoria?.({ ...base, status: undefined, codigoDoErro: errorCode, duracaoMs: durationMs });
    logger.warn('transporte: falha', { ...base, errorCode, durationMs });
    throw e;
  }
}

/** Envio pela identidade `helper`: a política já rodou, o helper faz o mTLS. */
export function sendViaHelper(
  options: TransporteOpcoes,
  prepared: PreparedRequest,
  signal: AbortSignal | undefined,
): Promise<RespostaTransporte> {
  const id = options.identidade;
  if (id.tipo !== 'helper') throw new ErroDeConfiguracao('identidade não é helper');
  return id.helper.enviar(
    id.identidade,
    {
      url: prepared.url.href,
      metodo: prepared.method,
      cabecalhos: prepared.headers,
      corpo: prepared.body,
      timeoutMs: prepared.timeoutMs,
    },
    signal,
  );
}
