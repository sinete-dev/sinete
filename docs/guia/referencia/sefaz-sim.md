# Referência: `@sinete/sefaz-sim`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/sefaz-sim/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/sefaz-sim/x` é `sinete/sefaz-sim/x`.

## `@sinete/sefaz-sim`

`@sinete/sefaz-sim`: SEFAZ simulada com estado, para testes.

Web services da NF-e 4.00 (autorização síncrona e assíncrona, retorno do recibo, consulta de protocolo, eventos de cancelamento, cancelamento por substituição, carta de correção e manifestação do destinatário, inutilização, consulta cadastro, distribuição de DF-e) com as validações do MOC 7.0 na ordem da SEFAZ; e os do MDF-e 3.00 na SVRS (recepção síncrona, consulta, não encerrados, status e eventos de cancelamento, encerramento, inclusão de condutor e de DF-e e pagamento da operação), com as regras do MOC do MDF-e, relógio injetado, números determinísticos e cenários de falha. Esta entrada roda em qualquer runtime (o simulador em processo e o `Transporte` sem socket); a entrada `node` acrescenta o servidor HTTPS com mTLS.

A NFS-e Nacional tem simulador próprio (`createNfseSim`): Sefin Nacional (emissão síncrona, consultas, eventos) e ADN (parametrização municipal), com as regras dos Anexos I e II como dado.

### Funções

- `chaveRejection`: J02a a J02g e P12-10 a P12-34: validação da chave de acesso, na ordem do MOC. `chaveRejection(chave: string, now: number, offsetMinutes: number): SimRejection | undefined`
- `checkAssinatura`: Grupos E e F: E01 (290) certificado ausente, ilegível, de AC ou sem assinatura digital e não recusa no KeyUsage; E02 (291) validade; E03 (292) sem CNPJ/CPF; F01 (298) assinatura fora do padrão (referência, transforms, algoritmos); F02 (297) valor da assinatura não confere; F03 (213) e F03A (227) raiz do CNPJ ou CPF do titular diferente da do certificado. `checkAssinatura(input: SignatureCheckInput): Promise<SignatureCheck>`
- `checkTransmissor`: Grupo A (certificado de transmissão, no TLS): A01 (280) ilegível, de AC ou sem `clientAuth`; A02 (281) fora da validade; A07 (282) sem CNPJ nem CPF no `otherName`. `checkTransmissor(der: Uint8Array, now: number): CertCheck`
- `createNfseSim`: Cria a NFS-e simulada. Cada instância tem estado próprio. `createNfseSim(options: NfseSimFullOptions): NfseSim`
- `createSefazSim`: Cria a SEFAZ simulada. Cada instância tem estado próprio. `createSefazSim(options: SefazSimOptions): SefazSim`
- `dvChave`: DV da chave: módulo 11 com pesos de 2 a 9 da direita para a esquerda, como na chave da NF-e. O Anexo I não publica o algoritmo; o simulador usa este e o `@sinete/nfse` não confere o DV. `dvChave(base49: string): string`
- `firstRejection`: Aplica as regras na ordem e devolve a primeira rejeição. `firstRejection<C>(rules: readonly SimRule<C>[], ctx: C): SimRejection | undefined`
- `isDenegacao`: O código é uma denegação (o número fica consumido e há protocolo)? `isDenegacao(cStat: string): boolean`
- `isMdfeServico`: O serviço é do MDF-e. `isMdfeServico(servico: string): servico is MdfeServicoSim`
- `isResultado`: O `cStat` é um resultado de processamento da tabela 4.4.1 (100, 103, 135...)? `isResultado(cStat: string): boolean`
- `motivo`: Mensagem de um resultado da tabela 4.4.1 quando houver; senão a rejeição ou denegação do catálogo, com o prefixo `Rejeição: ` ou `Uso Denegado: ` que o Anexo I usa na coluna "Descrição Erro". `motivo(cStat: string, params?: MotivoParams): string`
- `motivoMdfe`: Mensagem de um `cStat` do MDF-e: resultado (`data/mdfe-status.json`) ou rejeição do catálogo do MDF-e no `@sinete/rejeicoes/mdfe` (os códigos do MDF-e colidem com os da NF-e e têm outro sentido). `motivoMdfe(cStat: string, params?: MotivoParams): string`
- `motivoRejeicao`: Mensagem do catálogo com o prefixo, mesmo para os códigos que também são resultado (108 e 109 nos grupos B03 e B04). `motivoRejeicao(cStat: string, params?: MotivoParams): string`
- `redirectNfseToSim`: `redirectNfseToSim(transport: Transporte, baseUrl: string): Transporte`
- `redirectToSim`: Envolve um `Transporte` (o real, por HTTPS com mTLS, ou o `simTransport`) para mandar ao simulador os pedidos que um cliente de documento resolveu pelos dados de endpoints: a URL de cada pedido vira `baseUrl` + o caminho do serviço no autorizador simulado, e o `endpoint` segue com a URL e o host novos, sem o perfil TLS do host real. `redirectToSim(transport: Transporte, baseUrl: string): Transporte`
- `routeOf`: Resolve um caminho recebido; `undefined` se não for de nenhum serviço atendido por aquele autorizador. `routeOf(path: string): { readonly def: ServiceDef; readonly autorizador: SimAutorizador; } | undefined`
- `serviceDef`: Definição de um serviço da NF-e ou do MDF-e. `serviceDef(servico: SimServico): ServiceDef`
- `servicePath`: Caminho do serviço no simulador. `servicePath(servico: SimServico, autorizador: SimAutorizador): string`
- `simAutorizadorOf`: Autorizador simulado de um endpoint dos dados do `@sinete/transport`: o Ambiente Nacional (`AN`), a contingência (`SVC-AN`, `SVC-RS`) ou, em qualquer outro caso, o autorizador da UF (UF própria, SVAN, SVRS, inclusive os da NFC-e). `simAutorizadorOf(endpoint: EndpointResolvido): SimAutorizador`
- `simTransport`: Cria o transporte em processo. As URLs são `SIM_BASE_URL` + `sim.path(...)`. `simTransport(sim: SimHandler, options?: SimTransportOptions): Transporte`
- `soapAction`: `action` do SOAP 1.2 da operação, como vai no `Content-Type`. `soapAction(def: ServiceDef): string`
- `startSefazSimServer` (só na condição `node`): Sobe o simulador da NF-e num servidor HTTPS local. `startSefazSimServer(sim: SefazSim, options: SefazSimServerOptions): Promise<SefazSimServer>`
- `startSimServer` (só na condição `node`): Sobe um simulador qualquer (o da NFS-e, por exemplo) num servidor HTTPS local com mTLS. `startSimServer(sim: SimHandler, options: SefazSimServerOptions): Promise<SimServer>`
- `syntheticCertificate`: Gera um certificado sintético com chave RSA-2048 nova. `syntheticCertificate(options: SyntheticCertificateOptions): Promise<SyntheticCertificate>`
- `syntheticPfx`: PFX com a chave e o certificado de `cert`, cifrado com `senha`. `syntheticPfx(cert: SyntheticCertificate, senha: string, options?: SyntheticPfxOptions): Uint8Array`
- `wsdlNamespace`: Namespace do WSDL do serviço. `wsdlNamespace(def: ServiceDef): string`

### Interfaces

- `AliquotasIbsCbsSim`: Membros: `pCBS`, `pIBSUF`, `pIBSMun`.
- `AliquotaSim`: Alíquota de um código de serviço com vigência (datas `AAAA-MM-DD`, fim inclusivo). Membros: `aliquota`, `inicio`, `fim`.
- `AutorizacaoContext`: Membros: `nfe`, `chave`, `autorizador`, `view`, `now`.
- `CertIdentity` (estende `Documento`): Identidade lida de um certificado: CNPJ ou CPF do `otherName` ICP-Brasil, quando houver. Membros: `info`.
- `Contribuinte` (estende `Documento`): Situação cadastral de um contribuinte no cadastro simulado da UF. Membros: `UF`, `IE`, `xNome`, `situacao`.
- `ContribuinteNfseSim`: Contribuinte do cadastro nacional, para o grupo `emit` da NFS-e. Membros: `CNPJ`, `CPF`, `xNome`, `endereco`.
- `DistDoc`: Documento na fila de distribuição de um interessado. Membros: `nsu`, `schema`, `xml`, `chave`.
- `Documento`: Emitente, destinatário ou autor: CNPJ (numérico ou alfanumérico) ou CPF, sem máscara. Membros: `CNPJ`, `CPF`.
- `DpsFatos`: Membros: `config`, `dps`, `inf`, `now`, `dhEmi`, `diaEmissao`, `municipioEmissor`, `municipioIncidencia`, `servico`, `aliquota`, `duplicada`, `substituida`.
- `EventoContext`: Membros: `evento`, `autorizador`, `view`, `now`.
- `EventoFacts`: Membros: `id`, `cOrgao`, `tpAmb`, `autor`, `chNFe`, `dhEvento`, `tpEvento`, `nSeqEvento`, `verEvento`, `det`.
- `EventoNfseFatos`: Membros: `config`, `pedido`, `tpEvento`, `now`, `nfse`, `eventos`, `municipioEmissor`.
- `EventoNfseRegistro`: Um evento registrado. Membros: `chave`, `tpEvento`, `nSeqEvento`, `id`, `xml`, `recebidoEm`.
- `EventoRecord`: Membros: `chave`, `tpEvento`, `nSeqEvento`, `cOrgao`, `autor`, `dhEvento`, `dhRegEvento`, `nProt`, `xEvento`, `xml`, `retEvento`.
- `FaultTarget`: Membros: `servico`, `autorizador`, `times`.
- `InutilizacaoContext`: Membros: `inut`, `view`, `now`.
- `InutilizacaoFacts`: Membros: `id`, `tpAmb`, `cUF`, `ano`, `CNPJ`, `mod`, `serie`, `nNFIni`, `nNFFin`.
- `InutilizacaoRecord`: Membros: `cUF`, `ano`, `CNPJ`, `mod`, `serie`, `nNFIni`, `nNFFin`, `nProt`, `dhRecbto`, `xml`.
- `LoteRecord`: Membros: `nRec`, `autorizador`, `svc`, `receivedAt`, `availableAt`, `dhRecbto`, `payload`, `pending`, `transmissor`, `protNFe`, `processedAt`.
- `MdfeEventoRecord`: Membros: `chave`, `tpEvento`, `nSeqEvento`, `cOrgao`, `dhEvento`, `dhRegEvento`, `nProt`, `det`, `chNFe`, `xml`, `retEvento`.
- `MdfeRecord`: MDF-e autorizado, com o que as regras de não encerrados, eventos e consulta precisam. Membros: `chave`, `cUF`, `emitente`, `serie`, `nMDF`, `cMDF`, `tpEmit`, `tpEmis`, `modal`, `UFIni`, `UFFim`, `qtdPercurso`, `placa`, `tpProp`, `proprietario`, `carregaPosterior`, `cMunCarrega`, `dhEmi`, `dhEmiMs`, `xml`, `digVal`, `nProt`, `dhRecbto`, `dhRecbtoMs`, `protMDFe`, `situacao`.
- `MunicipioSim`: Membros: `cMun`, `nome`, `convenio`, `convenioDesde`, `servicos`, `prazoCancelamentoDias`, `regimesEspeciais`, `retencoes`, `beneficios`.
- `NfeFacts`: Campos da NF-e usados pelas regras de autorização. Membros: `id`, `cUF`, `cNF`, `mod`, `serie`, `nNF`, `dhEmi`, `tpEmis`, `cDV`, `tpAmb`, `emitente`, `ide`, `vNF`, `destinatario`, `supl`.
- `NfeRecord`: Membros: `chave`, `cUF`, `mod`, `serie`, `nNF`, `cNF`, `tpEmis`, `tpNF`, `dhEmi`, `dhEmiMs`, `vNF`, `emitente`, `destinatario`, `terceiros`, `xml`, `digVal`, `nRec`, `nProt`, `cStat`, `xMotivo`, `dhRecbto`, `dhRecbtoMs`, `prot`, `situacao`, `liberadaAoDestinatario`.
- `NfseRegistro`: Uma NFS-e gerada pelo simulador. Membros: `chave`, `idDps`, `xml`, `emitente`, `cLocEmi`, `serie`, `nDPS`, `processadaEm`, `situacao`.
- `NfseSim`: Membros: `handle()`, `injectFault()`, `clearFaults()`, `inspect`.
- `NfseSimFaultTarget`: Membros: `rota`, `times`.
- `NfseSimFullOptions` (estende `NfseSimOptions`): Membros: `regras`.
- `NfseSimInspect`: Membros: `nfse()`, `nfses()`, `eventos()`.
- `NfseSimOptions`: Membros: `clock`, `signer`, `ambiente`, `municipios`, `contribuintes`, `exigirCertificado`, `aliquotasIbsCbs`.
- `NfseSimRegra`: Membros: `codigo`, `fonte`, `violada()`, `complemento()`.
- `NfseSimRegras`: Membros: `dps`, `evento`.
- `PendingNfe`: NF-e de um lote assíncrono ainda não processado. Membros: `chave`, `emitenteKey`, `mod`, `serie`, `nNF`.
- `ProtocoloSemDigVal`: Protocolos que saem sem `digVal`, opcional no leiaute (`TProtNFe/infProt/digVal` e `TProtMDFe/infProt/digVal`, minOccurs 0), como há autorizador que devolve: `denegacao` só nas denegações da NF-e (110, 301, 302, 303), `todos` também nas autorizações da NF-e e do MDF-e. Membros: `quais`, `onde`.
- `RequestContext`: Membros: `rt`, `def`, `autorizador`, `payload`, `now`, `transmissor`, `transmissorRecusado`.
- `Runtime`: Estado mutável de execução, compartilhado pelos três autorizadores. Membros: `config`, `state`, `contingencia`, `svcPadrao`, `ativacaoSvc`, `paralisacao`, `paralisacaoMdfe`, `semDigVal`.
- `SefazSim`: Membros: `config`, `handle()`, `path()`, `url()`, `injectFault()`, `clearFaults()`, `setParalisacao()`, `setParalisacaoMdfe()`, `setProtocoloSemDigVal()`, `setContingencia()`, `setAtivacaoSvc()`, `settle()`, `inspect`.
- `SefazSimOptions`: Membros: `clock`, `uf`, `ufsAtendidas`, `ambiente`, `offsetMinutes`, `cadastro`, `rules`, `exigirCertificado`, `prazoCancelamentoHoras`, `prazoCancelamentoSubstituicaoHoras`, `atrasoProcessamentoMs`, `respostaSincrona`, `intervaloConsumoIndevidoMs`, `tamanhoMaximo`, `prazoCancelamentoMdfeHoras`, `tamanhoMaximoMdfe`, `regrasMdfeDesligadas`.
- `SefazSimServer` (estende `SimServer`; só na condição `node`): Membros: `url()`.
- `SefazSimServerOptions` (só na condição `node`): Membros: `cert`, `key`, `requestCert`, `hostname`, `port`.
- `ServiceDef`: Membros: `servico`, `wsdl`, `operation`, `style`, `autorizadores`, `namespace`, `compactado`, `operacaoEm`.
- `ServicoMunicipalSim`: Membros: `codigo`, `descricao`, `aliquotas`.
- `SignatureCheckInput`: Membros: `doc`, `id`, `element`, `now`, `titular`.
- `SimConfig`: Membros: `clock`, `ambiente`, `tpAmb`, `uf`, `cUF`, `cUFsAtendidas`, `offsetMinutes`, `cadastro`, `rules`, `exigirCertificado`, `prazoCancelamentoMs`, `prazoCancelamentoSubstituicaoMs`, `atrasoProcessamentoMs`, `respostaSincrona`, `intervaloConsumoIndevidoMs`, `tamanhoMaximo`, `prazoCancelamentoMdfeMs`, `tamanhoMaximoMdfe`, `regrasMdfeDesligadas`.
- `SimHandler`: Atende um pedido HTTP já lido: o `SefazSim` da NF-e e o `NfseSim` da NFS-e. Membros: `handle()`.
- `SimInspect`: Consultas ao estado para as asserções dos testes. Membros: `nfe()`, `nfes()`, `eventos()`, `inutilizacoes()`, `mdfe()`, `mdfes()`, `eventosMdfe()`, `lote()`, `distribuicao()`.
- `SimRejection`: Rejeição devolvida por uma regra: o `cStat` e os valores dos marcadores da mensagem oficial. Membros: `cStat`, `params`.
- `SimRequest`: Pedido HTTP como chegou ao simulador. Membros: `method`, `path`, `headers`, `body`, `clientCertificate`.
- `SimResult`: Membros: `status`, `headers`, `body`, `effect`, `delayMs`.
- `SimRule`: Membros: `id`, `source`, `check()`.
- `SimRules`: Membros: `autorizacao`, `evento`, `inutilizacao`.
- `SimServer` (só na condição `node`): Servidor HTTPS de um simulador (NF-e ou NFS-e). Membros: `baseUrl`, `port`, `close()`.
- `SimTransportOptions`: Membros: `clientCertificate`, `policy`, `timeoutMs`, `rejectOn403`.
- `SimView`: Consultas somente leitura ao estado, para as regras. Membros: `config`, `contingencia`, `nfe()`, `nfeByNumero()`, `pendenteByNumero()`, `inutilizacaoCom()`, `inutilizacoes()`, `eventos()`, `contribuinte()`.
- `SyntheticCertificate`: Certificado com a chave, pronto para o TLS (PEM), para assinar XML (`AssinadorDeDados`) e para assinar outros. Membros: `der`, `pem`, `keyPem`, `signer`, `tlsIdentity`, `commonName`, `signTbs`.
- `SyntheticCertificateOptions`: Membros: `clock`, `role`, `commonName`, `cnpj`, `cpf`, `validDays`, `issuer`, `hosts`, `omitDocumentExtension`.
- `SyntheticPfxOptions`: Membros: `chain`.

### Tipos

- `AtivacaoSvc`: Ativação da SVC para uma UF (NT 2013.007 v1.03, item 03): a SEFAZ de origem a ativa (`ativa`, 107 na consulta status), a desativa com aviso (`desativando` até `ate`, 113 na consulta status e a recepção ainda aceita; depois de `ate`, como `inativa`) ou a deixa desligada (`inativa`, 114 na consulta status e na recepção). `type AtivacaoSvc = { readonly situacao: 'ativa'; } | { readonly situacao: 'desativando'; readonly ate: ReturnType<Relogio['agora']>; } | { readonly situacao: 'inativa'; }`
- `CertCheck`: `type CertCheck = { readonly ok: true; readonly identity: CertIdentity; } | { readonly ok: false; readonly cStat: string; }`
- `MdfeServicoSim`: Serviços do MDF-e que o simulador atende (a distribuição de DF-e do MDF-e fica de fora). `type MdfeServicoSim = Exclude<MdfeServico, 'MDFeDistribuicaoDFe'>`
- `MotivoParams`: Valores dos marcadores entre colchetes da mensagem oficial (`nRec`, `chNFe`, `nProt`) ou `campo` do `<nome do campo>`. `type MotivoParams = Readonly<Record<string, string>>`
- `NfseRota`: Rota do simulador, para mirar falhas. `type NfseRota = 'emitir' | 'consultarNfse' | 'consultarDps' | 'evento' | 'consultarEventos' | 'parametrizacao'`
- `SignatureCheck`
- `SimAutorizador`: Autorizador simulado: SEFAZ da UF, SVC (contingência) ou Ambiente Nacional. `type SimAutorizador = 'uf' | 'svc' | 'an'`
- `SimEffect`: O que fazer com a conexão: responder, derrubar ou deixar sem resposta até o cliente desistir. `type SimEffect = 'respond' | 'drop' | 'hang'`
- `SimFault`: Falha de rede injetada.
- `SimServico`: Serviço atendido pelo simulador: da NF-e ou do MDF-e, com os nomes que o `@sinete/transport` usa. `type SimServico = NfeServico | MdfeServicoSim`
- `SituacaoMdfe`: `type SituacaoMdfe = 'autorizado' | 'cancelado' | 'encerrado'`
- `SituacaoNfe`: `type SituacaoNfe = 'autorizada' | 'cancelada' | 'denegada'`
- `Svc`: SVC que atende a UF simulada quando a contingência está ativa. `type Svc = 'SVC-AN' | 'SVC-RS'`
- `SyntheticRole`: Papel do certificado, que decide as extensões. `type SyntheticRole = 'ac' | 'titular' | 'servidor'`

### Constantes

- `DEFAULT_RULES`: Regras padrão do simulador. `DEFAULT_RULES: SimRules`
- `MDFE_NS`: Os web services do MDF-e 3.00 (MOC MDF-e 3.00b Visão Geral, itens 3.4.1 e 4.2 a 5.1), todos na SVRS, que o simulador atende pelo autorizador `uf`. `MDFE_NS = "http://www.portalfiscal.inf.br/mdfe"`
- `MDFE_SERVICES`: `MDFE_SERVICES: Readonly<Record<MdfeServicoSim, ServiceDef>>`
- `NFE_NS`: `NFE_NS = "http://www.portalfiscal.inf.br/nfe"`
- `NFE_SERVICES`: `NFE_SERVICES: Readonly<Record<NfeServico, ServiceDef>>`
- `NFSE_REGRAS_PADRAO`: Regras padrão do simulador, na ordem de avaliação. `NFSE_REGRAS_PADRAO: NfseSimRegras`
- `NFSE_SIM_PREFIXOS`: Prefixo de cada API da NFS-e no simulador. `NFSE_SIM_PREFIXOS: Readonly<Record<NfseApi, string>>`
- `SIM_BASE_URL`: Origem fictícia das URLs do transporte em processo. `SIM_BASE_URL = "https://sefaz-sim.invalid"`
