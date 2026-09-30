/**
 * Erros do `@sinete/core/xml`. Os dois estendem `ErroSinete` do core e têm `code` estável (princípio 7).
 */

import type { ErroSineteOpcoes } from '../errors.ts';
import { ErroSinete } from '../errors.ts';

/** Códigos lançados por este pacote. */
export type CodigoErroXml = 'xml_malformado' | 'xmldsig_falhou';

/**
 * O texto não é XML 1.0 bem formado com namespaces, ou usa algo que o parser recusa de propósito (DTD, entidade
 * externa). `posicao` é a posição (em unidades UTF-16 da string) onde o problema foi detectado.
 */
export class ErroXml extends ErroSinete<'xml_malformado'> {
  readonly posicao: number;

  constructor(message: string, posicao: number, options?: ErroSineteOpcoes) {
    super('xml_malformado', `${message} (posição ${posicao})`, {
      ...options,
      detalhes: { ...options?.detalhes, posicao },
    });
    this.name = 'ErroXml';
    this.posicao = posicao;
  }
}

/** Motivo de uma falha ao preparar ou montar uma assinatura. */
export type MotivoFalhaAssinaturaXml =
  | 'id-ausente'
  | 'id-duplicado'
  | 'referencia-na-raiz'
  | 'marcador-no-documento'
  | 'marcador-ausente'
  | 'assinatura-vazia';

/** A assinatura não pôde ser montada (Id ausente ou duplicado, template corrompido, signer devolveu vazio). */
export class ErroAssinaturaXml extends ErroSinete<'xmldsig_falhou'> {
  readonly motivo: MotivoFalhaAssinaturaXml;

  constructor(motivo: MotivoFalhaAssinaturaXml, message: string, options?: ErroSineteOpcoes) {
    super('xmldsig_falhou', message, { ...options, detalhes: { ...options?.detalhes, motivo } });
    this.name = 'ErroAssinaturaXml';
    this.motivo = motivo;
  }
}
