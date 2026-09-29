/**
 * `@sinete/ibs-cbs/aliquotas`: alíquotas nominais do IBS e da CBS por data de fato gerador, com estado da fonte.
 *
 * Toda alíquota é `official` (com dispositivo legal e fonte), `user-provided` (informada, com motivo) ou `unknown`
 * (ainda não publicada). Em 2026 valem as alíquotas de teste (CBS 0,9%, IBS estadual 0,1%, municipal 0%); em 2027 e
 * 2028, o IBS de 0,05% + 0,05% da LC 214/2025 e a CBS desconhecida até a resolução do Senado; de 2029 em diante,
 * desconhecidas até as leis dos entes e do Senado. Fica fora do `@sinete/ibs-cbs-dados` porque a cadência é outra.
 */

export { RatesDataError, RateUnknownError } from './errors.ts';
export {
  isSimulated,
  officialRates,
  RATES_SCHEMA_VERSION,
  RATES_TABLE,
  requireRate,
  withOverrides,
} from './provider.ts';
export type {
  Dec,
  IsoDate,
  NominalRates,
  Place,
  Rate,
  RateOverride,
  RateProvider,
  RateSource,
  RateStatus,
  RatesTable,
  RateTributo,
  ReferenceRateRecord,
  StandardRateRecord,
  Validity,
} from './types.ts';
export { RATE_TRIBUTOS } from './types.ts';
