# @sinete/ibs-cbs

## 0.2.0

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
- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `RateUnknownError` | `ErroAliquotaDesconhecida` |
  | `RatesDataError` | `ErroDadosDeAliquotas` |
  | `RATES_SCHEMA_VERSION` | `VERSAO_DO_FORMATO_DAS_ALIQUOTAS` |
  | `RATES_TABLE` | `TABELA_ALIQUOTAS` |
  | `isSimulated` | `ehSimulada` |
  | `officialRates` | `aliquotasOficiais` |
  | `requireRate` | `exigirAliquota` |
  | `withOverrides` | `comAliquotasInformadas` |
  | `IsoDate` | `DataIso` |
  | `NominalRates` | `AliquotasNominais` |
  | `Place` | `Local` |
  | `RATE_TRIBUTOS` | `TRIBUTOS_DAS_ALIQUOTAS` |
  | `Rate` | `Aliquota` |
  | `RateOverride` | `AliquotaInformada` |
  | `RateProvider` | `ProvedorDeAliquotas` |
  | `RateSource` | `FonteDaAliquota` |
  | `RateStatus` | `SituacaoDaAliquota` |
  | `RateTributo` | `TributoDaAliquota` |
  | `RatesTable` | `TabelaDeAliquotas` |
  | `ReferenceRateRecord` | `RegistroAliquotaDeReferencia` |
  | `StandardRateRecord` | `RegistroAliquotaPadrao` |
  | `Validity` | `Vigencia` |
  | `CalculateOptions` | `CalcularOpcoes` |
  | `calculate` | `calcular` |
  | `calculateAt` | `calcularEm` |
  | `ClassificationError` | `ErroClassificacao` |
  | `ClassificationReason` | `MotivoErroClassificacao` |
  | `ExpressionError` | `ErroExpressao` |
  | `UnsupportedRegime` | `RegimeNaoSuportado` |
  | `UnsupportedRegimeError` | `ErroRegimeNaoSuportado` |
  | `EXPRESSION_VARIABLES` | `VARIAVEIS_DAS_EXPRESSOES` |
  | `INTERNAL_SCALE` | `ESCALA_INTERNA` |
  | `Variables` | `Variaveis` |
  | `checkExpression` | `conferirExpressao` |
  | `evaluate` | `avaliar` |
  | `fromPercent` | `dePercentual` |
  | `money` | `dinheiro` |
  | `percent` | `percentual` |
  | `toPercent` | `paraPercentual` |
  | `GovValues` | `ValoresCompraGov` |
  | `REDISTRIBUTION_FROM` | `REDISTRIBUICAO_A_PARTIR_DE` |
  | `enteOf` | `enteDe` |
  | `redistribute` | `redistribuir` |
  | `AppliedRate` | `AliquotaAplicada` |
  | `ClassifiedItem` | `ItemClassificado` |
  | `ClassifiedOperation` | `OperacaoClassificada` |
  | `GovernmentPurchase` | `CompraGovernamental` |
  | `InformedRates` | `AliquotasInformadas` |
  | `OperationPlace` | `LocalDaOperacao` |
  | `PresumedCredit` | `CreditoPresumido` |
  | `PresumedCreditTributo` | `CreditoPresumidoTributo` |
  | `RateOrigin` | `OrigemDaAliquota` |
  | `RegularTaxation` | `TributacaoRegular` |
  | `TraceEntry` | `EntradaDoRastro` |
  | `ZfmPresumedCredit` | `CreditoPresumidoZfm` |
  | `ConstrainOptions` | `RestringirOpcoes` |
  | `ItemConstraints` | `RestricoesDoItem` |
  | `candidateOf` | `candidatoDe` |
  | `constrain` | `restringir` |
  | `constrainAt` | `restringirEm` |
  | `factDate` | `dataDoFato` |
  | `DEFAULT_RESOLVERS` | `RESOLVEDORES_PADRAO` |
  | `DetermineAtOptions` | `DeterminarEmOpcoes` |
  | `DetermineOptions` | `DeterminarOpcoes` |
  | `ItemInput` | `EntradaDoItem` |
  | `OperationInput` | `EntradaDaOperacao` |
  | `askUser` | `perguntarAoUsuario` |
  | `determine` | `determinar` |
  | `determineAt` | `determinarEm` |
  | `fromProfile` | `doPerfil` |
  | `questionId` | `idDaPergunta` |
  | `toClassified` | `paraClassificado` |
  | `uniqueCandidate` | `candidatoUnico` |
  | `DeterminationError` | `ErroDeterminacao` |
  | `DeterminationReason` | `MotivoErroDeterminacao` |
  | `ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR` | `ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE` |
  | `LEGAL_RULES` | `REGRAS_LEGAIS` |
  | `AppliedRule` | `RegraAplicada` |
  | `Candidate` | `Candidato` |
  | `Determination` | `Determinacao` |
  | `Exclusion` | `Exclusao` |
  | `ExclusionReason` | `MotivoDaExclusao` |
  | `ItemDetermination` | `DeterminacaoDoItem` |
  | `ItemFacts` | `FatosDoItem` |
  | `ItemProfile` | `PerfilDoItem` |
  | `LegalOutcome` | `ResultadoRegraLegal` |
  | `LegalRule` | `RegraLegal` |
  | `LegalRuleContext` | `ContextoRegraLegal` |
  | `OperationFacts` | `FatosDaOperacao` |
  | `OperationKind` | `TipoDeOperacao` |
  | `PartyFacts` | `FatosDaParte` |
  | `Provenance` | `Procedencia` |
  | `Question` | `Pergunta` |
  | `QuestionOption` | `OpcaoDaPergunta` |
  | `ResolveContext` | `ContextoDoResolvedor` |
  | `Resolver` | `Resolvedor` |
  | `ResolverOutcome` | `ResultadoDoResolvedor` |
  | `NOT_IMPLEMENTED` | `NAO_IMPLEMENTADAS` |
  | `NT_TABLES` | `TABELAS_NT` |
  | `RULES` | `REGRAS` |
  | `Report` | `Relatar` |
  | `Rule` | `Regra` |
  | `RuleContext` | `ContextoDaRegra` |
  | `Activation` | `Ativacao` |
  | `NotImplemented` | `NaoImplementada` |
  | `NtTables` | `TabelasNt` |
  | `RuleMeta` | `DescricaoDaRegra` |
  | `RulesDocument` | `DocumentoDasRegras` |
  | `RulesItem` | `ItemDasRegras` |
  | `ValidationReport` | `RelatorioDeValidacao` |
  | `Violation` | `Violacao` |
  | `ValidateOptions` | `ValidarOpcoes` |
  | `documentFromRoc` | `documentoDoRoc` |
  | `isActive` | `ativa` |
  | `validate` | `validar` |
  | `ItemResult` | `ResultadoDoItem` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `ProvedorDeAliquotas` | `nominal.date` | `nominal.data` |
  | `ProvedorDeAliquotas` | `nominal.place` | `nominal.local` |
  | `ProvedorDeAliquotas` | `reference.date` | `referencia.data` |
  | `ErroDadosDeAliquotas`, `ErroAliquotaDesconhecida`, `ErroClassificacao`, `ErroRegimeNaoSuportado`, `ErroDeterminacao` | `constructor.options` | `constructor.opcoes` |
  | `ErroAliquotaDesconhecida` | `constructor.date` | `constructor.data` |
  | `ErroClassificacao`, `ErroDeterminacao` | `constructor.reason` | `constructor.motivo` |
  | `calcularEm` | `options.rates` | `opcoes.aliquotas` |
  | `calcularEm` | `options.date` | `opcoes.data` |
  | `ErroExpressao` | `constructor.expression` | `constructor.expressao` |
  | `DeterminacaoDoItem` | `decided.candidate` | `decidido.candidato` |
  | `DeterminacaoDoItem` | `decided.provenance` | `decidido.procedencia` |
  | `RegraLegal` | `validity.from` | `vigencia.inicio` |
  | `RegraLegal` | `validity.to` | `vigencia.fim` |
  | `RegraLegal` | `apply.ctx` | `aplicar.contexto` |
  | `Resolvedor` | `resolve.ctx` | `resolver.contexto` |
  | `paraClassificado` | `item.candidate` | `item.candidato` |
  | `TabelasNt` | `source.title` | `fonte.titulo` |
  | `TabelasNt` | `source.version` | `fonte.versao` |
  | `TabelasNt` | `source.published` | `fonte.publicadaEm` |
  | `TabelasNt` | `cbsZeroExcludedNcm.prefixes` | `ncmExcluidosDaCbsZero.prefixos` |
  | `TabelasNt` | `cbsZeroExcludedNcm.allowedWithin` | `ncmExcluidosDaCbsZero.permitidoDentroDe` |
  | `TabelasNt` | `cbsZeroExcludedNcm.note` | `ncmExcluidosDaCbsZero.nota` |
  | `Regra` | `check.ctx` | `conferir.contexto` |
  | `Regra` | `check.report` | `conferir.relatar` |
  | `documentoDoRoc` | `ident.items` | `identificacao.itens` |
  | `Aliquota`, `RegistroAliquotaDeReferencia`, `AliquotaAplicada` | `status` | `situacao` |
  | `Aliquota`, `AliquotaInformada`, `AliquotaAplicada`, `dePercentual`, `dinheiro`, `percentual` | `value` | `valor` |
  | `Aliquota`, `TabelaDeAliquotas`, `RegistroAliquotaDeReferencia`, `RegistroAliquotaPadrao` | `sources` | `fontes` |
  | `Aliquota`, `RegistroAliquotaDeReferencia`, `RegraLegal`, `DescricaoDaRegra` | `note` | `nota` |
  | `Aliquota`, `AliquotaInformada`, `AliquotaAplicada`, `AliquotasInformadas`, `ErroClassificacao` e mais 3 | `reason` | `motivo` |
  | `Aliquota`, `AliquotaInformada`, `RegistroAliquotaDeReferencia`, `RegistroAliquotaPadrao`, `RegraLegal` | `validity` | `vigencia` |
  | `AliquotaInformada`, `OperacaoClassificada`, `EntradaDaOperacao` | `place` | `local` |
  | `AliquotaInformada` | `applies` | `aplicaA` |
  | `AliquotaInformada`, `RegraAplicada`, `Exclusao`, `RegraLegal`, `Procedencia` e mais 3 | `source` | `fonte` |
  | `ProvedorDeAliquotas`, `TabelaDeAliquotas` | `reference` | `referencia` |
  | `FonteDaAliquota`, `RegraLegal`, `DescricaoDaRegra` | `title` | `titulo` |
  | `FonteDaAliquota` | `version` | `versao` |
  | `FonteDaAliquota`, `ErroAliquotaDesconhecida`, `exigirAliquota`, `redistribuir` | `date` | `data` |
  | `TabelaDeAliquotas` | `schemaVersion` | `versaoDoFormato` |
  | `TabelaDeAliquotas` | `dataVersion` | `versaoDosDados` |
  | `TabelaDeAliquotas` | `knownAt` | `conhecidoEm` |
  | `TabelaDeAliquotas` | `standard` | `padrao` |
  | `RegistroAliquotaDeReferencia`, `RegistroAliquotaPadrao`, `exigirAliquota` | `rate` | `aliquota` |
  | `Vigencia` | `from` | `inicio` |
  | `Vigencia` | `to` | `fim` |
  | `ehSimulada`, `CalcularOpcoes`, `RocItem`, `ContextoDaRegra`, `ValidarOpcoes` | `rates` | `aliquotas` |
  | `comAliquotasInformadas` | `overrides` | `informadas` |
  | `AliquotaAplicada` | `origin` | `origem` |
  | `CalcularOpcoes`, `RestringirOpcoes`, `dataDoFato`, `ValidarOpcoes` | `time` | `tempo` |
  | `CalcularOpcoes`, `RestringirOpcoes`, `dataDoFato`, `ValidarOpcoes` | `utcOffsetMinutes` | `deslocamentoMin` |
  | `ItemClassificado` | `quantity` | `quantidade` |
  | `ItemClassificado` | `unit` | `unidade` |
  | `ItemClassificado` | `informedRates` | `aliquotasInformadas` |
  | `ItemClassificado` | `deferral` | `diferimento` |
  | `ItemClassificado` | `taxRefund` | `devolucaoDeTributo` |
  | `ItemClassificado` | `creditTransfer` | `transferenciaDeCredito` |
  | `ItemClassificado` | `competenceAdjustment` | `ajusteDeCompetencia` |
  | `ItemClassificado` | `creditReversal` | `estornoDeCredito` |
  | `ItemClassificado` | `presumedCredit` | `creditoPresumido` |
  | `ItemClassificado` | `zfmCredit` | `creditoZfm` |
  | `ItemClassificado` | `monophase` | `monofasia` |
  | `ItemClassificado` | `selectiveTax` | `impostoSeletivo` |
  | `OperacaoClassificada`, `EntradaDaOperacao` | `governmentPurchase` | `compraGovernamental` |
  | `OperacaoClassificada`, `Roc`, `Determinacao`, `FatosDaOperacao`, `DocumentoDasRegras` | `items` | `itens` |
  | `CreditoPresumido`, `ItemDasRegras` | `usedMovableGood` | `bemMovelUsado` |
  | `CreditoPresumidoTributo` | `conditional` | `condicional` |
  | `Roc`, `Determinacao`, `Procedencia` | `asOf` | `dataDeReferencia` |
  | `Roc`, `RocItem` | `simulated` | `simulado` |
  | `Roc`, `Determinacao`, `Procedencia` | `contentVersion` | `versaoDoConteudo` |
  | `Roc` | `ratesId` | `idDasAliquotas` |
  | `Roc` | `trace` | `rastro` |
  | `EntradaDoRastro` | `field` | `campo` |
  | `EntradaDoRastro` | `inputs` | `entradas` |
  | `EntradaDoRastro` | `result` | `resultado` |
  | `calcular`, `calcularEm`, `Pergunta`, `restringir`, `determinar` e mais 2 | `options` | `opcoes` |
  | `conferirExpressao`, `avaliar` | `expr` | `expressao` |
  | `ErroExpressao` | `expression` | `expressao` |
  | `avaliar` | `vars` | `variaveis` |
  | `redistribuir` | `values` | `valores` |
  | `redistribuir` | `transferFraction` | `fracaoTransferida` |
  | `paraPercentual` | `fraction` | `fracao` |
  | `RegraAplicada`, `Violacao`, `ativa` | `rule` | `regra` |
  | `RegraAplicada`, `ResultadoRegraLegal` | `codes` | `codigos` |
  | `RegraAplicada` | `conflict` | `conflito` |
  | `Candidato`, `Procedencia`, `Resolvedor` | `name` | `nome` |
  | `Candidato`, `FatosDoItem` | `description` | `descricao` |
  | `Candidato` | `link` | `url` |
  | `Candidato` | `requiresRegular` | `exigeRegular` |
  | `Determinacao` | `complete` | `completa` |
  | `DeterminarEmOpcoes`, `DeterminacaoDoItem`, `ValidarOpcoes` | `rules` | `regras` |
  | `DeterminarEmOpcoes` | `resolvers` | `resolvedores` |
  | `DeterminarEmOpcoes`, `ContextoDoResolvedor` | `answers` | `respostas` |
  | `DeterminarEmOpcoes`, `DeterminarOpcoes` | `clock` | `relogio` |
  | `Exclusao` | `detail` | `detalhe` |
  | `RestricoesDoItem`, `DeterminacaoDoItem`, `ContextoDoResolvedor` | `candidates` | `candidatos` |
  | `RestricoesDoItem`, `DeterminacaoDoItem` | `exclusions` | `exclusoes` |
  | `DeterminacaoDoItem` | `decided` | `decidido` |
  | `DeterminacaoDoItem` | `pending` | `pendente` |
  | `FatosDoItem`, `ResultadoRegraLegal`, `FatosDaOperacao`, `ResultadoDoResolvedor` | `kind` | `tipo` |
  | `FatosDoItem` | `referenced` | `referenciado` |
  | `FatosDoItem` | `profile` | `perfil` |
  | `PerfilDoItem` | `decidedBy` | `decididoPor` |
  | `RegraLegal` | `apply` | `aplicar` |
  | `ContextoRegraLegal`, `ContextoDoResolvedor`, `restringir`, `restringirEm`, `determinar`, `determinarEm` | `facts` | `fatos` |
  | `ContextoRegraLegal`, `ContextoDoResolvedor`, `candidatoDe`, `restringirEm`, `determinarEm`, `ContextoDaRegra` | `content` | `conteudo` |
  | `FatosDaOperacao` | `supplier` | `fornecedor` |
  | `FatosDaOperacao` | `buyer` | `adquirente` |
  | `FatosDaParte` | `actors` | `atores` |
  | `Procedencia` | `by` | `por` |
  | `Procedencia` | `at` | `em` |
  | `Procedencia`, `ResultadoDoResolvedor` | `confidence` | `confianca` |
  | `Procedencia`, `ResultadoDoResolvedor` | `evidence` | `evidencia` |
  | `Pergunta` | `text` | `texto` |
  | `OpcaoDaPergunta` | `label` | `rotulo` |
  | `Resolvedor` | `resolve` | `resolver` |
  | `ResultadoDoResolvedor` | `questions` | `perguntas` |
  | `TabelasNt` | `classTribByNoteType` | `classTribPorTipoDeNota` |
  | `TabelasNt` | `ratesByEmissionYear` | `aliquotasPorAnoDeEmissao` |
  | `TabelasNt` | `incentivizedAreas` | `areasIncentivadas` |
  | `TabelasNt` | `cbsZeroExcludedNcm` | `ncmExcluidosDaCbsZero` |
  | `Regra` | `check` | `conferir` |
  | `ContextoDaRegra`, `ativa`, `validar` | `doc` | `documento` |
  | `ContextoDaRegra`, `ativa` | `emission` | `emissao` |
  | `DescricaoDaRegra` | `activation` | `ativacao` |
  | `DocumentoDasRegras` | `referencedEmission` | `emissaoReferenciada` |
  | `DocumentoDasRegras` | `emitMun` | `munEmitente` |
  | `DocumentoDasRegras` | `destMun` | `munDestinatario` |
  | `ItemDasRegras` | `monophasicFuel` | `combustivelMonofasico` |
  | `ValidarOpcoes` | `ignoreActivation` | `ignorarAtivacao` |
  | `RelatorioDeValidacao` | `violations` | `violacoes` |
  | `RelatorioDeValidacao` | `evaluated` | `avaliadas` |
  | `RelatorioDeValidacao` | `inactive` | `inativas` |
  | `RelatorioDeValidacao` | `emissionDate` | `dataDaEmissao` |
  | `RelatorioDeValidacao` | `factDate` | `dataDoFato` |
  | `documentoDoRoc` | `ident` | `identificacao` |
  | `TabelasNt` | `tpNFDebito.code` | `tpNFDebito.codigo` |
  | `TabelasNt` | `tpNFDebito.description` | `tpNFDebito.descricao` |
  | `TabelasNt` | `tpNFCredito.code` | `tpNFCredito.codigo` |
  | `TabelasNt` | `tpNFCredito.description` | `tpNFCredito.descricao` |
  | `TabelasNt` | `aliquotasPorAnoDeEmissao.from` | `aliquotasPorAnoDeEmissao.inicio` |
  | `TabelasNt` | `aliquotasPorAnoDeEmissao.to` | `aliquotasPorAnoDeEmissao.fim` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `AliquotaInformada` | `'reference'` | `'referencia'` |
  | `AliquotaInformada` | `'both'` | `'ambas'` |
  | `SituacaoDaAliquota` | `'official'` | `'oficial'` |
  | `SituacaoDaAliquota` | `'user-provided'` | `'informada'` |
  | `SituacaoDaAliquota` | `'unknown'` | `'desconhecida'` |
  | `OrigemDaAliquota` | `'provider-nominal'` | `'provedor-nominal'` |
  | `OrigemDaAliquota` | `'provider-reference'` | `'provedor-referencia'` |
  | `OrigemDaAliquota` | `'dataset-fixed'` | `'dataset-fixa'` |
  | `OrigemDaAliquota` | `'informed'` | `'informada'` |
  | `OrigemDaAliquota` | `'no-rate'` | `'sem-aliquota'` |
  | `Procedencia` | `'rule'` | `'regra'` |
  | `Procedencia` | `'resolver'` | `'resolvedor'` |
  | `Procedencia` | `'user'` | `'usuario'` |
  | `ResultadoDoResolvedor` | `'decided'` | `'decidido'` |
  | `ResultadoDoResolvedor` | `'ask'` | `'perguntar'` |
  | `ResultadoDoResolvedor` | `'abstain'` | `'abster'` |
  | `ResultadoRegraLegal` | `'restrict'` | `'restringir'` |
  | `ResultadoRegraLegal` | `'none'` | `'nenhum'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `from` | `inicio` |
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `to` | `fim` |
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `note` | `nota` |
  | `aliquotas/data/rates.json` | `rate` | `aliquota` |
  | `aliquotas/data/rates.json` | `sources` | `fontes` |
  | `aliquotas/data/rates.json` | `status` | `situacao` |
  | `aliquotas/data/rates.json` | `validity` | `vigencia` |
  | `aliquotas/data/rates.json` | `date` | `data` |
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `title` | `titulo` |
  | `aliquotas/data/rates.json`, `validar/data/nt2025002.json` | `version` | `versao` |
  | `validar/data/nt2025002.json` | `allowedWithin` | `permitidoDentroDe` |
  | `validar/data/nt2025002.json` | `prefixes` | `prefixos` |
  | `validar/data/nt2025002.json` | `published` | `publicadaEm` |
  | `validar/data/nt2025002.json` | `code` | `codigo` |
  | `validar/data/nt2025002.json` | `description` | `descricao` |
  | `aliquotas/data/rates.json` | `dataVersion` | `versaoDosDados` |
  | `aliquotas/data/rates.json` | `knownAt` | `conhecidoEm` |
  | `aliquotas/data/rates.json` | `reference` | `referencia` |
  | `aliquotas/data/rates.json` | `schemaVersion` | `versaoDoFormato` |
  | `aliquotas/data/rates.json` | `standard` | `padrao` |
  | `validar/data/nt2025002.json` | `cbsZeroExcludedNcm` | `ncmExcluidosDaCbsZero` |
  | `validar/data/nt2025002.json` | `classTribByNoteType` | `classTribPorTipoDeNota` |
  | `validar/data/nt2025002.json` | `incentivizedAreas` | `areasIncentivadas` |
  | `validar/data/nt2025002.json` | `ratesByEmissionYear` | `aliquotasPorAnoDeEmissao` |
  | `validar/data/nt2025002.json` | `source` | `fonte` |
  Também mudam nesta versão:
  
  - `src/aliquotas/data/rates.json`: além das chaves, `situacao` passa a `oficial` e `desconhecida`, e `VERSAO_DO_FORMATO_DAS_ALIQUOTAS` (antes `RATES_SCHEMA_VERSION`) sobe para 2.
  - Alíquota informada por `comAliquotasInformadas` sai com `situacao: 'informada'` (antes `status: 'user-provided'`), e a fonte dela é `'usuario'` (antes `'user'`).
  - `name` de cada classe de erro é o nome novo da classe (`ErroClassificacao`, `ErroDeterminacao`, `ErroAliquotaDesconhecida`...).
  - Chaves de `detalhes`: `reason` → `motivo`, `date` → `data`, `expression` → `expressao`.
  - `Candidato` e `BaseLegalClassTrib`: `link` → `url`.
  - Parâmetros: `dec(texto)`, `sum(valores)`.
  - `Decimal` e seus métodos, e o modo `'HALF_EVEN'`, ficam em inglês (exceção 3 do ADR 0015).

### Patch Changes

- Updated dependencies [ae8ab90]
- Updated dependencies [ae8ab90]
- Updated dependencies [84080ad]
- Updated dependencies [2a46db6]
  - @sinete/core@0.2.0
  - @sinete/ibs-cbs-dados@2026.10.0

## 0.1.0

### Minor Changes

- 515861a: Primeira versão do `@sinete/ibs-cbs`, o motor do IBS e da CBS agnóstico de documento, com a raiz reexportando tudo e um subpath por parte:
  
  - `@sinete/ibs-cbs/aliquotas`: alíquotas nominais e de referência do IBS e da CBS por data de fato gerador, cada uma `official` (com dispositivo legal e fonte), `user-provided` (com motivo) ou `unknown`, e `RateUnknownError` em vez de zero quando a alíquota ainda não foi publicada. 2026 com as alíquotas de teste; IBS de 0,05% + 0,05% em 2027 e 2028 pela LC 214/2025; CBS de 2027 em diante desconhecida.
  - `@sinete/ibs-cbs/calcular`: cálculo puro e determinístico do IBS e da CBS a partir de CST e cClassTrib, com as expressões de tratamento do dataset, 8 casas internas e HALF_EVEN como a Calculadora da RFB, saída nos grupos da NT 2025.002 (`gIBSCBS`, `gRed`, `gDif`, `gDevTrib`, `gTribRegular`, `gTribCompraGov`, crédito presumido, estorno, transferência, ajuste de competência) e totais `IBSCBSTot`, compra governamental com a redistribuição do art. 473, alíquotas simuladas marcadas e erros tipados; monofasia, Imposto Seletivo e alíquotas combinadas lançam `UnsupportedRegimeError`.
  - `@sinete/ibs-cbs/validar`: regras de validação da NT 2025.002-RTC v1.51 para NF-e e NFC-e (UB12-10 a UB133-10 e somas W) como funções puras com id, cStat, modelos, implantação por ambiente e fonte, `validate` com os dois relógios e `documentFromRoc` para conferir a saída do `@sinete/ibs-cbs/calcular`.
  - `@sinete/ibs-cbs/determinar`: `constrain` reduz os cClassTrib de cada item pelas restrições oficiais (vigência, DF-e, tipo de nota, nomenclatura, anexos de NCM e NBS, atores) com o motivo e a fonte de cada exclusão; `determine` soma regras legais com fonte, respostas do usuário e resolvedores assíncronos plugáveis, e devolve cada decisão com proveniência; `toClassified` monta a entrada do `@sinete/ibs-cbs/calcular`.

### Patch Changes

- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/core@0.1.0
  - @sinete/ibs-cbs-dados@2026.9.1
