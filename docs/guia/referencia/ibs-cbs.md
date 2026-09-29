# Referência: `@sinete/ibs-cbs`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/ibs-cbs/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/ibs-cbs/x` é `sinete/ibs-cbs/x`.

## `@sinete/ibs-cbs`

`@sinete/ibs-cbs`: o motor do IBS e da CBS do sinete, agnóstico de documento (NF-e, NFC-e, CT-e, NFCom, NFS-e...).

A raiz reexporta as quatro partes; quem quer só uma importa o subpath: - `@sinete/ibs-cbs/aliquotas`: alíquotas nominais por data de fato gerador, com estado da fonte; - `@sinete/ibs-cbs/calcular`: cálculo a partir de uma operação já classificada (CST e cClassTrib por item); - `@sinete/ibs-cbs/validar`: regras de validação da NT 2025.002 que dá para conferir sem o banco da SEFAZ; - `@sinete/ibs-cbs/determinar`: determinação do CST e do cClassTrib a partir de fatos de negócio.

Os dados oficiais (CST, cClassTrib, tratamentos, anexos) ficam no `@sinete/ibs-cbs-dados`, que tem ritmo de versão próprio (ADR 0007 e ADR 0008).

### Funções

- `askUser`: Pergunta ao usuário entre os candidatos que sobraram; a resposta volta em `answers[questionId(n)]`. `askUser(): Resolver`
- `calculate`: Calcula IBS e CBS da operação. Lança `ClassificationError`, `UnsupportedRegimeError` ou `RateUnknownError`. `calculate(op: ClassifiedOperation, options: CalculateOptions): Roc`
- `calculateAt`: Variante com a data civil do fato gerador já resolvida (`AAAA-MM-DD`): para reprocessamento e para o oráculo, que trabalham com a data que a Calculadora recebe. `calculateAt(op: ClassifiedOperation, options: { readonly dataset: IbsCbsDataset; readonly rates: RateProvider; readonly date: IsoDate; }): Roc`
- `candidateOf`: `candidateOf(content: TaxContent, ct: ClassTribRecord): Candidate`
- `checkExpression`: Confere que a expressão só usa a gramática e as variáveis conhecidas; devolve as variáveis citadas. `checkExpression(expr: string): readonly string[]`
- `constrain`: Restrições oficiais na data do fato gerador de `options.time`. `constrain(facts: OperationFacts, options: ConstrainOptions): readonly ItemConstraints[]`
- `constrainAt`: Restrições oficiais numa visão já fixada numa data. `constrainAt(facts: OperationFacts, content: TaxContent): readonly ItemConstraints[]`
- `dec`: Atalho para `Decimal.parse`. `dec(text: string): Decimal`
- `determine`: Determinação na data do fato gerador de `options.time`. `determine(facts: OperationFacts, options: DetermineOptions): Promise<Determination>`
- `determineAt`: Determinação numa visão já fixada numa data. `determineAt(facts: OperationFacts, content: TaxContent, options: DetermineAtOptions): Promise<Determination>`
- `documentFromRoc`: Documento para `validate` a partir do `Roc` do motor, com os campos de identificação que o `Roc` não tem. `documentFromRoc(roc: Roc, ident: Omit<RulesDocument, 'items' | 'IBSCBSTot' | 'gCompraGov'> & { readonly items?: readonly Omit<RulesDocument['items'][number], 'IBSCBS'>[]; }): RulesDocument`
- `enteOf`: Ente equivalente para a redistribuição. `enteOf(tp: TpEnteGov): Ente`
- `evaluate`: `evaluate(expr: string, vars: Variables): Decimal`
- `factDate`: Data civil do fato gerador. `factDate(time: TimeContext, utcOffsetMinutes?: number): string`
- `fromPercent`: Percentual (`'0.9'`) para fração com 8 casas HALF_EVEN, como o `dividirPorCem` da Calculadora. `fromPercent(value: Decimal): Decimal`
- `fromProfile`: Reaproveita a classificação guardada no cadastro do item, se ela ainda estiver entre os candidatos. `fromProfile(): Resolver`
- `isActive`: A regra está implantada para o documento na data de emissão e no ambiente. `isActive(rule: RuleMeta, doc: RulesDocument, ambiente: Ambiente, emission: string): boolean`
- `isSimulated`: Alguma das alíquotas não é oficial: o cálculo feito com elas é simulação. `isSimulated(rates: NominalRates): boolean`
- `money`: Valor monetário com 2 casas, HALF_EVEN. `money(value: Decimal): string`
- `officialRates`: Provedor da tabela oficial (a embarcada, por padrão). `officialRates(t?: RatesTable): RateProvider`
- `percent`: Percentual com 4 casas HALF_EVEN, sem zeros à direita e com no mínimo 2 casas (`'0.90'`, `'0.1234'`, `'60.00'`). `percent(value: Decimal): string`
- `questionId`: Id estável da pergunta de classificação de um item. `questionId(n: number): string`
- `redistribute`: Valores que cada ente efetivamente recebe. `transferPercent` é o percentual da CBS transferido ao ente contratante (`'0'` até 2028), já em fração de 8 casas. `redistribute(values: GovValues, tp: TpEnteGov, date: IsoDate, transferFraction: Decimal): GovValues`
- `requireRate`: Valor da alíquota, ou `RateUnknownError` quando ela ainda não existe. `requireRate(rate: Rate, date: IsoDate): string`
- `sum`: Soma de uma lista (zero para lista vazia). `sum(values: readonly Decimal[]): Decimal`
- `toClassified`: Monta a entrada do `@sinete/ibs-cbs/calcular`. Falha se algum item ficou sem decisão. `toClassified(det: Determination, op: OperationInput, item: (n: number, candidate: Candidate) => ItemInput): ClassifiedOperation`
- `toPercent`: Fração (`0.009`) para percentual (`0.9`), sem arredondar (`movePointRight(2)`). `toPercent(fraction: Decimal): Decimal`
- `uniqueCandidate`: Decide quando só sobrou um candidato. `uniqueCandidate(): Resolver`
- `validate`: `validate(doc: RulesDocument, options: ValidateOptions): ValidationReport`
- `withOverrides`: Sobrepõe alíquotas informadas pelo usuário. A primeira sobreposição que casar (tributo, vigência, local, tipo) vence; as demais alíquotas continuam vindo de `base`. O resultado sai `user-provided`, com o motivo. `withOverrides(base: RateProvider, overrides: readonly RateOverride[]): RateProvider`

### Classes

- `ClassificationError` (estende `SineteError<'ibscbs_classificacao_invalida'>`): A classificação informada não pode ser calculada: código inexistente ou fora de vigência na data do fato gerador, cClassTrib fora da CST, não habilitado no modelo de DF-e, grupo exigido ausente ou vedado presente. `reason` diz qual. Membros: `reason`, `item`.
- `Decimal`: Valor decimal imutável: `unscaled × 10^-scale`. Membros: `unscaled`, `scale`, `ZERO`, `ONE`, `HUNDRED`, `of()`, `parse()`, `isDecimalText()`, `add()`, `sub()`, `mul()`, `div()`, `roundSignificant()`, `setScale()`, `stripZeros()`, `movePointRight()`, `neg()`, `cmp()`, `eq()`, `isZero()`, `isNegative()`, `toString()`, `toFixed()`, `toJSON()`.
- `DeterminationError` (estende `SineteError<'ibscbs_determinacao_invalida'>`): A determinação não pode seguir: fatos malformados (item repetido, NCM com letras), resolvedor ou resposta que escolhe código fora dos candidatos, ou `toClassified` com item sem decisão. `reason` diz qual; `item` diz onde. Membros: `reason`, `item`.
- `ExpressionError` (estende `SineteError<'ibscbs_expressao_invalida'>`): Expressão de cálculo do dataset fora da gramática conhecida: mudança de dado que precisa de revisão. Membros: `expression`.
- `RatesDataError` (estende `SineteError<'ibscbs_aliquotas_invalidas'>`): Tabela de alíquotas inconsistente (vigências sobrepostas, valor fora do domínio, formato desconhecido).
- `RateUnknownError` (estende `SineteError<'ibscbs_aliquota_desconhecida'>`): A alíquota pedida ainda não foi publicada (estado `unknown`). O cálculo não segue com zero nem com um palpite: quem precisa simular informa a alíquota com `withOverrides`, e o resultado sai marcado como simulado. Membros: `tributo`, `date`.
- `UnsupportedRegimeError` (estende `SineteError<'ibscbs_regime_nao_suportado'>`): Membros: `regime`, `item`.

### Interfaces

- `Activation`: A partir de quando a regra vale, por ambiente, pela data de emissão. Membros: `homologacao`, `producao`, `crt`.
- `AppliedRate`: Membros: `tributo`, `value`, `status`, `origin`, `legal`, `reason`.
- `AppliedRule`: Restrição aplicada por uma regra legal, registrada no item. Membros: `rule`, `source`, `codes`, `conflict`.
- `CalculateOptions`: Membros: `dataset`, `rates`, `time`, `utcOffsetMinutes`.
- `Candidate`: Um cClassTrib possível para o item, com o que o usuário precisa para escolher. Membros: `cst`, `cClassTrib`, `name`, `description`, `lc214`, `link`, `requiresRegular`.
- `ClassifiedItem`: Item classificado: tudo o que o cálculo precisa, sem fato de negócio (CFOP, cliente, descrição). Membros: `n`, `cst`, `cClassTrib`, `base`, `quantity`, `unit`, `regular`, `informedRates`, `deferral`, `taxRefund`, `creditTransfer`, `competenceAdjustment`, `creditReversal`, `presumedCredit`, `zfmCredit`, `monophase`, `selectiveTax`.
- `ClassifiedOperation`: Membros: `modelo`, `place`, `governmentPurchase`, `items`.
- `ConstrainOptions`: Membros: `dataset`, `time`, `utcOffsetMinutes`.
- `Determination`: Membros: `asOf`, `contentVersion`, `items`, `complete`.
- `DetermineAtOptions`: Membros: `rules`, `resolvers`, `answers`, `clock`, `signal`.
- `DetermineOptions` (estende `ConstrainOptions, Omit<DetermineAtOptions, 'clock'>`): Membros: `clock`.
- `Exclusion`: Membros: `cClassTrib`, `reason`, `detail`, `source`.
- `GCBS`: Membros: `pCBS`, `gDif`, `gDevTrib`, `gRed`, `vCBS`.
- `GCredPresIBSZFM`: Membros: `competApur`, `tpCredPresIBSZFM`, `vCredPresIBSZFM`.
- `GCredPresOper`: Membros: `vBCCredPres`, `cCredPres`, `gIBSCredPres`, `gCBSCredPres`.
- `GCredPresTributo`: Membros: `pCredPres`, `vCredPres`, `vCredPresCondSus`.
- `GDevTrib`: Membros: `pDevTrib`, `vDevTrib`.
- `GDif`: Membros: `pDif`, `vDif`.
- `GIBSCBS`: Membros: `vBC`, `gIBSUF`, `gIBSMun`, `vIBS`, `gCBS`, `gTribRegular`, `gTribCompraGov`.
- `GIBSMun`: Membros: `pIBSMun`, `gDif`, `gRed`, `vIBSMun`.
- `GIBSUF`: Membros: `pIBSUF`, `gDif`, `gRed`, `vIBSUF`.
- `GovernmentPurchase`: Membros: `tpEnteGov`, `tpOperGov`.
- `GRed`: Membros: `pRedAliq`, `pAliqEfet`.
- `GTribCompraGov`: Membros: `pAliqIBSUF`, `vTribIBSUF`, `pAliqIBSMun`, `vTribIBSMun`, `pAliqCBS`, `vTribCBS`.
- `GTribRegular`: Membros: `CSTReg`, `cClassTribReg`, `pAliqEfetRegIBSUF`, `vTribRegIBSUF`, `pAliqEfetRegIBSMun`, `vTribRegIBSMun`, `pAliqEfetRegCBS`, `vTribRegCBS`.
- `IBSCBS`: Grupo `IBSCBS` do item. Os grupos de escolha exclusiva (UB14k) seguem os indicadores da CST. Membros: `CST`, `cClassTrib`, `gIBSCBS`, `gTransfCred`, `gAjusteCompet`, `gEstornoCred`, `gCredPresOper`, `gCredPresIBSZFM`.
- `IBSCBSTot`: Membros: `vBCIBSCBS`, `gIBS`, `gCBS`, `gEstornoCred`.
- `InformedRates`: Alíquotas nominais informadas pelo usuário para o item, em percentual, com motivo obrigatório. Membros: `CBS`, `IBSUF`, `IBSMun`, `reason`.
- `ItemConstraints`: Candidatos e exclusões de um item, só pelas restrições oficiais. Membros: `n`, `candidates`, `exclusions`.
- `ItemDetermination`: Membros: `n`, `candidates`, `exclusions`, `rules`, `decided`, `pending`.
- `ItemFacts`: Membros: `n`, `ncm`, `nbs`, `description`, `kind`, `referenced`, `profile`.
- `ItemProfile`: Classificação já decidida e guardada no cadastro do item, reaproveitada pelo resolvedor `fromProfile`. Membros: `cClassTrib`, `decidedBy`.
- `LegalRule`: Regra fechada, derivada da lei, pura e com fonte: restringe os candidatos a uma lista de códigos. Membros: `id`, `title`, `source`, `validity`, `note`, `apply()`.
- `LegalRuleContext`: Membros: `facts`, `item`, `content`.
- `NominalRates`: As três alíquotas de uma operação. Membros: `CBS`, `IBSUF`, `IBSMun`.
- `NotImplemented`: Regra da NT que este pacote não confere, com o motivo. Membros: `id`, `reason`.
- `NtTables`: Tabelas próprias da NT 2025.002 embarcadas no pacote (`NT_TABLES`). Membros: `source`, `tpNFDebito`, `tpNFCredito`, `classTribByNoteType`, `ratesByEmissionYear`, `incentivizedAreas`, `cbsZeroExcludedNcm`.
- `OperationFacts`: Membros: `modelo`, `kind`, `supplier`, `buyer`, `tpNFDebito`, `tpNFCredito`, `items`.
- `OperationInput`: Membros: `modelo`, `place`, `governmentPurchase`.
- `OperationPlace`: Local da operação (define as alíquotas próprias de UF e município, quando houver). Membros: `uf`, `cMun`.
- `PartyFacts`: Membros: `actors`, `uf`, `cMun`.
- `Place`: Local da operação para a alíquota por ente (a partir de 2029, cada UF e município fixa a sua). Membros: `uf`, `cMun`.
- `PresumedCredit`: Crédito presumido da operação (`gCredPresOper`). Membros: `cCredPres`, `vBCCredPres`, `ibs`, `cbs`, `usedMovableGood`.
- `PresumedCreditTributo`: Membros: `pCredPres`, `conditional`.
- `Provenance`: Membros: `by`, `name`, `at`, `contentVersion`, `asOf`, `source`, `confidence`, `evidence`.
- `Question`: Membros: `id`, `item`, `text`, `options`.
- `QuestionOption`: Membros: `label`, `cClassTrib`.
- `Rate`: Membros: `tributo`, `status`, `value`, `legal`, `sources`, `note`, `reason`, `validity`.
- `RateOverride`: Alíquota informada pelo usuário, com motivo obrigatório. Membros: `tributo`, `value`, `reason`, `validity`, `place`, `applies`, `source`.
- `RateProvider`: Fonte de alíquotas por data. `nominal` é a alíquota "padrão" do cClassTrib; `reference`, a nacional uniforme. Membros: `id`, `nominal()`, `reference()`.
- `RateSource`: Membros: `id`, `title`, `url`, `version`, `date`, `sha256`.
- `RatesTable`: Membros: `schemaVersion`, `dataVersion`, `knownAt`, `sources`, `reference`, `standard`.
- `ReferenceRateRecord`: Membros: `tributo`, `validity`, `status`, `rate`, `legal`, `note`, `sources`.
- `RegularTaxation`: Grupo de tributação regular (`gTribRegular`), exigido pelos cClassTrib de suspensão e afins. Membros: `cst`, `cClassTrib`.
- `ResolveContext`: Membros: `facts`, `item`, `candidates`, `content`, `answers`.
- `Resolver`: Resolvedor plugável: histórico do contribuinte, cadastro, IA, fila de revisão. Só escolhe dentro de `candidates`; um código de fora é erro (`DeterminationError` com `reason` `resolvedor_fora_dos_candidatos`). Membros: `name`, `resolve()`.
- `Roc`: Membros: `asOf`, `oper`, `items`, `total`, `simulated`, `contentVersion`, `ratesId`, `trace`.
- `RocItem`: Membros: `nItem`, `IBSCBS`, `rates`, `simulated`.
- `Rule` (estende `RuleMeta`): Membros: `check()`.
- `RuleContext`: Contexto de uma validação. Membros: `doc`, `content`, `emission`, `rates`.
- `RuleMeta`: Membros: `id`, `cStat`, `title`, `modelos`, `activation`, `source`, `note`.
- `RulesDocument`: Membros: `modelo`, `crt`, `finNFe`, `tpNFDebito`, `tpNFCredito`, `referencedEmission`, `emitMun`, `destMun`, `gCompraGov`, `items`, `IBSCBSTot`.
- `RulesItem`: Membros: `nItem`, `IBSCBS`, `ncm`, `vProd`, `monophasicFuel`, `usedMovableGood`.
- `StandardRateRecord`: Alíquota própria de um ente (lei estadual ou municipal, art. 14 da LC 214/2025). Membros: `tributo`, `ente`, `validity`, `rate`, `legal`, `sources`.
- `TraceEntry`: Uma conta do cálculo, com as entradas em precisão interna (8 casas), para auditoria. Membros: `item`, `tributo`, `field`, `formula`, `inputs`, `result`.
- `ValidateOptions`: Membros: `dataset`, `time`, `ambiente`, `utcOffsetMinutes`, `rates`, `ignoreActivation`, `rules`.
- `ValidationReport`: Membros: `violations`, `evaluated`, `inactive`, `emissionDate`, `factDate`.
- `Validity`: Membros: `from`, `to`.
- `Violation`: Membros: `rule`, `cStat`, `item`, `message`, `source`.
- `ZfmPresumedCredit`: Crédito presumido do IBS na ZFM (`gCredPresIBSZFM`), com o valor apurado sobre o saldo devedor. Membros: `competApur`, `tpCredPresIBSZFM`, `vCredPresIBSZFM`.

### Tipos

- `Ambiente`: `type Ambiente = 'producao' | 'homologacao'`
- `ClassificationReason`: Motivo de uma classificação recusada pelo motor, estável como o `code`.
- `Dec`: `type Dec = string`
- `DeterminationReason`: Motivo estável de um `DeterminationError`. `type DeterminationReason = 'fatos_invalidos' | 'resolvedor_fora_dos_candidatos' | 'resolvedor_invalido' | 'resposta_fora_dos_candidatos' | 'determinacao_incompleta'`
- `ExclusionReason`: Por que um código saiu: `type ExclusionReason = 'vigencia' | 'dfe' | 'tipo-de-nota' | 'nomenclatura' | 'ncm' | 'nbs' | 'atores' | 'regra-legal'`
- `GovValues`: Alíquota efetiva (em percentual) e valor devido por tributo. `type GovValues = Readonly<Record<RateTributo, { readonly pAliq: Decimal; readonly vTrib: Decimal; }>>`
- `IsoDate`: Tipos do `@sinete/ibs-cbs/aliquotas`. Datas são civis (`AAAA-MM-DD`) no tempo do fato gerador; decimais vêm como texto. `type IsoDate = string`
- `ItemInput`: Dados do item para o cálculo que a determinação não produz (base, tributação regular, diferimento...). `type ItemInput = Omit<ClassifiedItem, 'n' | 'cst' | 'cClassTrib'>`
- `LegalOutcome`: `type LegalOutcome = { readonly kind: 'restrict'; readonly codes: readonly string[]; } | { readonly kind: 'none'; }`
- `Modelo`: `type Modelo = 55 | 65`
- `OperationKind`: Natureza da operação, no que muda a classificação: `type OperationKind = 'venda' | 'transferencia' | 'bonificacao' | 'doacao' | 'devolucao' | 'exportacao' | 'outra'`
- `RateOrigin`: De onde veio a alíquota usada para um tributo. `type RateOrigin = 'provider-nominal' | 'provider-reference' | 'dataset-fixed' | 'informed' | 'no-rate'`
- `RateStatus`: Estado de uma alíquota: - `official`: publicada em ato oficial (lei, resolução, tabela oficial), com a fonte citada; - `user-provided`: informada pelo usuário (ex.: simulação de 2027 antes da resolução do Senado), com o motivo; - `unknown`: ainda não publicada. `type RateStatus = 'official' | 'user-provided' | 'unknown'`
- `RateTributo`: Tributo com alíquota nominal por ente. `type RateTributo = 'CBS' | 'IBSUF' | 'IBSMun'`
- `Report`: `type Report = (item: number | undefined, message: string) => void`
- `ResolverOutcome`: `type ResolverOutcome = { readonly kind: 'decided'; readonly cClassTrib: string; readonly confidence: number; readonly evidence?: unknown; } | { readonly kind: 'ask'; readonly questions: readonly Question[]; } | { readonly kind: 'abstain'; }`
- `RoundingMode`: Decimal exato em ponto fixo sobre `BigInt`, com as regras de arredondamento da Calculadora da RFB. `type RoundingMode = 'HALF_EVEN' | 'HALF_UP' | 'DOWN'`
- `TpEnteGov`: Tipo de ente governamental comprador (`tpEnteGov`): 1 União, 2 Estado, 3 Distrito Federal, 4 Município. A Calculadora aceita ainda 5 (consórcio público) e 6 (Comitê Gestor do IBS), tratados como Município. `type TpEnteGov = 1 | 2 | 3 | 4 | 5 | 6`
- `UnsupportedRegime`: Regime que o motor ainda não calcula. Nunca sai um valor preenchido com zero no lugar. `type UnsupportedRegime = 'monofasia' | 'imposto-seletivo' | 'aliquotas-combinadas' | 'ajuste'`
- `Variables`: `type Variables = Readonly<Record<string, Decimal | undefined>>`

### Constantes

- `ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR`: Id do ator "Produtor rural não contribuinte" na tabela de atores da Calculadora (V0057). `ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR = 14`
- `DEFAULT_RESOLVERS`: `DEFAULT_RESOLVERS: readonly Resolver[]`
- `EXPRESSION_VARIABLES`: Variáveis que as expressões oficiais podem citar (`VariavelExpressao` da Calculadora). `EXPRESSION_VARIABLES: readonly string[]`
- `INTERNAL_SCALE`: Escala interna de todo resultado de expressão (`ArredondamentoUtils.PRECISAO_INTERNA`). `INTERNAL_SCALE = 8`
- `LEGAL_RULES`: `LEGAL_RULES: readonly LegalRule[]`
- `NOT_IMPLEMENTED`: Regras da NT que este pacote ainda não confere, com o motivo. `NOT_IMPLEMENTED: readonly NotImplemented[]`
- `NT_TABLES`: Tabelas da NT embarcadas neste pacote. `NT_TABLES: NtTables`
- `RATE_TRIBUTOS`: `RATE_TRIBUTOS: readonly RateTributo[]`
- `RATES_SCHEMA_VERSION`: Formato de tabela que este código lê. `RATES_SCHEMA_VERSION = 1`
- `RATES_TABLE`: A tabela embarcada nesta versão do pacote. `RATES_TABLE: RatesTable`
- `REDISTRIBUTION_FROM`: Primeiro dia em que a redistribuição do art. 473 vale. `REDISTRIBUTION_FROM: IsoDate`
- `RULES`: `RULES: readonly Rule[]`

## `@sinete/ibs-cbs/aliquotas`

`@sinete/ibs-cbs/aliquotas`: alíquotas nominais do IBS e da CBS por data de fato gerador, com estado da fonte.

Toda alíquota é `official` (com dispositivo legal e fonte), `user-provided` (informada, com motivo) ou `unknown` (ainda não publicada). Em 2026 valem as alíquotas de teste (CBS 0,9%, IBS estadual 0,1%, municipal 0%); em 2027 e 2028, o IBS de 0,05% + 0,05% da LC 214/2025 e a CBS desconhecida até a resolução do Senado; de 2029 em diante, desconhecidas até as leis dos entes e do Senado. Fica fora do `@sinete/ibs-cbs-dados` porque a cadência é outra.

### Funções

- `isSimulated`: Alguma das alíquotas não é oficial: o cálculo feito com elas é simulação. `isSimulated(rates: NominalRates): boolean`
- `officialRates`: Provedor da tabela oficial (a embarcada, por padrão). `officialRates(t?: RatesTable): RateProvider`
- `requireRate`: Valor da alíquota, ou `RateUnknownError` quando ela ainda não existe. `requireRate(rate: Rate, date: IsoDate): string`
- `withOverrides`: Sobrepõe alíquotas informadas pelo usuário. A primeira sobreposição que casar (tributo, vigência, local, tipo) vence; as demais alíquotas continuam vindo de `base`. O resultado sai `user-provided`, com o motivo. `withOverrides(base: RateProvider, overrides: readonly RateOverride[]): RateProvider`

### Classes

- `RatesDataError` (estende `SineteError<'ibscbs_aliquotas_invalidas'>`): Tabela de alíquotas inconsistente (vigências sobrepostas, valor fora do domínio, formato desconhecido).
- `RateUnknownError` (estende `SineteError<'ibscbs_aliquota_desconhecida'>`): A alíquota pedida ainda não foi publicada (estado `unknown`). O cálculo não segue com zero nem com um palpite: quem precisa simular informa a alíquota com `withOverrides`, e o resultado sai marcado como simulado. Membros: `tributo`, `date`.

### Interfaces

- `NominalRates`: As três alíquotas de uma operação. Membros: `CBS`, `IBSUF`, `IBSMun`.
- `Place`: Local da operação para a alíquota por ente (a partir de 2029, cada UF e município fixa a sua). Membros: `uf`, `cMun`.
- `Rate`: Membros: `tributo`, `status`, `value`, `legal`, `sources`, `note`, `reason`, `validity`.
- `RateOverride`: Alíquota informada pelo usuário, com motivo obrigatório. Membros: `tributo`, `value`, `reason`, `validity`, `place`, `applies`, `source`.
- `RateProvider`: Fonte de alíquotas por data. `nominal` é a alíquota "padrão" do cClassTrib; `reference`, a nacional uniforme. Membros: `id`, `nominal()`, `reference()`.
- `RateSource`: Membros: `id`, `title`, `url`, `version`, `date`, `sha256`.
- `RatesTable`: Membros: `schemaVersion`, `dataVersion`, `knownAt`, `sources`, `reference`, `standard`.
- `ReferenceRateRecord`: Membros: `tributo`, `validity`, `status`, `rate`, `legal`, `note`, `sources`.
- `StandardRateRecord`: Alíquota própria de um ente (lei estadual ou municipal, art. 14 da LC 214/2025). Membros: `tributo`, `ente`, `validity`, `rate`, `legal`, `sources`.
- `Validity`: Membros: `from`, `to`.

### Tipos

- `Dec`: `type Dec = string`
- `IsoDate`: Tipos do `@sinete/ibs-cbs/aliquotas`. Datas são civis (`AAAA-MM-DD`) no tempo do fato gerador; decimais vêm como texto. `type IsoDate = string`
- `RateStatus`: Estado de uma alíquota: - `official`: publicada em ato oficial (lei, resolução, tabela oficial), com a fonte citada; - `user-provided`: informada pelo usuário (ex.: simulação de 2027 antes da resolução do Senado), com o motivo; - `unknown`: ainda não publicada. `type RateStatus = 'official' | 'user-provided' | 'unknown'`
- `RateTributo`: Tributo com alíquota nominal por ente. `type RateTributo = 'CBS' | 'IBSUF' | 'IBSMun'`

### Constantes

- `RATE_TRIBUTOS`: `RATE_TRIBUTOS: readonly RateTributo[]`
- `RATES_SCHEMA_VERSION`: Formato de tabela que este código lê. `RATES_SCHEMA_VERSION = 1`
- `RATES_TABLE`: A tabela embarcada nesta versão do pacote. `RATES_TABLE: RatesTable`

## `@sinete/ibs-cbs/calcular`

`@sinete/ibs-cbs/calcular`: cálculo do IBS e da CBS a partir de uma operação já classificada.

Recebe CST, cClassTrib e grupos informados por item (`ClassifiedOperation`) e devolve o `Roc`, com os grupos da NT 2025.002 (`gIBSCBS`, `gRed`, `gDif`, `gDevTrib`, `gTribRegular`, `gTribCompraGov`, `gTransfCred`, `gAjusteCompet`, `gEstornoCred`, `gCredPresOper`, `gCredPresIBSZFM`) e os totais `IBSCBSTot`. As regras vêm do `@sinete/ibs-cbs-dados`, as alíquotas do `@sinete/ibs-cbs/aliquotas`. Monofasia, Imposto Seletivo e alíquotas combinadas lançam `UnsupportedRegimeError`: nunca sai valor zerado no lugar de um regime que o motor não calcula.

### Funções

- `calculate`: Calcula IBS e CBS da operação. Lança `ClassificationError`, `UnsupportedRegimeError` ou `RateUnknownError`. `calculate(op: ClassifiedOperation, options: CalculateOptions): Roc`
- `calculateAt`: Variante com a data civil do fato gerador já resolvida (`AAAA-MM-DD`): para reprocessamento e para o oráculo, que trabalham com a data que a Calculadora recebe. `calculateAt(op: ClassifiedOperation, options: { readonly dataset: IbsCbsDataset; readonly rates: RateProvider; readonly date: IsoDate; }): Roc`
- `checkExpression`: Confere que a expressão só usa a gramática e as variáveis conhecidas; devolve as variáveis citadas. `checkExpression(expr: string): readonly string[]`
- `dec`: Atalho para `Decimal.parse`. `dec(text: string): Decimal`
- `enteOf`: Ente equivalente para a redistribuição. `enteOf(tp: TpEnteGov): Ente`
- `evaluate`: `evaluate(expr: string, vars: Variables): Decimal`
- `fromPercent`: Percentual (`'0.9'`) para fração com 8 casas HALF_EVEN, como o `dividirPorCem` da Calculadora. `fromPercent(value: Decimal): Decimal`
- `money`: Valor monetário com 2 casas, HALF_EVEN. `money(value: Decimal): string`
- `percent`: Percentual com 4 casas HALF_EVEN, sem zeros à direita e com no mínimo 2 casas (`'0.90'`, `'0.1234'`, `'60.00'`). `percent(value: Decimal): string`
- `redistribute`: Valores que cada ente efetivamente recebe. `transferPercent` é o percentual da CBS transferido ao ente contratante (`'0'` até 2028), já em fração de 8 casas. `redistribute(values: GovValues, tp: TpEnteGov, date: IsoDate, transferFraction: Decimal): GovValues`
- `sum`: Soma de uma lista (zero para lista vazia). `sum(values: readonly Decimal[]): Decimal`
- `toPercent`: Fração (`0.009`) para percentual (`0.9`), sem arredondar (`movePointRight(2)`). `toPercent(fraction: Decimal): Decimal`

### Classes

- `ClassificationError` (estende `SineteError<'ibscbs_classificacao_invalida'>`): A classificação informada não pode ser calculada: código inexistente ou fora de vigência na data do fato gerador, cClassTrib fora da CST, não habilitado no modelo de DF-e, grupo exigido ausente ou vedado presente. `reason` diz qual. Membros: `reason`, `item`.
- `Decimal`: Valor decimal imutável: `unscaled × 10^-scale`. Membros: `unscaled`, `scale`, `ZERO`, `ONE`, `HUNDRED`, `of()`, `parse()`, `isDecimalText()`, `add()`, `sub()`, `mul()`, `div()`, `roundSignificant()`, `setScale()`, `stripZeros()`, `movePointRight()`, `neg()`, `cmp()`, `eq()`, `isZero()`, `isNegative()`, `toString()`, `toFixed()`, `toJSON()`.
- `ExpressionError` (estende `SineteError<'ibscbs_expressao_invalida'>`): Expressão de cálculo do dataset fora da gramática conhecida: mudança de dado que precisa de revisão. Membros: `expression`.
- `UnsupportedRegimeError` (estende `SineteError<'ibscbs_regime_nao_suportado'>`): Membros: `regime`, `item`.

### Interfaces

- `AppliedRate`: Membros: `tributo`, `value`, `status`, `origin`, `legal`, `reason`.
- `CalculateOptions`: Membros: `dataset`, `rates`, `time`, `utcOffsetMinutes`.
- `ClassifiedItem`: Item classificado: tudo o que o cálculo precisa, sem fato de negócio (CFOP, cliente, descrição). Membros: `n`, `cst`, `cClassTrib`, `base`, `quantity`, `unit`, `regular`, `informedRates`, `deferral`, `taxRefund`, `creditTransfer`, `competenceAdjustment`, `creditReversal`, `presumedCredit`, `zfmCredit`, `monophase`, `selectiveTax`.
- `ClassifiedOperation`: Membros: `modelo`, `place`, `governmentPurchase`, `items`.
- `GCBS`: Membros: `pCBS`, `gDif`, `gDevTrib`, `gRed`, `vCBS`.
- `GCredPresIBSZFM`: Membros: `competApur`, `tpCredPresIBSZFM`, `vCredPresIBSZFM`.
- `GCredPresOper`: Membros: `vBCCredPres`, `cCredPres`, `gIBSCredPres`, `gCBSCredPres`.
- `GCredPresTributo`: Membros: `pCredPres`, `vCredPres`, `vCredPresCondSus`.
- `GDevTrib`: Membros: `pDevTrib`, `vDevTrib`.
- `GDif`: Membros: `pDif`, `vDif`.
- `GIBSCBS`: Membros: `vBC`, `gIBSUF`, `gIBSMun`, `vIBS`, `gCBS`, `gTribRegular`, `gTribCompraGov`.
- `GIBSMun`: Membros: `pIBSMun`, `gDif`, `gRed`, `vIBSMun`.
- `GIBSUF`: Membros: `pIBSUF`, `gDif`, `gRed`, `vIBSUF`.
- `GovernmentPurchase`: Membros: `tpEnteGov`, `tpOperGov`.
- `GRed`: Membros: `pRedAliq`, `pAliqEfet`.
- `GTribCompraGov`: Membros: `pAliqIBSUF`, `vTribIBSUF`, `pAliqIBSMun`, `vTribIBSMun`, `pAliqCBS`, `vTribCBS`.
- `GTribRegular`: Membros: `CSTReg`, `cClassTribReg`, `pAliqEfetRegIBSUF`, `vTribRegIBSUF`, `pAliqEfetRegIBSMun`, `vTribRegIBSMun`, `pAliqEfetRegCBS`, `vTribRegCBS`.
- `IBSCBS`: Grupo `IBSCBS` do item. Os grupos de escolha exclusiva (UB14k) seguem os indicadores da CST. Membros: `CST`, `cClassTrib`, `gIBSCBS`, `gTransfCred`, `gAjusteCompet`, `gEstornoCred`, `gCredPresOper`, `gCredPresIBSZFM`.
- `IBSCBSTot`: Membros: `vBCIBSCBS`, `gIBS`, `gCBS`, `gEstornoCred`.
- `InformedRates`: Alíquotas nominais informadas pelo usuário para o item, em percentual, com motivo obrigatório. Membros: `CBS`, `IBSUF`, `IBSMun`, `reason`.
- `OperationPlace`: Local da operação (define as alíquotas próprias de UF e município, quando houver). Membros: `uf`, `cMun`.
- `PresumedCredit`: Crédito presumido da operação (`gCredPresOper`). Membros: `cCredPres`, `vBCCredPres`, `ibs`, `cbs`, `usedMovableGood`.
- `PresumedCreditTributo`: Membros: `pCredPres`, `conditional`.
- `RegularTaxation`: Grupo de tributação regular (`gTribRegular`), exigido pelos cClassTrib de suspensão e afins. Membros: `cst`, `cClassTrib`.
- `Roc`: Membros: `asOf`, `oper`, `items`, `total`, `simulated`, `contentVersion`, `ratesId`, `trace`.
- `RocItem`: Membros: `nItem`, `IBSCBS`, `rates`, `simulated`.
- `TraceEntry`: Uma conta do cálculo, com as entradas em precisão interna (8 casas), para auditoria. Membros: `item`, `tributo`, `field`, `formula`, `inputs`, `result`.
- `ZfmPresumedCredit`: Crédito presumido do IBS na ZFM (`gCredPresIBSZFM`), com o valor apurado sobre o saldo devedor. Membros: `competApur`, `tpCredPresIBSZFM`, `vCredPresIBSZFM`.

### Tipos

- `ClassificationReason`: Motivo de uma classificação recusada pelo motor, estável como o `code`.
- `Dec`: Decimal em texto (`'1000.00'`, `'0.9'`). `type Dec = string`
- `GovValues`: Alíquota efetiva (em percentual) e valor devido por tributo. `type GovValues = Readonly<Record<RateTributo, { readonly pAliq: Decimal; readonly vTrib: Decimal; }>>`
- `IsoDate`: Data civil `AAAA-MM-DD`. `type IsoDate = string`
- `RateOrigin`: De onde veio a alíquota usada para um tributo. `type RateOrigin = 'provider-nominal' | 'provider-reference' | 'dataset-fixed' | 'informed' | 'no-rate'`
- `RoundingMode`: Decimal exato em ponto fixo sobre `BigInt`, com as regras de arredondamento da Calculadora da RFB. `type RoundingMode = 'HALF_EVEN' | 'HALF_UP' | 'DOWN'`
- `TpEnteGov`: Tipo de ente governamental comprador (`tpEnteGov`): 1 União, 2 Estado, 3 Distrito Federal, 4 Município. A Calculadora aceita ainda 5 (consórcio público) e 6 (Comitê Gestor do IBS), tratados como Município. `type TpEnteGov = 1 | 2 | 3 | 4 | 5 | 6`
- `UnsupportedRegime`: Regime que o motor ainda não calcula. Nunca sai um valor preenchido com zero no lugar. `type UnsupportedRegime = 'monofasia' | 'imposto-seletivo' | 'aliquotas-combinadas' | 'ajuste'`
- `Variables`: `type Variables = Readonly<Record<string, Decimal | undefined>>`

### Constantes

- `EXPRESSION_VARIABLES`: Variáveis que as expressões oficiais podem citar (`VariavelExpressao` da Calculadora). `EXPRESSION_VARIABLES: readonly string[]`
- `INTERNAL_SCALE`: Escala interna de todo resultado de expressão (`ArredondamentoUtils.PRECISAO_INTERNA`). `INTERNAL_SCALE = 8`
- `REDISTRIBUTION_FROM`: Primeiro dia em que a redistribuição do art. 473 vale. `REDISTRIBUTION_FROM: IsoDate`

## `@sinete/ibs-cbs/validar`

`@sinete/ibs-cbs/validar`: regras de validação da NT 2025.002-RTC v1.51 (grupos UB e W da NF-e e da NFC-e) que dá para conferir sem o banco de dados da SEFAZ, como funções puras com id, cStat, implantação por ambiente e fonte.

`validate` confere um documento (o `Roc` do `@sinete/ibs-cbs/calcular` via `documentFromRoc`, ou os grupos lidos de um XML) e devolve as violações; é o segundo oráculo do motor, para o que a Calculadora da RFB não calcula.

### Funções

- `documentFromRoc`: Documento para `validate` a partir do `Roc` do motor, com os campos de identificação que o `Roc` não tem. `documentFromRoc(roc: Roc, ident: Omit<RulesDocument, 'items' | 'IBSCBSTot' | 'gCompraGov'> & { readonly items?: readonly Omit<RulesDocument['items'][number], 'IBSCBS'>[]; }): RulesDocument`
- `isActive`: A regra está implantada para o documento na data de emissão e no ambiente. `isActive(rule: RuleMeta, doc: RulesDocument, ambiente: Ambiente, emission: string): boolean`
- `validate`: `validate(doc: RulesDocument, options: ValidateOptions): ValidationReport`

### Interfaces

- `Activation`: A partir de quando a regra vale, por ambiente, pela data de emissão. Membros: `homologacao`, `producao`, `crt`.
- `NotImplemented`: Regra da NT que este pacote não confere, com o motivo. Membros: `id`, `reason`.
- `NtTables`: Tabelas próprias da NT 2025.002 embarcadas no pacote (`NT_TABLES`). Membros: `source`, `tpNFDebito`, `tpNFCredito`, `classTribByNoteType`, `ratesByEmissionYear`, `incentivizedAreas`, `cbsZeroExcludedNcm`.
- `Rule` (estende `RuleMeta`): Membros: `check()`.
- `RuleContext`: Contexto de uma validação. Membros: `doc`, `content`, `emission`, `rates`.
- `RuleMeta`: Membros: `id`, `cStat`, `title`, `modelos`, `activation`, `source`, `note`.
- `RulesDocument`: Membros: `modelo`, `crt`, `finNFe`, `tpNFDebito`, `tpNFCredito`, `referencedEmission`, `emitMun`, `destMun`, `gCompraGov`, `items`, `IBSCBSTot`.
- `RulesItem`: Membros: `nItem`, `IBSCBS`, `ncm`, `vProd`, `monophasicFuel`, `usedMovableGood`.
- `ValidateOptions`: Membros: `dataset`, `time`, `ambiente`, `utcOffsetMinutes`, `rates`, `ignoreActivation`, `rules`.
- `ValidationReport`: Membros: `violations`, `evaluated`, `inactive`, `emissionDate`, `factDate`.
- `Violation`: Membros: `rule`, `cStat`, `item`, `message`, `source`.

### Tipos

- `Ambiente`: `type Ambiente = 'producao' | 'homologacao'`
- `Dec`: `type Dec = string`
- `Modelo`: `type Modelo = 55 | 65`
- `Report`: `type Report = (item: number | undefined, message: string) => void`

### Constantes

- `NOT_IMPLEMENTED`: Regras da NT que este pacote ainda não confere, com o motivo. `NOT_IMPLEMENTED: readonly NotImplemented[]`
- `NT_TABLES`: Tabelas da NT embarcadas neste pacote. `NT_TABLES: NtTables`
- `RULES`: `RULES: readonly Rule[]`

## `@sinete/ibs-cbs/determinar`

`@sinete/ibs-cbs/determinar`: determinação do CST e do cClassTrib do IBS e da CBS a partir de fatos de negócio.

`constrain` aplica só as restrições oficiais (vigência, DF-e, tipo de nota, nomenclatura, anexos de NCM e NBS, atores) e diz o motivo de cada código excluído. `determine` soma as regras legais fechadas (`LEGAL_RULES`), as respostas do usuário e os resolvedores plugáveis, e devolve cada decisão com proveniência. `toClassified` monta a entrada do `@sinete/ibs-cbs/calcular`.

### Funções

- `askUser`: Pergunta ao usuário entre os candidatos que sobraram; a resposta volta em `answers[questionId(n)]`. `askUser(): Resolver`
- `candidateOf`: `candidateOf(content: TaxContent, ct: ClassTribRecord): Candidate`
- `constrain`: Restrições oficiais na data do fato gerador de `options.time`. `constrain(facts: OperationFacts, options: ConstrainOptions): readonly ItemConstraints[]`
- `constrainAt`: Restrições oficiais numa visão já fixada numa data. `constrainAt(facts: OperationFacts, content: TaxContent): readonly ItemConstraints[]`
- `determine`: Determinação na data do fato gerador de `options.time`. `determine(facts: OperationFacts, options: DetermineOptions): Promise<Determination>`
- `determineAt`: Determinação numa visão já fixada numa data. `determineAt(facts: OperationFacts, content: TaxContent, options: DetermineAtOptions): Promise<Determination>`
- `factDate`: Data civil do fato gerador. `factDate(time: TimeContext, utcOffsetMinutes?: number): string`
- `fromProfile`: Reaproveita a classificação guardada no cadastro do item, se ela ainda estiver entre os candidatos. `fromProfile(): Resolver`
- `questionId`: Id estável da pergunta de classificação de um item. `questionId(n: number): string`
- `toClassified`: Monta a entrada do `@sinete/ibs-cbs/calcular`. Falha se algum item ficou sem decisão. `toClassified(det: Determination, op: OperationInput, item: (n: number, candidate: Candidate) => ItemInput): ClassifiedOperation`
- `uniqueCandidate`: Decide quando só sobrou um candidato. `uniqueCandidate(): Resolver`

### Classes

- `DeterminationError` (estende `SineteError<'ibscbs_determinacao_invalida'>`): A determinação não pode seguir: fatos malformados (item repetido, NCM com letras), resolvedor ou resposta que escolhe código fora dos candidatos, ou `toClassified` com item sem decisão. `reason` diz qual; `item` diz onde. Membros: `reason`, `item`.

### Interfaces

- `AppliedRule`: Restrição aplicada por uma regra legal, registrada no item. Membros: `rule`, `source`, `codes`, `conflict`.
- `Candidate`: Um cClassTrib possível para o item, com o que o usuário precisa para escolher. Membros: `cst`, `cClassTrib`, `name`, `description`, `lc214`, `link`, `requiresRegular`.
- `ConstrainOptions`: Membros: `dataset`, `time`, `utcOffsetMinutes`.
- `Determination`: Membros: `asOf`, `contentVersion`, `items`, `complete`.
- `DetermineAtOptions`: Membros: `rules`, `resolvers`, `answers`, `clock`, `signal`.
- `DetermineOptions` (estende `ConstrainOptions, Omit<DetermineAtOptions, 'clock'>`): Membros: `clock`.
- `Exclusion`: Membros: `cClassTrib`, `reason`, `detail`, `source`.
- `ItemConstraints`: Candidatos e exclusões de um item, só pelas restrições oficiais. Membros: `n`, `candidates`, `exclusions`.
- `ItemDetermination`: Membros: `n`, `candidates`, `exclusions`, `rules`, `decided`, `pending`.
- `ItemFacts`: Membros: `n`, `ncm`, `nbs`, `description`, `kind`, `referenced`, `profile`.
- `ItemProfile`: Classificação já decidida e guardada no cadastro do item, reaproveitada pelo resolvedor `fromProfile`. Membros: `cClassTrib`, `decidedBy`.
- `LegalRule`: Regra fechada, derivada da lei, pura e com fonte: restringe os candidatos a uma lista de códigos. Membros: `id`, `title`, `source`, `validity`, `note`, `apply()`.
- `LegalRuleContext`: Membros: `facts`, `item`, `content`.
- `OperationFacts`: Membros: `modelo`, `kind`, `supplier`, `buyer`, `tpNFDebito`, `tpNFCredito`, `items`.
- `OperationInput`: Membros: `modelo`, `place`, `governmentPurchase`.
- `PartyFacts`: Membros: `actors`, `uf`, `cMun`.
- `Provenance`: Membros: `by`, `name`, `at`, `contentVersion`, `asOf`, `source`, `confidence`, `evidence`.
- `Question`: Membros: `id`, `item`, `text`, `options`.
- `QuestionOption`: Membros: `label`, `cClassTrib`.
- `ResolveContext`: Membros: `facts`, `item`, `candidates`, `content`, `answers`.
- `Resolver`: Resolvedor plugável: histórico do contribuinte, cadastro, IA, fila de revisão. Só escolhe dentro de `candidates`; um código de fora é erro (`DeterminationError` com `reason` `resolvedor_fora_dos_candidatos`). Membros: `name`, `resolve()`.

### Tipos

- `DeterminationReason`: Motivo estável de um `DeterminationError`. `type DeterminationReason = 'fatos_invalidos' | 'resolvedor_fora_dos_candidatos' | 'resolvedor_invalido' | 'resposta_fora_dos_candidatos' | 'determinacao_incompleta'`
- `ExclusionReason`: Por que um código saiu: `type ExclusionReason = 'vigencia' | 'dfe' | 'tipo-de-nota' | 'nomenclatura' | 'ncm' | 'nbs' | 'atores' | 'regra-legal'`
- `ItemInput`: Dados do item para o cálculo que a determinação não produz (base, tributação regular, diferimento...). `type ItemInput = Omit<ClassifiedItem, 'n' | 'cst' | 'cClassTrib'>`
- `LegalOutcome`: `type LegalOutcome = { readonly kind: 'restrict'; readonly codes: readonly string[]; } | { readonly kind: 'none'; }`
- `OperationKind`: Natureza da operação, no que muda a classificação: `type OperationKind = 'venda' | 'transferencia' | 'bonificacao' | 'doacao' | 'devolucao' | 'exportacao' | 'outra'`
- `ResolverOutcome`: `type ResolverOutcome = { readonly kind: 'decided'; readonly cClassTrib: string; readonly confidence: number; readonly evidence?: unknown; } | { readonly kind: 'ask'; readonly questions: readonly Question[]; } | { readonly kind: 'abstain'; }`

### Constantes

- `ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR`: Id do ator "Produtor rural não contribuinte" na tabela de atores da Calculadora (V0057). `ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR = 14`
- `DEFAULT_RESOLVERS`: `DEFAULT_RESOLVERS: readonly Resolver[]`
- `LEGAL_RULES`: `LEGAL_RULES: readonly LegalRule[]`
