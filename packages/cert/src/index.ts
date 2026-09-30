/**
 * `@sinete/cert`: certificado ICP-Brasil do titular.
 *
 * Leitura de PFX em JS (inclusive o legado RC2-40 + 3DES), escolha do certificado do titular, trava de validade,
 * identidade ICP-Brasil (CNPJ, CPF, responsável), cadeia até as raízes ICP-Brasil do bundle versionado, `Certificado` e
 * assinatura A1 via WebCrypto. Pacote puro: roda igual em Node, Bun, Deno e no browser.
 */

export type { CertificadoDoBundleIcp, DescricaoBundleIcp } from './bundle.ts';
export { certificadosIcpBrasil, ICP_BRASIL_BUNDLE, pemTlsIcpBrasil } from './bundle.ts';
export type { MontarCadeiaOpcoes, ResultadoCadeia, SituacaoCadeia } from './chain.ts';
export { conferirEmitidoPor, montarCadeia, podeEmitir } from './chain.ts';
export type { CodigoErroCertificado } from './errors.ts';
export { ErroCertificado } from './errors.ts';
export type { IcpPessoa, IdentidadeIcp } from './icp.ts';
export { ICP_OIDS, identidadeIcp } from './icp.ts';
export type { AbrirPfxOpcoes, Certificado, CertificadoA1, MaterialTlsPem, Validade } from './keystore.ts';
export { abrirPfx, validadeEm } from './keystore.ts';
export { codificarBase64, decodificarBase64, dersDoPem, pemDoDer } from './pem.ts';
export type { ConteudoPkcs12, LeitorPkcs12 } from './pkcs12.ts';
export { leitorPkcs12Forge, senhaNoFormatoLegado } from './pkcs12.ts';
export {
  assinarBytes,
  codificarDigestInfo,
  comoAssinadorDeDados,
  conferirBytes,
  criarAssinadorA1,
  digestInfoDe,
} from './signer.ts';
export type {
  AtributoDoNome,
  CertificadoX509,
  ChavePublicaRsa,
  NomeDistinto,
  OtherName,
  OutraChavePublica,
  SubjectAltNames,
} from './x509.ts';
export { impressaoDigitalSha256, lerCertificado, nomesIguais, pemDoCertificado } from './x509.ts';
