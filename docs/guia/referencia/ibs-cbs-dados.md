# Referência: `@sinete/ibs-cbs-dados`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/ibs-cbs-dados/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/ibs-cbs-dados/x` é `sinete/ibs-cbs-dados/x`.

## `@sinete/ibs-cbs-dados`

`@sinete/ibs-cbs-dados`: dados oficiais do IBS/CBS versionados, com leitor tipado e sem regra de negócio.

O dataset vem do SQLite da Calculadora offline da RFB e das tabelas do IT 2025.002, fixados por hash e extraídos por `tools/ibs-cbs-dados` (ADR 0007). Esta entrada tem o leitor, a aplicabilidade de NCM/NBS e o diff semântico; o dataset embarcado está em `@sinete/ibs-cbs-dados/embarcado`, e qualquer outro bundle compatível pode ser carregado em runtime com `carregarDataset` (depois de `conferirDataset`, se veio de fora).

### Funções

- `aplicabilidade`: `aplicabilidade(vinculos: readonly RegistroAplicabilidade[], codigo: string, data: DataIso, tamanhoCompleto: number): ResultadoAplicabilidade`
- `carregarDataset`: `carregarDataset(bundle: BundleDoDataset): DatasetIbsCbs`
- `compararDatasets`: `compararDatasets(a: BundleDoDataset, b: BundleDoDataset): DiferencaDeDatasets`
- `conferirDataset`: Confere cada tabela contra o sha256 do manifesto e o `sha256DoDataset`. Use antes de `carregarDataset` num bundle obtido fora do pacote. Lança `ErroDadosIbsCbs` (`ibscbs_dados_invalidos`) na primeira divergência. `conferirDataset(bundle: BundleDoDataset): Promise<void>`
- `dataCivil`: Data civil de um instante no deslocamento informado. O deslocamento depende do local da operação (UTC-4 no Amazonas e em Rondônia, UTC-5 no Acre), então vem do chamador; o padrão é Brasília. `dataCivil(instante: ReturnType<Relogio['agora']>, deslocamentoMin?: number): DataIso`
- `ehDataIso`: Confere o formato e a existência da data (`2026-02-30` é inválida). `ehDataIso(valor: unknown): valor is DataIso`
- `exigirDataIso`: Valida e devolve a data, ou lança `ErroDeConfiguracao`. `exigirDataIso(valor: unknown, oQue?: string): DataIso`
- `formatarDiferenca`: Resumo em Markdown do diff, para o corpo do PR de atualização do pacote. `limite` corta cada lista. `formatarDiferenca(diferenca: DiferencaDeDatasets, limite?: number): string`
- `jsonCanonico`: `jsonCanonico(valor: unknown): string`
- `tabelaCanonica`: Serialização canônica das tabelas: chaves ordenadas, um registro por linha, newline final. `tabelaCanonica(registros: readonly unknown[]): string`
- `tipoDeMudanca`: `tipoDeMudanca(caminho: string): TipoDeMudanca`
- `versaoDoConteudo`: Identificador curto do conteúdo (ver `DatasetIbsCbs.versaoDoConteudo`). `versaoDoConteudo(manifesto: ManifestoDoDataset): string`
- `vigente`: Vigência fechada nas duas pontas, como nas consultas da Calculadora (`inicio <= data <= fim`). `vigente(vigencia: Vigencia, data: DataIso): boolean`

### Classes

- `ErroDadosIbsCbs` (estende `ErroSinete<CodigoErroDadosIbsCbs>`): Pacote de dados que não pode ser usado: formato inesperado, tabela ausente, hash que não confere com o manifest (`ibscbs_dados_invalidos`), ou `versaoDoFormato` que este código não conhece (`ibscbs_dados_versao_incompativel`).

### Interfaces

- `AliquotasCredPres`: Orientação de alíquota do IT: texto quando não é um número, decimal em texto quando é. Membros: `cbs`, `ibs`, `pAliqCredPresCBS`, `pAliqCredPresIBS`, `pRedTransicaoIBS`.
- `BaseLegal`: Membros: `resumo`, `texto`, `referencia`, `vigencia`.
- `BaseLegalClassTrib`: Membros: `lc214`, `url`, `fundamento`.
- `BundleDoDataset`: O dataset serializado: o que o pacote embarca e o que se carrega em runtime de outra origem. Membros: `manifesto`, `tabelas`.
- `CalculoCredPres`: Membros: `pAliq`, `base`, `formula`, `impedimento`.
- `ConteudoTributario`: O dataset visto numa data de fato gerador: só registros vigentes nela. Membros: `dataDeReferencia`, `dataset`, `cst()`, `classTrib()`, `classTribs()`, `cstDe()`, `tratamento()`, `reducao()`, `aliquotaFixa()`, `permitidoEm()`, `credPres()`, `ncmAplicavel()`, `nbsAplicavel()`, `porAtores()`, `ator()`, `nfseNbs()`, `anexo()`, `tipoDfe()`, `redutorCompraGov()`, `percentualTransferenciaCbs()`.
- `CreditoClassTrib`: Membros: `adquirenteCbs`, `adquirenteIbs`, `presumidoFornecedor`, `presumidoAdquirente`, `operacaoAnterior`.
- `CredPresVigente`: Crédito presumido vigente na data, por tributo. Membros: `registro`, `cbs`, `ibs`.
- `DatasetIbsCbs`: Membros: `manifesto`, `tabelas`, `versaoDoConteudo`, `em()`.
- `DiferencaDeDatasets`: Membros: `de`, `para`, `formatoMudou`, `tabelas`, `inalteradas`.
- `DiferencaDeTabela`: Membros: `tabela`, `incluidos`, `removidos`, `alterados`, `tipos`.
- `ExcecaoDePrefixo`: Membros: `prefixo`, `vigencia`.
- `ExpressoesDoTratamento`: Membros: `aliquota`, `aliquotaEfetiva`, `baseCalculo`, `tributoCalculado`, `tributoDevido`, `percentualDiferimento`, `valorDiferimento`.
- `FiltroClassTrib`: Filtro de `classTribs`. Membros: `familia`, `cst`, `modelo`.
- `FiltroDeAtores`: Atores de uma operação, pelos ids da tabela de atores; `undefined` não restringe o papel. Membros: `fornecedor`, `adquirente`, `modelo`.
- `FonteDoDataset`: Artefato oficial de onde o dataset foi extraído. Membros: `id`, `tipo`, `titulo`, `versao`, `data`, `url`, `sha256`, `pins`, `notas`.
- `GruposClassTrib`: Membros: `gTribRegular`, `gCredPresOper`, `gMonoPadrao`, `gMonoReten`, `gMonoRet`, `gMonoDif`, `gpBioDiferenca`, `gEstornoCred`.
- `GruposCredPres`: Membros: `gCBSCredPres`, `gIBSCredPres`.
- `GruposCst`: Membros: `gIBSCBS`, `gIBSCBSMono`, `gRed`, `gDif`, `gTransfCred`, `gCredPresIBSZFM`, `gAjusteCompet`, `redutorBC`.
- `IndicadoresDoTratamento`: Membros: `incompativelComSuspensao`, `exigeGrupoTribRegular`, `possuiPercentualReducao`, `possuiAjuste`, `possuiRedutor`, `possuiMonofasia`.
- `ManifestoDaTabela`: Membros: `nome`, `registros`, `sha256`.
- `ManifestoDoDataset`: Membros: `versaoDoFormato`, `versaoDosDados`, `conhecidoEm`, `fontes`, `tabelas`, `sha256DoDataset`.
- `MudancaDeCampo`: Membros: `caminho`, `tipo`, `de`, `para`.
- `MudancaDeRegistro`: Membros: `chave`, `campos`.
- `PorTributo`: Membros: `tributo`, `vigencia`.
- `RegistroAliquotaFixa` (estende `PorTributo`): Membros: `aliquota`.
- `RegistroAnexo`: Item de anexo da LC 214/2025 citado pelos vínculos de NCM e NBS. Membros: `chave`, `anexo`, `item`, `descricao`, `texto`, `vigencia`.
- `RegistroAplicabilidade`: Vínculo de NCM ou NBS (por prefixo) com um cClassTrib, com as exceções do anexo. Membros: `chave`, `chaveClassTrib`, `familia`, `cClassTrib`, `prefixo`, `itemDoAnexo`, `vigencia`, `excecoes`.
- `RegistroAtor`: Membros: `chave`, `id`, `grupo`, `descricao`, `ordem`, `vigencia`.
- `RegistroAtorClassTrib`: Membros: `chave`, `ator`, `papel`, `chaveClassTrib`, `cClassTrib`, `vigencia`.
- `RegistroClassTrib`: Membros: `chave`, `familia`, `codigo`, `cst`, `nome`, `descricao`, `tipoDeAliquota`, `nomenclatura`, `anexo`, `tpRBSN`, `credito`, `grupos`, `tratamentos`, `reducoes`, `aliquotasFixas`, `dfe`, `legal`, `memoriaTemplate`, `vigencia`, `atualizadoEm`, `fontes`.
- `RegistroCredPres`: Código de classificação do crédito presumido (`cCredPres`, IT 2025.002, tabela 04). Membros: `chave`, `codigo`, `descricao`, `legal`, `viaDocumento`, `viaEvento`, `deduzDoTributo`, `grupos`, `aliquotas`, `classTribReferenciado`, `vigencia`, `calculo`, `fontes`.
- `RegistroCst`: Membros: `chave`, `familia`, `codigo`, `descricao`, `tributos`, `grupos`, `vigencia`, `fontes`.
- `RegistroGrupoDeAtores`: Membros: `chave`, `id`, `descricao`, `ordem`, `vigencia`.
- `RegistroNfseNbs`: NFS-e: vínculo NBS x cClassTrib x indicador de operação (cIndOp) x item da LC 116. Membros: `chave`, `nbs`, `chaveClassTrib`, `cClassTrib`, `itemLc116`, `cIndOp`, `onerosa`, `adquirenteExterior`, `vigencia`.
- `RegistroReducao` (estende `PorTributo`): Membros: `pRed`.
- `RegistroRedutorCompraGov`: Redutor de compras governamentais (LC 214/2025, arts. 370 e 472), em percentual. Membros: `chave`, `pRedutor`, `vigencia`.
- `RegistroTipoDfe`: Membros: `chave`, `sigla`, `modelo`, `descricao`, `vigencia`.
- `RegistroTransferenciaCbs`: Percentual da CBS transferido ao ente contratante na compra governamental (art. 473, com a transição). Membros: `chave`, `percentual`, `vigencia`.
- `RegistroTratamento`: Tratamento tributário da Calculadora: as regras de cálculo como expressões aritméticas. Membros: `chave`, `id`, `descricao`, `expressao`, `indicadores`, `vigencia`.
- `ResultadoAplicabilidade`: Membros: `resultado`, `casou`, `excluidoPor`.
- `TabelasDoDataset`: Membros: `cst`, `classTrib`, `tratamentos`, `credPres`, `aplicabilidadeNcm`, `aplicabilidadeNbs`, `anexos`, `nfseNbs`, `gruposDeAtores`, `atores`, `atorClassTrib`, `tiposDfe`, `redutorCompraGov`, `transferenciaCbs`.
- `Vigencia`: Intervalo de vigência, fechado nas duas pontas; `fim: null` é vigência aberta. Membros: `inicio`, `fim`.
- `VinculoDfe`: Membros: `sigla`, `modelo`, `vigencia`.
- `VinculoTratamento`: Membros: `tratamento`, `vigencia`.

### Tipos

- `Aplicabilidade`: `type Aplicabilidade = 'sim' | 'nao' | 'sem-restricao' | 'incompleta'`
- `CodigoErroDadosIbsCbs`: Códigos lançados pelo `@sinete/ibs-cbs-dados`. `type CodigoErroDadosIbsCbs = 'ibscbs_dados_invalidos' | 'ibscbs_dados_versao_incompativel'`
- `DataIso`: Data civil `AAAA-MM-DD`. `type DataIso = string`
- `Dec`: Decimal em texto (`'0.9'`, `'60'`, `'0.05'`). `type Dec = string`
- `Familia`: Família da tabela: CST e cClassTrib do IBS/CBS ou do Imposto Seletivo (os códigos se repetem entre famílias). `type Familia = 'CBS_IBS' | 'IS'`
- `IdDaFonte`: Fonte de onde veio um registro, pelo id em `manifesto.fontes`. `type IdDaFonte = string`
- `Indicador`: Indicador de grupo do leiaute. Na CST, 1 é "exige" e 0 é "não é permitido" (legenda do IT 2025.002); no `ind_gCredPresOper`, 1 é "permite, sem exigir" (NT 2025.002, UB120, observação 2). `type Indicador = 'obrigatorio' | 'permitido' | 'vedado'`
- `NomeDaTabela`: `type NomeDaTabela = keyof TabelasDoDataset`
- `Nomenclatura`: Nomenclatura que o cClassTrib exige para o item. `type Nomenclatura = 'NCM' | 'NBS' | 'NBS ou NCM' | 'CIB' | 'CIB ou NCM' | 'Não possui'`
- `PapelDoAtor`: `type PapelDoAtor = 'Fornecedor' | 'Adquirente'`
- `TipoDeAliquota`: Tipo de alíquota exatamente como publicado. `type TipoDeAliquota = 'Padrão' | 'Uniforme setorial' | 'Uniforme nacional (referência)' | 'Fixa' | 'Sem alíquota' | 'Alíquotas Combinadas (Ad Valorem e Ad Rem)'`
- `TipoDeMudanca`: `type TipoDeMudanca = 'fim-de-vigencia' | 'inicio-de-vigencia' | 'indicador-de-grupo' | 'dfe' | 'reducao-ou-aliquota' | 'expressao-de-calculo' | 'aplicabilidade' | 'texto' | 'outro'`
- `Tributo`: Tributo como a Calculadora o identifica. `type Tributo = 'CBS' | 'IBSUF' | 'IBSMun' | 'IS'`

### Constantes

- `DESLOCAMENTO_BRASILIA_MIN`: Deslocamento padrão: horário de Brasília (UTC-3, sem horário de verão desde 2019). `DESLOCAMENTO_BRASILIA_MIN = -180`
- `NOMES_DAS_TABELAS`: `NOMES_DAS_TABELAS: readonly NomeDaTabela[]`
- `VERSAO_DO_FORMATO_DOS_DADOS`: Versão do formato que este código lê. Bundle com versão maior é recusado. `VERSAO_DO_FORMATO_DOS_DADOS = 2`

## `@sinete/ibs-cbs-dados/embarcado`

`@sinete/ibs-cbs-dados/embarcado`: o dataset embarcado nesta versão do pacote, extraído por `tools/ibs-cbs-dados` das fontes oficiais fixadas em `manifesto.fontes`. Entrada separada da principal para que quem carrega dados em runtime de outra origem não leve os ~2 MB de JSON para o bundle.

### Funções

- `datasetEmbarcado`: O dataset embarcado, carregado uma vez por processo. `datasetEmbarcado(): DatasetIbsCbs`

### Constantes

- `DATASET_EMBARCADO`: O bundle embarcado, como gravado em `src/data/`. `DATASET_EMBARCADO: BundleDoDataset`
