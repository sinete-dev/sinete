/**
 * `@sinete/ibs-cbs/validar`: regras de validação da NT 2025.002-RTC v1.51 (grupos UB e W da NF-e e da NFC-e) que dá para
 * conferir sem o banco de dados da SEFAZ, como funções puras com id, cStat, implantação por ambiente e fonte.
 *
 * `validar` confere um documento (o `Roc` do `@sinete/ibs-cbs/calcular` via `documentoDoRoc`, ou os grupos lidos de um
 * XML) e devolve as violações; é o segundo oráculo do motor, para o que a Calculadora da RFB não calcula.
 */

export type { ContextoDaRegra, Regra, Relatar } from './rules.ts';
export { NAO_IMPLEMENTADAS, REGRAS, TABELAS_NT } from './rules.ts';
export type {
  Ambiente,
  Ativacao,
  Dec,
  DescricaoDaRegra,
  DocumentoDasRegras,
  ItemDasRegras,
  Modelo,
  NaoImplementada,
  RelatorioDeValidacao,
  TabelasNt,
  Violacao,
} from './types.ts';
export type { ValidarOpcoes } from './validate.ts';
export { ativa, documentoDoRoc, validar } from './validate.ts';
