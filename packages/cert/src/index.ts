/**
 * `@sinete/cert`: certificado ICP-Brasil do titular.
 *
 * Leitura de PFX em JS (inclusive o legado RC2-40 + 3DES), escolha do certificado do titular, trava de validade,
 * identidade ICP-Brasil (CNPJ, CPF, responsável), cadeia até as raízes ICP-Brasil do bundle versionado, `KeyStore` e
 * assinatura A1 via WebCrypto. Pacote puro: roda igual em Node, Bun, Deno e no browser.
 */

export type { IcpBundleCertificate, IcpBundleInfo } from './bundle.ts';
export { ICP_BRASIL_BUNDLE, icpBrasilCertificates, icpBrasilTlsPem } from './bundle.ts';
export type { BuildChainOptions, ChainResult, ChainStatus } from './chain.ts';
export { buildChain, mayIssue, verifyIssuedBy } from './chain.ts';
export type { CertErrorCode } from './errors.ts';
export { CertError } from './errors.ts';
export type { IcpIdentity, IcpPessoa } from './icp.ts';
export { ICP_OIDS, icpIdentity } from './icp.ts';
export type { A1KeyStore, KeyStore, OpenPfxOptions, TlsPemMaterial, Validity } from './keystore.ts';
export { openPfx, validityAt } from './keystore.ts';
export { base64ToBytes, bytesToBase64, derToPem, pemToDers } from './pem.ts';
export type { Pkcs12Contents, Pkcs12Reader } from './pkcs12.ts';
export { forgePkcs12Reader, legacyPasswordVariant } from './pkcs12.ts';
export {
  createA1Signer,
  digestInfoOf,
  digestSignerAsDataSigner,
  encodeDigestInfo,
  signBytes,
  verifyBytes,
} from './signer.ts';
export type {
  CertificateInfo,
  DistinguishedName,
  DnAttribute,
  OtherName,
  OtherPublicKey,
  RsaPublicKey,
  SubjectAltNames,
} from './x509.ts';
export { certificateToPem, fingerprintSha256, namesMatch, parseCertificate } from './x509.ts';
