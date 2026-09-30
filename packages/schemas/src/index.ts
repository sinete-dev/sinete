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
import type { Decodificado } from './runtime/decode.ts';
import { decodificarRaiz } from './runtime/decode.ts';
import type { ElementoRaiz } from './runtime/desc.ts';

export type { CodigoErroSchemas } from './errors.ts';
export { ErroSerializacao, ErroVigencia } from './errors.ts';
export type { CodigoOcorrenciaDecodificacao, Decodificado, OcorrenciaDecodificacao } from './runtime/decode.ts';
export { decodificar, decodificarRaiz } from './runtime/decode.ts';
export type {
  AjusteDoSchema,
  AttributeDecl,
  ComplexType,
  DescricaoModuloSchema,
  ElementoRaiz,
  ElementParticle,
  FonteDoSchema,
  GroupParticle,
  Particle,
  SimpleType,
  ValorDe,
  WildcardParticle,
} from './runtime/desc.ts';
export { ehComplexType, ehElementParticle, ehWildcard, maxOccurs, minOccurs } from './runtime/desc.ts';
export { compilarRegexXsd, ErroRegexXsd, regexXsdParaJs } from './runtime/regex.ts';
export { serializar, serializarRaiz } from './runtime/serialize.ts';
export type { CodigoValidacao, OcorrenciaSchema } from './runtime/validate.ts';
export {
  compararCalendario,
  compararDecimal,
  conferirTipoSimples,
  exigirValido,
  validar,
  validarRaiz,
} from './runtime/validate.ts';
export type { EntradaDeVigencia, FamiliaSchema } from './vigencia.ts';
export { selecionarPl, VIGENCIAS, VIGENCIAS_ATUALIZADAS_EM } from './vigencia.ts';

/** Parse estrito (`@sinete/core/xml`) seguido da decodificação tolerante pela raiz. Lança `ErroXml` só se o XML for malformado. */
export function decodificarXml<T>(raiz: ElementoRaiz<T>, xml: string | DocumentoXml): Decodificado<T> {
  return decodificarRaiz(raiz, typeof xml === 'string' ? lerXml(xml) : xml);
}
