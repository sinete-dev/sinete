# Referência: `@sinete/nfse`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/nfse/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/nfse/x` é `sinete/nfse/x`.

## `@sinete/nfse`

`@sinete/nfse`: NFS-e Nacional (Sefin Nacional e ADN), leiaute 1.01.

Entrada do domínio (`DadosDps`), montagem validada no XSD vigente (`montarDps`, que já inclui a declaração UTF-8 exigida pela Sefin), assinatura por splice (`assinarDps`), pedidos de evento (`montarPedidoCancelamento`) e o cliente REST com mTLS (`criarClienteNfse`): emissão síncrona, substituição, consultas, eventos e parâmetros municipais com cache. Rejeição é desfecho (`RejeicaoNfse`, com os códigos do Anexo I e II e o catálogo do `@sinete/rejeicoes/nfse`), não exceção. O emissor (DPS gravada antes do envio, trava, retomada) está em `@sinete/emissor/nfse` (ADR 0010), e o DANFSe sai do XML da NFS-e pelo `danfse` de `@sinete/da/nfse`.

### Funções

- `assinarDps`: Assina a DPS (enveloped, `Reference` para o `infDPS`). A string devolvida é a que vai para a Sefin e para o banco. `assinarDps(dps: DpsMontada, assinador: Assinador): Promise<string>`
- `assinarPedidoEvento`: Assina o pedido (Reference para o `infPedReg`). A string devolvida é a que vai para a Sefin. `assinarPedidoEvento(pedido: PedidoEventoMontado, assinador: Assinador): Promise<string>`
- `cacheEmMemoria`: Cache em memória com limite de entradas (sai a mais antiga). `cacheEmMemoria(maxEntradas?: number): CacheParametros`
- `codigoServicoParametrizacao`: Código de serviço da parametrização municipal do ADN: `01.01.01.000`, o `cTribNac` com pontos seguido do código de tributação municipal (`cTribMun`, 3 dígitos, `000` sem desdobro municipal). `codigoServicoParametrizacao(cTribNac: string, cTribMun?: string): string`
- `comprimirGzipBase64`: Texto (UTF-8) para gzip em base64. `comprimirGzipBase64(texto: string): Promise<string>`
- `criarClienteNfse`: Cria o cliente. Nada é enviado até a primeira operação. `criarClienteNfse(opcoesDoCliente: ClienteNfseOpcoes): ClienteNfse`
- `criarParametrosMunicipais`: Cliente da parametrização municipal. `criarClienteNfse` já cria um em `cliente.parametros`. `criarParametrosMunicipais(o: ParametrosOpcoes): ParametrosMunicipais`
- `cTribNacDps`: `cTribNac` na forma da DPS (6 dígitos), a partir de `010101` ou `01.01.01`. Lança `ErroDeConfiguracao` fora disso. `cTribNacDps(codigo: string): string`
- `descomprimirGzipBase64`: Gzip em base64 para o texto UTF-8 de dentro. Lança `ErroRespostaInvalida` se não for base64 de um gzip. `descomprimirGzipBase64(b64: string, campo?: string): Promise<string>`
- `formatarValor`: Converte para texto com `casas` casas decimais. Devolve `undefined` e acrescenta a ocorrência em `ocorrencias` quando o valor não tem representação exata. `formatarValor(valor: Valor, caminho: string, ocorrencias: Ocorrencia[], casas?: number): string | undefined`
- `idDps`: Id da DPS (`DPS` + 42 posições). `idDps(p: IdDpsPartes): string`
- `idPedidoEvento`: Id do pedido de registro de evento: `PRE` + chave + código do evento. `idPedidoEvento(chave: string, tpEvento: string): string`
- `inscricaoId`: Tipo de inscrição (1 CPF, 2 CNPJ) e inscrição com 14 posições, como entram no Id da DPS e na chave. `inscricaoId(documento: InscricaoFederal): { readonly tpInsc: '1' | '2'; readonly inscricao: string; }`
- `leiauteVigente`: O pacote de esquemas vigente no ambiente e no dia do relógio (fuso de Brasília). `leiauteVigente(ambiente: Ambiente, relogio: Relogio): { readonly vigencia: EntradaDeVigencia; readonly leiaute: LeiauteNfse; }`
- `lerChaveNfse`: Lê a chave de 50 posições. Lança `ErroDeConfiguracao` se a estrutura não bate; o DV não é conferido (ver o topo). `lerChaveNfse(chave: string): ChaveNfse`
- `montarDps`: Monta e valida a DPS. Nunca lança por dado de entrada: tudo o que impede a DPS vira `Ocorrencia` (formato, documento com DV errado, competência depois da emissão, schema). Lança `ErroDeConfiguracao` só por opção inválida. `montarDps(entrada: DadosDps, opcoes: MontarDpsOpcoes): Promise<ResultadoMontagemDps>`
- `montarPedidoAnaliseFiscal`: Pedido de análise fiscal para cancelamento (e101103). `montarPedidoAnaliseFiscal(p: AnaliseFiscalPedido, opcoes: PedidoEventoOpcoes): ResultadoPedidoEvento`
- `montarPedidoCancelamento`: Pedido de cancelamento da NFS-e (e101101). `montarPedidoCancelamento(p: CancelamentoPedido, opcoes: PedidoEventoOpcoes): ResultadoPedidoEvento`
- `recuperarEventoRegistrado`: Consulta os eventos da chave e devolve o evento `tpEvento`, na sequência `nSeqEvento` (o cancelamento, e101101, é sempre a 1), que a Sefin registrou para ela. `recuperarEventoRegistrado(cliente: ClienteNfse, chave: string, tpEvento: string, nSeqEvento?: number, opcoes?: EnvioOpcoes): Promise<RecuperacaoEvento>`
- `resolverEnvioSemResposta`: Depois de um envio sem resposta (timeout, conexão caída) ou recusado com E0014, descobre se a DPS gerou NFS-e: consulta pelo Id da DPS e, achando a chave, lê a NFS-e. `resolverEnvioSemResposta(cliente: ClienteNfse, dpsAssinada: string, anterior?: ResultadoNfse<NfseGerada>, opcoes?: EnvioOpcoes): Promise<ResolucaoEnvio>`
- `rotuloDoCaminho`: Rótulo em português do caminho de uma ocorrência da DPS: `Grupo, Campo` quando os dois são conhecidos (`Tomador, CNPJ`), só um deles quando falta o outro, e `Dados da DPS` quando nenhum é. `rotuloDoCaminho(caminho: string): string`

### Interfaces

- `AliquotaServico`: Uma alíquota vigente ou do histórico de um código de serviço. Membros: `incidencia`, `aliquota`, `inicio`, `fim`.
- `AnaliseFiscalPedido`: Solicitação de análise fiscal para cancelamento (e101103), quando o prazo de cancelamento do município passou. Membros: `chave`, `autor`, `cMotivo`, `xMotivo`.
- `CacheParametros`: Cache das consultas de parametrização. O padrão é `cacheEmMemoria()`; troque por um compartilhado entre processos. Membros: `obter()`, `gravar()`, `limpar()`.
- `CancelamentoPedido`: Cancelamento (e101101): 1 erro na emissão, 2 serviço não prestado, 9 outros; motivo com 15 a 255 caracteres. Membros: `chave`, `autor`, `cMotivo`, `xMotivo`.
- `ChaveNfse`: Partes da chave de acesso da NFS-e. Membros: `chave`, `cMun`, `ambGer`, `tpInsc`, `inscricao`, `nNFSe`, `anoMes`, `cNum`, `dv`.
- `ClassificacaoIbsCbs`: Classificação do IBS e da CBS do serviço (grupo `IBSCBS/valores/trib/gIBSCBS`). Membros: `CST`, `cClassTrib`, `cCredPres`, `tributacaoRegular`, `diferimento`.
- `ClienteNfse`: Membros: `opcoes`, `ambiente`, `autorizar()`, `substituir()`, `consultar()`, `consultarDps()`, `registrarEvento()`, `cancelar()`, `solicitarAnaliseFiscal()`, `consultarEventos()`, `parametros`.
- `ClienteNfseOpcoes`: Membros: `transporte`, `ambiente`, `relogio`, `assinador`, `logger`, `timeoutMs`, `cacheParametros`, `validadeParametrosMs`, `endpoint`, `verAplic`.
- `ConvenioMunicipal`: Convênio do município com o Sistema Nacional NFS-e. Membros: `aderenteAmbienteNacional`, `aderenteEmissorNacional`, `situacaoEmissaoPadraoContribuintesRFB`, `aderenteMAN`, `permiteAproveitamentoDeCreditos`, `bruto`.
- `DadosDps`: Membros: `serie`, `nDPS`, `dCompet`, `tpEmit`, `cMotivoEmisTI`, `chNFSeRej`, `cLocEmi`, `substituicao`, `prestador`, `tomador`, `intermediario`, `servico`, `valores`, `tributacao`, `ibsCbs`.
- `DpsMontada`: DPS montada e validada, pronta para assinar. Membros: `xml`, `id`, `ambiente`, `modulo`, `dhEmi`, `dCompet`.
- `EntradaCache`: Resposta crua guardada no cache. Membros: `status`, `corpo`, `expiraEm`.
- `EnvioOpcoes`: Membros: `signal`.
- `EventoRegistrado`: Evento registrado (`evento` do Anexo II), com o XML como veio. Membros: `xml`, `id`, `chaveAcesso`, `tpEvento`, `nSeqEvento`, `dhProc`.
- `FiltroEventos`: Tipo e sequência do evento procurado, os dois obrigatórios. Membros: `tpEvento`, `nSeqEvento`.
- `IbsCbsDps`: Grupo `IBSCBS` da DPS: o que o emitente declara (NT SE/CGNFS-e 004). Membros: `finNFSe`, `indFinal`, `cIndOp`, `tpOper`, `refNFSe`, `tpEnteGov`, `indDest`, `destinatario`, `imovel`, `reembolsos`, `classificacao`.
- `IdDpsPartes`: Membros: `cLocEmi`, `emitente`, `serie`, `nDPS`.
- `Issqn`: Tributação municipal (ISSQN) como declarada; o valor do imposto é da Sefin. Membros: `tribISSQN`, `tpRetISSQN`, `pAliq`, `cPaisResult`, `tpImunidade`, `exigSusp`, `BM`.
- `LeiauteNfse`: Membros: `schema`, `DPSElement`, `NFSeElement`, `pedRegEventoElement`, `eventoElement`.
- `MensagemNfse`: Uma mensagem de erro ou alerta da Sefin, com a entrada do catálogo quando o código é conhecido. Membros: `codigo`, `descricao`, `complemento`, `catalogo`.
- `MontarDpsOpcoes`: Membros: `ambiente`, `tempo`, `verAplic`, `deslocamentoMin`.
- `NfseConsultada`: NFS-e lida numa consulta por chave. Membros: `chaveAcesso`, `xml`, `nfse`.
- `NfseGerada`: NFS-e gerada pela Sefin. `xml` é a string recebida, nunca reserializada; `nfse` é a leitura tolerante dela. Membros: `chaveAcesso`, `idDps`, `xml`, `nfse`, `nNFSe`, `dhProc`, `alertas`, `dataHoraProcessamento`, `versaoAplicativo`.
- `ParametrosMunicipais`: Membros: `convenio()`, `aliquota()`, `historicoAliquotas()`, `regimesEspeciais()`, `retencoes()`, `beneficio()`, `limparCache()`.
- `ParametrosOpcoes`: Membros: `transporte`, `endpoint`, `relogio`, `cache`, `validadeMs`, `validadeNaoEncontradoMs`, `timeoutMs`, `logger`.
- `PedidoEventoMontado`: Membros: `xml`, `id`, `chave`, `tpEvento`, `modulo`.
- `PedidoEventoOpcoes`: Membros: `ambiente`, `relogio`, `verAplic`, `deslocamentoMin`.
- `RejeicaoNfse` (estende `Recusado`): Rejeição da NFS-e: o `cStat` é o código do primeiro erro (`E0312`), o `xMotivo` a descrição dele, e `erros` traz a lista inteira na ordem da resposta. Membros: `erros`, `statusHttp`.
- `RespostaParametrizacao`: Resposta de uma consulta cujo formato não foi observado: a mensagem e o JSON como veio. Membros: `mensagem`, `dados`.
- `Servico`: Membros: `local`, `cTribNac`, `cTribMun`, `xDescServ`, `cNBS`, `cIntContrib`, `comExt`, `obra`, `atvEvento`, `infoCompl`.
- `Substituicao`: NFS-e substituída por esta DPS (grupo `subst`). Membros: `chSubstda`, `cMotivo`, `xMotivo`.
- `Tributacao`: Membros: `issqn`, `federal`, `totTrib`.
- `ValoresDps`: Membros: `vServ`, `vReceb`, `vDescIncond`, `vDescCond`, `deducaoReducao`.

### Tipos

- `InscricaoFederal`: Inscrição do emitente da DPS: CNPJ (14, numérico ou alfanumérico) ou CPF (11). `type InscricaoFederal = { readonly CNPJ: string; readonly CPF?: never; } | { readonly CPF: string; readonly CNPJ?: never; }`
- `LocalPrestacao`: Local da prestação: município (IBGE, `0000000` para águas marítimas) ou país (ISO, prestação no exterior). `type LocalPrestacao = { readonly cLocPrestacao: string; readonly cPaisPrestacao?: never; } | { readonly cPaisPrestacao: string; readonly cLocPrestacao?: never; }`
- `Pessoa`: Tomador ou intermediário. `type Pessoa = TCInfoPessoa`
- `Prestador`: Prestador: CNPJ, CPF, NIF ou motivo de não ter NIF, mais o regime de tributação (`regTrib`). `type Prestador = TCInfoPrestador`
- `RecuperacaoEvento`: Resultado da recuperação: o evento registrado, ou que a consulta não o mostrou. `type RecuperacaoEvento = { readonly registrado: true; readonly evento: EventoRegistrado; } | { readonly registrado: false; }`
- `ResolucaoEnvio`: Desfecho de `resolverEnvioSemResposta`, com a mesma forma do resolvedor da NF-e e do MDF-e.
- `ResultadoMontagemDps`: `type ResultadoMontagemDps = { readonly ok: true; readonly valor: DpsMontada; } | { readonly ok: false; readonly ocorrencias: readonly Ocorrencia[]; }`
- `ResultadoNfse`: Desfecho de uma operação da NFS-e: gerada ou registrada, ou rejeitada. Não há pendente nem denegação na NFS-e. `type ResultadoNfse<T> = Autorizado<T> | RejeicaoNfse`
- `ResultadoPedidoEvento`: `type ResultadoPedidoEvento = { readonly ok: true; readonly valor: PedidoEventoMontado; } | { readonly ok: false; readonly ocorrencias: readonly Ocorrencia[]; }`
- `Valor`: Valor aceito na entrada. Prefira texto (`'1500.00'`): número binário pode não representar a casa decimal exata. `type Valor = string | number`

### Constantes

- `DECLARACAO_XML`: Declaração XML exigida pela Sefin Nacional (E1229). `DECLARACAO_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"`
- `NFSE_NS`: Namespace dos documentos da NFS-e Nacional. `NFSE_NS = "http://www.sped.fazenda.gov.br/nfse"`
- `TIPOS_EVENTO`: Códigos de evento da NFS-e (Anexo II, aba "TIPO EVENTOS DE NFSe") que o sinete envia ou reconhece pelo nome. `TIPOS_EVENTO: { readonly cancelamento: '101101'; readonly cancelamentoPorSubstituicao: '105102'; readonly solicitacaoAnaliseFiscal: '101103'; }`
- `VERSAO_LEIAUTE`: Versão do leiaute (atributo `versao` da DPS, do pedido de evento e da NFS-e). `VERSAO_LEIAUTE = "1.01"`
