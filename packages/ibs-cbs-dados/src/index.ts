/**
 * `@sinete/ibs-cbs-dados`: dados oficiais do IBS/CBS versionados, com leitor tipado e sem regra de negócio.
 *
 * O dataset vem do SQLite da Calculadora offline da RFB e das tabelas do IT 2025.002, fixados por hash e extraídos por
 * `tools/ibs-cbs-dados` (ADR 0007). Esta entrada tem o leitor, a aplicabilidade de NCM/NBS e o diff semântico; o dataset
 * embarcado está em `@sinete/ibs-cbs-dados/bundled`, e qualquer outro bundle compatível pode ser carregado em runtime com
 * `loadDataset` (depois de `verifyDataset`, se veio de fora).
 */

export type { Applicability, ApplicabilityResult } from './applicability.ts';
export { applicability } from './applicability.ts';
export { canonicalJson, canonicalTable } from './canonical.ts';
export type { ActorFilter, ClassTribFilter, CredPresInForce, IbsCbsDataset, TaxContent } from './dataset.ts';
export { contentVersionOf, DATA_SCHEMA_VERSION, loadDataset, TABLE_NAMES, verifyDataset } from './dataset.ts';
export { BRASILIA_OFFSET_MINUTES, civilDate, inForce, isIsoDate, requireIsoDate } from './dates.ts';
export type { ChangeKind, DatasetDiff, FieldChange, RecordChange, TableDiff } from './diff.ts';
export { changeKind, diffDatasets, formatDiff } from './diff.ts';
export type { IbsCbsDataErrorCode } from './errors.ts';
export { IbsCbsDataError } from './errors.ts';
export type {
  ActorClassTribRecord,
  ActorGroupRecord,
  ActorRecord,
  ActorRole,
  AnnexRecord,
  ApplicabilityRecord,
  ByTributo,
  CbsTransferRecord,
  ClassTribCredit,
  ClassTribGroups,
  ClassTribLegal,
  ClassTribRecord,
  CredPresCalculation,
  CredPresGroups,
  CredPresRates,
  CredPresRecord,
  CstGroups,
  CstRecord,
  DataSource,
  DatasetBundle,
  DatasetManifest,
  DatasetTables,
  Dec,
  DfeLink,
  DfeTypeRecord,
  Family,
  FixedRateRecord,
  GovPurchaseReducerRecord,
  Indicator,
  IsoDate,
  LegalBasis,
  NfseNbsRecord,
  Nomenclature,
  PrefixException,
  RateKind,
  ReductionRecord,
  SourceId,
  TableManifest,
  TableName,
  TreatmentExpressions,
  TreatmentFlags,
  TreatmentLink,
  TreatmentRecord,
  Tributo,
  Validity,
} from './types.ts';
