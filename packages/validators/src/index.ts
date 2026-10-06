/**
 * `@sinete/validators`: CPF, CNPJ (numérico e alfanumérico), CAEPF, chave de acesso, inscrição estadual das 27 UFs e a
 * tabela de CFOP do Portal da NF-e.
 *
 * Funções puras, sem API de runtime. Cada documento tem `lerX` (devolve `Resultado` com o valor normalizado ou uma
 * `Ocorrencia` de código estável), a conferência booleana (`cpfValido`, `ieValida`...) e `formatarX`; os códigos das
 * ocorrências compõem o `ErroDeValidacao` do `@sinete/core`.
 */

export { caepfValido, calcularDvCaepf, formatarCaepf, lerCaepf } from './caepf.ts';
export type { DescricaoTabelaCfop, IndicadoresCfop } from './cfop.ts';
export { indicadoresCfop, TABELA_CFOP } from './cfop.ts';
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
