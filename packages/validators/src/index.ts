/**
 * `@sinete/validators`: CPF, CNPJ (numérico e alfanumérico), CAEPF, chave de acesso e inscrição estadual das 27 UFs.
 *
 * Funções puras, sem API de runtime. Cada documento tem `parseX` (devolve `Result` com o valor normalizado ou uma
 * `ValidationIssue` de código estável), `isValidX` e `formatX`; os códigos das ocorrências compõem o
 * `ValidationError` do `@sinete/core`.
 */

export { caepfCheckDigits, formatCaepf, isValidCaepf, parseCaepf } from './caepf.ts';
export type { ChaveAcesso, ChaveAcessoParts, ChaveParseOptions } from './chave.ts';
export {
  buildChaveAcesso,
  CNPJ_ALFANUMERICO_VIGENCIA,
  chaveAcessoCheckDigit,
  formatChaveAcesso,
  isValidChaveAcesso,
  parseChaveAcesso,
} from './chave.ts';
export { cnpjCheckDigits, formatCnpj, isAlphanumericCnpj, isValidCnpj, parseCnpj } from './cnpj.ts';
export type { ParseOptions } from './cpf.ts';
export { cpfCheckDigits, formatCpf, isValidCpf, parseCpf } from './cpf.ts';
export type {
  IeCheck,
  IeParseOptions,
  IeRange,
  IeTableInfo,
  IeUfRule,
  IeVariant,
  InscricaoEstadual,
} from './ie.ts';
export {
  completeIe,
  formatIe,
  IE_ISENTO,
  IE_TABLE,
  ieCheckDigits,
  ieRule,
  isIeIsento,
  isValidIe,
  parseIe,
} from './ie.ts';
export type { ValidationIssueCode } from './issues.ts';
export { VALIDATION_ISSUE_CODES } from './issues.ts';
