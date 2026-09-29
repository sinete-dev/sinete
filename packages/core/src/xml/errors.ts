/**
 * Erros do `@sinete/core/xml`. Os dois estendem `SineteError` do core e têm `code` estável (princípio 7).
 */

import type { SineteErrorOptions } from '../errors.ts';
import { SineteError } from '../errors.ts';

/** Códigos lançados por este pacote. */
export type XmlErrorCode = 'xml_malformado' | 'xmldsig_falhou';

/**
 * O texto não é XML 1.0 bem formado com namespaces, ou usa algo que o parser recusa de propósito (DTD, entidade
 * externa). `offset` é a posição (em unidades UTF-16 da string) onde o problema foi detectado.
 */
export class XmlError extends SineteError<'xml_malformado'> {
  readonly offset: number;

  constructor(message: string, offset: number, options?: SineteErrorOptions) {
    super('xml_malformado', `${message} (offset ${offset})`, {
      ...options,
      details: { ...options?.details, offset },
    });
    this.name = 'XmlError';
    this.offset = offset;
  }
}

/** Motivo de uma falha ao preparar ou montar uma assinatura. */
export type XmlSignatureFailure =
  | 'id-ausente'
  | 'id-duplicado'
  | 'referencia-na-raiz'
  | 'placeholder-no-documento'
  | 'placeholder-ausente'
  | 'assinatura-vazia';

/** A assinatura não pôde ser montada (Id ausente ou duplicado, template corrompido, signer devolveu vazio). */
export class XmlSignatureError extends SineteError<'xmldsig_falhou'> {
  readonly reason: XmlSignatureFailure;

  constructor(reason: XmlSignatureFailure, message: string, options?: SineteErrorOptions) {
    super('xmldsig_falhou', message, { ...options, details: { ...options?.details, reason } });
    this.name = 'XmlSignatureError';
    this.reason = reason;
  }
}
