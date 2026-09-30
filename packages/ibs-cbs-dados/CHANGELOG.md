# @sinete/ibs-cbs-dados

## 2026.9.2

### Minor Changes

- ae8ab90: Acompanham a fase 1 do ADR 0015 (`@sinete/core`, `@sinete/validators` e `@sinete/rejeicoes` com nomes em português). Nenhum nome próprio destes pacotes muda nesta fase, mas os tipos do core que eles recebem e devolvem mudam, e o código de quem os usa muda junto. Os mais visíveis:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | desfecho dos clientes (`ResultadoSefaz`, antes `SefazOutcome`) | `status: 'authorized' \| 'rejected' \| 'denied' \| 'pending'` | `tipo: 'autorizado' \| 'recusado' \| 'denegado' \| 'pendente'` |
  | desfecho autorizado ou denegado | `value` | `valor` |
  | desfecho recusado | `hint` (`probableCause`, `suggestedFix`, `source`) | `dica` (`causaProvavel`, `comoCorrigir`, `fonte`) |
  | desfecho pendente | `ref`, `retryAfterMs` | `referencia`, `aguardarMs` |
  | erros (`ErroSinete`, antes `SineteError`) | `details`, `docs` | `detalhes`, `pagina` |
  | ocorrências (`Ocorrencia`, antes `ValidationIssue`) | `path`, `message` | `caminho`, `mensagem` |
  | `ErroDeValidacao` (antes `ValidationError`) | `issues` | `ocorrencias` |
  | assinador (`Assinador`, antes `Signer`) | `kind: 'data' \| 'digest'`, `sign`, `signDigestInfo`, `certificateDer` | `tipo: 'dados' \| 'digest'`, `assinar`, `assinarDigestInfo`, `certificadoDer` |
  | relógio (`Relogio`, antes `Clock`) | `now()` | `agora()` |
  | resultado local (`Resultado`, antes `Result`) | `value`, `error` | `valor`, `erro` |
  
  A tabela completa de cada pacote da fase está nos changesets do `@sinete/core`, do `@sinete/validators` e do `@sinete/rejeicoes`.
- 84080ad: O subpath `/bundled` passa a `/embarcado` (ADR 0015, fase 3): `@sinete/ibs-cbs-dados/embarcado` e `sinete/ibs-cbs-dados/embarcado`. Sem alias: quem importa o subpath antigo troca o caminho ao atualizar.
- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `ActorClassTribRecord` | `RegistroAtorClassTrib` |
  | `ActorGroupRecord` | `RegistroGrupoDeAtores` |
  | `ActorRecord` | `RegistroAtor` |
  | `ActorRole` | `PapelDoAtor` |
  | `AnnexRecord` | `RegistroAnexo` |
  | `ApplicabilityRecord` | `RegistroAplicabilidade` |
  | `ByTributo` | `PorTributo` |
  | `CbsTransferRecord` | `RegistroTransferenciaCbs` |
  | `ClassTribCredit` | `CreditoClassTrib` |
  | `ClassTribGroups` | `GruposClassTrib` |
  | `ClassTribLegal` | `BaseLegalClassTrib` |
  | `ClassTribRecord` | `RegistroClassTrib` |
  | `CredPresCalculation` | `CalculoCredPres` |
  | `CredPresGroups` | `GruposCredPres` |
  | `CredPresRates` | `AliquotasCredPres` |
  | `CredPresRecord` | `RegistroCredPres` |
  | `CstGroups` | `GruposCst` |
  | `CstRecord` | `RegistroCst` |
  | `DataSource` | `FonteDoDataset` |
  | `DatasetBundle` | `BundleDoDataset` |
  | `DatasetManifest` | `ManifestoDoDataset` |
  | `DatasetTables` | `TabelasDoDataset` |
  | `DfeLink` | `VinculoDfe` |
  | `DfeTypeRecord` | `RegistroTipoDfe` |
  | `Family` | `Familia` |
  | `FixedRateRecord` | `RegistroAliquotaFixa` |
  | `GovPurchaseReducerRecord` | `RegistroRedutorCompraGov` |
  | `Indicator` | `Indicador` |
  | `IsoDate` | `DataIso` |
  | `LegalBasis` | `BaseLegal` |
  | `NfseNbsRecord` | `RegistroNfseNbs` |
  | `Nomenclature` | `Nomenclatura` |
  | `PrefixException` | `ExcecaoDePrefixo` |
  | `RateKind` | `TipoDeAliquota` |
  | `ReductionRecord` | `RegistroReducao` |
  | `SourceId` | `IdDaFonte` |
  | `TableManifest` | `ManifestoDaTabela` |
  | `TableName` | `NomeDaTabela` |
  | `TreatmentExpressions` | `ExpressoesDoTratamento` |
  | `TreatmentFlags` | `IndicadoresDoTratamento` |
  | `TreatmentLink` | `VinculoTratamento` |
  | `TreatmentRecord` | `RegistroTratamento` |
  | `Validity` | `Vigencia` |
  | `ActorFilter` | `FiltroDeAtores` |
  | `ClassTribFilter` | `FiltroClassTrib` |
  | `CredPresInForce` | `CredPresVigente` |
  | `DATA_SCHEMA_VERSION` | `VERSAO_DO_FORMATO_DOS_DADOS` |
  | `IbsCbsDataset` | `DatasetIbsCbs` |
  | `TABLE_NAMES` | `NOMES_DAS_TABELAS` |
  | `TaxContent` | `ConteudoTributario` |
  | `contentVersionOf` | `versaoDoConteudo` |
  | `loadDataset` | `carregarDataset` |
  | `verifyDataset` | `conferirDataset` |
  | `Applicability` | `Aplicabilidade` |
  | `ApplicabilityResult` | `ResultadoAplicabilidade` |
  | `applicability` | `aplicabilidade` |
  | `canonicalJson` | `jsonCanonico` |
  | `canonicalTable` | `tabelaCanonica` |
  | `BRASILIA_OFFSET_MINUTES` | `DESLOCAMENTO_BRASILIA_MIN` |
  | `civilDate` | `dataCivil` |
  | `inForce` | `vigente` |
  | `isIsoDate` | `ehDataIso` |
  | `requireIsoDate` | `exigirDataIso` |
  | `ChangeKind` | `TipoDeMudanca` |
  | `DatasetDiff` | `DiferencaDeDatasets` |
  | `FieldChange` | `MudancaDeCampo` |
  | `RecordChange` | `MudancaDeRegistro` |
  | `TableDiff` | `DiferencaDeTabela` |
  | `changeKind` | `tipoDeMudanca` |
  | `diffDatasets` | `compararDatasets` |
  | `formatDiff` | `formatarDiferenca` |
  | `IbsCbsDataError` | `ErroDadosIbsCbs` |
  | `IbsCbsDataErrorCode` | `CodigoErroDadosIbsCbs` |
  | `BUNDLED_DATASET` | `DATASET_EMBARCADO` |
  | `bundledDataset` | `datasetEmbarcado` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `DatasetIbsCbs` | `at.date` | `em.data` |
  | `ConteudoTributario` | `cst.code` | `cst.codigo` |
  | `ConteudoTributario` | `cst.family` | `cst.familia` |
  | `ConteudoTributario` | `classTrib.code` | `classTrib.codigo` |
  | `ConteudoTributario` | `classTrib.family` | `classTrib.familia` |
  | `ConteudoTributario` | `classTribs.filter` | `classTribs.filtro` |
  | `ConteudoTributario` | `credPres.code` | `credPres.codigo` |
  | `ConteudoTributario` | `byActors.filter` | `porAtores.filtro` |
  | `DiferencaDeDatasets` | `from.dataVersion` | `de.versaoDosDados` |
  | `DiferencaDeDatasets` | `from.sources` | `de.fontes` |
  | `DiferencaDeDatasets` | `to.dataVersion` | `para.versaoDosDados` |
  | `DiferencaDeDatasets` | `to.sources` | `para.fontes` |
  | `ErroDadosIbsCbs` | `constructor.options` | `constructor.opcoes` |
  | `ResultadoAplicabilidade` | `result` | `resultado` |
  | `ResultadoAplicabilidade` | `matched` | `casou` |
  | `ResultadoAplicabilidade` | `excludedBy` | `excluidoPor` |
  | `aplicabilidade` | `links` | `vinculos` |
  | `aplicabilidade`, `RegistroClassTrib`, `RegistroCredPres`, `RegistroCst` | `code` | `codigo` |
  | `aplicabilidade`, `vigente`, `FonteDoDataset` | `date` | `data` |
  | `aplicabilidade` | `fullLength` | `tamanhoCompleto` |
  | `jsonCanonico`, `ehDataIso`, `exigirDataIso` | `value` | `valor` |
  | `tabelaCanonica`, `ManifestoDaTabela` | `records` | `registros` |
  | `FiltroDeAtores` | `supplier` | `fornecedor` |
  | `FiltroDeAtores` | `buyer` | `adquirente` |
  | `FiltroClassTrib`, `RegistroAplicabilidade`, `RegistroClassTrib`, `RegistroCst` | `family` | `familia` |
  | `CredPresVigente` | `record` | `registro` |
  | `DatasetIbsCbs`, `versaoDoConteudo`, `BundleDoDataset` | `manifest` | `manifesto` |
  | `DatasetIbsCbs`, `DiferencaDeDatasets`, `BundleDoDataset`, `ManifestoDoDataset` | `tables` | `tabelas` |
  | `DatasetIbsCbs` | `contentVersion` | `versaoDoConteudo` |
  | `DatasetIbsCbs` | `at` | `em` |
  | `ConteudoTributario` | `asOf` | `dataDeReferencia` |
  | `ConteudoTributario` | `cstOf` | `cstDe` |
  | `ConteudoTributario`, `VinculoTratamento` | `treatment` | `tratamento` |
  | `ConteudoTributario` | `reduction` | `reducao` |
  | `ConteudoTributario` | `fixedRate` | `aliquotaFixa` |
  | `ConteudoTributario` | `allowedIn` | `permitidoEm` |
  | `ConteudoTributario` | `applicableNcm` | `ncmAplicavel` |
  | `ConteudoTributario` | `applicableNbs` | `nbsAplicavel` |
  | `ConteudoTributario` | `byActors` | `porAtores` |
  | `ConteudoTributario`, `RegistroAtorClassTrib` | `actor` | `ator` |
  | `ConteudoTributario`, `RegistroAnexo`, `RegistroClassTrib` | `annex` | `anexo` |
  | `ConteudoTributario` | `dfeType` | `tipoDfe` |
  | `ConteudoTributario`, `TabelasDoDataset` | `govPurchaseReducer` | `redutorCompraGov` |
  | `ConteudoTributario` | `cbsTransferPercent` | `percentualTransferenciaCbs` |
  | `dataCivil` | `instant` | `instante` |
  | `dataCivil` | `offsetMinutes` | `deslocamentoMin` |
  | `vigente`, `RegistroAtorClassTrib`, `RegistroGrupoDeAtores`, `RegistroAtor`, `RegistroAnexo` e mais 14 | `validity` | `vigencia` |
  | `exigirDataIso` | `what` | `oQue` |
  | `DiferencaDeDatasets`, `MudancaDeCampo` | `from` | `de` |
  | `DiferencaDeDatasets`, `MudancaDeCampo` | `to` | `para` |
  | `DiferencaDeDatasets` | `schemaChanged` | `formatoMudou` |
  | `DiferencaDeDatasets` | `unchanged` | `inalteradas` |
  | `MudancaDeCampo`, `tipoDeMudanca` | `path` | `caminho` |
  | `MudancaDeCampo`, `FonteDoDataset` | `kind` | `tipo` |
  | `MudancaDeRegistro`, `RegistroAtorClassTrib`, `RegistroGrupoDeAtores`, `RegistroAtor`, `RegistroAnexo` e mais 9 | `key` | `chave` |
  | `MudancaDeRegistro` | `fields` | `campos` |
  | `DiferencaDeTabela` | `table` | `tabela` |
  | `DiferencaDeTabela` | `added` | `incluidos` |
  | `DiferencaDeTabela` | `removed` | `removidos` |
  | `DiferencaDeTabela` | `changed` | `alterados` |
  | `DiferencaDeTabela` | `kinds` | `tipos` |
  | `formatarDiferenca` | `diff` | `diferenca` |
  | `formatarDiferenca` | `limit` | `limite` |
  | `RegistroAtorClassTrib` | `role` | `papel` |
  | `RegistroAtorClassTrib`, `RegistroAplicabilidade`, `RegistroNfseNbs` | `classTribKey` | `chaveClassTrib` |
  | `RegistroGrupoDeAtores`, `RegistroAtor`, `RegistroAnexo`, `RegistroClassTrib`, `RegistroCredPres` e mais 3 | `description` | `descricao` |
  | `RegistroGrupoDeAtores`, `RegistroAtor` | `order` | `ordem` |
  | `RegistroAtor` | `group` | `grupo` |
  | `RegistroAnexo`, `BaseLegal` | `text` | `texto` |
  | `RegistroAplicabilidade`, `ExcecaoDePrefixo` | `prefix` | `prefixo` |
  | `RegistroAplicabilidade` | `annexItem` | `itemDoAnexo` |
  | `RegistroAplicabilidade` | `exceptions` | `excecoes` |
  | `RegistroTransferenciaCbs` | `percent` | `percentual` |
  | `CreditoClassTrib` | `buyerCbs` | `adquirenteCbs` |
  | `CreditoClassTrib` | `buyerIbs` | `adquirenteIbs` |
  | `CreditoClassTrib` | `presumedSupplier` | `presumidoFornecedor` |
  | `CreditoClassTrib` | `presumedBuyer` | `presumidoAdquirente` |
  | `CreditoClassTrib` | `priorOperation` | `operacaoAnterior` |
  | `BaseLegalClassTrib` | `link` | `url` |
  | `BaseLegalClassTrib` | `basis` | `fundamento` |
  | `RegistroClassTrib`, `ManifestoDaTabela` | `name` | `nome` |
  | `RegistroClassTrib` | `rateKind` | `tipoDeAliquota` |
  | `RegistroClassTrib` | `nomenclature` | `nomenclatura` |
  | `RegistroClassTrib` | `credit` | `credito` |
  | `RegistroClassTrib`, `RegistroCredPres`, `RegistroCst` | `groups` | `grupos` |
  | `RegistroClassTrib`, `TabelasDoDataset` | `treatments` | `tratamentos` |
  | `RegistroClassTrib` | `reductions` | `reducoes` |
  | `RegistroClassTrib` | `fixedRates` | `aliquotasFixas` |
  | `RegistroClassTrib` | `updatedAt` | `atualizadoEm` |
  | `RegistroClassTrib`, `RegistroCredPres`, `RegistroCst`, `ManifestoDoDataset` | `sources` | `fontes` |
  | `CalculoCredPres` | `impediment` | `impedimento` |
  | `RegistroCredPres` | `viaDocument` | `viaDocumento` |
  | `RegistroCredPres` | `viaEvent` | `viaEvento` |
  | `RegistroCredPres` | `deductsFromTax` | `deduzDoTributo` |
  | `RegistroCredPres` | `rates` | `aliquotas` |
  | `RegistroCredPres` | `referencedClassTrib` | `classTribReferenciado` |
  | `RegistroCredPres` | `calculation` | `calculo` |
  | `FonteDoDataset` | `title` | `titulo` |
  | `FonteDoDataset` | `version` | `versao` |
  | `FonteDoDataset` | `notes` | `notas` |
  | `ManifestoDoDataset` | `dataSchemaVersion` | `versaoDoFormato` |
  | `ManifestoDoDataset` | `dataVersion` | `versaoDosDados` |
  | `ManifestoDoDataset` | `knownAt` | `conhecidoEm` |
  | `ManifestoDoDataset` | `datasetSha256` | `sha256DoDataset` |
  | `TabelasDoDataset` | `ncmApplicability` | `aplicabilidadeNcm` |
  | `TabelasDoDataset` | `nbsApplicability` | `aplicabilidadeNbs` |
  | `TabelasDoDataset` | `annexes` | `anexos` |
  | `TabelasDoDataset` | `actorGroups` | `gruposDeAtores` |
  | `TabelasDoDataset` | `actors` | `atores` |
  | `TabelasDoDataset` | `actorClassTrib` | `atorClassTrib` |
  | `TabelasDoDataset` | `dfeTypes` | `tiposDfe` |
  | `TabelasDoDataset` | `cbsTransfer` | `transferenciaCbs` |
  | `RegistroAliquotaFixa` | `rate` | `aliquota` |
  | `BaseLegal` | `short` | `resumo` |
  | `BaseLegal` | `reference` | `referencia` |
  | `RegistroTratamento` | `expr` | `expressao` |
  | `RegistroTratamento` | `flags` | `indicadores` |
  | `Vigencia` | `from` | `inicio` |
  | `Vigencia` | `to` | `fim` |
  | `DiferencaDeDatasets` | `de.datasetSha256` | `de.sha256DoDataset` |
  | `DiferencaDeDatasets` | `para.datasetSha256` | `para.sha256DoDataset` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `Aplicabilidade` | `'yes'` | `'sim'` |
  | `Aplicabilidade` | `'no'` | `'nao'` |
  | `Aplicabilidade` | `'not-restricted'` | `'sem-restricao'` |
  | `Aplicabilidade` | `'incomplete'` | `'incompleta'` |
  | `Indicador` | `'required'` | `'obrigatorio'` |
  | `Indicador` | `'allowed'` | `'permitido'` |
  | `Indicador` | `'forbidden'` | `'vedado'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/classTrib.json`, `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json` e mais 10 | `validity` | `vigencia` |
  | `data/classTrib.json` | `rate` | `aliquota` |
  | `data/classTrib.json` | `treatment` | `tratamento` |
  | `data/classTrib.json` | `reference` | `referencia` |
  | `data/classTrib.json` | `short` | `resumo` |
  | `data/classTrib.json`, `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json` e mais 10 | `text` | `texto` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `from` | `inicio` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `to` | `fim` |
  | `data/classTrib.json` | `buyerCbs` | `adquirenteCbs` |
  | `data/classTrib.json` | `buyerIbs` | `adquirenteIbs` |
  | `data/classTrib.json` | `presumedBuyer` | `presumidoAdquirente` |
  | `data/classTrib.json` | `presumedSupplier` | `presumidoFornecedor` |
  | `data/classTrib.json` | `priorOperation` | `operacaoAnterior` |
  | `data/classTrib.json` | `basis` | `fundamento` |
  | `data/credPres.json` | `impediment` | `impedimento` |
  | `data/manifest.json` | `date` | `data` |
  | `data/manifest.json` | `kind` | `tipo` |
  | `data/manifest.json` | `notes` | `notas` |
  | `data/manifest.json` | `title` | `titulo` |
  | `data/manifest.json` | `version` | `versao` |
  | `data/manifest.json`, `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json` e mais 10 | `name` | `nome` |
  | `data/manifest.json` | `records` | `registros` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `key` | `chave` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `description` | `descricao` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `order` | `ordem` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `group` | `grupo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `annex` | `anexo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `percent` | `percentual` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `code` | `codigo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `family` | `familia` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `credit` | `credito` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `groups` | `grupos` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `fixedRates` | `aliquotasFixas` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `reductions` | `reducoes` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `treatments` | `tratamentos` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `rateKind` | `tipoDeAliquota` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `nomenclature` | `nomenclatura` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `updatedAt` | `atualizadoEm` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `sources` | `fontes` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `actor` | `ator` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `role` | `papel` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `classTribKey` | `chaveClassTrib` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `calculation` | `calculo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `deductsFromTax` | `deduzDoTributo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `rates` | `aliquotas` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `referencedClassTrib` | `classTribReferenciado` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `viaDocument` | `viaDocumento` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `viaEvent` | `viaEvento` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `annexItem` | `itemDoAnexo` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `exceptions` | `excecoes` |
  | `data/actorClassTrib.json`, `data/actorGroups.json`, `data/actors.json`, `data/annexes.json`, `data/cbsTransfer.json` e mais 10 | `prefix` | `prefixo` |
  | `data/manifest.json` | `dataSchemaVersion` | `versaoDoFormato` |
  | `data/manifest.json` | `dataVersion` | `versaoDosDados` |
  | `data/manifest.json` | `datasetSha256` | `sha256DoDataset` |
  | `data/manifest.json` | `knownAt` | `conhecidoEm` |
  | `data/manifest.json` | `tables` | `tabelas` |
  Arquivos de dados renomeados em `src/data/`:
  
  | Antigo | Novo |
  |---|---|
  | `treatments.json` | `tratamentos.json` |
  | `ncmApplicability.json` | `aplicabilidadeNcm.json` |
  | `nbsApplicability.json` | `aplicabilidadeNbs.json` |
  | `annexes.json` | `anexos.json` |
  | `actorGroups.json` | `gruposDeAtores.json` |
  | `actors.json` | `atores.json` |
  | `actorClassTrib.json` | `atorClassTrib.json` |
  | `dfeTypes.json` | `tiposDfe.json` |
  | `govPurchaseReducer.json` | `redutorCompraGov.json` |
  | `cbsTransfer.json` | `transferenciaCbs.json` |
  
  Também mudam nesta versão:
  
  - `VERSAO_DO_FORMATO_DOS_DADOS` (antes `DATA_SCHEMA_VERSION`) sobe para 2: um bundle da 0.1.x é recusado com `ibscbs_dados_versao_incompativel`. Os hashes do `manifest.json` foram recalculados sobre as chaves novas.
  - Os indicadores de grupo passam de `forbidden`, `required` e `allowed` para `vedado`, `obrigatorio` e `permitido`.
  - `name` de cada classe de erro é o nome novo da classe (`ErroDadosIbsCbs`).
  - Chaves de `detalhes`: `dataSchemaVersion` → `versaoDoFormato`, `supported` → `suportada`, `table` → `tabela`, `key` → `chave`, `missing` → `ausentes`, `extra` → `sobrando`, `expected` → `esperado`, `got` → `obtido`, `value` → `valor`.

### Patch Changes

- Updated dependencies [ae8ab90]
  - @sinete/core@0.2.0

## 2026.9.1

### Patch Changes

- 515861a: Primeira versão do `@sinete/ibs-cbs-dados`: dataset do IBS/CBS (CST, cClassTrib com tratamentos, reduções, alíquotas fixas, vínculo com DF-e e fundamentação, cCredPres, aplicabilidade de NCM e NBS, anexos, atores, redutor de compras governamentais) extraído do SQLite da Calculadora offline V0057 e do IT 2025.002 v1.60, reproduzível por dois caminhos e fixado por hash, com `manifest.json` de proveniência, `verifyDataset`, visão por data de fato gerador (`TaxContent`) e diff semântico entre versões. Versionado por AAAA.M.patch do mês dos dados, independente do código.
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/core@0.1.0
