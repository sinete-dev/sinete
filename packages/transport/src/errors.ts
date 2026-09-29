import type { ErrorDetails, SineteErrorOptions } from '@sinete/core';
import { SineteError, UnsupportedError } from '@sinete/core';

/**
 * Códigos estáveis do `@sinete/transport`, mapeados do que a SEFAZ faz de fato (ADR 0004, seção 4 e decisão 4).
 * Os detalhes trazem host, alerta TLS, código do sistema e status HTTP; nunca corpo, chave ou certificado.
 */
export type TransportErrorCode =
  /** O servidor pediu certificado e não recebeu (alertas TLS 40 e 42; 116 no TLS 1.3). */
  | 'certificado_nao_apresentado'
  /** O servidor recebeu o certificado e recusou (alertas 43 a 46, 48 e 49: expirado, revogado, AC desconhecida). */
  | 'certificado_recusado'
  /** Recusa sem distinguir ausência de recusa: HTTP 403 do IIS e o "bad record mac" do ADN em TLS 1.3. */
  | 'certificado_ausente_ou_recusado'
  /** A identidade não entrou no contexto TLS (o socket não tem certificado local, ou tem outro). */
  | 'certificado_nao_carregado'
  /** O servidor fechou ou recusou a conexão (TCP reset depois da requisição costuma ser falta de certificado). */
  | 'conexao_recusada'
  /** A cadeia do servidor não fecha nas raízes da runtime + ICP-Brasil. */
  | 'cadeia_servidor_nao_confiavel'
  /** O certificado do servidor não é do host pedido. */
  | 'nome_servidor_divergente'
  /** Outra falha de TLS (versão, cifra, handshake). */
  | 'falha_tls'
  /** Falha de rede antes do TLS (DNS, rota). */
  | 'falha_rede'
  /** A `HostPolicy` recusou o envio antes de abrir socket. */
  | 'politica_recusou'
  /** O chamador cancelou pelo `AbortSignal`. */
  | 'cancelado';

export class TransportError extends SineteError<TransportErrorCode> {
  constructor(code: TransportErrorCode, message: string, options?: SineteErrorOptions) {
    super(code, message, options);
    this.name = 'TransportError';
  }
}

/** Recusa da `HostPolicy`. Sempre antes de qualquer socket. */
export class PolicyError extends TransportError {
  constructor(message: string, details?: ErrorDetails) {
    super('politica_recusou', message, details === undefined ? undefined : { details });
    this.name = 'PolicyError';
  }
}

/**
 * A runtime não consegue falar com o host pedido (ADR 0004, decisão 4): hoje, o Deno (rustls) diante de um host que
 * pede o certificado numa renegociação ou que só oferece CBC ou DHE. `details` traz `host`, `reasons` e
 * `alternative`. O código é o `nao_suportado` do core.
 */
export class TransportUnsupportedError extends UnsupportedError {
  readonly host: string;
  readonly reasons: readonly string[];

  constructor(host: string, reasons: readonly string[], alternative: string, options?: SineteErrorOptions) {
    super(`${host}: esta runtime não suporta o que o host exige (${reasons.join('; ')}). ${alternative}`, {
      ...options,
      details: { host, reasons, alternative },
    });
    this.name = 'TransportUnsupportedError';
    this.host = host;
    this.reasons = reasons;
  }
}

/**
 * Códigos do cliente do helper `sinete-signer` (`@sinete/transport/signer`, ADR 0005). As falhas de rede e TLS do
 * helper viram os mesmos `TransportError` do transporte em processo; estes são os que só existem com o helper.
 */
export type SignerErrorCode =
  /** O binário não foi achado ou não subiu, ou o processo saiu (o canal fechou). */
  | 'signer_indisponivel'
  /** O helper fala outra versão do protocolo ou respondeu fora do contrato. */
  | 'signer_protocolo'
  /** Quem assina recusou o handshake (política do dono da chave) ou devolveu assinatura que não confere. */
  | 'assinatura_tls_recusada'
  /** Quem assina não respondeu no prazo da identidade (`signTimeoutMs`). */
  | 'assinatura_tls_expirou'
  /** O token PKCS#11 falhou: módulo, token, PIN, objeto ou `C_Sign`; ou o binário não tem PKCS#11. */
  | 'pkcs11_falhou'
  /** O helper recusou assinar o documento (`dfe.sign`): o SignedInfo ou o Id não são de documento do titular. */
  | 'assinatura_documento_recusada';

export class SignerError extends SineteError<SignerErrorCode> {
  constructor(code: SignerErrorCode, message: string, options?: SineteErrorOptions) {
    super(code, message, options);
    this.name = 'SignerError';
  }
}
