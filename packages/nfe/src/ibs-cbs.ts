/**
 * `@sinete/nfe/ibs-cbs`: tudo o que quem emite NF-e precisa do IBS/CBS, sem importar `@sinete/ibs-cbs` nem
 * `@sinete/ibs-cbs-dados` diretamente.
 *
 * Reexporta o motor inteiro (`@sinete/ibs-cbs`: alíquotas, cálculo, regras da NT 2025.002 e determinação de CST e
 * cClassTrib) e o leitor do dataset (`@sinete/ibs-cbs-dados`: `loadDataset`, `verifyDataset`, diff, tipos). O dataset
 * embarcado não entra aqui, para não ir para o bundle de quem não o usa: `carregarDatasetEmbarcado()`, na raiz do
 * `@sinete/nfe`, o importa sob demanda. `Dec`, `IsoDate` e `Validity` vêm do motor (os de `Dec` e `IsoDate` são os
 * mesmos; a `Validity` dos dados, com os campos do dataset, fica acessível pelos tipos que a usam).
 */

// biome-ignore lint/performance/noReExportAll: o subpath existe para reexportar o motor inteiro, e as duas pontas são do mesmo repo.
export * from '@sinete/ibs-cbs';
export type {
  ActorClassTribRecord,
  ActorFilter,
  ActorGroupRecord,
  ActorRecord,
  ActorRole,
  AnnexRecord,
  Applicability,
  ApplicabilityRecord,
  ApplicabilityResult,
  ByTributo,
  CbsTransferRecord,
  ChangeKind,
  ClassTribCredit,
  ClassTribFilter,
  ClassTribGroups,
  ClassTribLegal,
  ClassTribRecord,
  CredPresCalculation,
  CredPresGroups,
  CredPresInForce,
  CredPresRates,
  CredPresRecord,
  CstGroups,
  CstRecord,
  DataSource,
  DatasetBundle,
  DatasetDiff,
  DatasetManifest,
  DatasetTables,
  DfeLink,
  DfeTypeRecord,
  Family,
  FieldChange,
  FixedRateRecord,
  GovPurchaseReducerRecord,
  IbsCbsDataErrorCode,
  IbsCbsDataset,
  Indicator,
  LegalBasis,
  NfseNbsRecord,
  Nomenclature,
  PrefixException,
  RateKind,
  RecordChange,
  ReductionRecord,
  SourceId,
  TableDiff,
  TableManifest,
  TableName,
  TaxContent,
  TreatmentExpressions,
  TreatmentFlags,
  TreatmentLink,
  TreatmentRecord,
  Tributo,
} from '@sinete/ibs-cbs-dados';
export {
  applicability,
  BRASILIA_OFFSET_MINUTES,
  canonicalJson,
  canonicalTable,
  changeKind,
  civilDate,
  contentVersionOf,
  DATA_SCHEMA_VERSION,
  diffDatasets,
  formatDiff,
  IbsCbsDataError,
  inForce,
  isIsoDate,
  loadDataset,
  requireIsoDate,
  TABLE_NAMES,
  verifyDataset,
} from '@sinete/ibs-cbs-dados';
