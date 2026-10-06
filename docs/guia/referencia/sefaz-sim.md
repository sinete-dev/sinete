# Referência: `@sinete/sefaz-sim`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/sefaz-sim/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/sefaz-sim/x` é `sinete/sefaz-sim/x`.

## `@sinete/sefaz-sim`

`@sinete/sefaz-sim`: SEFAZ simulada com estado, para testes.

Web services da NF-e 4.00 (autorização síncrona e assíncrona, retorno do recibo, consulta de protocolo, eventos de cancelamento, cancelamento por substituição, carta de correção e manifestação do destinatário, inutilização, consulta cadastro, distribuição de DF-e) com as validações do MOC 7.0 na ordem da SEFAZ; e os do MDF-e 3.00 na SVRS (recepção síncrona, consulta, não encerrados, status e eventos de cancelamento, encerramento, inclusão de condutor e de DF-e e pagamento da operação), com as regras do MOC do MDF-e, relógio injetado, números determinísticos e cenários de falha. Esta entrada roda em qualquer runtime (o simulador em processo e o `Transporte` sem socket); a entrada `node` acrescenta o servidor HTTPS com mTLS.

A NFS-e Nacional tem simulador próprio (`criarNfseSim`): Sefin Nacional (emissão síncrona, consultas, eventos) e ADN (parametrização municipal), com as regras dos Anexos I e II como dado.

### Funções

- `acaoSoap`: `action` do SOAP 1.2 da operação, como vai no `Content-Type`. `acaoSoap(definicao: DefinicaoDeServico): string`
- `autorizadorSimDe`: Autorizador simulado de um endpoint dos dados do `@sinete/transport`: o Ambiente Nacional (`AN`), a contingência (`SVC-AN`, `SVC-RS`) ou, em qualquer outro caso, o autorizador da UF (UF própria, SVAN, SVRS, inclusive os da NFC-e). `autorizadorSimDe(endpoint: EndpointResolvido): AutorizadorSim`
- `caminhoDoServico`: Caminho do serviço no simulador. `caminhoDoServico(servico: ServicoSim, autorizador: AutorizadorSim): string`
- `certificadoSintetico`: Gera um certificado sintético com chave RSA-2048 nova. `certificadoSintetico(opcoes: CertificadoSinteticoOpcoes): Promise<CertificadoSintetico>`
- `conferirAssinaturaDoDocumento`: Grupos E e F: E01 (290) certificado ausente, ilegível, de AC ou sem assinatura digital e não recusa no KeyUsage; E02 (291) validade; E03 (292) sem CNPJ/CPF; F01 (298) assinatura fora do padrão (referência, transforms, algoritmos); F02 (297) valor da assinatura não confere; F03 (213) e F03A (227) raiz do CNPJ ou CPF do titular diferente da do certificado. `conferirAssinaturaDoDocumento(entrada: EntradaConferenciaAssinatura): Promise<ConferenciaDaAssinatura>`
- `conferirTransmissor`: Grupo A (certificado de transmissão, no TLS): A01 (280) ilegível, de AC ou sem `clientAuth`; A02 (281) fora da validade; A07 (282) sem CNPJ nem CPF no `otherName`. `conferirTransmissor(der: Uint8Array, agora: number): ConferenciaDoCertificado`
- `criarNfseSim`: Cria a NFS-e simulada. Cada instância tem estado próprio. `criarNfseSim(opcoes: NfseSimOpcoesCompletas): NfseSim`
- `criarSefazSim`: Cria a SEFAZ simulada. Cada instância tem estado próprio. `criarSefazSim(opcoes: SefazSimOpcoes): SefazSim`
- `definicaoDoServico`: Definição de um serviço da NF-e ou do MDF-e. `definicaoDoServico(servico: ServicoSim): DefinicaoDeServico`
- `dvChave`: DV da chave: módulo 11 com pesos de 2 a 9 da direita para a esquerda, como na chave da NF-e. O Anexo I não publica o algoritmo; o simulador usa este e o `@sinete/nfse` não confere o DV. `dvChave(base49: string): string`
- `ehDenegacao`: O código é uma denegação (o número fica consumido e há protocolo)? `ehDenegacao(cStat: string): boolean`
- `ehResultado`: O `cStat` é um resultado de processamento da tabela 4.4.1 (100, 103, 135...)? `ehResultado(cStat: string): boolean`
- `ehServicoMdfe`: O serviço é do MDF-e. `ehServicoMdfe(servico: string): servico is MdfeServicoSim`
- `iniciarServidorSefazSim` (só na condição `node`): Sobe o simulador da NF-e num servidor HTTPS local. `iniciarServidorSefazSim(sim: SefazSim, opcoes: ServidorSefazSimOpcoes): Promise<ServidorSefazSim>`
- `iniciarServidorSim` (só na condição `node`): Sobe um simulador qualquer (o da NFS-e, por exemplo) num servidor HTTPS local com mTLS. `iniciarServidorSim(sim: TratadorSim, opcoes: ServidorSefazSimOpcoes): Promise<ServidorSim>`
- `motivo`: Mensagem de um resultado da tabela 4.4.1 quando houver; senão a rejeição ou denegação do catálogo, com o prefixo `Rejeição: ` ou `Uso Denegado: ` que o Anexo I usa na coluna "Descrição Erro". `motivo(cStat: string, parametros?: ParametrosDoMotivo): string`
- `motivoMdfe`: Mensagem de um `cStat` do MDF-e: resultado (`data/mdfe-status.json`) ou rejeição do catálogo do MDF-e no `@sinete/rejeicoes/mdfe` (os códigos do MDF-e colidem com os da NF-e e têm outro sentido). `motivoMdfe(cStat: string, parametros?: ParametrosDoMotivo): string`
- `motivoRejeicao`: Mensagem do catálogo com o prefixo, mesmo para os códigos que também são resultado (108 e 109 nos grupos B03 e B04). `motivoRejeicao(cStat: string, parametros?: ParametrosDoMotivo): string`
- `namespaceDoWsdl`: Namespace do WSDL do serviço. `namespaceDoWsdl(definicao: DefinicaoDeServico): string`
- `pfxSintetico`: PFX com a chave e o certificado de `certificado`, cifrado com `senha`. `pfxSintetico(certificado: CertificadoSintetico, senha: string, opcoes?: PfxSinteticoOpcoes): Uint8Array`
- `primeiraRejeicao`: Aplica as regras na ordem e devolve a primeira rejeição. `primeiraRejeicao<C>(regras: readonly RegraSim<C>[], contexto: C): RejeicaoSim | undefined`
- `redirecionarNfseParaSim`: `redirecionarNfseParaSim(transporte: Transporte, urlBase: string): Transporte`
- `redirecionarParaSim`: Envolve um `Transporte` (o real, por HTTPS com mTLS, ou o `transporteSim`) para mandar ao simulador os pedidos que um cliente de documento resolveu pelos dados de endpoints: a URL de cada pedido vira `urlBase` + o caminho do serviço no autorizador simulado, e o `endpoint` segue com a URL e o host novos, sem o perfil TLS do host real. `redirecionarParaSim(transporte: Transporte, urlBase: string): Transporte`
- `rejeicaoDaChave`: J02a a J02g e P12-10 a P12-34: validação da chave de acesso, na ordem do MOC. `rejeicaoDaChave(chave: string, agora: number, deslocamentoMin: number): RejeicaoSim | undefined`
- `rotaDe`: Resolve um caminho recebido; `undefined` se não for de nenhum serviço atendido por aquele autorizador. `rotaDe(caminho: string): { readonly definicao: DefinicaoDeServico; readonly autorizador: AutorizadorSim; } | undefined`
- `transporteSim`: Cria o transporte em processo. As URLs são `URL_BASE_SIM` + `sim.caminho(...)`. `transporteSim(sim: TratadorSim, opcoes?: TransporteSimOpcoes): Transporte`

### Interfaces

- `AliquotasIbsCbsSim`: Membros: `pCBS`, `pIBSUF`, `pIBSMun`.
- `AliquotaSim`: Alíquota de um código de serviço com vigência (datas `AAAA-MM-DD`, fim inclusivo). Membros: `aliquota`, `inicio`, `fim`.
- `AlvoDaFalha`: Membros: `servico`, `autorizador`, `vezes`.
- `AlvoDaFalhaNfseSim`: Membros: `rota`, `vezes`.
- `CertificadoSintetico`: Certificado com a chave, pronto para o TLS (PEM), para assinar XML (`AssinadorDeDados`) e para assinar outros. Membros: `der`, `pem`, `chavePem`, `assinador`, `identidadeTls`, `commonName`, `assinarTbs`.
- `CertificadoSinteticoOpcoes`: Membros: `relogio`, `papel`, `commonName`, `cnpj`, `cpf`, `diasDeValidade`, `emissor`, `hosts`, `omitirExtensaoDoDocumento`.
- `ConfiguracaoSim`: Membros: `relogio`, `ambiente`, `tpAmb`, `uf`, `cUF`, `cUFsAtendidas`, `deslocamentoMin`, `cadastro`, `regras`, `exigirCertificado`, `prazoCancelamentoMs`, `prazoCancelamentoSubstituicaoMs`, `atrasoProcessamentoMs`, `respostaSincrona`, `intervaloConsumoIndevidoMs`, `tamanhoMaximo`, `prazoCancelamentoMdfeMs`, `tamanhoMaximoMdfe`, `regrasMdfeDesligadas`.
- `ContextoAutorizacao`: Membros: `nfe`, `chave`, `autorizador`, `visao`, `agora`.
- `ContextoDoPedido`: Membros: `rt`, `definicao`, `autorizador`, `payload`, `agora`, `transmissor`, `transmissorRecusado`.
- `ContextoEvento`: Membros: `evento`, `autorizador`, `visao`, `agora`.
- `ContextoInutilizacao`: Membros: `inut`, `visao`, `agora`.
- `Contribuinte` (estende `Documento`): Situação cadastral de um contribuinte no cadastro simulado da UF. Membros: `UF`, `IE`, `xNome`, `situacao`.
- `ContribuinteNfseSim`: Contribuinte do cadastro nacional, para o grupo `emit` da NFS-e. Membros: `CNPJ`, `CPF`, `xNome`, `endereco`.
- `DefinicaoDeServico`: Membros: `servico`, `wsdl`, `operacao`, `estilo`, `autorizadores`, `namespace`, `compactado`, `operacaoEm`.
- `Documento`: Emitente, destinatário ou autor: CNPJ (numérico ou alfanumérico) ou CPF, sem máscara. Membros: `CNPJ`, `CPF`.
- `DocumentoDaDistribuicao`: Documento na fila de distribuição de um interessado. Membros: `nsu`, `schema`, `xml`, `chave`.
- `DpsFatos`: Membros: `configuracao`, `dps`, `inf`, `agora`, `dhEmi`, `diaEmissao`, `municipioEmissor`, `municipioIncidencia`, `servico`, `aliquota`, `duplicada`, `substituida`.
- `EntradaConferenciaAssinatura`: Membros: `documento`, `id`, `elemento`, `agora`, `titular`.
- `EstadoDeExecucao`: Estado mutável de execução, compartilhado pelos três autorizadores. Membros: `configuracao`, `estado`, `contingencia`, `svcPadrao`, `ativacaoSvc`, `paralisacao`, `paralisacaoMdfe`, `semDigVal`.
- `EventoNfseFatos`: Membros: `configuracao`, `pedido`, `tpEvento`, `agora`, `nfse`, `eventos`, `municipioEmissor`.
- `EventoNfseRegistro`: Um evento registrado. Membros: `chave`, `tpEvento`, `nSeqEvento`, `id`, `xml`, `recebidoEm`.
- `FatosEvento`: Membros: `id`, `cOrgao`, `tpAmb`, `autor`, `chNFe`, `dhEvento`, `tpEvento`, `nSeqEvento`, `verEvento`, `det`.
- `FatosInutilizacao`: Membros: `id`, `tpAmb`, `cUF`, `ano`, `CNPJ`, `mod`, `serie`, `nNFIni`, `nNFFin`.
- `FatosNfe`: Campos da NF-e usados pelas regras de autorização. Membros: `id`, `cUF`, `cNF`, `mod`, `serie`, `nNF`, `dhEmi`, `tpEmis`, `cDV`, `tpAmb`, `emitente`, `ide`, `vNF`, `destinatario`, `itens`, `supl`.
- `IdentidadeDoCertificado` (estende `Documento`): Identidade lida de um certificado: CNPJ ou CPF do `otherName` ICP-Brasil, quando houver. Membros: `certificado`.
- `InspecaoNfseSim`: Membros: `nfse()`, `nfses()`, `eventos()`.
- `InspecaoSim`: Consultas ao estado para as asserções dos testes. Membros: `nfe()`, `nfes()`, `eventos()`, `inutilizacoes()`, `mdfe()`, `mdfes()`, `eventosMdfe()`, `lote()`, `distribuicao()`.
- `MunicipioSim`: Membros: `cMun`, `nome`, `convenio`, `convenioDesde`, `servicos`, `prazoCancelamentoDias`, `regimesEspeciais`, `retencoes`, `beneficios`.
- `NfePendente`: NF-e de um lote assíncrono ainda não processado. Membros: `chave`, `chaveDoEmitente`, `mod`, `serie`, `nNF`.
- `NfseRegistro`: Uma NFS-e gerada pelo simulador. Membros: `chave`, `idDps`, `xml`, `emitente`, `cLocEmi`, `serie`, `nDPS`, `processadaEm`, `situacao`.
- `NfseSim`: Membros: `atender()`, `injetarFalha()`, `limparFalhas()`, `inspecao`.
- `NfseSimOpcoes`: Membros: `relogio`, `assinador`, `ambiente`, `municipios`, `contribuintes`, `exigirCertificado`, `aliquotasIbsCbs`.
- `NfseSimOpcoesCompletas` (estende `NfseSimOpcoes`): Membros: `regras`.
- `NfseSimRegra`: Membros: `codigo`, `fonte`, `violada()`, `complemento()`.
- `NfseSimRegras`: Membros: `dps`, `evento`.
- `PedidoSim`: Pedido HTTP como chegou ao simulador. Membros: `metodo`, `caminho`, `cabecalhos`, `corpo`, `certificadoDoCliente`.
- `PfxSinteticoOpcoes`: Membros: `cadeia`.
- `ProtocoloSemDigVal`: Protocolos que saem sem `digVal`, opcional no leiaute (`TProtNFe/infProt/digVal` e `TProtMDFe/infProt/digVal`, minOccurs 0), como há autorizador que devolve: `denegacao` só nas denegações da NF-e (110, 301, 302, 303), `todos` também nas autorizações da NF-e e do MDF-e. Membros: `quais`, `onde`.
- `RegistroEvento`: Membros: `chave`, `tpEvento`, `nSeqEvento`, `cOrgao`, `autor`, `dhEvento`, `dhRegEvento`, `nProt`, `xEvento`, `xml`, `retEvento`.
- `RegistroEventoMdfe`: Membros: `chave`, `tpEvento`, `nSeqEvento`, `cOrgao`, `dhEvento`, `dhRegEvento`, `nProt`, `det`, `chNFe`, `xml`, `retEvento`.
- `RegistroInutilizacao`: Membros: `cUF`, `ano`, `CNPJ`, `mod`, `serie`, `nNFIni`, `nNFFin`, `nProt`, `dhRecbto`, `xml`.
- `RegistroLote`: Membros: `nRec`, `autorizador`, `svc`, `recebidoEm`, `disponivelEm`, `dhRecbto`, `payload`, `pendente`, `transmissor`, `protNFe`, `processadoEm`.
- `RegistroMdfe`: MDF-e autorizado, com o que as regras de não encerrados, eventos e consulta precisam. Membros: `chave`, `cUF`, `emitente`, `serie`, `nMDF`, `cMDF`, `tpEmit`, `tpEmis`, `modal`, `UFIni`, `UFFim`, `qtdPercurso`, `placa`, `tpProp`, `proprietario`, `carregaPosterior`, `cMunCarrega`, `dhEmi`, `dhEmiMs`, `xml`, `digVal`, `nProt`, `dhRecbto`, `dhRecbtoMs`, `protMDFe`, `situacao`.
- `RegistroNfe`: Membros: `chave`, `cUF`, `mod`, `serie`, `nNF`, `cNF`, `tpEmis`, `tpNF`, `dhEmi`, `dhEmiMs`, `vNF`, `emitente`, `destinatario`, `terceiros`, `xml`, `digVal`, `nRec`, `nProt`, `cStat`, `xMotivo`, `dhRecbto`, `dhRecbtoMs`, `prot`, `situacao`, `liberadaAoDestinatario`.
- `RegraSim`: Membros: `id`, `fonte`, `conferir()`.
- `RegrasSim`: Membros: `autorizacao`, `evento`, `inutilizacao`.
- `RejeicaoSim`: Rejeição devolvida por uma regra: o `cStat` e os valores dos marcadores da mensagem oficial. Membros: `cStat`, `parametros`.
- `RespostaSim`: Membros: `status`, `cabecalhos`, `corpo`, `efeito`, `atrasoMs`.
- `SefazSim`: Membros: `configuracao`, `atender()`, `caminho()`, `url()`, `injetarFalha()`, `limparFalhas()`, `definirParalisacao()`, `definirParalisacaoMdfe()`, `definirProtocoloSemDigVal()`, `definirContingencia()`, `definirAtivacaoSvc()`, `processarLotes()`, `inspecao`.
- `SefazSimOpcoes`: Membros: `relogio`, `uf`, `ufsAtendidas`, `ambiente`, `deslocamentoMin`, `cadastro`, `regras`, `exigirCertificado`, `prazoCancelamentoHoras`, `prazoCancelamentoSubstituicaoHoras`, `atrasoProcessamentoMs`, `respostaSincrona`, `intervaloConsumoIndevidoMs`, `tamanhoMaximo`, `prazoCancelamentoMdfeHoras`, `tamanhoMaximoMdfe`, `regrasMdfeDesligadas`.
- `ServicoMunicipalSim`: Membros: `codigo`, `descricao`, `aliquotas`.
- `ServidorSefazSim` (estende `ServidorSim`; só na condição `node`): Membros: `url()`.
- `ServidorSefazSimOpcoes` (só na condição `node`): Membros: `certificado`, `chave`, `pedirCertificado`, `host`, `porta`.
- `ServidorSim` (só na condição `node`): Servidor HTTPS de um simulador (NF-e ou NFS-e). Membros: `urlBase`, `porta`, `fechar()`.
- `TransporteSimOpcoes`: Membros: `certificadoDoCliente`, `politica`, `timeoutMs`, `recusarEm403`.
- `TratadorSim`: Atende um pedido HTTP já lido: o `SefazSim` da NF-e e o `NfseSim` da NFS-e. Membros: `atender()`.
- `VisaoSim`: Consultas somente leitura ao estado, para as regras. Membros: `configuracao`, `contingencia`, `nfe()`, `nfePorNumero()`, `pendentePorNumero()`, `inutilizacaoCom()`, `inutilizacoes()`, `eventos()`, `contribuinte()`.

### Tipos

- `AtivacaoSvc`: Ativação da SVC para uma UF (NT 2013.007 v1.03, item 03): a SEFAZ de origem a ativa (`ativa`, 107 na consulta status), a desativa com aviso (`desativando` até `ate`, 113 na consulta status e a recepção ainda aceita; depois de `ate`, como `inativa`) ou a deixa desligada (`inativa`, 114 na consulta status e na recepção). `type AtivacaoSvc = { readonly situacao: 'ativa'; } | { readonly situacao: 'desativando'; readonly ate: ReturnType<Relogio['agora']>; } | { readonly situacao: 'inativa'; }`
- `AutorizadorSim`: Autorizador simulado: SEFAZ da UF, SVC (contingência) ou Ambiente Nacional. `type AutorizadorSim = 'uf' | 'svc' | 'an'`
- `ConferenciaDaAssinatura`
- `ConferenciaDoCertificado`: `type ConferenciaDoCertificado = { readonly ok: true; readonly identidade: IdentidadeDoCertificado; } | { readonly ok: false; readonly cStat: string; }`
- `EfeitoSim`: O que fazer com a conexão: responder, derrubar ou deixar sem resposta até o cliente desistir. `type EfeitoSim = 'responder' | 'derrubar' | 'travar'`
- `FalhaSim`: Falha de rede injetada.
- `MdfeServicoSim`: Serviços do MDF-e que o simulador atende (a distribuição de DF-e do MDF-e fica de fora). `type MdfeServicoSim = Exclude<MdfeServico, 'MDFeDistribuicaoDFe'>`
- `NfseRota`: Rota do simulador, para mirar falhas. `type NfseRota = 'emitir' | 'consultarNfse' | 'consultarDps' | 'evento' | 'consultarEventos' | 'parametrizacao'`
- `PapelSintetico`: Papel do certificado, que decide as extensões. `type PapelSintetico = 'ac' | 'titular' | 'servidor'`
- `ParametrosDoMotivo`: Valores dos marcadores entre colchetes da mensagem oficial (`nRec`, `chNFe`, `nProt`) ou `campo` do `<nome do campo>`. `type ParametrosDoMotivo = Readonly<Record<string, string>>`
- `ServicoSim`: Serviço atendido pelo simulador: da NF-e ou do MDF-e, com os nomes que o `@sinete/transport` usa. `type ServicoSim = NfeServico | MdfeServicoSim`
- `SituacaoMdfe`: `type SituacaoMdfe = 'autorizado' | 'cancelado' | 'encerrado'`
- `SituacaoNfe`: `type SituacaoNfe = 'autorizada' | 'cancelada' | 'denegada'`
- `Svc`: SVC que atende a UF simulada quando a contingência está ativa. `type Svc = 'SVC-AN' | 'SVC-RS'`

### Constantes

- `MDFE_NS`: Os web services do MDF-e 3.00 (MOC MDF-e 3.00b Visão Geral, itens 3.4.1 e 4.2 a 5.1), todos na SVRS, que o simulador atende pelo autorizador `uf`. `MDFE_NS = "http://www.portalfiscal.inf.br/mdfe"`
- `NFE_NS`: `NFE_NS = "http://www.portalfiscal.inf.br/nfe"`
- `NFSE_REGRAS_PADRAO`: Regras padrão do simulador, na ordem de avaliação. `NFSE_REGRAS_PADRAO: NfseSimRegras`
- `NFSE_SIM_PREFIXOS`: Prefixo de cada API da NFS-e no simulador. `NFSE_SIM_PREFIXOS: Readonly<Record<NfseApi, string>>`
- `REGRAS_PADRAO`: Regras padrão do simulador. `REGRAS_PADRAO: RegrasSim`
- `SERVICOS_MDFE`: `SERVICOS_MDFE: Readonly<Record<MdfeServicoSim, DefinicaoDeServico>>`
- `SERVICOS_NFE`: `SERVICOS_NFE: Readonly<Record<NfeServico, DefinicaoDeServico>>`
- `URL_BASE_SIM`: Origem fictícia das URLs do transporte em processo. `URL_BASE_SIM = "https://sefaz-sim.invalid"`
