/**
 * `@sinete/ibs-cbs/validar`: regras de validação da NT 2025.002-RTC v1.51 (grupos UB e W da NF-e e da NFC-e) que dá para
 * conferir sem o banco de dados da SEFAZ, como funções puras com id, cStat, implantação por ambiente e fonte.
 *
 * `validate` confere um documento (o `Roc` do `@sinete/ibs-cbs/calcular` via `documentFromRoc`, ou os grupos lidos de um
 * XML) e devolve as violações; é o segundo oráculo do motor, para o que a Calculadora da RFB não calcula.
 */

export type { Report, Rule, RuleContext } from './rules.ts';
export { NOT_IMPLEMENTED, NT_TABLES, RULES } from './rules.ts';
export type {
  Activation,
  Ambiente,
  Dec,
  Modelo,
  NotImplemented,
  NtTables,
  RuleMeta,
  RulesDocument,
  RulesItem,
  ValidationReport,
  Violation,
} from './types.ts';
export type { ValidateOptions } from './validate.ts';
export { documentFromRoc, isActive, validate } from './validate.ts';
