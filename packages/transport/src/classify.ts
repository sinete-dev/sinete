/**
 * Tradução das falhas de rede e TLS de cada runtime (OpenSSL no Node, BoringSSL no Bun, rustls no Deno) para os
 * códigos estáveis do transporte. O mapa segue o que foi observado contra a SEFAZ no spike S2 (ADR 0004, seção 4).
 */

import type { ErroSinete } from '@sinete/core';
import { ErroDeConfiguracao, ehErroSinete } from '@sinete/core';
import type { TransportErrorCode } from './errors.ts';
import { TransportError } from './errors.ts';

/** Alerta TLS (RFC 8446, seção 6) para o código do sinete. */
const ALERTS: Readonly<Record<string, TransportErrorCode>> = {
  HANDSHAKE_FAILURE: 'certificado_nao_apresentado',
  BAD_CERTIFICATE: 'certificado_nao_apresentado',
  CERTIFICATE_REQUIRED: 'certificado_nao_apresentado',
  UNSUPPORTED_CERTIFICATE: 'certificado_recusado',
  CERTIFICATE_REVOKED: 'certificado_recusado',
  CERTIFICATE_EXPIRED: 'certificado_recusado',
  CERTIFICATE_UNKNOWN: 'certificado_recusado',
  UNKNOWN_CA: 'certificado_recusado',
  ACCESS_DENIED: 'certificado_recusado',
};

const MESSAGES: Record<TransportErrorCode, string> = {
  certificado_nao_apresentado: 'o servidor pediu certificado de cliente e não recebeu',
  certificado_recusado: 'o servidor recusou o certificado de cliente',
  certificado_ausente_ou_recusado: 'o servidor recusou a conexão por certificado ausente ou não aceito',
  certificado_nao_carregado: 'o certificado da identidade não está no contexto TLS',
  conexao_recusada: 'o servidor fechou ou recusou a conexão',
  cadeia_servidor_nao_confiavel: 'a cadeia do servidor não fecha nas raízes da runtime + ICP-Brasil',
  nome_servidor_divergente: 'o certificado do servidor não é do host pedido',
  falha_tls: 'falha no handshake TLS',
  falha_rede: 'falha de rede',
  politica_recusou: 'a política de hosts recusou o envio',
  cancelado: 'envio cancelado pelo chamador',
};

/** Hints que acompanham a mensagem, para quem lê o log. */
const HINTS: Partial<Record<TransportErrorCode, string>> = {
  certificado_nao_apresentado: 'confira se a identidade TLS foi passada ao transporte',
  certificado_ausente_ou_recusado: 'confira a identidade TLS, a validade do certificado e a AC dele',
  conexao_recusada: 'em MS e MT homologação, reset depois da requisição é falta de certificado',
  cadeia_servidor_nao_confiavel:
    'o transporte soma o bundle ICP-Brasil do @sinete/cert; proxy corporativo pede trust: "system"',
};

function collectText(err: unknown, depth = 0): string {
  if (depth > 4 || err === null || err === undefined) return '';
  if (typeof err !== 'object') return String(err);
  const e = err as { code?: unknown; message?: unknown; name?: unknown; cause?: unknown; reason?: unknown };
  const own = [e.name, e.code, e.message, e.reason].filter((x) => typeof x === 'string').join(' ');
  return `${own} ${collectText(e.cause, depth + 1)}`;
}

/** `BadCertificate` (rustls) e `bad certificate` (OpenSSL) viram `BAD_CERTIFICATE`. */
function alertName(text: string): string | undefined {
  const upper = /ALERT_([A-Z0-9_]+)/.exec(text)?.[1];
  if (upper) return upper.replace(/^(TLSV1|TLSV13|SSLV3)_ALERT_/, '');
  const spaced = /alert ([a-z ]+?)(?:$|[^a-z ])/i.exec(text)?.[1];
  const camel = /fatal alert: ?([A-Za-z]+)/.exec(text)?.[1];
  const raw = camel ?? spaced;
  if (!raw) return undefined;
  return raw
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();
}

function classifyCode(text: string): { code: TransportErrorCode; alert?: string } | { config: string } {
  if (/KEY_VALUES_MISMATCH|key values mismatch/i.test(text)) {
    return { config: 'certificado e chave da identidade TLS não correspondem' };
  }
  if (/ALTNAME|NotValidForName|not valid for name|Hostname\/IP does not match/i.test(text)) {
    return { code: 'nome_servidor_divergente' };
  }
  if (/BAD_RECORD_MAC|bad record mac|BadRecordMac/i.test(text)) return { code: 'certificado_ausente_ou_recusado' };
  const alert = /alert/i.test(text) ? alertName(text) : undefined;
  if (alert) return { code: ALERTS[alert] ?? 'falha_tls', alert };
  if (
    /UNABLE_TO_GET_ISSUER_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT|CERT_HAS_EXPIRED|CERT_UNTRUSTED|UnknownIssuer|invalid peer certificate|certificate verify failed/i.test(
      text,
    )
  ) {
    return { code: 'cadeia_servidor_nao_confiavel' };
  }
  if (
    /ECONNRESET|socket hang up|EPIPE|ECONNREFUSED|connection reset|connection refused|connection closed/i.test(text)
  ) {
    return { code: 'conexao_recusada' };
  }
  if (/ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|dns error|failed to lookup/i.test(text)) {
    return { code: 'falha_rede' };
  }
  if (/SSL|TLS|handshake|cipher/i.test(text)) return { code: 'falha_tls' };
  return { code: 'falha_rede' };
}

/** Converte a falha de uma runtime num erro tipado do sinete. `SineteError` passa direto. */
export function classifyTransportFailure(err: unknown, context: { readonly host: string }): ErroSinete {
  if (ehErroSinete(err)) return err;
  const text = collectText(err);
  const r = classifyCode(text);
  if ('config' in r) return new ErroDeConfiguracao(r.config, { cause: err, detalhes: { host: context.host } });
  const hint = HINTS[r.code];
  const details: Record<string, unknown> = { host: context.host };
  if (r.alert) details.alert = r.alert.toLowerCase();
  const sys = (err as { code?: unknown } | null)?.code;
  if (typeof sys === 'string') details.systemCode = sys;
  // O alerta 40 é ambíguo: a SEFAZ o manda por falta de certificado (MG, ADR 0004), mas ele também sai quando não há
  // cifra ou versão em comum. O código segue o ADR; a mensagem diz as duas coisas.
  const message =
    r.alert === 'HANDSHAKE_FAILURE'
      ? 'o servidor abortou o handshake (handshake_failure): costuma ser certificado de cliente ausente ou não aceito, mas também pode ser cifra ou versão sem acordo'
      : MESSAGES[r.code];
  return new TransportError(r.code, `${context.host}: ${message}${hint ? ` (${hint})` : ''}`, {
    cause: err,
    detalhes: details,
  });
}

/** Número do alerta TLS (RFC 5246, seção 7.2; RFC 8446, seção 6) para o nome usado em `ALERTS`. */
const ALERT_NAMES: Readonly<Record<number, string>> = {
  20: 'BAD_RECORD_MAC',
  40: 'HANDSHAKE_FAILURE',
  42: 'BAD_CERTIFICATE',
  43: 'UNSUPPORTED_CERTIFICATE',
  44: 'CERTIFICATE_REVOKED',
  45: 'CERTIFICATE_EXPIRED',
  46: 'CERTIFICATE_UNKNOWN',
  48: 'UNKNOWN_CA',
  49: 'ACCESS_DENIED',
  70: 'PROTOCOL_VERSION',
  71: 'INSUFFICIENT_SECURITY',
  116: 'CERTIFICATE_REQUIRED',
};

/** O `data` de um erro `transport` do helper `sinete-signer` (docs/signer-contract/PROTOCOL.md). */
export interface HelperFailureData {
  readonly stage?: 'dial' | 'handshake' | 'request' | 'response';
  readonly alert?: number;
  readonly x509?: 'unknown_authority' | 'hostname' | 'invalid';
  readonly timeout?: boolean;
  readonly reset?: boolean;
  readonly refused?: boolean;
  readonly dns?: boolean;
  readonly notTls?: boolean;
}

/**
 * Converte a falha de transporte relatada pelo helper (código `transport` com `data` estruturado) no mesmo erro tipado
 * que o transporte em processo produziria. O prazo estourado fica de fora: quem chama lança `TimeoutError`.
 */
export function classifyHelperFailure(data: HelperFailureData, message: string, host: string): TransportError {
  let code: TransportErrorCode;
  let alert: string | undefined;
  if (data.alert !== undefined) {
    alert = ALERT_NAMES[data.alert] ?? `ALERT_${data.alert}`;
    code = alert === 'BAD_RECORD_MAC' ? 'certificado_ausente_ou_recusado' : (ALERTS[alert] ?? 'falha_tls');
  } else if (data.x509 === 'hostname') code = 'nome_servidor_divergente';
  else if (data.x509 !== undefined) code = 'cadeia_servidor_nao_confiavel';
  else if (data.reset || (data.refused && data.stage !== 'dial')) code = 'conexao_recusada';
  else if (data.dns || data.stage === 'dial') code = 'falha_rede';
  else if (data.notTls || data.stage === 'handshake') code = 'falha_tls';
  else code = 'falha_rede';
  const hint = HINTS[code];
  const details: Record<string, unknown> = { host, helper: message };
  if (alert) details.alert = alert.toLowerCase();
  if (data.stage) details.stage = data.stage;
  const text =
    alert === 'HANDSHAKE_FAILURE'
      ? 'o servidor abortou o handshake (handshake_failure): costuma ser certificado de cliente ausente ou não aceito, mas também pode ser cifra ou versão sem acordo'
      : MESSAGES[code];
  return new TransportError(code, `${host}: ${text}${hint ? ` (${hint})` : ''}`, { detalhes: details });
}

/** HTTP 403 do IIS da SEFAZ: certificado ausente ou recusado (o subcódigo 403.7/403.16 só às vezes vem no corpo). */
export function http403Error(host: string): TransportError {
  return new TransportError(
    'certificado_ausente_ou_recusado',
    `${host}: HTTP 403, ${MESSAGES.certificado_ausente_ou_recusado} (${HINTS.certificado_ausente_ou_recusado})`,
    { detalhes: { host, status: 403 } },
  );
}
