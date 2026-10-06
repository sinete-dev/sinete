# Referência: `@sinete/mdfe`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/mdfe/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/mdfe/x` é `sinete/mdfe/x`.

## `@sinete/mdfe`

`@sinete/mdfe`: MDF-e modelo 58, leiaute 3.00b, modal rodoviário.

- `montarMdfe`: entrada do domínio (`DadosMdfe`) para o `<MDFe>` canônico validado contra o schema vigente, com a chave de acesso, os derivados em decimal exato e as regras do MOC conferidas antes de serializar. - `assinarMdfe`: QR Code (com `sign` em contingência off-line) e assinatura por splice; a string devolvida é a final. - `criarClienteMdfe`: status, autorização síncrona, consulta, não encerrados e eventos (cancelamento, encerramento, inclusão de condutor e de DF-e, pagamento da operação), com os desfechos como `ResultadoSefaz` do core. - O emissor (bytes gravados antes do envio, trava, retomada, cancelamento com recuperação) está em `@sinete/emissor/mdfe` (ADR 0010). - Percurso por divisas (`conferirPercurso`, `sugerirPercurso`) e o resolvedor de envio sem resposta.

### Funções

- `assinarMdfe`: Assina o MDF-e montado: QR Code (com `sign` em contingência) e `Signature` como último filho de `MDFe`, ambos por splice, e devolve a string final. É essa string que vai para a SEFAZ e para o banco. `assinarMdfe(manifesto: MdfeMontado, assinador: Assinador): Promise<string>`
- `assinaturaQrCode`: `sign` do QR Code: RSA PKCS#1 v1.5 com SHA-1 sobre os 44 caracteres da chave, com o certificado que assina o MDF-e. `assinaturaQrCode(chave: string, assinador: Assinador): Promise<string>`
- `chaveDaDuplicidade`: Chave que a SEFAZ informa no `xMotivo` da rejeição 539 (`[chMDFe: ...]`), se houver. `chaveDaDuplicidade(xMotivo: string): string | undefined`
- `comprimirGzipBase64`: Texto UTF-8 para GZip em Base64. `comprimirGzipBase64(texto: string): Promise<string>`
- `comQrCode`: O MDF-e montado com o `infMDFeSupl` (QR Code) inserido por splice antes do fechamento de `MDFe`, pronto para a assinatura. `comQrCode(manifesto: MdfeMontado, assinatura?: string): string`
- `conferirPercurso`: Confere o percurso. Um trecho que envolve `EX` não é conferido (a divisa com o exterior não está na tabela). UF repetida em seguida é recusada: a UF de percurso é a atravessada entre as outras duas. `conferirPercurso(ufIni: UfMdfe, percurso: readonly UfMdfe[], ufFim: UfMdfe): TrechoInvalido | undefined`
- `criarClienteMdfe`: Cria o cliente dos serviços do MDF-e. `criarClienteMdfe(opcoesDoCliente: ClienteMdfeOpcoes): ClienteMdfe`
- `cstatEm`: O `cStat` pertence à classe da tabela. `cstatEm(cStat: string, classe: CStatClasse): boolean`
- `dec`: Atalho para `Decimal.of`. `dec(valor: DecimalInput): Decimal`
- `descomprimirGzipBase64`: Base64 de um GZip para o texto UTF-8 de dentro. `limiteBytes` para a leitura assim que o conteúdo descompactado passa do limite (`ErroRespostaInvalida`), para GZip de origem não confiável. `descomprimirGzipBase64(b64: string, limiteBytes?: number): Promise<string>`
- `deslocamentoDaUf`: Deslocamento do horário legal da UF em minutos (`-180` para Brasília). `deslocamentoDaUf(uf: Uf): number`
- `documentoAssinado`: Confere que `xml` é um documento `raiz` assinado (no namespace do MDF-e, com `Signature` referenciando o filho `elemento`) e devolve a string sem a declaração XML. Lança `ErroDeConfiguracao` para qualquer outra coisa: o serviço nunca "conserta" o documento de quem chama. `documentoAssinado(xml: string, raiz: string, elemento: string): DocumentoAssinado`
- `mdfeAssinadoDoProc`: MDF-e assinado de dentro de um `mdfeProc` (ou o próprio MDF-e assinado), como fatia do texto e sem a declaração XML, pronto para `consultar`, `resolverEnvioSemResposta` e a retomada, que recusam raiz sem `xmlns` próprio. `mdfeAssinadoDoProc(xml: string): string`
- `montarMdfe`: Monta o MDF-e. Devolve as ocorrências (todas de uma vez) em vez do documento quando alguma regra falha; a exceção fica para erro de configuração (vigência sem schema conhecido, UF inválida no relógio). `montarMdfe(entrada: DadosMdfe, opcoes: MontarMdfeOpcoes): Promise<ResultadoMontagemMdfe>`
- `pagamentosDoLeiaute`: Grupos `infPag` do leiaute a partir dos pagamentos do domínio, com as regras de pagamento do Anexo I (F52, F53, F56 a F63). `pagamentosDoLeiaute(pagamentos: readonly PagamentoFrete[], dataReferencia: string, caminho?: string): { readonly infPag: readonly Record<string, unknown>[]; readonly ocorrencias: readonly Ocorrencia[]; }`
- `prazoContingencia`: Prazo para transmitir um MDF-e emitido em contingência off-line: 168 horas depois da emissão (Visão Geral, 11.1). `prazoContingencia(emitidoEm: Instante): Instante`
- `qrCodeMdfe`: URL do QR Code (`qrCodMDFe`): endereço do portal, `chMDFe` e `tpAmb`; em contingência off-line, também `sign`, a assinatura RSA-SHA1 da chave em Base64 (MOC Visão Geral, item 9.2). `qrCodeMdfe(chave: string, tpAmb: '1' | '2', assinatura?: string): string`
- `recortarElemento`: Recorta o elemento da fonte, acrescentando na tag de abertura só as declarações de namespace que ele usa e que estão em ancestrais fora do recorte. O default entra apenas quando difere de `nsPadraoDoPai` (o default do envelope onde a fatia vai morar). `recortarElemento(documento: DocumentoXml, el: ElementoXml, nsPadraoDoPai?: string): string`
- `recuperarEventoRegistrado`: Consulta a chave e devolve o evento `tpEvento` que a SEFAZ registrou para ela (o de maior `nSeqEvento`, quando há vários, como na inclusão de condutor). `recuperarEventoRegistrado(cliente: ClienteMdfe, chave: string, tpEvento: string, opcoes?: EnvioOpcoes): Promise<RecuperacaoEvento>`
- `resolverEnvioSemResposta`: Resolve uma autorização sem resposta, ou cuja resposta foi 204 ou 539, consultando a chave do MDF-e assinado. `anterior` é o desfecho do envio, quando houve um. `opcoes.signal` cancela a consulta (lança o `ErroTransporte` com `code: 'cancelado'`). `resolverEnvioSemResposta(cliente: ClienteMdfe, mdfeAssinado: string, anterior?: ResultadoAutorizacao, opcoes?: EnvioOpcoes): Promise<ResolucaoEnvio>`
- `rotuloDoCaminho`: Rótulo em português do caminho de uma ocorrência do MDF-e: `Grupo, Campo` quando os dois são conhecidos (`Condutor 1, CPF`), só um deles quando falta o outro, e `Dados do MDF-e` quando nenhum é. `rotuloDoCaminho(caminho: string): string`
- `saoVizinhas`: As duas UFs fazem divisa terrestre. `saoVizinhas(a: string, b: string): boolean`
- `sugerirPercurso`: Um percurso mínimo (menos UFs atravessadas) entre duas UFs, por busca em largura na tabela de divisas; `[]` para UFs vizinhas ou iguais. Serve de sugestão: a UF de percurso é a da rota real, que pode não ser a mais curta. `sugerirPercurso(ufIni: Uf, ufFim: Uf): Uf[] | undefined`
- `sum`: Soma uma lista (vazia = zero). `sum(valores: Iterable<Decimal>): Decimal`

### Classes

- `Decimal`: Valor decimal imutável: `coef × 10^-scale`. Membros: `coef`, `scale`, `ZERO`, `of()`, `tryOf()`, `plus()`, `minus()`, `abs()`, `compare()`, `eq()`, `gt()`, `isZero()`, `isNegative()`, `significantScale()`, `intDigits()`, `toFixed()`, `toString()`, `toJSON()`.

### Interfaces

- `Aereo`: Grupo do modal aéreo (`aereo`, MOC 3.00b Anexo I, 3.2). Membros: `nac`, `matr`, `nVoo`, `cAerEmb`, `cAerDes`, `dVoo`.
- `CamposMdfe`: Campos do MDF-e comuns a todos os modais. Membros: `tpEmit`, `tpTransp`, `serie`, `nMDF`, `cMDF`, `emitente`, `ufIni`, `ufFim`, `carregamento`, `percurso`, `dhIniViagem`, `indCanalVerde`, `indCarregaPosterior`, `descarregamentos`, `seguros`, `produtoPredominante`, `totais`, `lacres`, `autXML`, `informacoesAdicionais`, `respTec`.
- `CancelamentoPedido`: Membros: `chave`, `nProt`, `xJust`.
- `ClienteMdfe`: Membros: `opcoes`, `statusServico()`, `autorizar()`, `consultar()`, `consultarNaoEncerrados()`, `cancelar()`, `encerrar()`, `incluirCondutor()`, `incluirDFe()`, `pagamentoOperacao()`.
- `ClienteMdfeOpcoes`: Membros: `transporte`, `assinador`, `ambiente`, `relogio`, `logger`, `timeoutMs`, `deslocamentoMin`, `autor`, `endpoint`.
- `ComponentePagamento`: Componente do pagamento: 01 vale-pedágio; 02 impostos; 03 despesas; 04 frete; 99 outros. Membros: `tpComp`, `vComp`, `xComp`.
- `Condutor`: Membros: `xNome`, `CPF`.
- `ConsultaMdfe`: Situação do MDF-e na consulta: autorizado (100), cancelado (101) ou encerrado (132). Membros: `chMDFe`, `situacao`, `protocolo`, `eventos`, `digValConfere`.
- `CteTransportado` (estende `DocumentoTransportado`): CT-e transportado; a entrega parcial (corte de voo) só vale no modal aéreo (F34, 702). Membros: `entregaParcial`.
- `DadosMdfeAereo` (estende `CamposMdfe`): MDF-e do modal aéreo (`modal` 2). Membros: `aereo`, `rodoviario`, `ferroviario`.
- `DadosMdfeFerroviario` (estende `CamposMdfe`): MDF-e do modal ferroviário (`modal` 4). Membros: `ferroviario`, `rodoviario`, `aereo`.
- `DadosMdfeRodoviario` (estende `CamposMdfe`): MDF-e do modal rodoviário (`modal` 1). Membros: `rodoviario`, `aereo`, `ferroviario`.
- `Descarregamento`: Município de descarregamento com os documentos que descarregam nele (`infMunDescarga`). Membros: `cMun`, `xMun`, `nfe`, `cte`.
- `DispositivoValePedagio`: Dispositivo de vale-pedágio (`valePed/disp`). Membros: `CNPJForn`, `responsavel`, `nCompra`, `vValePed`, `tpValePed`.
- `DocumentoAssinado`: Documento assinado já conferido: a string como veio (sem a declaração XML) e o que se lê dela. Membros: `xml`, `id`, `digestValue`, `documento`.
- `EncerramentoPedido`: Membros: `chave`, `nProt`, `dtEnc`, `uf`, `cMun`, `terceiro`.
- `EnderecoEmitente`: Endereço do emitente (`TEndeEmi`). Membros: `xLgr`, `nro`, `xCpl`, `xBairro`, `cMun`, `xMun`, `CEP`, `UF`, `fone`, `email`.
- `EnvioOpcoes`: Opções de toda chamada que vai à rede. Membros: `signal`.
- `EventoRegistrado`: Evento registrado (135; 134 e 136 quando a vinculação ao MDF-e tem ressalva). Membros: `chMDFe`, `tpEvento`, `nSeqEvento`, `nProt`, `dhRegEvento`, `xEvento`, `retEventoMDFe`, `procEventoMDFe`.
- `Ferroviario`: Grupo do modal ferroviário (`ferrov`, MOC 3.00b Anexo I, 3.3). `qVag` sai da contagem de `vagoes`. Membros: `trem`, `vagoes`.
- `FormatoDecimal`: Formato de um campo decimal do leiaute: dígitos inteiros e casas (ADR 0002: as casas vêm do pattern do XSD). Membros: `nome`, `digitosInteiros`, `casas`, `naoNulo`.
- `InclusaoCondutorPedido`: Membros: `chave`, `nSeqEvento`, `condutor`.
- `InclusaoDfePedido`: Membros: `chave`, `nProt`, `nSeqEvento`, `carregamento`, `documentos`.
- `MdfeMontado`: Membros: `chave`, `id`, `cMDF`, `cDV`, `tpEmis`, `tpAmb`, `dhEmi`, `schema`, `infMDFe`, `xml`.
- `MdfeNaoEncerrado`: MDF-e autorizado e ainda não encerrado do emitente. Membros: `chMDFe`, `nProt`.
- `MontarMdfeOpcoes`: Membros: `ambiente`, `tempo`, `deslocamentoMin`, `verProc`, `tpEmis`, `respTec`, `aleatorio`.
- `MunicipioCarregamento`: Membros: `cMun`, `xMun`.
- `PagamentoOperacaoPedido`: Membros: `chave`, `nProt`, `nSeqEvento`, `qtdViagens`, `nroViagem`, `pagamentos`.
- `ParcelaPagamento`: Membros: `dVenc`, `vParcela`.
- `ProdutoPerigoso`: Produto perigoso transportado (`peri`). Membros: `nONU`, `xNomeAE`, `xClaRisco`, `grEmb`, `qTotProd`, `qVolTipo`.
- `ProdutoPredominante`: Produto predominante (`prodPred`): o de maior valor. Na carga lotação (um único DF-e), `lotacao` leva os locais de carregamento e descarregamento (grupo `infLotacao`, dentro de `prodPred`). Membros: `tpCarga`, `xProd`, `cEAN`, `NCM`, `lotacao`.
- `ProtocoloMdfe`: Protocolo de autorização de um MDF-e. Membros: `chMDFe`, `cStat`, `xMotivo`, `nProt`, `dhRecbto`, `digVal`, `verAplic`, `protMDFe`, `mdfeProc`.
- `ResponsavelTecnico`: Responsável técnico (`infRespTec`). Membros: `CNPJ`, `xContato`, `email`, `fone`, `csrt`.
- `Rodoviario`: Grupo do modal rodoviário (`rodo`). Membros: `RNTRC`, `ciot`, `valePedagio`, `contratantes`, `pagamentos`, `tracao`, `reboques`, `codAgPorto`, `lacres`.
- `Seguro`: Seguro da carga (`seg`). `respSeg` 1 emitente; 2 contratante (com o CNPJ ou CPF dele). Membros: `responsavel`, `seguradora`, `nApol`, `nAver`.
- `StatusServico`: Status do serviço (cStat 107). Membros: `cUF`, `verAplic`, `dhRecbto`, `tMed`, `dhRetorno`, `xObs`.
- `TotaisCarga`: Totais da carga. `qNFe` e `qCTe` saem dos documentos. Membros: `vCarga`, `cUnid`, `qCarga`.
- `TrechoInvalido`: Primeiro trecho do percurso que não é divisa, ou `undefined` quando o percurso é válido. Membros: `indice`, `de`, `para`.
- `Trem`: Composição do trem (`trem`). Membros: `xPref`, `dhTrem`, `xOri`, `xDest`.
- `Vagao`: Vagão da composição (`vag`). Membros: `pesoBC`, `pesoR`, `tpVag`, `serie`, `nVag`, `nSeq`, `TU`.
- `ValePedagio`: Membros: `dispositivos`, `categCombVeic`.
- `VeiculoReboque`: Veículo reboque (`veicReboque`, até 3). Membros: `cInt`, `placa`, `RENAVAM`, `tara`, `capKG`, `capM3`, `proprietario`, `tpCar`, `UF`.
- `VeiculoTracao`: Veículo de tração (`veicTracao`). Membros: `cInt`, `placa`, `RENAVAM`, `tara`, `capKG`, `capM3`, `proprietario`, `condutores`, `tpRod`, `tpCar`, `UF`.

### Tipos

- `AutorDocumento`: CNPJ ou CPF do emitente para a consulta dos não encerrados. `type AutorDocumento = { readonly CNPJ: string; readonly CPF?: never; } | { readonly CPF: string; readonly CNPJ?: never; }`
- `AutorizarOpcoes`: Opções do envio para autorização. `type AutorizarOpcoes = EnvioOpcoes`
- `Ciot`: CIOT (`infCIOT`): código e o CPF ou CNPJ do responsável pela geração. O código é opcional desde a NT 2025.001. `type Ciot = DocumentoPessoa & { readonly CIOT?: string; }`
- `CodigoOcorrenciaMdfe`: `type CodigoOcorrenciaMdfe = (typeof CODIGOS_OCORRENCIA_MDFE)[number]`
- `Contratante`: `type Contratante = DocumentoContratante & { readonly xNome?: string; readonly contrato?: { readonly NroContrato: string; readonly vContratoGlobal: DecimalInput; }; }`
- `CStatClasse`: `type CStatClasse = 'autorizado' | 'cancelado' | 'encerrado' | 'servicoEmOperacao' | 'naoEncerradosLocalizados' | 'naoEncerradosNenhum' | 'eventoRegistrado' | 'duplicidade' | 'duplicidadeChaveDiferente' | 'naoConsta'`
- `DadosBancarios`: Dados bancários do pagamento (`infBanc`): banco e agência, instituição de pagamento eletrônico ou PIX. `type DadosBancarios = { readonly codBanco: string; readonly codAgencia: string; } | { readonly CNPJIPEF: string; } | { readonly PIX: string; }`
- `DadosMdfe`: Entrada do `montarMdfe`: os campos comuns e o grupo de um modal, um e só um. `type DadosMdfe = DadosMdfeRodoviario | DadosMdfeAereo | DadosMdfeFerroviario`
- `DecimalInput`: O que as APIs de entrada aceitam como número. Prefira `string` (`'12.34'`): `number` perde dígitos acima de 15 algarismos. `type DecimalInput = string | number | bigint | Decimal`
- `DocumentoContratante`: CNPJ, CPF ou identificação de estrangeiro (contratante, responsável pelo pagamento). `type DocumentoContratante = DocumentoPessoa | { readonly idEstrangeiro: string; readonly CNPJ?: never; readonly CPF?: never; }`
- `DocumentoPessoa`: CNPJ (numérico ou alfanumérico) ou CPF, exclusivos. `type DocumentoPessoa = { readonly CNPJ: string; readonly CPF?: never; } | { readonly CPF: string; readonly CNPJ?: never; }`
- `Emitente`: Emitente (grupo `emit`). Pessoa física (produtor rural) emite com CPF, só como carga própria (`tpEmit` 2) e nas séries 920 a 969 (Anexo I, F70 e F71). `type Emitente = DocumentoPessoa & { /** Inscrição estadual, obrigatória fora do regime especial da NFF (F72, 229). */ readonly IE: string; readonly xNome: string; readonly xFant?: string; readonly endereco: EnderecoEmitente; }`
- `Instante`: Instante no tempo, como os relógios do `@sinete/core` o devolvem (o tipo `Date`, sem tocar no global). `type Instante = ReturnType<Relogio['agora']>`
- `LocalLotacao`: Local de carregamento ou descarregamento da carga lotação: CEP ou coordenadas (6 casas). `type LocalLotacao = { readonly CEP: string; } | { readonly latitude: string; readonly longitude: string; }`
- `MdfeServicoCliente`: Serviços do MDF-e que o cliente chama (a distribuição de DF-e do MDF-e fica fora deste pacote). `type MdfeServicoCliente = Exclude<MdfeServico, 'MDFeDistribuicaoDFe'>`
- `NfeTransportada`: `type NfeTransportada = DocumentoTransportado`
- `PagamentoFrete`: Pagamento do frete (`infPag`). `nParcela` sai da ordem das parcelas (001, 002...); `vContrato` omitido é a soma dos componentes, informado é conferido contra ela com tolerância de R$ 0,01 (F58, 746).
- `Proprietario`: Proprietário ou possuidor do veículo quando não é o emitente (`prop`).
- `RecuperacaoEvento`: Resultado da recuperação: o evento registrado, com a consulta que o prova, ou só a consulta. `type RecuperacaoEvento = { readonly registrado: true; readonly evento: EventoRegistrado; readonly consulta: ResultadoConsulta; } | { readonly registrado: false; readonly consulta: ResultadoConsulta; }`
- `ResolucaoEnvio`
- `ResultadoAutorizacao`: `type ResultadoAutorizacao = ResultadoSefaz<ProtocoloMdfe, never>`
- `ResultadoConsulta`: `type ResultadoConsulta = ResultadoSefaz<ConsultaMdfe, never>`
- `ResultadoEvento`: `type ResultadoEvento = ResultadoSefaz<EventoRegistrado, never>`
- `ResultadoMontagemMdfe`: `type ResultadoMontagemMdfe = { readonly ok: true; readonly valor: MdfeMontado; } | { readonly ok: false; readonly ocorrencias: readonly Ocorrencia[]; }`
- `TipoCarroceria`: Tipo de carroceria (`tpCar`): 00 não aplicável; 01 aberta; 02 fechada/baú; 03 granelera; 04 porta container; 05 sider. `type TipoCarroceria = '00' | '01' | '02' | '03' | '04' | '05'`
- `TipoRodado`: Tipo de rodado (`tpRod`): 01 truck; 02 toco; 03 cavalo mecânico; 04 VAN; 05 utilitário; 06 outros. `type TipoRodado = '01' | '02' | '03' | '04' | '05' | '06'`
- `TipoTransportador`: Tipo do transportador (`tpTransp`): 1 ETC (empresa); 2 TAC (autônomo); 3 CTC (cooperativa). `type TipoTransportador = '1' | '2' | '3'`
- `UfMdfe`: UF do leiaute do MDF-e (`TUf`): as 27 e `EX` (exterior). `type UfMdfe = Uf | 'EX'`

### Constantes

- `CODIGOS_OCORRENCIA_MDFE`: `CODIGOS_OCORRENCIA_MDFE: readonly ['campo_obrigatorio', 'campo_invalido', 'decimal_invalido', 'combinacao_invalida', 'serie_invalida', 'documento_invalido', 'ie_invalida', 'chave_invalida', 'municipio_uf_divergente', 'duplicado', 'percurso…`
- `MDFE_NS`: `MDFE_NS = "http://www.portalfiscal.inf.br/mdfe"`
- `TipoCarga`: Tipo de carga do produto predominante (`tpCarga`), com o 12 da NT 2025.001. `TipoCarga: { readonly GRANEL_SOLIDO: '01'; readonly GRANEL_LIQUIDO: '02'; readonly FRIGORIFICADA: '03'; readonly CONTEINERIZADA: '04'; readonly CARGA_GERAL: '05'; readonly NEOGRANEL: '06'; readonly PERIGOSA_GRANEL_SOLIDO: '07'; readonly PE…` `type TipoCarga = (typeof TipoCarga)[keyof typeof TipoCarga]`
- `TipoEmitente`: Tipo do emitente (`tpEmit`): 1 prestador de serviço de transporte (com CT-e); 2 transportador de carga própria (com NF-e; também o prestador que emite CT-e globalizado quando a operação é interna, por regra própria da UF); 3 prestador que emitirá CT-e globalizado. `TipoEmitente: { readonly PRESTADOR_SERVICO: '1'; readonly CARGA_PROPRIA: '2'; readonly CTE_GLOBALIZADO: '3'; }` `type TipoEmitente = (typeof TipoEmitente)[keyof typeof TipoEmitente]`
