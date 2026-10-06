/**
 * Tradução das falhas de rede e TLS de cada runtime (OpenSSL no Node, BoringSSL no Bun, rustls no Deno) para os
 * códigos estáveis do transporte. O mapa segue o que foi observado contra a SEFAZ no spike S2 (ADR 0004, seção 4).
 */

import type { ErroSinete } from '@sinete/core';
import { ErroDeConfiguracao, ehErroSinete } from '@sinete/core';
import type { CodigoErroTransporte } from './errors.ts';
import { ErroTransporte } from './errors.ts';

/** Alerta TLS (RFC 8446, seção 6) para o código do sinete. */
const ALERTS: Readonly<Record<string, CodigoErroTransporte>> = {
  HANDSHAKE_FAILURE: 'certificado_nao_apresentado',
  BAD_CERTIFICATE: 'certificado_nao_apresentado',
  CERTIFICATE_REQUIRED: 'certificado_nao_apresentado',
  UNSUPPORTED_CERTIFICATE: 'certificado_recusado',
  CERTIFICATE_REVOKED: 'certificado_revogado',
  CERTIFICATE_EXPIRED: 'certificado_expirado',
  CERTIFICATE_UNKNOWN: 'certificado_recusado',
  UNKNOWN_CA: 'certificado_recusado',
  ACCESS_DENIED: 'certificado_recusado',
};

const MESSAGES: Record<CodigoErroTransporte, string> = {
  certificado_nao_apresentado: 'o servidor pediu certificado de cliente e não recebeu',
  certificado_recusado: 'o servidor recusou o certificado de cliente',
  certificado_expirado: 'o servidor recusou o certificado de cliente por estar vencido',
  certificado_revogado: 'o servidor recusou o certificado de cliente por estar revogado',
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
const HINTS: Partial<Record<CodigoErroTransporte, string>> = {
  certificado_nao_apresentado: 'confira se a identidade TLS foi passada ao transporte',
  certificado_ausente_ou_recusado: 'confira a identidade TLS, a validade do certificado e a AC dele',
  certificado_expirado: 'renove o certificado com a AC; confira também o relógio da máquina',
  certificado_revogado: 'o certificado foi revogado pela AC: emita um novo',
  conexao_recusada: 'em MS e MT homologação, reset depois da requisição é falta de certificado',
  cadeia_servidor_nao_confiavel:
    'o transporte soma o bundle ICP-Brasil do @sinete/cert; proxy corporativo pede confianca: "sistema"',
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

function classifyCode(text: string): { code: CodigoErroTransporte; alert?: string } | { config: string } {
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

/** Converte a falha de uma runtime num erro tipado do sinete. `ErroSinete` passa direto. */
export function classificarFalhaDeTransporte(erro: unknown, contexto: { readonly host: string }): ErroSinete {
  if (ehErroSinete(erro)) return erro;
  const text = collectText(erro);
  const r = classifyCode(text);
  if ('config' in r) return new ErroDeConfiguracao(r.config, { cause: erro, detalhes: { host: contexto.host } });
  const hint = HINTS[r.code];
  const details: Record<string, unknown> = { host: contexto.host };
  if (r.alert) details.alerta = r.alert.toLowerCase();
  const sys = (erro as { code?: unknown } | null)?.code;
  if (typeof sys === 'string') details.codigoDoSistema = sys;
  // O alerta 40 é ambíguo: a SEFAZ o manda por falta de certificado (MG, ADR 0004), mas ele também sai quando não há
  // cifra ou versão em comum. O código segue o ADR; a mensagem diz as duas coisas.
  const message =
    r.alert === 'HANDSHAKE_FAILURE'
      ? 'o servidor abortou o handshake (handshake_failure): costuma ser certificado de cliente ausente ou não aceito, mas também pode ser cifra ou versão sem acordo'
      : MESSAGES[r.code];
  return new ErroTransporte(r.code, `${contexto.host}: ${message}${hint ? ` (${hint})` : ''}`, {
    cause: erro,
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
export interface DadosDaFalhaDoHelper {
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
 * que o transporte em processo produziria. O prazo estourado fica de fora: quem chama lança `ErroDeTempoEsgotado`.
 */
export function classificarFalhaDoHelper(dados: DadosDaFalhaDoHelper, mensagem: string, host: string): ErroTransporte {
  let code: CodigoErroTransporte;
  let alert: string | undefined;
  if (dados.alert !== undefined) {
    alert = ALERT_NAMES[dados.alert] ?? `ALERT_${dados.alert}`;
    code = alert === 'BAD_RECORD_MAC' ? 'certificado_ausente_ou_recusado' : (ALERTS[alert] ?? 'falha_tls');
  } else if (dados.x509 === 'hostname') code = 'nome_servidor_divergente';
  else if (dados.x509 !== undefined) code = 'cadeia_servidor_nao_confiavel';
  else if (dados.reset || (dados.refused && dados.stage !== 'dial')) code = 'conexao_recusada';
  else if (dados.dns || dados.stage === 'dial') code = 'falha_rede';
  else if (dados.notTls || dados.stage === 'handshake') code = 'falha_tls';
  else code = 'falha_rede';
  const hint = HINTS[code];
  const details: Record<string, unknown> = { host, mensagemDoHelper: mensagem };
  if (alert) details.alerta = alert.toLowerCase();
  if (dados.stage) details.etapa = dados.stage;
  const text =
    alert === 'HANDSHAKE_FAILURE'
      ? 'o servidor abortou o handshake (handshake_failure): costuma ser certificado de cliente ausente ou não aceito, mas também pode ser cifra ou versão sem acordo'
      : MESSAGES[code];
  return new ErroTransporte(code, `${host}: ${text}${hint ? ` (${hint})` : ''}`, { detalhes: details });
}

/** HTTP 403 do IIS da SEFAZ: certificado ausente ou recusado (o subcódigo 403.7/403.16 só às vezes vem no corpo). */
export function erroHttp403(host: string): ErroTransporte {
  return new ErroTransporte(
    'certificado_ausente_ou_recusado',
    `${host}: HTTP 403, ${MESSAGES.certificado_ausente_ou_recusado} (${HINTS.certificado_ausente_ou_recusado})`,
    { detalhes: { host, status: 403 } },
  );
}
