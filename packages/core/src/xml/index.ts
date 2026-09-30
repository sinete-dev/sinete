/**
 * `@sinete/core/xml`: parser XML estrito com offsets, C14N 1.0 inclusivo e XMLDSig no perfil dos DF-e.
 *
 * Sem DOM e sem dependências de runtime; a criptografia é a WebCrypto de `globalThis.crypto`, então roda igual em Node,
 * Bun, Deno e browser. A assinatura insere texto por splice e nunca reserializa o documento (ADR 0003).
 */

export type { C14nOpcoes } from './c14n.ts';
export { c14n, escaparAtributoC14n, escaparTextoC14n } from './c14n.ts';
export type {
  AssinaturaEsperada,
  ConferenciaInvalida,
  ConferenciaValida,
  MotivoFalhaConferencia,
  ResultadoConferencia,
} from './dsig.ts';
export { ALGORITMOS_XMLDSIG, conferirAssinatura, encontrarAssinaturas, XMLDSIG_NS } from './dsig.ts';
export { codificarBase64, decodificarBase64, extrairSpki } from './encoding.ts';
export type { CodigoErroXml, MotivoFalhaAssinaturaXml } from './errors.ts';
export { ErroAssinaturaXml, ErroXml } from './errors.ts';
export type {
  AtributoXml,
  DocumentoXml,
  ElementoXml,
  InstrucaoDeProcessamentoXml,
  NoXml,
  TextoXml,
} from './parser.ts';
export {
  atributoDe,
  descendentes,
  elementosFilhos,
  lerXml,
  namespacesEmEscopo,
  primeiroFilho,
  textoDe,
  XML_NS,
  XMLNS_NS,
} from './parser.ts';
export type { AssinaturaPreparada, PrepararAssinaturaOpcoes } from './sign.ts';
export {
  assinarPreparada,
  assinarXml,
  digestInfoDoSignedInfo,
  montarAssinatura,
  PREFIXO_DIGEST_INFO_SHA1,
  prepararAssinatura,
} from './sign.ts';
