/**
 * `@sinete/validators`: CPF, CNPJ (numérico e alfanumérico), CAEPF, chave de acesso e inscrição estadual das 27 UFs.
 *
 * Funções puras, sem API de runtime. Cada documento tem `parseX` (devolve `Result` com o valor normalizado ou uma
 * `ValidationIssue` de código estável), `isValidX` e `formatX`; os códigos das ocorrências compõem o
 * `ValidationError` do `@sinete/core`.
 */

export { caepfValido, calcularDvCaepf, formatarCaepf, lerCaepf } from './caepf.ts';
export type { ChaveAcesso, LerChaveAcessoOpcoes, PartesChaveAcesso } from './chave.ts';
export {
  CNPJ_ALFANUMERICO_VIGENCIA,
  calcularDvChaveAcesso,
  chaveAcessoValida,
  formatarChaveAcesso,
  lerChaveAcesso,
  montarChaveAcesso,
} from './chave.ts';
export { calcularDvCnpj, cnpjAlfanumerico, cnpjValido, formatarCnpj, lerCnpj } from './cnpj.ts';
export type { LerOpcoes } from './cpf.ts';
export { calcularDvCpf, cpfValido, formatarCpf, lerCpf } from './cpf.ts';
export type {
  CalculoDvIe,
  DescricaoTabelaIe,
  FaixaIe,
  InscricaoEstadual,
  LerIeOpcoes,
  RegraIeUf,
  VarianteIe,
} from './ie.ts';
export {
  calcularDvIe,
  completarIe,
  formatarIe,
  IE_ISENTO,
  ieIsenta,
  ieValida,
  lerIe,
  regraIe,
  TABELA_IE,
} from './ie.ts';
export type { CodigoOcorrencia } from './issues.ts';
export { CODIGOS_OCORRENCIA } from './issues.ts';
