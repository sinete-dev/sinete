# Referência: `@sinete/ibs-cbs`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/ibs-cbs/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/ibs-cbs/x` é `sinete/ibs-cbs/x`.

## `@sinete/ibs-cbs`

`@sinete/ibs-cbs`: o motor do IBS e da CBS do sinete, agnóstico de documento (NF-e, NFC-e, CT-e, NFCom, NFS-e...).

A raiz reexporta as quatro partes; quem quer só uma importa o subpath: - `@sinete/ibs-cbs/aliquotas`: alíquotas nominais por data de fato gerador, com estado da fonte; - `@sinete/ibs-cbs/calcular`: cálculo a partir de uma operação já classificada (CST e cClassTrib por item); - `@sinete/ibs-cbs/validar`: regras de validação da NT 2025.002 que dá para conferir sem o banco da SEFAZ; - `@sinete/ibs-cbs/determinar`: determinação do CST e do cClassTrib a partir de fatos de negócio.

Os dados oficiais (CST, cClassTrib, tratamentos, anexos) ficam no `@sinete/ibs-cbs-dados`, que tem ritmo de versão próprio (ADR 0007 e ADR 0008).

### Funções

- `aliquotasOficiais`: Provedor da tabela oficial (a embarcada, por padrão). `aliquotasOficiais(t?: TabelaDeAliquotas): ProvedorDeAliquotas`
- `ativa`: A regra está implantada para o documento na data de emissão e no ambiente. `ativa(regra: DescricaoDaRegra, documento: DocumentoDasRegras, ambiente: Ambiente, emissao: string): boolean`
- `avaliar`: `avaliar(expressao: string, variaveis: Variaveis): Decimal`
- `calcular`: Calcula IBS e CBS da operação. Lança `ErroClassificacao`, `ErroRegimeNaoSuportado` ou `ErroAliquotaDesconhecida`. `calcular(op: OperacaoClassificada, opcoes: CalcularOpcoes): Roc`
- `calcularEm`: Variante com a data civil do fato gerador já resolvida (`AAAA-MM-DD`): para reprocessamento e para o oráculo, que trabalham com a data que a Calculadora recebe. `calcularEm(op: OperacaoClassificada, opcoes: { readonly dataset: DatasetIbsCbs; readonly aliquotas: ProvedorDeAliquotas; readonly data: DataIso; }): Roc`
- `candidatoDe`: `candidatoDe(conteudo: ConteudoTributario, ct: RegistroClassTrib): Candidato`
- `candidatoUnico`: Decide quando só sobrou um candidato. `candidatoUnico(): Resolvedor`
- `comAliquotasInformadas`: Sobrepõe alíquotas informadas pelo usuário. A primeira sobreposição que casar (tributo, vigência, local, tipo) vence; as demais alíquotas continuam vindo de `base`. O resultado sai `informada`, com o motivo. `comAliquotasInformadas(base: ProvedorDeAliquotas, informadas: readonly AliquotaInformada[]): ProvedorDeAliquotas`
- `conferirExpressao`: Confere que a expressão só usa a gramática e as variáveis conhecidas; devolve as variáveis citadas. `conferirExpressao(expressao: string): readonly string[]`
- `dataDoFato`: Data civil do fato gerador. `dataDoFato(tempo: ContextoDeTempo, deslocamentoMin?: number): string`
- `dec`: Atalho para `Decimal.parse`. `dec(texto: string): Decimal`
- `dePercentual`: Percentual (`'0.9'`) para fração com 8 casas HALF_EVEN, como o `dividirPorCem` da Calculadora. `dePercentual(valor: Decimal): Decimal`
- `determinar`: Determinação na data do fato gerador de `opcoes.tempo`. `determinar(fatos: FatosDaOperacao, opcoes: DeterminarOpcoes): Promise<Determinacao>`
- `determinarEm`: Determinação numa visão já fixada numa data. `determinarEm(fatos: FatosDaOperacao, conteudo: ConteudoTributario, opcoes: DeterminarEmOpcoes): Promise<Determinacao>`
- `dinheiro`: Valor monetário com 2 casas, HALF_EVEN. `dinheiro(valor: Decimal): string`
- `documentoDoRoc`: Documento para `validar` a partir do `Roc` do motor, com os campos de identificação que o `Roc` não tem. `documentoDoRoc(roc: Roc, identificacao: Omit<DocumentoDasRegras, 'itens' | 'IBSCBSTot' | 'gCompraGov'> & { readonly itens?: readonly Omit<DocumentoDasRegras['itens'][number], 'IBSCBS'>[]; }): DocumentoDasRegras`
- `doPerfil`: Reaproveita a classificação guardada no cadastro do item, se ela ainda estiver entre os candidatos. `doPerfil(): Resolvedor`
- `ehSimulada`: Alguma das alíquotas não é oficial: o cálculo feito com elas é simulação. `ehSimulada(aliquotas: AliquotasNominais): boolean`
- `enteDe`: Ente equivalente para a redistribuição. `enteDe(tp: TpEnteGov): Ente`
- `exigirAliquota`: Valor da alíquota, ou `ErroAliquotaDesconhecida` quando ela ainda não existe. `exigirAliquota(aliquota: Aliquota, data: DataIso): string`
- `idDaPergunta`: Id estável da pergunta de classificação de um item. `idDaPergunta(n: number): string`
- `paraClassificado`: Monta a entrada do `@sinete/ibs-cbs/calcular`. Falha se algum item ficou sem decisão. `paraClassificado(det: Determinacao, op: EntradaDaOperacao, item: (n: number, candidato: Candidato) => EntradaDoItem): OperacaoClassificada`
- `paraPercentual`: Fração (`0.009`) para percentual (`0.9`), sem arredondar (`movePointRight(2)`). `paraPercentual(fracao: Decimal): Decimal`
- `percentual`: Percentual com 4 casas HALF_EVEN, sem zeros à direita e com no mínimo 2 casas (`'0.90'`, `'0.1234'`, `'60.00'`). `percentual(valor: Decimal): string`
- `perguntarAoUsuario`: Pergunta ao usuário entre os candidatos que sobraram; a resposta volta em `respostas[idDaPergunta(n)]`. `perguntarAoUsuario(): Resolvedor`
- `redistribuir`: Valores que cada ente efetivamente recebe. `transferPercent` é o percentual da CBS transferido ao ente contratante (`'0'` até 2028), já em fração de 8 casas. `redistribuir(valores: ValoresCompraGov, tp: TpEnteGov, data: DataIso, fracaoTransferida: Decimal): ValoresCompraGov`
- `restringir`: Restrições oficiais na data do fato gerador de `opcoes.tempo`. `restringir(fatos: FatosDaOperacao, opcoes: RestringirOpcoes): readonly RestricoesDoItem[]`
- `restringirEm`: Restrições oficiais numa visão já fixada numa data. `restringirEm(fatos: FatosDaOperacao, conteudo: ConteudoTributario): readonly RestricoesDoItem[]`
- `sum`: Soma de uma lista (zero para lista vazia). `sum(valores: readonly Decimal[]): Decimal`
- `validar`: `validar(documento: DocumentoDasRegras, opcoes: ValidarOpcoes): RelatorioDeValidacao`

### Classes

- `Decimal`: Valor decimal imutável: `unscaled × 10^-scale`. Membros: `unscaled`, `scale`, `ZERO`, `ONE`, `HUNDRED`, `of()`, `parse()`, `isDecimalText()`, `add()`, `sub()`, `mul()`, `div()`, `roundSignificant()`, `setScale()`, `stripZeros()`, `movePointRight()`, `neg()`, `cmp()`, `eq()`, `isZero()`, `isNegative()`, `toString()`, `toFixed()`, `toJSON()`.
- `ErroAliquotaDesconhecida` (estende `ErroSinete<'ibscbs_aliquota_desconhecida'>`): A alíquota pedida ainda não foi publicada (estado `desconhecida`). O cálculo não segue com zero nem com um palpite: quem precisa simular informa a alíquota com `comAliquotasInformadas`, e o resultado sai marcado como simulado. Membros: `tributo`, `data`.
- `ErroClassificacao` (estende `ErroSinete<'ibscbs_classificacao_invalida'>`): A classificação informada não pode ser calculada: código inexistente ou fora de vigência na data do fato gerador, cClassTrib fora da CST, não habilitado no modelo de DF-e, grupo exigido ausente ou vedado presente. `motivo` diz qual. Membros: `motivo`, `item`.
- `ErroDadosDeAliquotas` (estende `ErroSinete<'ibscbs_aliquotas_invalidas'>`): Tabela de alíquotas inconsistente (vigências sobrepostas, valor fora do domínio, formato desconhecido).
- `ErroDeterminacao` (estende `ErroSinete<'ibscbs_determinacao_invalida'>`): A determinação não pode seguir: fatos malformados (item repetido, NCM com letras), resolvedor ou resposta que escolhe código fora dos candidatos, ou `paraClassificado` com item sem decisão. `motivo` diz qual; `item` diz onde. Membros: `motivo`, `item`.
- `ErroExpressao` (estende `ErroSinete<'ibscbs_expressao_invalida'>`): Expressão de cálculo do dataset fora da gramática conhecida: mudança de dado que precisa de revisão. Membros: `expressao`.
- `ErroRegimeNaoSuportado` (estende `ErroSinete<'ibscbs_regime_nao_suportado'>`): Membros: `regime`, `item`.

### Interfaces

- `Aliquota`: Membros: `tributo`, `situacao`, `valor`, `legal`, `fontes`, `nota`, `motivo`, `vigencia`.
- `AliquotaAplicada`: Membros: `tributo`, `valor`, `situacao`, `origem`, `legal`, `motivo`.
- `AliquotaInformada`: Alíquota informada pelo usuário, com motivo obrigatório. Membros: `tributo`, `valor`, `motivo`, `vigencia`, `local`, `aplicaA`, `fonte`.
- `AliquotasInformadas`: Alíquotas nominais informadas pelo usuário para o item, em percentual, com motivo obrigatório. Membros: `CBS`, `IBSUF`, `IBSMun`, `motivo`.
- `AliquotasNominais`: As três alíquotas de uma operação. Membros: `CBS`, `IBSUF`, `IBSMun`.
- `Ativacao`: A partir de quando a regra vale, por ambiente, pela data de emissão. Membros: `homologacao`, `producao`, `crt`.
- `CalcularOpcoes`: Membros: `dataset`, `aliquotas`, `tempo`, `deslocamentoMin`.
- `Candidato`: Um cClassTrib possível para o item, com o que o usuário precisa para escolher. Membros: `cst`, `cClassTrib`, `nome`, `descricao`, `lc214`, `url`, `exigeRegular`.
- `CompraGovernamental`: Membros: `tpEnteGov`, `tpOperGov`.
- `ContextoDaRegra`: Contexto de uma validação. Membros: `documento`, `conteudo`, `emissao`, `aliquotas`.
- `ContextoDoResolvedor`: Membros: `fatos`, `item`, `candidatos`, `conteudo`, `respostas`.
- `ContextoRegraLegal`: Membros: `fatos`, `item`, `conteudo`.
- `CreditoPresumido`: Crédito presumido da operação (`gCredPresOper`). Membros: `cCredPres`, `vBCCredPres`, `ibs`, `cbs`, `bemMovelUsado`.
- `CreditoPresumidoTributo`: Membros: `pCredPres`, `condicional`.
- `CreditoPresumidoZfm`: Crédito presumido do IBS na ZFM (`gCredPresIBSZFM`), com o valor apurado sobre o saldo devedor. Membros: `competApur`, `tpCredPresIBSZFM`, `vCredPresIBSZFM`.
- `DescricaoDaRegra`: Membros: `id`, `cStat`, `titulo`, `modelos`, `ativacao`, `fonte`, `nota`.
- `Determinacao`: Membros: `dataDeReferencia`, `versaoDoConteudo`, `itens`, `completa`.
- `DeterminacaoDoItem`: Membros: `n`, `candidatos`, `exclusoes`, `regras`, `decidido`, `pendente`.
- `DeterminarEmOpcoes`: Membros: `regras`, `resolvedores`, `respostas`, `relogio`, `signal`.
- `DeterminarOpcoes` (estende `RestringirOpcoes, Omit<DeterminarEmOpcoes, 'relogio'>`): Membros: `relogio`.
- `DocumentoDasRegras`: Membros: `modelo`, `crt`, `finNFe`, `tpNFDebito`, `tpNFCredito`, `emissaoReferenciada`, `munEmitente`, `munDestinatario`, `gCompraGov`, `itens`, `IBSCBSTot`.
- `EntradaDaOperacao`: Membros: `modelo`, `local`, `compraGovernamental`.
- `EntradaDoRastro`: Uma conta do cálculo, com as entradas em precisão interna (8 casas), para auditoria. Membros: `item`, `tributo`, `campo`, `formula`, `entradas`, `resultado`.
- `Exclusao`: Membros: `cClassTrib`, `motivo`, `detalhe`, `fonte`.
- `FatosDaOperacao`: Membros: `modelo`, `tipo`, `fornecedor`, `adquirente`, `tpNFDebito`, `tpNFCredito`, `itens`.
- `FatosDaParte`: Membros: `atores`, `uf`, `cMun`.
- `FatosDoItem`: Membros: `n`, `ncm`, `nbs`, `descricao`, `tipo`, `referenciado`, `perfil`.
- `FonteDaAliquota`: Membros: `id`, `titulo`, `url`, `versao`, `data`, `sha256`.
- `GCBS`: Membros: `pCBS`, `gDif`, `gDevTrib`, `gRed`, `vCBS`.
- `GCredPresIBSZFM`: Membros: `competApur`, `tpCredPresIBSZFM`, `vCredPresIBSZFM`.
- `GCredPresOper`: Membros: `vBCCredPres`, `cCredPres`, `gIBSCredPres`, `gCBSCredPres`.
- `GCredPresTributo`: Membros: `pCredPres`, `vCredPres`, `vCredPresCondSus`.
- `GDevTrib`: Membros: `pDevTrib`, `vDevTrib`.
- `GDif`: Membros: `pDif`, `vDif`.
- `GIBSCBS`: Membros: `vBC`, `gIBSUF`, `gIBSMun`, `vIBS`, `gCBS`, `gTribRegular`, `gTribCompraGov`.
- `GIBSMun`: Membros: `pIBSMun`, `gDif`, `gRed`, `vIBSMun`.
- `GIBSUF`: Membros: `pIBSUF`, `gDif`, `gRed`, `vIBSUF`.
- `GRed`: Membros: `pRedAliq`, `pAliqEfet`.
- `GTribCompraGov`: Membros: `pAliqIBSUF`, `vTribIBSUF`, `pAliqIBSMun`, `vTribIBSMun`, `pAliqCBS`, `vTribCBS`.
- `GTribRegular`: Membros: `CSTReg`, `cClassTribReg`, `pAliqEfetRegIBSUF`, `vTribRegIBSUF`, `pAliqEfetRegIBSMun`, `vTribRegIBSMun`, `pAliqEfetRegCBS`, `vTribRegCBS`.
- `IBSCBS`: Grupo `IBSCBS` do item. Os grupos de escolha exclusiva (UB14k) seguem os indicadores da CST. Membros: `CST`, `cClassTrib`, `gIBSCBS`, `gTransfCred`, `gAjusteCompet`, `gEstornoCred`, `gCredPresOper`, `gCredPresIBSZFM`.
- `IBSCBSTot`: Membros: `vBCIBSCBS`, `gIBS`, `gCBS`, `gEstornoCred`.
- `ItemClassificado`: Item classificado: tudo o que o cálculo precisa, sem fato de negócio (CFOP, cliente, descrição). Membros: `n`, `cst`, `cClassTrib`, `base`, `quantidade`, `unidade`, `regular`, `aliquotasInformadas`, `diferimento`, `devolucaoDeTributo`, `transferenciaDeCredito`, `ajusteDeCompetencia`, `estornoDeCredito`, `creditoPresumido`, `creditoZfm`, `monofasia`, `impostoSeletivo`.
- `ItemDasRegras`: Membros: `nItem`, `IBSCBS`, `ncm`, `vProd`, `combustivelMonofasico`, `bemMovelUsado`.
- `Local`: Local da operação para a alíquota por ente (a partir de 2029, cada UF e município fixa a sua). Membros: `uf`, `cMun`.
- `LocalDaOperacao`: Local da operação (define as alíquotas próprias de UF e município, quando houver). Membros: `uf`, `cMun`.
- `NaoImplementada`: Regra da NT que este pacote não confere, com o motivo. Membros: `id`, `motivo`.
- `OpcaoDaPergunta`: Membros: `rotulo`, `cClassTrib`.
- `OperacaoClassificada`: Membros: `modelo`, `local`, `compraGovernamental`, `itens`.
- `PerfilDoItem`: Classificação já decidida e guardada no cadastro do item, reaproveitada pelo resolvedor `doPerfil`. Membros: `cClassTrib`, `decididoPor`.
- `Pergunta`: Membros: `id`, `item`, `texto`, `opcoes`.
- `Procedencia`: Membros: `por`, `nome`, `em`, `versaoDoConteudo`, `dataDeReferencia`, `fonte`, `confianca`, `evidencia`.
- `ProvedorDeAliquotas`: Fonte de alíquotas por data. `nominal` é a alíquota "padrão" do cClassTrib; `referencia`, a nacional uniforme. Membros: `id`, `nominal()`, `referencia()`.
- `RegistroAliquotaDeReferencia`: Membros: `tributo`, `vigencia`, `situacao`, `aliquota`, `legal`, `nota`, `fontes`.
- `RegistroAliquotaPadrao`: Alíquota própria de um ente (lei estadual ou municipal, art. 14 da LC 214/2025). Membros: `tributo`, `ente`, `vigencia`, `aliquota`, `legal`, `fontes`.
- `Regra` (estende `DescricaoDaRegra`): Membros: `conferir()`.
- `RegraAplicada`: Restrição aplicada por uma regra legal, registrada no item. Membros: `regra`, `fonte`, `codigos`, `conflito`.
- `RegraLegal`: Regra fechada, derivada da lei, pura e com fonte: restringe os candidatos a uma lista de códigos. Membros: `id`, `titulo`, `fonte`, `vigencia`, `nota`, `aplicar()`.
- `RelatorioDeValidacao`: Membros: `violacoes`, `avaliadas`, `inativas`, `dataDaEmissao`, `dataDoFato`.
- `Resolvedor`: Resolvedor plugável: histórico do contribuinte, cadastro, IA, fila de revisão. Só escolhe dentro de `candidatos`; um código de fora é erro (`ErroDeterminacao` com `motivo` `resolvedor_fora_dos_candidatos`). Membros: `nome`, `resolver()`.
- `RestricoesDoItem`: Candidatos e exclusões de um item, só pelas restrições oficiais. Membros: `n`, `candidatos`, `exclusoes`.
- `RestringirOpcoes`: Membros: `dataset`, `tempo`, `deslocamentoMin`.
- `Roc`: Membros: `dataDeReferencia`, `oper`, `itens`, `total`, `simulado`, `versaoDoConteudo`, `idDasAliquotas`, `rastro`.
- `RocItem`: Membros: `nItem`, `IBSCBS`, `aliquotas`, `simulado`.
- `TabelaDeAliquotas`: Membros: `versaoDoFormato`, `versaoDosDados`, `conhecidoEm`, `fontes`, `referencia`, `padrao`.
- `TabelasNt`: Tabelas próprias da NT 2025.002 embarcadas no pacote (`TABELAS_NT`). Membros: `fonte`, `tpNFDebito`, `tpNFCredito`, `classTribPorTipoDeNota`, `aliquotasPorAnoDeEmissao`, `areasIncentivadas`, `ncmExcluidosDaCbsZero`.
- `TributacaoRegular`: Grupo de tributação regular (`gTribRegular`), exigido pelos cClassTrib de suspensão e afins. Membros: `cst`, `cClassTrib`.
- `ValidarOpcoes`: Membros: `dataset`, `tempo`, `ambiente`, `deslocamentoMin`, `aliquotas`, `ignorarAtivacao`, `regras`.
- `Vigencia`: Membros: `inicio`, `fim`.
- `Violacao`: Membros: `regra`, `cStat`, `item`, `message`, `fonte`.

### Tipos

- `Ambiente`: `type Ambiente = 'producao' | 'homologacao'`
- `DataIso`: Tipos do `@sinete/ibs-cbs/aliquotas`. Datas são civis (`AAAA-MM-DD`) no tempo do fato gerador; decimais vêm como texto. `type DataIso = string`
- `Dec`: `type Dec = string`
- `EntradaDoItem`: Dados do item para o cálculo que a determinação não produz (base, tributação regular, diferimento...). `type EntradaDoItem = Omit<ItemClassificado, 'n' | 'cst' | 'cClassTrib'>`
- `Modelo`: `type Modelo = 55 | 65`
- `MotivoDaExclusao`: Por que um código saiu: `type MotivoDaExclusao = 'vigencia' | 'dfe' | 'tipo-de-nota' | 'nomenclatura' | 'ncm' | 'nbs' | 'atores' | 'regra-legal'`
- `MotivoErroClassificacao`: Motivo de uma classificação recusada pelo motor, estável como o `code`.
- `MotivoErroDeterminacao`: Motivo estável de um `ErroDeterminacao`. `type MotivoErroDeterminacao = 'fatos_invalidos' | 'resolvedor_fora_dos_candidatos' | 'resolvedor_invalido' | 'resposta_fora_dos_candidatos' | 'determinacao_incompleta'`
- `OrigemDaAliquota`: De onde veio a alíquota usada para um tributo. `type OrigemDaAliquota = 'provedor-nominal' | 'provedor-referencia' | 'dataset-fixa' | 'informada' | 'sem-aliquota'`
- `RegimeNaoSuportado`: Regime que o motor ainda não calcula. Nunca sai um valor preenchido com zero no lugar. `type RegimeNaoSuportado = 'monofasia' | 'imposto-seletivo' | 'aliquotas-combinadas' | 'ajuste'`
- `Relatar`: `type Relatar = (item: number | undefined, message: string) => void`
- `ResultadoDoResolvedor`
- `ResultadoRegraLegal`: `type ResultadoRegraLegal = { readonly tipo: 'restringir'; readonly codigos: readonly string[]; } | { readonly tipo: 'nenhum'; }`
- `RoundingMode`: Decimal exato em ponto fixo sobre `BigInt`, com as regras de arredondamento da Calculadora da RFB. `type RoundingMode = 'HALF_EVEN' | 'HALF_UP' | 'DOWN'`
- `SituacaoDaAliquota`: Estado de uma alíquota: - `oficial`: publicada em ato oficial (lei, resolução, tabela oficial), com a fonte citada; - `informada`: informada pelo usuário (ex.: simulação de 2027 antes da resolução do Senado), com o motivo; - `desconhecida`: ainda não publicada. `type SituacaoDaAliquota = 'oficial' | 'informada' | 'desconhecida'`
- `TipoDeOperacao`: Natureza da operação, no que muda a classificação: `type TipoDeOperacao = 'venda' | 'transferencia' | 'bonificacao' | 'doacao' | 'devolucao' | 'exportacao' | 'outra'`
- `TpEnteGov`: Tipo de ente governamental comprador (`tpEnteGov`): 1 União, 2 Estado, 3 Distrito Federal, 4 Município. A Calculadora aceita ainda 5 (consórcio público) e 6 (Comitê Gestor do IBS), tratados como Município. `type TpEnteGov = 1 | 2 | 3 | 4 | 5 | 6`
- `TributoDaAliquota`: Tributo com alíquota nominal por ente. `type TributoDaAliquota = 'CBS' | 'IBSUF' | 'IBSMun'`
- `ValoresCompraGov`: Alíquota efetiva (em percentual) e valor devido por tributo. `type ValoresCompraGov = Readonly<Record<TributoDaAliquota, { readonly pAliq: Decimal; readonly vTrib: Decimal; }>>`
- `Variaveis`: `type Variaveis = Readonly<Record<string, Decimal | undefined>>`

### Constantes

- `ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE`: Id do ator "Produtor rural não contribuinte" na tabela de atores da Calculadora (V0057). `ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE = 14`
- `ESCALA_INTERNA`: Escala interna de todo resultado de expressão (`ArredondamentoUtils.PRECISAO_INTERNA`). `ESCALA_INTERNA = 8`
- `NAO_IMPLEMENTADAS`: Regras da NT que este pacote ainda não confere, com o motivo. `NAO_IMPLEMENTADAS: readonly NaoImplementada[]`
- `REDISTRIBUICAO_A_PARTIR_DE`: Primeiro dia em que a redistribuição do art. 473 vale. `REDISTRIBUICAO_A_PARTIR_DE: DataIso`
- `REGRAS`: `REGRAS: readonly Regra[]`
- `REGRAS_LEGAIS`: `REGRAS_LEGAIS: readonly RegraLegal[]`
- `RESOLVEDORES_PADRAO`: `RESOLVEDORES_PADRAO: readonly Resolvedor[]`
- `TABELA_ALIQUOTAS`: A tabela embarcada nesta versão do pacote. `TABELA_ALIQUOTAS: TabelaDeAliquotas`
- `TABELAS_NT`: Tabelas da NT embarcadas neste pacote. `TABELAS_NT: TabelasNt`
- `TRIBUTOS_DAS_ALIQUOTAS`: `TRIBUTOS_DAS_ALIQUOTAS: readonly TributoDaAliquota[]`
- `VARIAVEIS_DAS_EXPRESSOES`: Variáveis que as expressões oficiais podem citar (`VariavelExpressao` da Calculadora). `VARIAVEIS_DAS_EXPRESSOES: readonly string[]`
- `VERSAO_DO_FORMATO_DAS_ALIQUOTAS`: Formato de tabela que este código lê. `VERSAO_DO_FORMATO_DAS_ALIQUOTAS = 2`

## `@sinete/ibs-cbs/aliquotas`

`@sinete/ibs-cbs/aliquotas`: alíquotas nominais do IBS e da CBS por data de fato gerador, com estado da fonte.

Toda alíquota é `oficial` (com dispositivo legal e fonte), `informada` (pelo usuário, com motivo) ou `desconhecida` (ainda não publicada). Em 2026 valem as alíquotas de teste (CBS 0,9%, IBS estadual 0,1%, municipal 0%); em 2027 e 2028, o IBS de 0,05% + 0,05% da LC 214/2025 e a CBS desconhecida até a resolução do Senado; de 2029 em diante, desconhecidas até as leis dos entes e do Senado. Fica fora do `@sinete/ibs-cbs-dados` porque a cadência é outra.

### Funções

- `aliquotasOficiais`: Provedor da tabela oficial (a embarcada, por padrão). `aliquotasOficiais(t?: TabelaDeAliquotas): ProvedorDeAliquotas`
- `comAliquotasInformadas`: Sobrepõe alíquotas informadas pelo usuário. A primeira sobreposição que casar (tributo, vigência, local, tipo) vence; as demais alíquotas continuam vindo de `base`. O resultado sai `informada`, com o motivo. `comAliquotasInformadas(base: ProvedorDeAliquotas, informadas: readonly AliquotaInformada[]): ProvedorDeAliquotas`
- `ehSimulada`: Alguma das alíquotas não é oficial: o cálculo feito com elas é simulação. `ehSimulada(aliquotas: AliquotasNominais): boolean`
- `exigirAliquota`: Valor da alíquota, ou `ErroAliquotaDesconhecida` quando ela ainda não existe. `exigirAliquota(aliquota: Aliquota, data: DataIso): string`

### Classes

- `ErroAliquotaDesconhecida` (estende `ErroSinete<'ibscbs_aliquota_desconhecida'>`): A alíquota pedida ainda não foi publicada (estado `desconhecida`). O cálculo não segue com zero nem com um palpite: quem precisa simular informa a alíquota com `comAliquotasInformadas`, e o resultado sai marcado como simulado. Membros: `tributo`, `data`.
- `ErroDadosDeAliquotas` (estende `ErroSinete<'ibscbs_aliquotas_invalidas'>`): Tabela de alíquotas inconsistente (vigências sobrepostas, valor fora do domínio, formato desconhecido).

### Interfaces

- `Aliquota`: Membros: `tributo`, `situacao`, `valor`, `legal`, `fontes`, `nota`, `motivo`, `vigencia`.
- `AliquotaInformada`: Alíquota informada pelo usuário, com motivo obrigatório. Membros: `tributo`, `valor`, `motivo`, `vigencia`, `local`, `aplicaA`, `fonte`.
- `AliquotasNominais`: As três alíquotas de uma operação. Membros: `CBS`, `IBSUF`, `IBSMun`.
- `FonteDaAliquota`: Membros: `id`, `titulo`, `url`, `versao`, `data`, `sha256`.
- `Local`: Local da operação para a alíquota por ente (a partir de 2029, cada UF e município fixa a sua). Membros: `uf`, `cMun`.
- `ProvedorDeAliquotas`: Fonte de alíquotas por data. `nominal` é a alíquota "padrão" do cClassTrib; `referencia`, a nacional uniforme. Membros: `id`, `nominal()`, `referencia()`.
- `RegistroAliquotaDeReferencia`: Membros: `tributo`, `vigencia`, `situacao`, `aliquota`, `legal`, `nota`, `fontes`.
- `RegistroAliquotaPadrao`: Alíquota própria de um ente (lei estadual ou municipal, art. 14 da LC 214/2025). Membros: `tributo`, `ente`, `vigencia`, `aliquota`, `legal`, `fontes`.
- `TabelaDeAliquotas`: Membros: `versaoDoFormato`, `versaoDosDados`, `conhecidoEm`, `fontes`, `referencia`, `padrao`.
- `Vigencia`: Membros: `inicio`, `fim`.

### Tipos

- `DataIso`: Tipos do `@sinete/ibs-cbs/aliquotas`. Datas são civis (`AAAA-MM-DD`) no tempo do fato gerador; decimais vêm como texto. `type DataIso = string`
- `Dec`: `type Dec = string`
- `SituacaoDaAliquota`: Estado de uma alíquota: - `oficial`: publicada em ato oficial (lei, resolução, tabela oficial), com a fonte citada; - `informada`: informada pelo usuário (ex.: simulação de 2027 antes da resolução do Senado), com o motivo; - `desconhecida`: ainda não publicada. `type SituacaoDaAliquota = 'oficial' | 'informada' | 'desconhecida'`
- `TributoDaAliquota`: Tributo com alíquota nominal por ente. `type TributoDaAliquota = 'CBS' | 'IBSUF' | 'IBSMun'`

### Constantes

- `TABELA_ALIQUOTAS`: A tabela embarcada nesta versão do pacote. `TABELA_ALIQUOTAS: TabelaDeAliquotas`
- `TRIBUTOS_DAS_ALIQUOTAS`: `TRIBUTOS_DAS_ALIQUOTAS: readonly TributoDaAliquota[]`
- `VERSAO_DO_FORMATO_DAS_ALIQUOTAS`: Formato de tabela que este código lê. `VERSAO_DO_FORMATO_DAS_ALIQUOTAS = 2`

## `@sinete/ibs-cbs/calcular`

`@sinete/ibs-cbs/calcular`: cálculo do IBS e da CBS a partir de uma operação já classificada.

Recebe CST, cClassTrib e grupos informados por item (`OperacaoClassificada`) e devolve o `Roc`, com os grupos da NT 2025.002 (`gIBSCBS`, `gRed`, `gDif`, `gDevTrib`, `gTribRegular`, `gTribCompraGov`, `gTransfCred`, `gAjusteCompet`, `gEstornoCred`, `gCredPresOper`, `gCredPresIBSZFM`) e os totais `IBSCBSTot`. As regras vêm do `@sinete/ibs-cbs-dados`, as alíquotas do `@sinete/ibs-cbs/aliquotas`. Monofasia, Imposto Seletivo e alíquotas combinadas lançam `ErroRegimeNaoSuportado`: nunca sai valor zerado no lugar de um regime que o motor não calcula.

### Funções

- `avaliar`: `avaliar(expressao: string, variaveis: Variaveis): Decimal`
- `calcular`: Calcula IBS e CBS da operação. Lança `ErroClassificacao`, `ErroRegimeNaoSuportado` ou `ErroAliquotaDesconhecida`. `calcular(op: OperacaoClassificada, opcoes: CalcularOpcoes): Roc`
- `calcularEm`: Variante com a data civil do fato gerador já resolvida (`AAAA-MM-DD`): para reprocessamento e para o oráculo, que trabalham com a data que a Calculadora recebe. `calcularEm(op: OperacaoClassificada, opcoes: { readonly dataset: DatasetIbsCbs; readonly aliquotas: ProvedorDeAliquotas; readonly data: DataIso; }): Roc`
- `conferirExpressao`: Confere que a expressão só usa a gramática e as variáveis conhecidas; devolve as variáveis citadas. `conferirExpressao(expressao: string): readonly string[]`
- `dec`: Atalho para `Decimal.parse`. `dec(texto: string): Decimal`
- `dePercentual`: Percentual (`'0.9'`) para fração com 8 casas HALF_EVEN, como o `dividirPorCem` da Calculadora. `dePercentual(valor: Decimal): Decimal`
- `dinheiro`: Valor monetário com 2 casas, HALF_EVEN. `dinheiro(valor: Decimal): string`
- `enteDe`: Ente equivalente para a redistribuição. `enteDe(tp: TpEnteGov): Ente`
- `paraPercentual`: Fração (`0.009`) para percentual (`0.9`), sem arredondar (`movePointRight(2)`). `paraPercentual(fracao: Decimal): Decimal`
- `percentual`: Percentual com 4 casas HALF_EVEN, sem zeros à direita e com no mínimo 2 casas (`'0.90'`, `'0.1234'`, `'60.00'`). `percentual(valor: Decimal): string`
- `redistribuir`: Valores que cada ente efetivamente recebe. `transferPercent` é o percentual da CBS transferido ao ente contratante (`'0'` até 2028), já em fração de 8 casas. `redistribuir(valores: ValoresCompraGov, tp: TpEnteGov, data: DataIso, fracaoTransferida: Decimal): ValoresCompraGov`
- `sum`: Soma de uma lista (zero para lista vazia). `sum(valores: readonly Decimal[]): Decimal`

### Classes

- `Decimal`: Valor decimal imutável: `unscaled × 10^-scale`. Membros: `unscaled`, `scale`, `ZERO`, `ONE`, `HUNDRED`, `of()`, `parse()`, `isDecimalText()`, `add()`, `sub()`, `mul()`, `div()`, `roundSignificant()`, `setScale()`, `stripZeros()`, `movePointRight()`, `neg()`, `cmp()`, `eq()`, `isZero()`, `isNegative()`, `toString()`, `toFixed()`, `toJSON()`.
- `ErroClassificacao` (estende `ErroSinete<'ibscbs_classificacao_invalida'>`): A classificação informada não pode ser calculada: código inexistente ou fora de vigência na data do fato gerador, cClassTrib fora da CST, não habilitado no modelo de DF-e, grupo exigido ausente ou vedado presente. `motivo` diz qual. Membros: `motivo`, `item`.
- `ErroExpressao` (estende `ErroSinete<'ibscbs_expressao_invalida'>`): Expressão de cálculo do dataset fora da gramática conhecida: mudança de dado que precisa de revisão. Membros: `expressao`.
- `ErroRegimeNaoSuportado` (estende `ErroSinete<'ibscbs_regime_nao_suportado'>`): Membros: `regime`, `item`.

### Interfaces

- `AliquotaAplicada`: Membros: `tributo`, `valor`, `situacao`, `origem`, `legal`, `motivo`.
- `AliquotasInformadas`: Alíquotas nominais informadas pelo usuário para o item, em percentual, com motivo obrigatório. Membros: `CBS`, `IBSUF`, `IBSMun`, `motivo`.
- `CalcularOpcoes`: Membros: `dataset`, `aliquotas`, `tempo`, `deslocamentoMin`.
- `CompraGovernamental`: Membros: `tpEnteGov`, `tpOperGov`.
- `CreditoPresumido`: Crédito presumido da operação (`gCredPresOper`). Membros: `cCredPres`, `vBCCredPres`, `ibs`, `cbs`, `bemMovelUsado`.
- `CreditoPresumidoTributo`: Membros: `pCredPres`, `condicional`.
- `CreditoPresumidoZfm`: Crédito presumido do IBS na ZFM (`gCredPresIBSZFM`), com o valor apurado sobre o saldo devedor. Membros: `competApur`, `tpCredPresIBSZFM`, `vCredPresIBSZFM`.
- `EntradaDoRastro`: Uma conta do cálculo, com as entradas em precisão interna (8 casas), para auditoria. Membros: `item`, `tributo`, `campo`, `formula`, `entradas`, `resultado`.
- `GCBS`: Membros: `pCBS`, `gDif`, `gDevTrib`, `gRed`, `vCBS`.
- `GCredPresIBSZFM`: Membros: `competApur`, `tpCredPresIBSZFM`, `vCredPresIBSZFM`.
- `GCredPresOper`: Membros: `vBCCredPres`, `cCredPres`, `gIBSCredPres`, `gCBSCredPres`.
- `GCredPresTributo`: Membros: `pCredPres`, `vCredPres`, `vCredPresCondSus`.
- `GDevTrib`: Membros: `pDevTrib`, `vDevTrib`.
- `GDif`: Membros: `pDif`, `vDif`.
- `GIBSCBS`: Membros: `vBC`, `gIBSUF`, `gIBSMun`, `vIBS`, `gCBS`, `gTribRegular`, `gTribCompraGov`.
- `GIBSMun`: Membros: `pIBSMun`, `gDif`, `gRed`, `vIBSMun`.
- `GIBSUF`: Membros: `pIBSUF`, `gDif`, `gRed`, `vIBSUF`.
- `GRed`: Membros: `pRedAliq`, `pAliqEfet`.
- `GTribCompraGov`: Membros: `pAliqIBSUF`, `vTribIBSUF`, `pAliqIBSMun`, `vTribIBSMun`, `pAliqCBS`, `vTribCBS`.
- `GTribRegular`: Membros: `CSTReg`, `cClassTribReg`, `pAliqEfetRegIBSUF`, `vTribRegIBSUF`, `pAliqEfetRegIBSMun`, `vTribRegIBSMun`, `pAliqEfetRegCBS`, `vTribRegCBS`.
- `IBSCBS`: Grupo `IBSCBS` do item. Os grupos de escolha exclusiva (UB14k) seguem os indicadores da CST. Membros: `CST`, `cClassTrib`, `gIBSCBS`, `gTransfCred`, `gAjusteCompet`, `gEstornoCred`, `gCredPresOper`, `gCredPresIBSZFM`.
- `IBSCBSTot`: Membros: `vBCIBSCBS`, `gIBS`, `gCBS`, `gEstornoCred`.
- `ItemClassificado`: Item classificado: tudo o que o cálculo precisa, sem fato de negócio (CFOP, cliente, descrição). Membros: `n`, `cst`, `cClassTrib`, `base`, `quantidade`, `unidade`, `regular`, `aliquotasInformadas`, `diferimento`, `devolucaoDeTributo`, `transferenciaDeCredito`, `ajusteDeCompetencia`, `estornoDeCredito`, `creditoPresumido`, `creditoZfm`, `monofasia`, `impostoSeletivo`.
- `LocalDaOperacao`: Local da operação (define as alíquotas próprias de UF e município, quando houver). Membros: `uf`, `cMun`.
- `OperacaoClassificada`: Membros: `modelo`, `local`, `compraGovernamental`, `itens`.
- `Roc`: Membros: `dataDeReferencia`, `oper`, `itens`, `total`, `simulado`, `versaoDoConteudo`, `idDasAliquotas`, `rastro`.
- `RocItem`: Membros: `nItem`, `IBSCBS`, `aliquotas`, `simulado`.
- `TributacaoRegular`: Grupo de tributação regular (`gTribRegular`), exigido pelos cClassTrib de suspensão e afins. Membros: `cst`, `cClassTrib`.

### Tipos

- `DataIso`: Data civil `AAAA-MM-DD`. `type DataIso = string`
- `Dec`: Decimal em texto (`'1000.00'`, `'0.9'`). `type Dec = string`
- `MotivoErroClassificacao`: Motivo de uma classificação recusada pelo motor, estável como o `code`.
- `OrigemDaAliquota`: De onde veio a alíquota usada para um tributo. `type OrigemDaAliquota = 'provedor-nominal' | 'provedor-referencia' | 'dataset-fixa' | 'informada' | 'sem-aliquota'`
- `RegimeNaoSuportado`: Regime que o motor ainda não calcula. Nunca sai um valor preenchido com zero no lugar. `type RegimeNaoSuportado = 'monofasia' | 'imposto-seletivo' | 'aliquotas-combinadas' | 'ajuste'`
- `RoundingMode`: Decimal exato em ponto fixo sobre `BigInt`, com as regras de arredondamento da Calculadora da RFB. `type RoundingMode = 'HALF_EVEN' | 'HALF_UP' | 'DOWN'`
- `TpEnteGov`: Tipo de ente governamental comprador (`tpEnteGov`): 1 União, 2 Estado, 3 Distrito Federal, 4 Município. A Calculadora aceita ainda 5 (consórcio público) e 6 (Comitê Gestor do IBS), tratados como Município. `type TpEnteGov = 1 | 2 | 3 | 4 | 5 | 6`
- `ValoresCompraGov`: Alíquota efetiva (em percentual) e valor devido por tributo. `type ValoresCompraGov = Readonly<Record<TributoDaAliquota, { readonly pAliq: Decimal; readonly vTrib: Decimal; }>>`
- `Variaveis`: `type Variaveis = Readonly<Record<string, Decimal | undefined>>`

### Constantes

- `ESCALA_INTERNA`: Escala interna de todo resultado de expressão (`ArredondamentoUtils.PRECISAO_INTERNA`). `ESCALA_INTERNA = 8`
- `REDISTRIBUICAO_A_PARTIR_DE`: Primeiro dia em que a redistribuição do art. 473 vale. `REDISTRIBUICAO_A_PARTIR_DE: DataIso`
- `VARIAVEIS_DAS_EXPRESSOES`: Variáveis que as expressões oficiais podem citar (`VariavelExpressao` da Calculadora). `VARIAVEIS_DAS_EXPRESSOES: readonly string[]`

## `@sinete/ibs-cbs/validar`

`@sinete/ibs-cbs/validar`: regras de validação da NT 2025.002-RTC v1.51 (grupos UB e W da NF-e e da NFC-e) que dá para conferir sem o banco de dados da SEFAZ, como funções puras com id, cStat, implantação por ambiente e fonte.

`validar` confere um documento (o `Roc` do `@sinete/ibs-cbs/calcular` via `documentoDoRoc`, ou os grupos lidos de um XML) e devolve as violações; é o segundo oráculo do motor, para o que a Calculadora da RFB não calcula.

### Funções

- `ativa`: A regra está implantada para o documento na data de emissão e no ambiente. `ativa(regra: DescricaoDaRegra, documento: DocumentoDasRegras, ambiente: Ambiente, emissao: string): boolean`
- `documentoDoRoc`: Documento para `validar` a partir do `Roc` do motor, com os campos de identificação que o `Roc` não tem. `documentoDoRoc(roc: Roc, identificacao: Omit<DocumentoDasRegras, 'itens' | 'IBSCBSTot' | 'gCompraGov'> & { readonly itens?: readonly Omit<DocumentoDasRegras['itens'][number], 'IBSCBS'>[]; }): DocumentoDasRegras`
- `validar`: `validar(documento: DocumentoDasRegras, opcoes: ValidarOpcoes): RelatorioDeValidacao`

### Interfaces

- `Ativacao`: A partir de quando a regra vale, por ambiente, pela data de emissão. Membros: `homologacao`, `producao`, `crt`.
- `ContextoDaRegra`: Contexto de uma validação. Membros: `documento`, `conteudo`, `emissao`, `aliquotas`.
- `DescricaoDaRegra`: Membros: `id`, `cStat`, `titulo`, `modelos`, `ativacao`, `fonte`, `nota`.
- `DocumentoDasRegras`: Membros: `modelo`, `crt`, `finNFe`, `tpNFDebito`, `tpNFCredito`, `emissaoReferenciada`, `munEmitente`, `munDestinatario`, `gCompraGov`, `itens`, `IBSCBSTot`.
- `ItemDasRegras`: Membros: `nItem`, `IBSCBS`, `ncm`, `vProd`, `combustivelMonofasico`, `bemMovelUsado`.
- `NaoImplementada`: Regra da NT que este pacote não confere, com o motivo. Membros: `id`, `motivo`.
- `Regra` (estende `DescricaoDaRegra`): Membros: `conferir()`.
- `RelatorioDeValidacao`: Membros: `violacoes`, `avaliadas`, `inativas`, `dataDaEmissao`, `dataDoFato`.
- `TabelasNt`: Tabelas próprias da NT 2025.002 embarcadas no pacote (`TABELAS_NT`). Membros: `fonte`, `tpNFDebito`, `tpNFCredito`, `classTribPorTipoDeNota`, `aliquotasPorAnoDeEmissao`, `areasIncentivadas`, `ncmExcluidosDaCbsZero`.
- `ValidarOpcoes`: Membros: `dataset`, `tempo`, `ambiente`, `deslocamentoMin`, `aliquotas`, `ignorarAtivacao`, `regras`.
- `Violacao`: Membros: `regra`, `cStat`, `item`, `message`, `fonte`.

### Tipos

- `Ambiente`: `type Ambiente = 'producao' | 'homologacao'`
- `Dec`: `type Dec = string`
- `Modelo`: `type Modelo = 55 | 65`
- `Relatar`: `type Relatar = (item: number | undefined, message: string) => void`

### Constantes

- `NAO_IMPLEMENTADAS`: Regras da NT que este pacote ainda não confere, com o motivo. `NAO_IMPLEMENTADAS: readonly NaoImplementada[]`
- `REGRAS`: `REGRAS: readonly Regra[]`
- `TABELAS_NT`: Tabelas da NT embarcadas neste pacote. `TABELAS_NT: TabelasNt`

## `@sinete/ibs-cbs/determinar`

`@sinete/ibs-cbs/determinar`: determinação do CST e do cClassTrib do IBS e da CBS a partir de fatos de negócio.

`restringir` aplica só as restrições oficiais (vigência, DF-e, tipo de nota, nomenclatura, anexos de NCM e NBS, atores) e diz o motivo de cada código excluído. `determinar` soma as regras legais fechadas (`REGRAS_LEGAIS`), as respostas do usuário e os resolvedores plugáveis, e devolve cada decisão com proveniência. `paraClassificado` monta a entrada do `@sinete/ibs-cbs/calcular`.

### Funções

- `candidatoDe`: `candidatoDe(conteudo: ConteudoTributario, ct: RegistroClassTrib): Candidato`
- `candidatoUnico`: Decide quando só sobrou um candidato. `candidatoUnico(): Resolvedor`
- `dataDoFato`: Data civil do fato gerador. `dataDoFato(tempo: ContextoDeTempo, deslocamentoMin?: number): string`
- `determinar`: Determinação na data do fato gerador de `opcoes.tempo`. `determinar(fatos: FatosDaOperacao, opcoes: DeterminarOpcoes): Promise<Determinacao>`
- `determinarEm`: Determinação numa visão já fixada numa data. `determinarEm(fatos: FatosDaOperacao, conteudo: ConteudoTributario, opcoes: DeterminarEmOpcoes): Promise<Determinacao>`
- `doPerfil`: Reaproveita a classificação guardada no cadastro do item, se ela ainda estiver entre os candidatos. `doPerfil(): Resolvedor`
- `idDaPergunta`: Id estável da pergunta de classificação de um item. `idDaPergunta(n: number): string`
- `paraClassificado`: Monta a entrada do `@sinete/ibs-cbs/calcular`. Falha se algum item ficou sem decisão. `paraClassificado(det: Determinacao, op: EntradaDaOperacao, item: (n: number, candidato: Candidato) => EntradaDoItem): OperacaoClassificada`
- `perguntarAoUsuario`: Pergunta ao usuário entre os candidatos que sobraram; a resposta volta em `respostas[idDaPergunta(n)]`. `perguntarAoUsuario(): Resolvedor`
- `restringir`: Restrições oficiais na data do fato gerador de `opcoes.tempo`. `restringir(fatos: FatosDaOperacao, opcoes: RestringirOpcoes): readonly RestricoesDoItem[]`
- `restringirEm`: Restrições oficiais numa visão já fixada numa data. `restringirEm(fatos: FatosDaOperacao, conteudo: ConteudoTributario): readonly RestricoesDoItem[]`

### Classes

- `ErroDeterminacao` (estende `ErroSinete<'ibscbs_determinacao_invalida'>`): A determinação não pode seguir: fatos malformados (item repetido, NCM com letras), resolvedor ou resposta que escolhe código fora dos candidatos, ou `paraClassificado` com item sem decisão. `motivo` diz qual; `item` diz onde. Membros: `motivo`, `item`.

### Interfaces

- `Candidato`: Um cClassTrib possível para o item, com o que o usuário precisa para escolher. Membros: `cst`, `cClassTrib`, `nome`, `descricao`, `lc214`, `url`, `exigeRegular`.
- `ContextoDoResolvedor`: Membros: `fatos`, `item`, `candidatos`, `conteudo`, `respostas`.
- `ContextoRegraLegal`: Membros: `fatos`, `item`, `conteudo`.
- `Determinacao`: Membros: `dataDeReferencia`, `versaoDoConteudo`, `itens`, `completa`.
- `DeterminacaoDoItem`: Membros: `n`, `candidatos`, `exclusoes`, `regras`, `decidido`, `pendente`.
- `DeterminarEmOpcoes`: Membros: `regras`, `resolvedores`, `respostas`, `relogio`, `signal`.
- `DeterminarOpcoes` (estende `RestringirOpcoes, Omit<DeterminarEmOpcoes, 'relogio'>`): Membros: `relogio`.
- `EntradaDaOperacao`: Membros: `modelo`, `local`, `compraGovernamental`.
- `Exclusao`: Membros: `cClassTrib`, `motivo`, `detalhe`, `fonte`.
- `FatosDaOperacao`: Membros: `modelo`, `tipo`, `fornecedor`, `adquirente`, `tpNFDebito`, `tpNFCredito`, `itens`.
- `FatosDaParte`: Membros: `atores`, `uf`, `cMun`.
- `FatosDoItem`: Membros: `n`, `ncm`, `nbs`, `descricao`, `tipo`, `referenciado`, `perfil`.
- `OpcaoDaPergunta`: Membros: `rotulo`, `cClassTrib`.
- `PerfilDoItem`: Classificação já decidida e guardada no cadastro do item, reaproveitada pelo resolvedor `doPerfil`. Membros: `cClassTrib`, `decididoPor`.
- `Pergunta`: Membros: `id`, `item`, `texto`, `opcoes`.
- `Procedencia`: Membros: `por`, `nome`, `em`, `versaoDoConteudo`, `dataDeReferencia`, `fonte`, `confianca`, `evidencia`.
- `RegraAplicada`: Restrição aplicada por uma regra legal, registrada no item. Membros: `regra`, `fonte`, `codigos`, `conflito`.
- `RegraLegal`: Regra fechada, derivada da lei, pura e com fonte: restringe os candidatos a uma lista de códigos. Membros: `id`, `titulo`, `fonte`, `vigencia`, `nota`, `aplicar()`.
- `Resolvedor`: Resolvedor plugável: histórico do contribuinte, cadastro, IA, fila de revisão. Só escolhe dentro de `candidatos`; um código de fora é erro (`ErroDeterminacao` com `motivo` `resolvedor_fora_dos_candidatos`). Membros: `nome`, `resolver()`.
- `RestricoesDoItem`: Candidatos e exclusões de um item, só pelas restrições oficiais. Membros: `n`, `candidatos`, `exclusoes`.
- `RestringirOpcoes`: Membros: `dataset`, `tempo`, `deslocamentoMin`.

### Tipos

- `EntradaDoItem`: Dados do item para o cálculo que a determinação não produz (base, tributação regular, diferimento...). `type EntradaDoItem = Omit<ItemClassificado, 'n' | 'cst' | 'cClassTrib'>`
- `MotivoDaExclusao`: Por que um código saiu: `type MotivoDaExclusao = 'vigencia' | 'dfe' | 'tipo-de-nota' | 'nomenclatura' | 'ncm' | 'nbs' | 'atores' | 'regra-legal'`
- `MotivoErroDeterminacao`: Motivo estável de um `ErroDeterminacao`. `type MotivoErroDeterminacao = 'fatos_invalidos' | 'resolvedor_fora_dos_candidatos' | 'resolvedor_invalido' | 'resposta_fora_dos_candidatos' | 'determinacao_incompleta'`
- `ResultadoDoResolvedor`
- `ResultadoRegraLegal`: `type ResultadoRegraLegal = { readonly tipo: 'restringir'; readonly codigos: readonly string[]; } | { readonly tipo: 'nenhum'; }`
- `TipoDeOperacao`: Natureza da operação, no que muda a classificação: `type TipoDeOperacao = 'venda' | 'transferencia' | 'bonificacao' | 'doacao' | 'devolucao' | 'exportacao' | 'outra'`

### Constantes

- `ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE`: Id do ator "Produtor rural não contribuinte" na tabela de atores da Calculadora (V0057). `ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE = 14`
- `REGRAS_LEGAIS`: `REGRAS_LEGAIS: readonly RegraLegal[]`
- `RESOLVEDORES_PADRAO`: `RESOLVEDORES_PADRAO: readonly Resolvedor[]`
