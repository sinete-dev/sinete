/**
 * `@sinete/ibs-cbs/calcular`: cálculo do IBS e da CBS a partir de uma operação já classificada.
 *
 * Recebe CST, cClassTrib e grupos informados por item (`ClassifiedOperation`) e devolve o `Roc`, com os grupos da NT
 * 2025.002 (`gIBSCBS`, `gRed`, `gDif`, `gDevTrib`, `gTribRegular`, `gTribCompraGov`, `gTransfCred`, `gAjusteCompet`,
 * `gEstornoCred`, `gCredPresOper`, `gCredPresIBSZFM`) e os totais `IBSCBSTot`. As regras vêm do `@sinete/ibs-cbs-dados`, as
 * alíquotas do `@sinete/ibs-cbs/aliquotas`. Monofasia, Imposto Seletivo e alíquotas combinadas lançam
 * `UnsupportedRegimeError`: nunca sai valor zerado no lugar de um regime que o motor não calcula.
 */

export type { CalculateOptions } from './calculate.ts';
export { calculate, calculateAt } from './calculate.ts';
export type { RoundingMode } from './decimal.ts';
export { Decimal, dec, sum } from './decimal.ts';
export type { ClassificationReason, UnsupportedRegime } from './errors.ts';
export { ClassificationError, ExpressionError, UnsupportedRegimeError } from './errors.ts';
export type { Variables } from './expression.ts';
export { checkExpression, EXPRESSION_VARIABLES, evaluate, INTERNAL_SCALE } from './expression.ts';
export { fromPercent, money, percent, toPercent } from './format.ts';
export type { GovValues } from './govpurchase.ts';
export { enteOf, REDISTRIBUTION_FROM, redistribute } from './govpurchase.ts';
export type {
  AppliedRate,
  ClassifiedItem,
  ClassifiedOperation,
  Dec,
  GCBS,
  GCredPresIBSZFM,
  GCredPresOper,
  GCredPresTributo,
  GDevTrib,
  GDif,
  GIBSCBS,
  GIBSMun,
  GIBSUF,
  GovernmentPurchase,
  GRed,
  GTribCompraGov,
  GTribRegular,
  IBSCBS,
  IBSCBSTot,
  InformedRates,
  IsoDate,
  OperationPlace,
  PresumedCredit,
  PresumedCreditTributo,
  RateOrigin,
  RegularTaxation,
  Roc,
  RocItem,
  TpEnteGov,
  TraceEntry,
  ZfmPresumedCredit,
} from './types.ts';
