# Referência: `@sinete/ibs-cbs-dados`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/ibs-cbs-dados/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/ibs-cbs-dados/x` é `sinete/ibs-cbs-dados/x`.

## `@sinete/ibs-cbs-dados`

`@sinete/ibs-cbs-dados`: dados oficiais do IBS/CBS versionados, com leitor tipado e sem regra de negócio.

O dataset vem do SQLite da Calculadora offline da RFB e das tabelas do IT 2025.002, fixados por hash e extraídos por `tools/ibs-cbs-dados` (ADR 0007). Esta entrada tem o leitor, a aplicabilidade de NCM/NBS e o diff semântico; o dataset embarcado está em `@sinete/ibs-cbs-dados/bundled`, e qualquer outro bundle compatível pode ser carregado em runtime com `loadDataset` (depois de `verifyDataset`, se veio de fora).

### Funções

- `applicability`: `applicability(links: readonly ApplicabilityRecord[], code: string, date: IsoDate, fullLength: number): ApplicabilityResult`
- `canonicalJson`: `canonicalJson(value: unknown): string`
- `canonicalTable`: Serialização canônica das tabelas: chaves ordenadas, um registro por linha, newline final. `canonicalTable(records: readonly unknown[]): string`
- `changeKind`: `changeKind(path: string): ChangeKind`
- `civilDate`: Data civil de um instante no deslocamento informado. O deslocamento depende do local da operação (UTC-4 no Amazonas e em Rondônia, UTC-5 no Acre), então vem do chamador; o padrão é Brasília. `civilDate(instant: ReturnType<Relogio['agora']>, offsetMinutes?: number): IsoDate`
- `contentVersionOf`: Identificador curto do conteúdo (ver `IbsCbsDataset.contentVersion`). `contentVersionOf(manifest: DatasetManifest): string`
- `diffDatasets`: `diffDatasets(a: DatasetBundle, b: DatasetBundle): DatasetDiff`
- `formatDiff`: Resumo em Markdown do diff, para o corpo do PR de atualização do pacote. `limit` corta cada lista. `formatDiff(diff: DatasetDiff, limit?: number): string`
- `inForce`: Vigência fechada nas duas pontas, como nas consultas da Calculadora (`inicio <= data <= fim`). `inForce(validity: Validity, date: IsoDate): boolean`
- `isIsoDate`: Confere o formato e a existência da data (`2026-02-30` é inválida). `isIsoDate(value: unknown): value is IsoDate`
- `loadDataset`: `loadDataset(bundle: DatasetBundle): IbsCbsDataset`
- `requireIsoDate`: Valida e devolve a data, ou lança `ErroDeConfiguracao`. `requireIsoDate(value: unknown, what?: string): IsoDate`
- `verifyDataset`: Confere cada tabela contra o sha256 do manifest e o `datasetSha256`. Use antes de `loadDataset` num bundle obtido fora do pacote. Lança `IbsCbsDataError` (`ibscbs_dados_invalidos`) na primeira divergência. `verifyDataset(bundle: DatasetBundle): Promise<void>`

### Classes

- `IbsCbsDataError` (estende `ErroSinete<IbsCbsDataErrorCode>`): Pacote de dados que não pode ser usado: formato inesperado, tabela ausente, hash que não confere com o manifest (`ibscbs_dados_invalidos`), ou `dataSchemaVersion` que este código não conhece (`ibscbs_dados_versao_incompativel`).

### Interfaces

- `ActorClassTribRecord`: Membros: `key`, `actor`, `role`, `classTribKey`, `cClassTrib`, `validity`.
- `ActorFilter`: Atores de uma operação, pelos ids da tabela de atores; `undefined` não restringe o papel. Membros: `supplier`, `buyer`, `modelo`.
- `ActorGroupRecord`: Membros: `key`, `id`, `description`, `order`, `validity`.
- `ActorRecord`: Membros: `key`, `id`, `group`, `description`, `order`, `validity`.
- `AnnexRecord`: Item de anexo da LC 214/2025 citado pelos vínculos de NCM e NBS. Membros: `key`, `annex`, `item`, `description`, `text`, `validity`.
- `ApplicabilityRecord`: Vínculo de NCM ou NBS (por prefixo) com um cClassTrib, com as exceções do anexo. Membros: `key`, `classTribKey`, `family`, `cClassTrib`, `prefix`, `annexItem`, `validity`, `exceptions`.
- `ApplicabilityResult`: Membros: `result`, `matched`, `excludedBy`.
- `ByTributo`: Membros: `tributo`, `validity`.
- `CbsTransferRecord`: Percentual da CBS transferido ao ente contratante na compra governamental (art. 473, com a transição). Membros: `key`, `percent`, `validity`.
- `ClassTribCredit`: Membros: `buyerCbs`, `buyerIbs`, `presumedSupplier`, `presumedBuyer`, `priorOperation`.
- `ClassTribFilter`: Filtro de `classTribs`. Membros: `family`, `cst`, `modelo`.
- `ClassTribGroups`: Membros: `gTribRegular`, `gCredPresOper`, `gMonoPadrao`, `gMonoReten`, `gMonoRet`, `gMonoDif`, `gpBioDiferenca`, `gEstornoCred`.
- `ClassTribLegal`: Membros: `lc214`, `link`, `basis`.
- `ClassTribRecord`: Membros: `key`, `family`, `code`, `cst`, `name`, `description`, `rateKind`, `nomenclature`, `annex`, `tpRBSN`, `credit`, `groups`, `treatments`, `reductions`, `fixedRates`, `dfe`, `legal`, `memoriaTemplate`, `validity`, `updatedAt`, `sources`.
- `CredPresCalculation`: Membros: `pAliq`, `base`, `formula`, `impediment`.
- `CredPresGroups`: Membros: `gCBSCredPres`, `gIBSCredPres`.
- `CredPresInForce`: Crédito presumido vigente na data, por tributo. Membros: `record`, `cbs`, `ibs`.
- `CredPresRates`: Orientação de alíquota do IT: texto quando não é um número, decimal em texto quando é. Membros: `cbs`, `ibs`, `pAliqCredPresCBS`, `pAliqCredPresIBS`, `pRedTransicaoIBS`.
- `CredPresRecord`: Código de classificação do crédito presumido (`cCredPres`, IT 2025.002, tabela 04). Membros: `key`, `code`, `description`, `legal`, `viaDocument`, `viaEvent`, `deductsFromTax`, `groups`, `rates`, `referencedClassTrib`, `validity`, `calculation`, `sources`.
- `CstGroups`: Membros: `gIBSCBS`, `gIBSCBSMono`, `gRed`, `gDif`, `gTransfCred`, `gCredPresIBSZFM`, `gAjusteCompet`, `redutorBC`.
- `CstRecord`: Membros: `key`, `family`, `code`, `description`, `tributos`, `groups`, `validity`, `sources`.
- `DatasetBundle`: O dataset serializado: o que o pacote embarca e o que se carrega em runtime de outra origem. Membros: `manifest`, `tables`.
- `DatasetDiff`: Membros: `from`, `to`, `schemaChanged`, `tables`, `unchanged`.
- `DatasetManifest`: Membros: `dataSchemaVersion`, `dataVersion`, `knownAt`, `sources`, `tables`, `datasetSha256`.
- `DatasetTables`: Membros: `cst`, `classTrib`, `treatments`, `credPres`, `ncmApplicability`, `nbsApplicability`, `annexes`, `nfseNbs`, `actorGroups`, `actors`, `actorClassTrib`, `dfeTypes`, `govPurchaseReducer`, `cbsTransfer`.
- `DataSource`: Artefato oficial de onde o dataset foi extraído. Membros: `id`, `kind`, `title`, `version`, `date`, `url`, `sha256`, `pins`, `notes`.
- `DfeLink`: Membros: `sigla`, `modelo`, `validity`.
- `DfeTypeRecord`: Membros: `key`, `sigla`, `modelo`, `description`, `validity`.
- `FieldChange`: Membros: `path`, `kind`, `from`, `to`.
- `FixedRateRecord` (estende `ByTributo`): Membros: `rate`.
- `GovPurchaseReducerRecord`: Redutor de compras governamentais (LC 214/2025, arts. 370 e 472), em percentual. Membros: `key`, `pRedutor`, `validity`.
- `IbsCbsDataset`: Membros: `manifest`, `tables`, `contentVersion`, `at()`.
- `LegalBasis`: Membros: `short`, `text`, `reference`, `validity`.
- `NfseNbsRecord`: NFS-e: vínculo NBS x cClassTrib x indicador de operação (cIndOp) x item da LC 116. Membros: `key`, `nbs`, `classTribKey`, `cClassTrib`, `itemLc116`, `cIndOp`, `onerosa`, `adquirenteExterior`, `validity`.
- `PrefixException`: Membros: `prefix`, `validity`.
- `RecordChange`: Membros: `key`, `fields`.
- `ReductionRecord` (estende `ByTributo`): Membros: `pRed`.
- `TableDiff`: Membros: `table`, `added`, `removed`, `changed`, `kinds`.
- `TableManifest`: Membros: `name`, `records`, `sha256`.
- `TaxContent`: O dataset visto numa data de fato gerador: só registros vigentes nela. Membros: `asOf`, `dataset`, `cst()`, `classTrib()`, `classTribs()`, `cstOf()`, `treatment()`, `reduction()`, `fixedRate()`, `allowedIn()`, `credPres()`, `applicableNcm()`, `applicableNbs()`, `byActors()`, `actor()`, `nfseNbs()`, `annex()`, `dfeType()`, `govPurchaseReducer()`, `cbsTransferPercent()`.
- `TreatmentExpressions`: Membros: `aliquota`, `aliquotaEfetiva`, `baseCalculo`, `tributoCalculado`, `tributoDevido`, `percentualDiferimento`, `valorDiferimento`.
- `TreatmentFlags`: Membros: `incompativelComSuspensao`, `exigeGrupoTribRegular`, `possuiPercentualReducao`, `possuiAjuste`, `possuiRedutor`, `possuiMonofasia`.
- `TreatmentLink`: Membros: `treatment`, `validity`.
- `TreatmentRecord`: Tratamento tributário da Calculadora: as regras de cálculo como expressões aritméticas. Membros: `key`, `id`, `description`, `expr`, `flags`, `validity`.
- `Validity`: Intervalo de vigência, fechado nas duas pontas; `to: null` é vigência aberta. Membros: `from`, `to`.

### Tipos

- `ActorRole`: `type ActorRole = 'Fornecedor' | 'Adquirente'`
- `Applicability`: `type Applicability = 'yes' | 'no' | 'not-restricted' | 'incomplete'`
- `ChangeKind`: `type ChangeKind = 'fim-de-vigencia' | 'inicio-de-vigencia' | 'indicador-de-grupo' | 'dfe' | 'reducao-ou-aliquota' | 'expressao-de-calculo' | 'aplicabilidade' | 'texto' | 'outro'`
- `Dec`: Decimal em texto (`'0.9'`, `'60'`, `'0.05'`). `type Dec = string`
- `Family`: Família da tabela: CST e cClassTrib do IBS/CBS ou do Imposto Seletivo (os códigos se repetem entre famílias). `type Family = 'CBS_IBS' | 'IS'`
- `IbsCbsDataErrorCode`: Códigos lançados pelo `@sinete/ibs-cbs-dados`. `type IbsCbsDataErrorCode = 'ibscbs_dados_invalidos' | 'ibscbs_dados_versao_incompativel'`
- `Indicator`: Indicador de grupo do leiaute. Na CST, 1 é "exige" e 0 é "não é permitido" (legenda do IT 2025.002); no `ind_gCredPresOper`, 1 é "permite, sem exigir" (NT 2025.002, UB120, observação 2). `type Indicator = 'required' | 'allowed' | 'forbidden'`
- `IsoDate`: Data civil `AAAA-MM-DD`. `type IsoDate = string`
- `Nomenclature`: Nomenclatura que o cClassTrib exige para o item. `type Nomenclature = 'NCM' | 'NBS' | 'NBS ou NCM' | 'CIB' | 'CIB ou NCM' | 'Não possui'`
- `RateKind`: Tipo de alíquota exatamente como publicado. `type RateKind = 'Padrão' | 'Uniforme setorial' | 'Uniforme nacional (referência)' | 'Fixa' | 'Sem alíquota' | 'Alíquotas Combinadas (Ad Valorem e Ad Rem)'`
- `SourceId`: Fonte de onde veio um registro, pelo id em `manifest.sources`. `type SourceId = string`
- `TableName`: `type TableName = keyof DatasetTables`
- `Tributo`: Tributo como a Calculadora o identifica. `type Tributo = 'CBS' | 'IBSUF' | 'IBSMun' | 'IS'`

### Constantes

- `BRASILIA_OFFSET_MINUTES`: Deslocamento padrão: horário de Brasília (UTC-3, sem horário de verão desde 2019). `BRASILIA_OFFSET_MINUTES = -180`
- `DATA_SCHEMA_VERSION`: Versão do formato que este código lê. Bundle com versão maior é recusado. `DATA_SCHEMA_VERSION = 1`
- `TABLE_NAMES`: `TABLE_NAMES: readonly TableName[]`

## `@sinete/ibs-cbs-dados/bundled`

### Funções

- `bundledDataset`: O dataset embarcado, carregado uma vez por processo. `bundledDataset(): IbsCbsDataset`

### Constantes

- `BUNDLED_DATASET`: O bundle embarcado, como gravado em `src/data/`. `BUNDLED_DATASET: DatasetBundle`
