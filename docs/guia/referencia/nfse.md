# Referência: `@sinete/nfse`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/nfse/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/nfse/x` é `sinete/nfse/x`.

## `@sinete/nfse`

`@sinete/nfse`: NFS-e Nacional (Sefin Nacional e ADN), leiaute 1.01.

Entrada do domínio (`DpsInput`), montagem validada no XSD vigente (`buildDps`, que já inclui a declaração UTF-8 exigida pela Sefin), assinatura por splice (`signDps`), pedidos de evento (`buildPedidoCancelamento`) e o cliente REST com mTLS (`createNfseClient`): emissão síncrona, substituição, consultas, eventos e parâmetros municipais com cache. Rejeição é desfecho (`NfseRejeicao`, com os códigos do Anexo I e II e o catálogo do `@sinete/rejeicoes/nfse`), não exceção. O emissor (DPS gravada antes do envio, trava, retomada) está em `@sinete/emissor/nfse` (ADR 0010), e o DANFSe sai do XML da NFS-e pelo `danfse` de `@sinete/da/nfse`.

### Funções

- `buildDps`: Monta e valida a DPS. Nunca lança por dado de entrada: tudo o que impede a DPS vira `Ocorrencia` (formato, documento com DV errado, competência depois da emissão, schema). Lança `ErroDeConfiguracao` só por opção inválida. `buildDps(input: DpsInput, options: BuildDpsOptions): BuildDpsResult`
- `buildPedidoAnaliseFiscal`: Pedido de análise fiscal para cancelamento (e101103). `buildPedidoAnaliseFiscal(p: AnaliseFiscalPedido, options: PedidoEventoOptions): PedidoEventoResult`
- `buildPedidoCancelamento`: Pedido de cancelamento da NFS-e (e101101). `buildPedidoCancelamento(p: CancelamentoPedido, options: PedidoEventoOptions): PedidoEventoResult`
- `cacheEmMemoria`: Cache em memória com limite de entradas (sai a mais antiga). `cacheEmMemoria(maxEntradas?: number): CacheParametros`
- `codigoServicoParametrizacao`: Código de serviço da parametrização municipal do ADN: `01.01.01.000`, o `cTribNac` com pontos seguido do código de tributação municipal (`cTribMun`, 3 dígitos, `000` sem desdobro municipal). `codigoServicoParametrizacao(cTribNac: string, cTribMun?: string): string`
- `createNfseClient`: Cria o cliente. Nada é enviado até a primeira operação. `createNfseClient(options: NfseClientOptions): NfseClient`
- `createParametrosMunicipais`: Cliente da parametrização municipal. `createNfseClient` já cria um em `client.parametros`. `createParametrosMunicipais(o: ParametrosOptions): ParametrosMunicipais`
- `cTribNacDps`: `cTribNac` na forma da DPS (6 dígitos), a partir de `010101` ou `01.01.01`. Lança `ErroDeConfiguracao` fora disso. `cTribNacDps(codigo: string): string`
- `formatValor`: Converte para texto com `casas` casas decimais. Devolve `undefined` e acrescenta a ocorrência em `issues` quando o valor não tem representação exata. `formatValor(valor: Valor, path: string, issues: Ocorrencia[], casas?: number): string | undefined`
- `gunzipBase64`: Gzip em base64 para o texto UTF-8 de dentro. Lança `ErroRespostaInvalida` se não for base64 de um gzip. `gunzipBase64(b64: string, campo?: string): Promise<string>`
- `gzipBase64`: Texto (UTF-8) para gzip em base64. `gzipBase64(text: string): Promise<string>`
- `idDps`: Id da DPS (`DPS` + 42 posições). `idDps(p: IdDpsPartes): string`
- `idPedidoEvento`: Id do pedido de registro de evento: `PRE` + chave + código do evento. `idPedidoEvento(chave: string, tpEvento: string): string`
- `inscricaoId`: Tipo de inscrição (1 CPF, 2 CNPJ) e inscrição com 14 posições, como entram no Id da DPS e na chave. `inscricaoId(doc: InscricaoFederal): { readonly tpInsc: '1' | '2'; readonly inscricao: string; }`
- `leiauteVigente`: O pacote de esquemas vigente no ambiente e no dia do relógio (fuso de Brasília). `leiauteVigente(ambiente: Ambiente, relogio: Relogio): { readonly vigencia: VigenciaEntry; readonly leiaute: LeiauteNfse; }`
- `parseChaveNfse`: Lê a chave de 50 posições. Lança `ErroDeConfiguracao` se a estrutura não bate; o DV não é conferido (ver o topo). `parseChaveNfse(chave: string): ChaveNfse`
- `resolverEnvioSemResposta`: Depois de um envio sem resposta (timeout, conexão caída), descobre se a DPS gerou NFS-e: consulta pelo Id da DPS e, achando a chave, lê a NFS-e. `resolverEnvioSemResposta(client: NfseClient, dpsAssinada: string): Promise<ResolucaoEnvio>`
- `signDps`: Assina a DPS (enveloped, `Reference` para o `infDPS`). A string devolvida é a que vai para a Sefin e para o banco. `signDps(dps: DpsMontada, signer: Assinador): Promise<string>`
- `signPedidoEvento`: Assina o pedido (Reference para o `infPedReg`). A string devolvida é a que vai para a Sefin. `signPedidoEvento(pedido: PedidoEventoMontado, signer: Assinador): Promise<string>`

### Interfaces

- `AliquotaServico`: Uma alíquota vigente ou do histórico de um código de serviço. Membros: `incidencia`, `aliquota`, `inicio`, `fim`.
- `AnaliseFiscalPedido`: Solicitação de análise fiscal para cancelamento (e101103), quando o prazo de cancelamento do município passou. Membros: `chave`, `autor`, `cMotivo`, `xMotivo`.
- `BuildDpsOptions`: Membros: `ambiente`, `time`, `verAplic`, `offsetMinutes`.
- `CacheParametros`: Cache das consultas de parametrização. O padrão é `cacheEmMemoria()`; troque por um compartilhado entre processos. Membros: `get()`, `set()`, `clear()`.
- `CancelamentoPedido`: Cancelamento (e101101): 1 erro na emissão, 2 serviço não prestado, 9 outros; motivo com 15 a 255 caracteres. Membros: `chave`, `autor`, `cMotivo`, `xMotivo`.
- `ChaveNfse`: Partes da chave de acesso da NFS-e. Membros: `chave`, `cMun`, `ambGer`, `tpInsc`, `inscricao`, `nNFSe`, `anoMes`, `cNum`, `dv`.
- `ClassificacaoIbsCbs`: Classificação do IBS e da CBS do serviço (grupo `IBSCBS/valores/trib/gIBSCBS`). Membros: `CST`, `cClassTrib`, `cCredPres`, `tributacaoRegular`, `diferimento`.
- `ConvenioMunicipal`: Convênio do município com o Sistema Nacional NFS-e. Membros: `aderenteAmbienteNacional`, `aderenteEmissorNacional`, `situacaoEmissaoPadraoContribuintesRFB`, `aderenteMAN`, `permiteAproveitamentoDeCreditos`, `bruto`.
- `DpsInput`: Membros: `serie`, `nDPS`, `dCompet`, `tpEmit`, `cMotivoEmisTI`, `chNFSeRej`, `cLocEmi`, `substituicao`, `prestador`, `tomador`, `intermediario`, `servico`, `valores`, `tributacao`, `ibsCbs`.
- `DpsMontada`: DPS montada e validada, pronta para assinar. Membros: `xml`, `id`, `ambiente`, `modulo`, `dhEmi`, `dCompet`.
- `EntradaCache`: Resposta crua guardada no cache. Membros: `status`, `corpo`, `expiraEm`.
- `EventoRegistrado`: Evento registrado (`evento` do Anexo II), com o XML como veio. Membros: `xml`, `id`, `chaveAcesso`, `tpEvento`, `nSeqEvento`, `dhProc`.
- `FiltroEventos`: Tipo e sequência do evento procurado, os dois obrigatórios. Membros: `tpEvento`, `nSeqEvento`.
- `IbsCbsDps`: Grupo `IBSCBS` da DPS: o que o emitente declara (NT SE/CGNFS-e 004). Membros: `finNFSe`, `indFinal`, `cIndOp`, `tpOper`, `refNFSe`, `tpEnteGov`, `indDest`, `destinatario`, `imovel`, `reembolsos`, `classificacao`.
- `IdDpsPartes`: Membros: `cLocEmi`, `emitente`, `serie`, `nDPS`.
- `Issqn`: Tributação municipal (ISSQN) como declarada; o valor do imposto é da Sefin. Membros: `tribISSQN`, `tpRetISSQN`, `pAliq`, `cPaisResult`, `tpImunidade`, `exigSusp`, `BM`.
- `LeiauteNfse`: Membros: `schema`, `DPSElement`, `NFSeElement`, `pedRegEventoElement`, `eventoElement`.
- `NfseClient`: Membros: `ambiente`, `autorizar()`, `substituir()`, `consultar()`, `consultarDps()`, `registrarEvento()`, `cancelar()`, `solicitarAnaliseFiscal()`, `consultarEventos()`, `parametros`.
- `NfseClientOptions`: Membros: `transport`, `ambiente`, `clock`, `signer`, `logger`, `timeoutMs`, `cacheParametros`, `ttlParametrosMs`, `endpoint`, `verAplic`.
- `NfseConsultada`: NFS-e lida numa consulta por chave. Membros: `chaveAcesso`, `xml`, `nfse`.
- `NfseGerada`: NFS-e gerada pela Sefin. `xml` é a string recebida, nunca reserializada; `nfse` é a leitura tolerante dela. Membros: `chaveAcesso`, `idDps`, `xml`, `nfse`, `nNFSe`, `dhProc`, `alertas`, `dataHoraProcessamento`, `versaoAplicativo`.
- `NfseMensagem`: Uma mensagem de erro ou alerta da Sefin, com a entrada do catálogo quando o código é conhecido. Membros: `codigo`, `descricao`, `complemento`, `catalogo`.
- `NfseRejeicao` (estende `Recusado`): Rejeição da NFS-e: o `cStat` é o código do primeiro erro (`E0312`), o `xMotivo` a descrição dele, e `erros` traz a lista inteira na ordem da resposta. Membros: `erros`, `httpStatus`.
- `OpcoesEnvio`: Membros: `signal`.
- `ParametrosMunicipais`: Membros: `convenio()`, `aliquota()`, `historicoAliquotas()`, `regimesEspeciais()`, `retencoes()`, `beneficio()`, `limparCache()`.
- `ParametrosOptions`: Membros: `transport`, `endpoint`, `clock`, `cache`, `ttlMs`, `ttlNaoEncontradoMs`, `timeoutMs`, `logger`.
- `PedidoEventoMontado`: Membros: `xml`, `id`, `chave`, `tpEvento`, `modulo`.
- `PedidoEventoOptions`: Membros: `ambiente`, `clock`, `verAplic`, `offsetMinutes`.
- `RespostaParametrizacao`: Resposta de uma consulta cujo formato não foi observado: a mensagem e o JSON como veio. Membros: `mensagem`, `dados`.
- `Servico`: Membros: `local`, `cTribNac`, `cTribMun`, `xDescServ`, `cNBS`, `cIntContrib`, `comExt`, `obra`, `atvEvento`, `infoCompl`.
- `Substituicao`: NFS-e substituída por esta DPS (grupo `subst`). Membros: `chSubstda`, `cMotivo`, `xMotivo`.
- `Tributacao`: Membros: `issqn`, `federal`, `totTrib`.
- `ValoresDps`: Membros: `vServ`, `vReceb`, `vDescIncond`, `vDescCond`, `deducaoReducao`.

### Tipos

- `BuildDpsResult`: `type BuildDpsResult = { readonly ok: true; readonly value: DpsMontada; } | { readonly ok: false; readonly issues: readonly Ocorrencia[]; }`
- `InscricaoFederal`: Inscrição do emitente da DPS: CNPJ (14, numérico ou alfanumérico) ou CPF (11). `type InscricaoFederal = { readonly CNPJ: string; readonly CPF?: never; } | { readonly CPF: string; readonly CNPJ?: never; }`
- `LocalPrestacao`: Local da prestação: município (IBGE, `0000000` para águas marítimas) ou país (ISO, prestação no exterior). `type LocalPrestacao = { readonly cLocPrestacao: string; readonly cPaisPrestacao?: never; } | { readonly cPaisPrestacao: string; readonly cLocPrestacao?: never; }`
- `NfseOutcome`: Desfecho de uma operação da NFS-e: gerada ou registrada, ou rejeitada. Não há pendente nem denegação na NFS-e. `type NfseOutcome<T> = Autorizado<T> | NfseRejeicao`
- `PedidoEventoResult`: `type PedidoEventoResult = { readonly ok: true; readonly value: PedidoEventoMontado; } | { readonly ok: false; readonly issues: readonly Ocorrencia[]; }`
- `Pessoa`: Tomador ou intermediário. `type Pessoa = TCInfoPessoa`
- `Prestador`: Prestador: CNPJ, CPF, NIF ou motivo de não ter NIF, mais o regime de tributação (`regTrib`). `type Prestador = TCInfoPrestador`
- `ResolucaoEnvio`: Desfecho de `resolverEnvioSemResposta`, com a mesma forma do resolvedor da NF-e e do MDF-e.
- `Valor`: Valor aceito na entrada. Prefira texto (`'1500.00'`): número binário pode não representar a casa decimal exata. `type Valor = string | number`

### Constantes

- `DECLARACAO_XML`: Declaração XML exigida pela Sefin Nacional (E1229). `DECLARACAO_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"`
- `NFSE_NS`: Namespace dos documentos da NFS-e Nacional. `NFSE_NS = "http://www.sped.fazenda.gov.br/nfse"`
- `TIPOS_EVENTO`: Códigos de evento da NFS-e (Anexo II, aba "TIPO EVENTOS DE NFSe") que o sinete envia ou reconhece pelo nome. `TIPOS_EVENTO: { readonly cancelamento: '101101'; readonly cancelamentoPorSubstituicao: '105102'; readonly solicitacaoAnaliseFiscal: '101103'; }`
- `VERSAO_LEIAUTE`: Versão do leiaute (atributo `versao` da DPS, do pedido de evento e da NFS-e). `VERSAO_LEIAUTE = "1.01"`
