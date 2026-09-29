/**
 * `@sinete/core/xml`: parser XML estrito com offsets, C14N 1.0 inclusivo e XMLDSig no perfil dos DF-e.
 *
 * Sem DOM e sem dependências de runtime; a criptografia é a WebCrypto de `globalThis.crypto`, então roda igual em Node,
 * Bun, Deno e browser. A assinatura insere texto por splice e nunca reserializa o documento (ADR 0003).
 */

export type { C14nOptions } from './c14n.ts';
export { c14n, escapeC14nAttribute, escapeC14nText } from './c14n.ts';
export type { VerifyExpectation, VerifyFailed, VerifyFailure, VerifyResult, VerifySuccess } from './dsig.ts';
export { findSignatures, verifySignature, XMLDSIG_ALGORITHMS, XMLDSIG_NS } from './dsig.ts';
export { base64Decode, base64Encode, spkiFromCertificate } from './encoding.ts';
export type { XmlErrorCode, XmlSignatureFailure } from './errors.ts';
export { XmlError, XmlSignatureError } from './errors.ts';
export type {
  XmlAttribute,
  XmlDocument,
  XmlElement,
  XmlNode,
  XmlProcessingInstruction,
  XmlText,
} from './parser.ts';
export {
  attributeOf,
  childElements,
  descendants,
  firstChild,
  inScopeNamespaces,
  parseXml,
  textOf,
  XML_NS,
  XMLNS_NS,
} from './parser.ts';
export type { PreparedSignature, PrepareOptions } from './sign.ts';
export {
  assembleSignature,
  prepareSignature,
  SHA1_DIGEST_INFO_PREFIX,
  signedInfoDigestInfo,
  signPrepared,
  signXml,
} from './sign.ts';
