# Referência: `@sinete/nfe`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/nfe/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/nfe/x` é `sinete/nfe/x`.

## `@sinete/nfe`

`@sinete/nfe`: NF-e modelo 55 e NFC-e modelo 65. Entrada do domínio (`DadosNfe`), montagem com totais em decimal exato e validação estrita (`montarNfe`), assinatura por splice (`assinarNfe`) e os serviços da SEFAZ sobre `@sinete/transport` (`criarClienteNfe`). IBS/CBS pelo motor do sinete por padrão (`calculadoraIbsCbs`), com o dataset carregado sob demanda. O emissor (bytes gravados antes do envio, trava, retomada, cancelamento com recuperação) está em `@sinete/emissor/nfe` (ADR 0010).

### Funções

- `assinarNfe`: Assina a NF-e montada: na NFC-e, insere antes o `infNFeSupl` (`comQrCode`, com a assinatura do QR Code quando a contingência off-line pede); depois, a `Signature` como último filho de `NFe`, tudo por splice, e devolve a string final. `assinarNfe(nota: NfeMontada, assinador: Assinador): Promise<string>`
- `assinaturaQrCode`: Assinatura dos parâmetros do QR Code da NFC-e em contingência off-line com a versão 3 (RSA-SHA1 em Base64, com o certificado que assina a nota; Manual do DANFE NFC-e 6.0, 4.4.2). `undefined` quando o QR Code não leva assinatura (NF-e, emissão normal, versão 2). `assinaturaQrCode(nota: NfeMontada, assinador: Assinador): Promise<string | undefined>`
- `autorizadorContingencia`: Autorizador SVC da UF e o `tpEmis` que a NF-e emitida nele leva (6 SVC-AN, 7 SVC-RS; MOC 7.0, B22). `autorizadorContingencia(uf: Uf, ambiente: Ambiente): { readonly autorizador: 'SVC-AN' | 'SVC-RS'; readonly tpEmis: '6' | '7'; }`
- `calculadoraIbsCbs`: Cria a calculadora de IBS/CBS sobre o motor do sinete. `calculadoraIbsCbs(opcoes?: CalculadoraIbsCbsOpcoes): CalculadoraIbsCbs`
- `carregarDatasetEmbarcado`: O dataset embarcado no `@sinete/ibs-cbs-dados`, importado sob demanda (`import()` dinâmico) e carregado uma vez por processo. É o que a calculadora padrão usa quando `dataset` não é informado; chamar antes só adianta a carga. Se o import falhar, a próxima chamada tenta de novo. `carregarDatasetEmbarcado(): Promise<DatasetIbsCbs>`
- `chaveDaDuplicidade`: Chave de acesso que a SEFAZ informa no `xMotivo` da rejeição 539 (`[chNFe:...]`), se houver. `chaveDaDuplicidade(xMotivo: string): string | undefined`
- `comQrCode`: A NFC-e montada com o `infNFeSupl` (QR Code e `urlChave`) inserido por splice antes do fechamento de `NFe`, pronta para a assinatura. `comQrCode(nota: NfeMontada, assinatura?: string): string`
- `conferirEmitenteDoCertificado`: Confere o emitente com o titular do certificado que assina a NF-e (MOC 7.0 Anexo I, grupo F): `conferirEmitenteDoCertificado(nfe: DadosNfe, titular: { readonly cnpj?: string | undefined; readonly cpf?: string | undefined; }): readonly Ocorrencia[]`
- `criarClienteNfe`: Cria o cliente dos serviços da NF-e. `criarClienteNfe(opcoesDoCliente: ClienteNfeOpcoes): ClienteNfe`
- `dec`: Atalho para `Decimal.of`. `dec(valor: DecimalInput): Decimal`
- `descomprimirGzipBase64`: Base64 de um gzip para o texto UTF-8 de dentro. `descomprimirGzipBase64(b64: string): Promise<string>`
- `deslocamentoDaUf`: Deslocamento do horário legal da UF em minutos (`-180` para Brasília). `deslocamentoDaUf(uf: Uf): number`
- `documentoAssinado`: Confere que `xml` é um documento `raiz` assinado (no namespace da NF-e, com `Signature` referenciando o filho `elemento`) e devolve a string sem a declaração XML. Lança `ErroDeConfiguracao` para qualquer outra coisa: o serviço nunca "conserta" o documento de quem chama. `documentoAssinado(xml: string, raiz: string, elemento: string): DocumentoAssinado`
- `exigenciaRespTec`: Exigência de infRespTec ou CSRT para a UF no ambiente e na data (tabela `data/resp-tec.json`). `exigenciaRespTec(uf: Uf, ambiente: Ambiente, data: Instante): { readonly infRespTec: ExigenciaRespTec; readonly csrt: ExigenciaRespTec; }`
- `formatarDecimal`: Texto do valor já arredondado no formato (arredonda em `max` casas pelo modo dado). `formatarDecimal(valor: Decimal, formato: FormatoDecimal, modo?: RoundingMode): string`
- `formatarDh`: `TDateTimeUTC` do instante no deslocamento dado. `formatarDh(data: Instante, deslocamentoMin: number): string`
- `hashCsrt`: `hashCSRT`: Base64(SHA-1(CSRT + chave de acesso)) (NT 2018.005, campo ZD09). `hashCsrt(csrt: string, chave: string): Promise<string>`
- `localDaOperacao`: Local da operação para as alíquotas próprias de UF e município: o `cMunFGIBS` informado (campo B12a da NT 2025.002, município de ocorrência do fato gerador do IBS/CBS), senão o destino da mercadoria (entrega ou destinatário, pela LC 214/2025, art. 11, o local da entrega), senão o emitente. `localDaOperacao(nota: PedidoIbsCbsNota): LocalDaOperacao`
- `montarNfe`: Monta, calcula e valida. Nunca lança por dado do chamador: devolve as ocorrências. `montarNfe(entrada: DadosNfe, opcoes: MontarNfeOpcoes): Promise<ResultadoMontagemNfe>`
- `nfeAssinadaDoProc`: NF-e assinada de dentro de um `nfeProc` (ou a própria NF-e assinada), como fatia do texto e sem a declaração XML, pronta para `consultar`, `resolverEnvioSemResposta` e a retomada, que recusam raiz sem `xmlns` próprio. `nfeAssinadaDoProc(xml: string): string`
- `problemaDeFormato`: Por que o valor não cabe no formato, ou `undefined` se cabe sem perder dígitos. `problemaDeFormato(valor: Decimal, formato: FormatoDecimal): string | undefined`
- `recortarElemento`: Recorta o elemento da fonte, acrescentando na tag de abertura só as declarações de namespace que ele usa e que estão em ancestrais fora do recorte. O default entra apenas quando difere de `nsPadraoDoPai` (o default do envelope onde a fatia vai morar). `recortarElemento(documento: DocumentoXml, el: ElementoXml, nsPadraoDoPai?: string): string`
- `recuperarEventoRegistrado`: Consulta a chave e devolve o evento `tpEvento` que a SEFAZ registrou para ela (o de maior `nSeqEvento`, quando há vários, como na CC-e; com `nSeqEvento`, só o dessa sequência). `recuperarEventoRegistrado(cliente: ClienteNfe, chave: string, tpEvento: string, nSeqEvento?: number): Promise<RecuperacaoEvento>`
- `resolverEnvioSemResposta`: Resolve um envio de autorização sem resposta, ou cuja resposta foi 204 ou 539, consultando a chave da NF-e assinada. `anterior` é o desfecho do envio, quando houve um. `resolverEnvioSemResposta(cliente: ClienteNfe, nfeAssinada: string, anterior?: ResultadoAutorizacao): Promise<ResolucaoEnvio>`
- `rotuloDoCaminho`: Rótulo em português do caminho de uma ocorrência da NF-e: `Grupo, Campo` quando os dois são conhecidos (`Emitente, Inscrição estadual`), só um deles quando falta o outro, e `Dados da NF-e` quando nenhum é. `rotuloDoCaminho(caminho: string): string`
- `sum`: Soma uma lista (vazia = zero). `sum(valores: Iterable<Decimal>): Decimal`
- `urlsNfce`: Endereços da NFC-e da UF no ambiente e no dia (`data/nfce-urls.json`, das tabelas do Portal Nacional da NFC-e). O `qrCode` é `undefined` onde a tabela não traz o endereço completo (AM e MA publicam sem o protocolo): informe `MontarNfeOpcoes.urlQrCode`. `urlsNfce(uf: Uf, ambiente: Ambiente, dia: string): { readonly qrCode: string | undefined; readonly urlChave: string | undefined; }`

### Classes

- `Decimal`: Valor decimal imutável: `coef × 10^-scale`. Membros: `coef`, `scale`, `ZERO`, `ONE`, `HUNDRED`, `fromParts()`, `of()`, `tryOf()`, `plus()`, `minus()`, `times()`, `dividedBy()`, `percent()`, `negate()`, `abs()`, `round()`, `compare()`, `eq()`, `lt()`, `gt()`, `isZero()`, `isNegative()`, `significantScale()`, `toFixed()`, `toString()`, `toJSON()`.

### Interfaces

- `AutorizarOpcoes` (estende `EnvioOpcoes`): Membros: `sincrono`.
- `Cadastro`: Membros: `UF`, `dhCons`, `infCad`.
- `CalculadoraIbsCbs`: Calcula o IBS e a CBS dos itens classificados. O padrão é o `calculadoraIbsCbs`, sobre o `@sinete/ibs-cbs/calcular`; nos testes, um dublê com alíquotas fixas. A calculadora não vê o XML nem o resto da nota além do que está no pedido. Membros: `calcular()`.
- `CalculadoraIbsCbsOpcoes`: Membros: `dataset`, `aliquotas`, `base`, `regras`, `deslocamentoMin`.
- `CancelamentoPedido`: Membros: `chave`, `nProt`, `xJust`, `autor`.
- `CancelamentoSubstituicaoPedido`: Membros: `chave`, `nProt`, `xJust`, `chNFeRef`, `cOrgaoAutor`, `tpAutor`, `verAplic`, `autor`.
- `CartaCorrecaoPedido`: Membros: `chave`, `xCorrecao`, `nSeqEvento`, `autor`.
- `ClassificacaoIbsCbs`: Classificação do item para IBS/CBS (NT 2025.002): o que o `CalculadoraIbsCbs` recebe. `CST` e `cClassTrib` vêm do cadastro do item (tabela de classificação tributária); o cálculo, as alíquotas e as reduções são da calculadora. Membros: `CST`, `cClassTrib`, `vBC`, `indDoacao`, `cCredPres`, `gTribRegular`.
- `ClienteNfe`: Membros: `opcoes`, `statusServico()`, `autorizar()`, `consultarRecibo()`, `aguardarRecibo()`, `consultar()`, `cancelar()`, `cancelarPorSubstituicao()`, `cartaCorrecao()`, `manifestar()`, `inutilizar()`, `consultarCadastro()`, `distribuicaoDFe()`.
- `ClienteNfeOpcoes`: Membros: `transporte`, `assinador`, `ambiente`, `uf`, `relogio`, `logger`, `timeoutMs`, `deslocamentoMin`, `contingencia`, `autor`, `esperar`, `endpointNfce`, `idLote`.
- `Cobranca`: Cobrança (grupo Y). `fat.vLiq` padrão `vOrig - vDesc`. Membros: `fatura`, `duplicatas`.
- `ConsultaNfe`: Situação da NF-e na consulta protocolo. Membros: `chNFe`, `situacao`, `protocolo`, `eventos`, `digValConfere`.
- `ConsultaReciboOpcoes` (estende `EnvioOpcoes`): Opções da consulta de um recibo. Membros: `mod`.
- `Contingencia`: Forma de emissão (B22) fora do normal. Membros: `tpEmis`, `dhCont`, `xJust`.
- `DadosNfe`: Entrada completa de uma NF-e. Membros: `modelo`, `serie`, `nNF`, `natOp`, `tpNF`, `finNFe`, `tpNFDebito`, `tpNFCredito`, `idDest`, `indFinal`, `indPres`, `indIntermed`, `cMunFG`, `cMunFGIBS`, `tpImp`, `dhSaiEnt`, `dPrevEntrega`, `cNF`, `contingencia`, `referenciadas`, `gCompraGov`, `gPagAntecipado`, `emitente`, `destinatario`, `retirada`, `entrega`, `autXML`, `itens`, `transporte`, `cobranca`, `pagamento`, `infIntermed`, `informacoesAdicionais`, `exporta`, `compra`, `cana`, `respTec`, `agropecuario`.
- `Desoneracao` (estende `MotivoDesoneracaoIcms>`): Desoneração do ICMS: valor e motivo andam juntos (RV N27a/N28). Membros: `vICMSDeson`, `motDesICMS`, `indDeduzDeson`.
- `DesoneracaoSt`: Desoneração do ICMS-ST (N33a/N33b): 3 uso na agropecuária; 9 outros; 12 fomento agropecuário. Membros: `vICMSSTDeson`, `motDesICMSST`.
- `DetalhePagamento`: Membros: `indPag`, `tPag`, `xPag`, `vPag`, `dPag`, `CNPJPag`, `UFPag`, `card`.
- `Distribuicao`: Membros: `ultNSU`, `maxNSU`, `dhResp`, `documentos`.
- `DistribuicaoOpcoes` (estende `EnvioOpcoes`): Membros: `cUFAutor`, `autor`.
- `DocumentoAssinado`: Documento assinado já conferido: a string como veio (sem a declaração XML) e o que se lê dela. Membros: `xml`, `id`, `digestValue`, `documento`.
- `DocumentoDistribuido`: Documento devolvido pela Distribuição DF-e, já descompactado. Membros: `NSU`, `schema`, `tipo`, `xml`, `resNFe`, `resEvento`.
- `Endereco`: Endereço no Brasil (`TEnderEmi`, `TEndereco`, `TLocal`). Membros: `xLgr`, `nro`, `xCpl`, `xBairro`, `cMun`, `xMun`, `UF`, `CEP`, `fone`.
- `EnderecoExterior`: Endereço de destinatário no exterior: o leiaute usa `cMun` 9999999, `xMun` EXTERIOR e `UF` EX. Membros: `exterior`, `xLgr`, `nro`, `xCpl`, `xBairro`, `cPais`, `xPais`, `fone`.
- `EnvioOpcoes`: Opções de toda chamada que vai à rede. Membros: `signal`.
- `EventoRegistrado`: Evento registrado (cStat 135, 136 ou 155). Membros: `chNFe`, `tpEvento`, `nSeqEvento`, `nProt`, `dhRegEvento`, `retEvento`, `procEventoNFe`.
- `FormatoDecimal`: Membros: `nome`, `min`, `max`, `minimoAbaixoDeUm`, `naoNulo`, `digitosInteiros`.
- `Icms00` (estende `IcmsBase, IcmsProprio`): Membros: `CST`, `pFCP`, `vFCP`.
- `Icms02` (estende `IcmsBase`): Monofásico próprio sobre combustíveis. `vICMSMono` padrão `qBCMono × adRemICMS`. Membros: `CST`, `qBCMono`, `adRemICMS`, `vICMSMono`.
- `Icms10` (estende `IcmsBase, IcmsProprio, IcmsFcp`): Membros: `CST`, `st`, `desoneracaoSt`.
- `Icms15` (estende `IcmsBase`): Monofásico próprio e com retenção sobre combustíveis. Membros: `CST`, `qBCMono`, `adRemICMS`, `vICMSMono`, `qBCMonoReten`, `adRemICMSReten`, `vICMSMonoReten`, `pRedAdRem`, `motRedAdRem`.
- `Icms20` (estende `IcmsBase, IcmsProprio, IcmsFcp`): Com redução de base de cálculo. `vBC` padrão: valor da operação × (1 - pRedBC/100). Membros: `CST`, `pRedBC`, `desoneracao`.
- `Icms30` (estende `IcmsBase`): Isenta ou não tributada, com ST. Membros: `CST`, `st`, `desoneracao`.
- `Icms40` (estende `IcmsBase`): 40 isenta, 41 não tributada, 50 suspensão. Membros: `CST`, `desoneracao`.
- `Icms51` (estende `IcmsBase, IcmsFcp`): Diferimento (CST 51). Com `pICMS` e sem valores: `vICMSOp = vBC × pICMS`, `vICMSDif = vICMSOp × pDif`, `vICMS = vICMSOp - vICMSDif` (RV N16a e N16c); o FCP segue a mesma conta com `pFCPDif`. Membros: `CST`, `modBC`, `pRedBC`, `cBenefRBC`, `vBC`, `pICMS`, `vICMSOp`, `pDif`, `vICMSDif`, `vICMS`, `pFCPDif`, `vFCPDif`, `vFCPEfet`.
- `Icms53` (estende `IcmsBase`): Monofásico com recolhimento diferido. Membros: `CST`, `qBCMono`, `adRemICMS`, `vICMSMonoOp`, `pDif`, `vICMSMonoDif`, `vICMSMono`, `qBCMonoDif`, `adRemICMSDif`.
- `Icms60` (estende `IcmsBase, IcmsStRetido`): ICMS cobrado anteriormente por ST. Membros: `CST`.
- `Icms61` (estende `IcmsBase`): Monofásico cobrado anteriormente. Membros: `CST`, `qBCMonoRet`, `adRemICMSRet`, `vICMSMonoRet`.
- `Icms70` (estende `IcmsBase, IcmsProprio, IcmsFcp`): Com redução de base e ST. Membros: `CST`, `pRedBC`, `st`, `desoneracao`, `desoneracaoSt`.
- `Icms90` (estende `IcmsBase, IcmsFcp`): Outras. Tudo opcional; cada parte informada é calculada como nos grupos equivalentes. Membros: `CST`, `modBC`, `vBC`, `pRedBC`, `cBenefRBC`, `pICMS`, `vICMSOp`, `pDif`, `vICMSDif`, `vICMS`, `pFCPDif`, `vFCPDif`, `vFCPEfet`, `st`, `desoneracao`, `desoneracaoSt`.
- `IcmsFcp`: FCP da operação própria. `vBCFCP` padrão `vBC`; `vFCP` padrão `vBCFCP × pFCP / 100`. Membros: `vBCFCP`, `pFCP`, `vFCP`.
- `IcmsPartilha` (estende `Omit<IcmsProprio, 'modBC'>`): Partilha do ICMS entre UF de origem e destino (ICMSPart), CST 10 ou 90 (ou 20). Membros: `grupo`, `orig`, `CST`, `modBC`, `pRedBC`, `st`, `pBCOp`, `UFST`, `desoneracao`.
- `IcmsProprio`: Parte própria do ICMS. `vBC` padrão: valor da operação (vProd + vFrete + vSeg + vOutro - vDesc) já reduzido por `pRedBC`. Membros: `modBC`, `vBC`, `pICMS`, `vICMS`.
- `IcmsRepasseSt` (estende `IcmsStRetido`): Repasse de ICMS-ST retido anteriormente para a UF de destino (ICMSST), CST 41 ou 60. Membros: `grupo`, `orig`, `CST`, `vBCSTRet`, `vICMSSTRet`, `vBCSTDest`, `vICMSSTDest`.
- `IcmsSn101` (estende `IcmsBase`): Simples Nacional 101: com permissão de crédito. `vCredICMSSN` padrão: valor da operação × pCredSN / 100. Membros: `CSOSN`, `pCredSN`, `vCredICMSSN`.
- `IcmsSn102`: Simples Nacional 102, 103, 300, 400. Membros: `CSOSN`, `orig`, `grupo`.
- `IcmsSn201` (estende `IcmsBase`): Simples Nacional 201: crédito e ST. Membros: `CSOSN`, `st`, `pCredSN`, `vCredICMSSN`.
- `IcmsSn202` (estende `IcmsBase`): Simples Nacional 202 e 203: ST sem crédito. Membros: `CSOSN`, `st`.
- `IcmsSn500` (estende `IcmsBase, IcmsStRetido`): Simples Nacional 500: cobrado anteriormente. Membros: `CSOSN`.
- `IcmsSn900`: Simples Nacional 900: outros. Membros: `CSOSN`, `orig`, `grupo`, `modBC`, `vBC`, `pRedBC`, `pICMS`, `vICMS`, `st`, `pCredSN`, `vCredICMSSN`.
- `IcmsSt`: ICMS retido por substituição tributária. Membros: `modBCST`, `pMVAST`, `pRedBCST`, `vBCST`, `pICMSST`, `vICMSST`, `vBCFCPST`, `pFCPST`, `vFCPST`, `vICMSDeducaoST`.
- `IcmsStRetido`: ICMS-ST retido anteriormente (CST 60, CSOSN 500). Todos informativos. Membros: `vBCSTRet`, `pST`, `vICMSSubstituto`, `vICMSSTRet`, `vBCFCPSTRet`, `pFCPSTRet`, `vFCPSTRet`, `pRedBCEfet`, `vBCEfet`, `pICMSEfet`, `vICMSEfet`.
- `IcmsUfDest`: ICMS de partilha para a UF de destino (NA, EC 87/2015), venda interestadual a não contribuinte. Os valores `vICMSUFDest` e `vFCPUFDest` são obrigatórios: a conta muda entre base única e base dupla conforme a UF de destino, e esse dado não está aqui. Membros: `vBCUFDest`, `vBCFCPUFDest`, `pFCPUFDest`, `pICMSUFDest`, `pICMSInter`, `pICMSInterPart`, `vFCPUFDest`, `vICMSUFDest`, `vICMSUFRemet`.
- `ImpostoImportacao`: Imposto de importação (grupo P). Membros: `vBC`, `vDespAdu`, `vII`, `vIOF`.
- `ImpostosItem`: Tributos do item (grupo M). ICMS ou ISSQN, exclusivos; o resto conforme a operação. Membros: `vTotTrib`, `icms`, `ipi`, `ii`, `issqn`, `pis`, `pisSt`, `cofins`, `cofinsSt`, `icmsUfDest`, `is`, `ibsCbs`.
- `InformacoesAdicionais`: Informações adicionais (grupo Z). Membros: `infAdFisco`, `infCpl`, `obsCont`, `obsFisco`, `procRef`.
- `Inutilizacao`: Inutilização homologada (cStat 102). Membros: `nProt`, `dhRecbto`, `retInutNFe`, `procInutNFe`.
- `InutilizacaoPedido`: Membros: `ano`, `serie`, `nNFIni`, `nNFFin`, `xJust`, `mod`, `autor`.
- `IpiNaoTributado`: IPI não tributado (O08). Membros: `CST`.
- `Issqn`: ISSQN (grupo U), NF-e conjugada. `vISSQN` padrão `vBC × vAliq / 100`. Membros: `vBC`, `vAliq`, `vISSQN`, `cMunFG`, `cListServ`, `vDeducao`, `vOutro`, `vDescIncond`, `vDescCond`, `vISSRet`, `indISS`, `cServico`, `cMun`, `cPais`, `nProcesso`, `indIncentivo`.
- `Item`: Item da nota (grupo H). Membros: `produto`, `impostos`, `impostoDevol`, `infAdProd`, `obsItem`, `DFeReferenciado`.
- `ManifestacaoPedido`: Membros: `chave`, `tipo`, `xJust`, `autor`.
- `MontarNfeOpcoes`: Membros: `ambiente`, `tempo`, `ibsCbs`, `deslocamentoMin`, `verProc`, `arredondamento`, `respTec`, `exigencias`, `aleatorio`, `pagamentoIgualTotal`, `qrCode`, `urlQrCode`, `urlChave`.
- `NfceSupl`: O que a montagem deixa pronto para o `infNFeSupl` da NFC-e. Membros: `versao`, `urlChave`, `base`, `parametros`, `assinar`.
- `NfeMontada`: Membros: `chave`, `id`, `cNF`, `cDV`, `mod`, `tpEmis`, `dhEmi`, `nfce`, `pl`, `infNFe`, `xml`.
- `Pagamento`: Pagamento (grupo YA). Ausente, o builder informa `tPag` 90 (sem pagamento) com valor zero. Membros: `detPag`, `vTroco`.
- `PedidoIbsCbsItem`: Um item classificado, com os valores que a calculadora pode precisar para a base do IBS/CBS. Membros: `nItem`, `CST`, `cClassTrib`, `indDoacao`, `cCredPres`, `gTribRegular`, `vBC`, `NCM`, `CFOP`, `uTrib`, `qTrib`, `vProd`, `vDesc`, `vFrete`, `vSeg`, `vOutro`, `vICMS`, `vICMSST`, `vFCP`, `vFCPST`, `vIPI`, `vPIS`, `vCOFINS`, `vII`, `vISSQN`, `vICMSUFDest`, `vFCPUFDest`.
- `PedidoIbsCbsNota`: Dados da nota que decidem a regra aplicável (local da operação, vigência, compra governamental). Membros: `fatoGerador`, `emissao`, `ambiente`, `mod`, `tpNF`, `finNFe`, `tpNFDebito`, `tpNFCredito`, `indFinal`, `indPres`, `emitente`, `destino`, `cMunFGIBS`, `compraGov`.
- `PoliticaRecibo` (estende `ConsultaReciboOpcoes`): Política de consulta do recibo (autorização assíncrona). Membros: `maxTentativas`, `esperaMinimaMs`, `multiplicador`, `esperaMaximaMs`.
- `Produto`: Produto ou serviço do item (grupo I). Membros: `cProd`, `cEAN`, `cBarra`, `xProd`, `NCM`, `NVE`, `CEST`, `indEscala`, `CNPJFab`, `cBenef`, `gCred`, `tpCredPresIBSZFM`, `EXTIPI`, `CFOP`, `uCom`, `qCom`, `vUnCom`, `vProd`, `cEANTrib`, `cBarraTrib`, `uTrib`, `qTrib`, `vUnTrib`, `vFrete`, `vSeg`, `vDesc`, `vOutro`, `indTot`, `indBemMovelUsado`, `DI`, `detExport`, `xPed`, `nItemPed`, `nFCI`, `rastro`, `infProdNFF`, `infProdEmb`, `especifico`.
- `ProtocoloNfe`: Protocolo de uma NF-e (autorização ou denegação). Membros: `chNFe`, `cStat`, `xMotivo`, `nProt`, `dhRecbto`, `digVal`, `verAplic`, `protNFe`, `nfeProc`.
- `ResponsavelTecnico`: Responsável técnico (grupo ZD, NT 2018.005). O `hashCSRT` é calculado pelo builder a partir do CSRT (nunca vai para o XML): Base64(SHA-1(CSRT + chave de acesso)). Membros: `CNPJ`, `xContato`, `email`, `fone`, `csrt`.
- `RespostaIbsCbs`: Resultado da calculadora: o grupo `IBSCBS` de cada item pedido, já na forma lexical do leiaute. Membros: `itens`, `ocorrencias`.
- `StatusServico`: Status do serviço (cStat 107). Membros: `cUF`, `verAplic`, `dhRecbto`, `tMed`, `dhRetorno`, `xObs`.
- `StatusServicoOpcoes` (estende `EnvioOpcoes`): Opções do status do serviço. Membros: `mod`.
- `Transportador`: Membros: `CNPJ`, `CPF`, `xNome`, `IE`, `xEnder`, `xMun`, `UF`.
- `Transporte`: Transporte (grupo X). Membros: `modFrete`, `transportador`, `retTransp`, `veicTransp`, `reboque`, `vagao`, `balsa`, `volumes`.
- `Volume`: Membros: `qVol`, `esp`, `marca`, `nVol`, `pesoL`, `pesoB`, `lacres`.

### Tipos

- `AutorDocumento`: CNPJ ou CPF de quem assina um evento ou consulta a distribuição. `type AutorDocumento = { readonly CNPJ: string; readonly CPF?: never; } | { readonly CPF: string; readonly CNPJ?: never; }`
- `CadastroPedido`: `type CadastroPedido = { readonly uf: Uf; } & ({ readonly CNPJ: string; } | { readonly CPF: string; } | { readonly IE: string; })`
- `CodigoOcorrenciaNfe`: `type CodigoOcorrenciaNfe = (typeof CODIGOS_OCORRENCIA_NFE)[number]`
- `ConteudoDoProtocolo`: O que o `digVal` do protocolo diz dos bytes assinados: `confere` (é o DigestValue deles), `sem-digval` (o protocolo não o traz) ou `difere` (a SEFAZ registrou outro conteúdo com a mesma chave). `type ConteudoDoProtocolo = 'confere' | 'sem-digval' | 'difere'`
- `Crt`: Código de Regime Tributário (C21): 1 Simples Nacional; 2 Simples com excesso de sublimite; 3 Regime Normal; 4 MEI. `type Crt = '1' | '2' | '3' | '4'`
- `CstPisCofinsOutras`: CSTs de PIS/COFINS do grupo "outras operações" (Q05, S05). `type CstPisCofinsOutras = '49' | '50' | '51' | '52' | '53' | '54' | '55' | '56' | '60' | '61' | '62' | '63' | '64' | '65' | '66' | '67' | '70' | '71' | '72' | '73' | '74' | '75' | '98' | '99'`
- `DecimalInput`: O que as APIs de entrada aceitam como número. Prefira `string` (`'12.34'`): `number` perde dígitos acima de 15 algarismos. `type DecimalInput = string | number | bigint | Decimal`
- `Destinatario`: Destinatário (grupo E). No exterior, `idEstrangeiro` no lugar do CNPJ/CPF.
- `DistribuicaoConsulta`: `type DistribuicaoConsulta = { readonly ultNSU: string | number; } | { readonly NSU: string | number; } | { readonly chNFe: string; }`
- `DocumentoPessoa`: CNPJ (numérico ou alfanumérico) ou CPF, exclusivos. Aceitam máscara; o builder normaliza. `type DocumentoPessoa = { readonly CNPJ: string; readonly CPF?: never; } | { readonly CPF: string; readonly CNPJ?: never; }`
- `Emitente`: Emitente (grupo C). Produtor rural pessoa física emite com CPF, nas séries 920 a 969.
- `Espera`: Espera injetável (testes passam uma que não dorme). `type Espera = (ms: number, signal?: AbortSignal) => Promise<void>`
- `ExigenciaRespTec`: `type ExigenciaRespTec = 'obrigatorio' | 'opcional'`
- `Familia`: Famílias de campo com modo de arredondamento próprio (`data/arredondamento.json`). `type Familia = 'produto' | 'icms' | 'ipi' | 'pisCofins' | 'issqn' | 'ibsCbs'`
- `FinNFe`: Finalidade (B25): 1 normal; 2 complementar; 3 ajuste; 4 devolução; 5 nota de crédito; 6 nota de débito. `type FinNFe = '1' | '2' | '3' | '4' | '5' | '6'`
- `GrupoIbsCbs`: Grupo `IBSCBS` do item, como o `@sinete/nfe` o recebe. `type GrupoIbsCbs = RespostaIbsCbs['itens'][number]['IBSCBS']`
- `IbsCbsItem`: IBS/CBS do item: pela classificação (a calculadora injetada devolve o grupo) ou já calculado (grupo do schema pronto, por exemplo vindo de outro sistema). `type IbsCbsItem = { readonly classificacao: ClassificacaoIbsCbs; readonly grupo?: never; } | { readonly grupo: TTribNFe; readonly classificacao?: never; }`
- `Icms`: Tributação do ICMS do item: um grupo por CST (regime normal) ou CSOSN (Simples Nacional). `type Icms = Icms00 | Icms02 | Icms10 | Icms15 | Icms20 | Icms30 | Icms40 | Icms51 | Icms53 | Icms60 | Icms61 | Icms70 | Icms90 | IcmsPartilha | IcmsRepasseSt | IcmsSn101 | IcmsSn102 | IcmsSn201 | IcmsSn202 | IcmsSn500 | IcmsSn900`
- `IndIEDest`: Indicador da IE do destinatário (E16a): 1 contribuinte do ICMS; 2 contribuinte isento de inscrição (não informar a IE); 9 não contribuinte. `type IndIEDest = '1' | '2' | '9'`
- `Instante`: Instante no tempo, como os relógios do `@sinete/core` o devolvem (o tipo `Date`, sem tocar no global). `type Instante = ReturnType<Relogio['agora']>`
- `Ipi`: `type Ipi = (IpiTributado | IpiNaoTributado) & { /** Código de enquadramento legal; `999` quando não há. */ readonly cEnq: string; readonly CNPJProd?: string; readonly cSelo?: string; readonly qSelo?: string; }`
- `IpiTributado`: IPI tributado (O07): por alíquota (`vBC` padrão valor da operação) ou por unidade (`qUnid × vUnid`).
- `Local`: Local de retirada ou de entrega (grupos F e G), quando diferente do endereço do emitente ou destinatário. `type Local = DocumentoPessoa & Endereco & { readonly xNome?: string; readonly email?: string; readonly IE?: string; }`
- `ManifestacaoTipo`: `type ManifestacaoTipo = 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao-realizada'`
- `ModBC`: Modalidade da BC do ICMS (N13): 0 MVA; 1 pauta; 2 preço tabelado máximo; 3 valor da operação. `type ModBC = '0' | '1' | '2' | '3'`
- `ModBCST`: Modalidade da BC do ICMS ST (N18): 0 preço tabelado; 1 lista negativa; 2 positiva; 3 neutra; 4 MVA; 5 pauta; 6 valor da operação. `type ModBCST = '0' | '1' | '2' | '3' | '4' | '5' | '6'`
- `ModFrete`: Modalidade do frete (X02): 0 CIF; 1 FOB; 2 terceiros; 3 próprio do remetente; 4 próprio do destinatário; 9 sem frete. `type ModFrete = '0' | '1' | '2' | '3' | '4' | '9'`
- `Origem`: Origem da mercadoria (N11, `Torig`): 0 nacional; 1 e 2 estrangeira; 3 a 8 conforme conteúdo de importação. `type Origem = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'`
- `PisCofins`: PIS ou COFINS (grupos Q e S), com a mesma forma. `vBC` é obrigatório: a base legal varia (exclusão do ICMS, receita bruta, regime) e não há padrão seguro. O valor (`valor`) padrão é `vBC × aliquota / 100` ou `qBCProd × vAliqProd`.
- `PisCofinsSt`: PIS ou COFINS ST (grupos R e T). `indSoma` 1: o valor compõe o total da nota.
- `ProdutoEspecifico`: Grupo específico do produto (choice do grupo I): no máximo um. Repassado como veio.
- `QrCodeNfceOpcoes`: Versão do QR Code da NFC-e.
- `RecuperacaoEvento`: Resultado da recuperação: o evento registrado, com a consulta que o prova, ou só a consulta. `type RecuperacaoEvento = { readonly registrado: true; readonly evento: EventoRegistrado; readonly consulta: ResultadoConsulta; } | { readonly registrado: false; readonly consulta: ResultadoConsulta; }`
- `Referenciada`: Documento referenciado no nível da nota (grupo BA).
- `RefNfp`: NF de produtor em papel (modelo 04) ou avulsa (01) referenciada (BA10). O modelo 04 foi extinto pelo Ajuste SINIEF 10/2022; o builder só aceita a referência a notas emitidas antes do fim da vigência (`data/produtor-rural.json`).
- `ResolucaoEnvio`: O que fazer com uma NF-e cujo envio ficou sem resposta ou voltou como duplicidade. `type ResolucaoEnvio = /** * A chave está decidida: autorizada (ou cancelada) com o mesmo conteúdo, e `resultado` traz o protocolo e o `nfeProc``
- `ResultadoAutorizacao`: Desfecho da autorização: autorizada, denegada (número consumido), rejeitada ou pendente (recibo em `referencia`). `type ResultadoAutorizacao = ResultadoSefaz<ProtocoloNfe, ProtocoloNfe>`
- `ResultadoConsulta`: `type ResultadoConsulta = ResultadoSefaz<ConsultaNfe, ConsultaNfe>`
- `ResultadoEvento`: `type ResultadoEvento = ResultadoSefaz<EventoRegistrado, never>`
- `ResultadoInutilizacao`: `type ResultadoInutilizacao = ResultadoSefaz<Inutilizacao, never>`
- `ResultadoMontagemNfe`: `type ResultadoMontagemNfe = { readonly ok: true; readonly valor: NfeMontada; } | { readonly ok: false; readonly ocorrencias: readonly Ocorrencia[]; }`
- `RoundingMode`: Decimal exato para os valores da NF-e. Nada de `number` nas contas: um valor é `coef × 10^-scale` com `coef` em `bigint`, então soma, subtração e multiplicação são exatas e só o arredondamento, feito de propósito e com o modo escolhido, descarta dígitos. `type RoundingMode = 'HALF_EVEN' | 'HALF_UP' | 'DOWN'`
- `TCIBS_NFe`: reexportado de `@sinete/schemas/nfe/PL_010f` (veja a referência dele).
- `TMonofasia`: reexportado de `@sinete/schemas/nfe/PL_010f` (veja a referência dele).
- `TTribNFe`: reexportado de `@sinete/schemas/nfe/PL_010f` (veja a referência dele).

### Constantes

- `CODIGOS_OCORRENCIA_NFE`: `CODIGOS_OCORRENCIA_NFE: readonly ['campo_obrigatorio', 'campo_invalido', 'campo_fora_do_pl', 'decimal_invalido', 'valor_divergente', 'combinacao_invalida', 'modelo_nao_suportado', 'serie_invalida', 'documento_invalido', 'ie_invalida', 'cha…`
- `MotivoDesoneracaoIcms`: Motivo da desoneração do ICMS (N28), com os nomes das tabelas do leiaute. Cada CST aceita um subconjunto (o tipo de cada grupo restringe): CST 20 e 70 e 90: 3, 9, 10, 11, 12 (20) ou 3, 9, 12; CST 30: 6, 7, 9; CST 40/41/50: 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 90; partilha: 9, 10, 11. `MotivoDesoneracaoIcms: { readonly TAXI: '1'; readonly AGROPECUARIA: '3'; readonly FROTISTA_LOCADORA: '4'; readonly DIPLOMATICO_CONSULAR: '5'; readonly UTILITARIOS_MOTOCICLETAS_AMAZONIA_ALC: '6'; readonly SUFRAMA: '7'; readonly VENDA_ORGAO_…` `type MotivoDesoneracaoIcms = (typeof MotivoDesoneracaoIcms)[keyof typeof MotivoDesoneracaoIcms]`
- `NFCE_LIMITE_SEM_DESTINATARIO`: Valor da NFC-e acima do qual o destinatário tem de ser identificado (MOC 7.0 Anexo I, RV W16-40, rejeição 750). `NFCE_LIMITE_SEM_DESTINATARIO = "10000.00"`
- `NFE_NS`: `NFE_NS = "http://www.portalfiscal.inf.br/nfe"`
- `TipoPagamento`: Meio de pagamento (YA02, NT 2020.006 e seguintes). `TipoPagamento: { readonly DINHEIRO: '01'; readonly CHEQUE: '02'; readonly CARTAO_CREDITO: '03'; readonly CARTAO_DEBITO: '04'; readonly CREDITO_LOJA: '05'; readonly VALE_ALIMENTACAO: '10'; readonly VALE_REFEICAO: '11'; readonly VALE_PRESENT…` `type TipoPagamento = (typeof TipoPagamento)[keyof typeof TipoPagamento]`
- `XNOME_HOMOLOGACAO`: Literal do nome do destinatário em homologação (MOC 7.0 Anexo I, RV E04-20, rejeição 598). `XNOME_HOMOLOGACAO = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"`
- `XPROD_HOMOLOGACAO_NFCE`: Literal da descrição do primeiro item da NFC-e em homologação (MOC 7.0 Anexo I, RV I04-10, rejeição 373). `XPROD_HOMOLOGACAO_NFCE = "NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"`

## `@sinete/nfe/ibs-cbs`

`@sinete/nfe/ibs-cbs`: tudo o que quem emite NF-e precisa do IBS/CBS, sem importar `@sinete/ibs-cbs` nem `@sinete/ibs-cbs-dados` diretamente.

Reexporta o motor inteiro (`@sinete/ibs-cbs`: alíquotas, cálculo, regras da NT 2025.002 e determinação de CST e cClassTrib) e o leitor do dataset (`@sinete/ibs-cbs-dados`: `carregarDataset`, `conferirDataset`, diff, tipos). O dataset embarcado não entra aqui, para não ir para o bundle de quem não o usa: `carregarDatasetEmbarcado()`, na raiz do `@sinete/nfe`, o importa sob demanda. `Dec`, `DataIso` e `Vigencia` vêm do motor (os de `Dec` e `DataIso` são os mesmos; a `Vigencia` dos dados, com os campos do dataset, fica acessível pelos tipos que a usam).

Experimental (ADR 0016, seção 5) até o `@sinete/ibs-cbs` sair 1.0: a calculadora espera a norma da base de cálculo (NT 2025.002, UB16-10), e este subpath pode mudar em minor, sempre com changeset.

@experimental

Reexporta tudo de `@sinete/ibs-cbs` (veja a referência dele).

### Tipos

- `AliquotasCredPres`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `aplicabilidade`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `Aplicabilidade`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `BaseLegal`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `BaseLegalClassTrib`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `BundleDoDataset`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `CalculoCredPres`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `carregarDataset`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `CodigoErroDadosIbsCbs`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `compararDatasets`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `conferirDataset`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `ConteudoTributario`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `CreditoClassTrib`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `CredPresVigente`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `dataCivil`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `DatasetIbsCbs`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `DESLOCAMENTO_BRASILIA_MIN`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `DiferencaDeDatasets`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `DiferencaDeTabela`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `ehDataIso`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `ErroDadosIbsCbs`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `ExcecaoDePrefixo`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `exigirDataIso`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `ExpressoesDoTratamento`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `Familia`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `FiltroClassTrib`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `FiltroDeAtores`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `FonteDoDataset`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `formatarDiferenca`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `GruposClassTrib`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `GruposCredPres`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `GruposCst`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `IdDaFonte`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `Indicador`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `IndicadoresDoTratamento`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `jsonCanonico`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `ManifestoDaTabela`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `ManifestoDoDataset`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `MudancaDeCampo`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `MudancaDeRegistro`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `NomeDaTabela`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `Nomenclatura`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `NOMES_DAS_TABELAS`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `PapelDoAtor`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `PorTributo`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroAliquotaFixa`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroAnexo`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroAplicabilidade`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroAtor`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroAtorClassTrib`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroClassTrib`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroCredPres`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroCst`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroGrupoDeAtores`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroNfseNbs`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroReducao`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroRedutorCompraGov`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroTipoDfe`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroTransferenciaCbs`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `RegistroTratamento`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `ResultadoAplicabilidade`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `tabelaCanonica`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `TabelasDoDataset`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `TipoDeAliquota`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `tipoDeMudanca`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `TipoDeMudanca`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `Tributo`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `VERSAO_DO_FORMATO_DOS_DADOS`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `versaoDoConteudo`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `vigente`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `VinculoDfe`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
- `VinculoTratamento`: reexportado de `@sinete/ibs-cbs-dados` (veja a referência dele).
