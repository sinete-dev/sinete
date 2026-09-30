/**
 * `@sinete/schemas`: runtime genérico dos módulos gerados dos XSD oficiais (ADR 0002).
 *
 * Os módulos de cada documento e pacote de liberação ficam em subpaths (`@sinete/schemas/nfe/PL_010f`,
 * `@sinete/schemas/mdfe/3.00b`, `@sinete/schemas/nfe/evento-cancelamento/PL_010d`...) e exportam, com o mesmo
 * identificador, o tipo TS e o descritor de cada tipo complexo, mais os elementos raiz (`nfeProcElement`). Este
 * ponto de entrada traz o que percorre os descritores: serializer canônico, decoder tolerante, validador estrito e a
 * tabela de vigências.
 */

import type { DocumentoXml } from '@sinete/core/xml';
import { lerXml } from '@sinete/core/xml';
import type { Decoded } from './runtime/decode.ts';
import { decodeRoot } from './runtime/decode.ts';
import type { RootElement } from './runtime/desc.ts';

export type { SchemasErrorCode } from './errors.ts';
export { SerializeError, VigenciaError } from './errors.ts';
export type { Decoded, DecodeIssue, DecodeIssueCode } from './runtime/decode.ts';
export { decode, decodeRoot } from './runtime/decode.ts';
export type {
  AttributeDecl,
  ComplexType,
  ElementParticle,
  GroupParticle,
  Particle,
  RootElement,
  SchemaModuleInfo,
  SchemaPatch,
  SchemaSource,
  SimpleType,
  ValueOf,
  WildcardParticle,
} from './runtime/desc.ts';
export { isComplexType, isElementParticle, isWildcard, maxOccurs, minOccurs } from './runtime/desc.ts';
export { compileXsdRegex, XsdRegexError, xsdRegexToJs } from './runtime/regex.ts';
export { serialize, serializeRoot } from './runtime/serialize.ts';
export type { SchemaIssue, ValidationCode } from './runtime/validate.ts';
export {
  assertValid,
  checkSimple,
  compareCalendar,
  compareDecimal,
  validate,
  validateRoot,
} from './runtime/validate.ts';
export type { FamiliaSchema, VigenciaEntry } from './vigencia.ts';
export { selecionarPl, VIGENCIAS, VIGENCIAS_ATUALIZADAS_EM } from './vigencia.ts';

/** Parse estrito (`@sinete/core/xml`) seguido do decode tolerante pela raiz. Lança `XmlError` só se o XML for malformado. */
export function decodeXml<T>(root: RootElement<T>, xml: string | DocumentoXml): Decoded<T> {
  return decodeRoot(root, typeof xml === 'string' ? lerXml(xml) : xml);
}
