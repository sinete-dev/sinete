---
'@sinete/sefaz-sim': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

Mudanças de comportamento:

- Os JSON de dados (`status.json`, `mdfe-status.json`, `svc.json`) passam a `versaoDoFormato: 2`, com as chaves em português.
- `NfseSim.clearFaults` → `limparFalhas`, como no `SefazSim`.

Nomes exportados:

| Antigo | Novo |
|---|---|
| `CertCheck` | `ConferenciaDoCertificado` |
| `CertIdentity` | `IdentidadeDoCertificado` |
| `SignatureCheck` | `ConferenciaDaAssinatura` |
| `SignatureCheckInput` | `EntradaConferenciaAssinatura` |
| `checkAssinatura` | `conferirAssinaturaDoDocumento` |
| `checkTransmissor` | `conferirTransmissor` |
| `RequestContext` | `ContextoDoPedido` |
| `Runtime` | `EstadoDeExecucao` |
| `SimConfig` | `ConfiguracaoSim` |
| `SimHandler` | `TratadorSim` |
| `MotivoParams` | `ParametrosDoMotivo` |
| `isDenegacao` | `ehDenegacao` |
| `isResultado` | `ehResultado` |
| `NfseSimOptions` | `NfseSimOpcoes` |
| `NfseSimFaultTarget` | `AlvoDaFalhaNfseSim` |
| `NfseSimFullOptions` | `NfseSimOpcoesCompletas` |
| `NfseSimInspect` | `InspecaoNfseSim` |
| `createNfseSim` | `criarNfseSim` |
| `redirectNfseToSim` | `redirecionarNfseParaSim` |
| `SyntheticPfxOptions` | `PfxSinteticoOpcoes` |
| `syntheticPfx` | `pfxSintetico` |
| `AutorizacaoContext` | `ContextoAutorizacao` |
| `EventoContext` | `ContextoEvento` |
| `EventoFacts` | `FatosEvento` |
| `InutilizacaoContext` | `ContextoInutilizacao` |
| `InutilizacaoFacts` | `FatosInutilizacao` |
| `NfeFacts` | `FatosNfe` |
| `SimRejection` | `RejeicaoSim` |
| `SimRule` | `RegraSim` |
| `SimRules` | `RegrasSim` |
| `SimView` | `VisaoSim` |
| `chaveRejection` | `rejeicaoDaChave` |
| `DEFAULT_RULES` | `REGRAS_PADRAO` |
| `firstRejection` | `primeiraRejeicao` |
| `SefazSimServer` | `ServidorSefazSim` |
| `SefazSimServerOptions` | `ServidorSefazSimOpcoes` |
| `SimServer` | `ServidorSim` |
| `startSefazSimServer` | `iniciarServidorSefazSim` |
| `startSimServer` | `iniciarServidorSim` |
| `ServiceDef` | `DefinicaoDeServico` |
| `SimAutorizador` | `AutorizadorSim` |
| `SimServico` | `ServicoSim` |
| `isMdfeServico` | `ehServicoMdfe` |
| `MDFE_SERVICES` | `SERVICOS_MDFE` |
| `NFE_SERVICES` | `SERVICOS_NFE` |
| `routeOf` | `rotaDe` |
| `serviceDef` | `definicaoDoServico` |
| `servicePath` | `caminhoDoServico` |
| `soapAction` | `acaoSoap` |
| `wsdlNamespace` | `namespaceDoWsdl` |
| `FaultTarget` | `AlvoDaFalha` |
| `SefazSimOptions` | `SefazSimOpcoes` |
| `SimEffect` | `EfeitoSim` |
| `SimFault` | `FalhaSim` |
| `SimInspect` | `InspecaoSim` |
| `SimRequest` | `PedidoSim` |
| `SimResult` | `RespostaSim` |
| `createSefazSim` | `criarSefazSim` |
| `DistDoc` | `DocumentoDaDistribuicao` |
| `EventoRecord` | `RegistroEvento` |
| `InutilizacaoRecord` | `RegistroInutilizacao` |
| `LoteRecord` | `RegistroLote` |
| `MdfeEventoRecord` | `RegistroEventoMdfe` |
| `MdfeRecord` | `RegistroMdfe` |
| `NfeRecord` | `RegistroNfe` |
| `PendingNfe` | `NfePendente` |
| `SyntheticCertificate` | `CertificadoSintetico` |
| `SyntheticCertificateOptions` | `CertificadoSinteticoOpcoes` |
| `SyntheticRole` | `PapelSintetico` |
| `syntheticCertificate` | `certificadoSintetico` |
| `SimTransportOptions` | `TransporteSimOpcoes` |
| `redirectToSim` | `redirecionarParaSim` |
| `SIM_BASE_URL` | `URL_BASE_SIM` |
| `simAutorizadorOf` | `autorizadorSimDe` |
| `simTransport` | `transporteSim` |

Membros e parâmetros com nome:

| Tipo | Antigo | Novo |
|---|---|---|
| `NfseSim`, `SefazSim`, `TratadorSim` | `handle.request` | `atender.pedido` |
| `NfseSim`, `SefazSim` | `injectFault.fault` | `injetarFalha.falha` |
| `NfseSim`, `SefazSim` | `injectFault.target` | `injetarFalha.alvo` |
| `SefazSim` | `url.baseUrl` | `url.urlBase` |
| `RegraSim` | `check.ctx` | `conferir.contexto` |
| `rotaDe` | `@retorno.def` | `@retorno.definicao` |
| `ContextoAutorizacao`, `ContextoEvento`, `ContextoInutilizacao` | `view` | `visao` |
| `ContextoAutorizacao`, `DpsFatos`, `ContextoEvento`, `EventoNfseFatos`, `ContextoInutilizacao` e mais 4 | `now` | `agora` |
| `ConferenciaDoCertificado`, `ConferenciaDaAssinatura` | `identity` | `identidade` |
| `IdentidadeDoCertificado` | `info` | `certificado` |
| `DpsFatos`, `EventoNfseFatos`, `EstadoDeExecucao`, `SefazSim`, `VisaoSim` | `config` | `configuracao` |
| `AlvoDaFalha`, `AlvoDaFalhaNfseSim` | `times` | `vezes` |
| `RegistroLote` | `receivedAt` | `recebidoEm` |
| `RegistroLote` | `availableAt` | `disponivelEm` |
| `RegistroLote` | `pending` | `pendente` |
| `RegistroLote` | `processedAt` | `processadoEm` |
| `NfseSim`, `SefazSim`, `TratadorSim` | `handle` | `atender` |
| `NfseSim`, `SefazSim` | `injectFault` | `injetarFalha` |
| `NfseSim`, `SefazSim` | `inspect` | `inspecao` |
| `NfseSimOpcoes`, `SefazSimOpcoes`, `ConfiguracaoSim`, `CertificadoSinteticoOpcoes` | `clock` | `relogio` |
| `NfseSimOpcoes`, `CertificadoSintetico` | `signer` | `assinador` |
| `NfePendente` | `emitenteKey` | `chaveDoEmitente` |
| `ContextoDoPedido`, `acaoSoap`, `namespaceDoWsdl` | `def` | `definicao` |
| `EstadoDeExecucao` | `state` | `estado` |
| `SefazSim`, `PedidoSim`, `rotaDe` | `path` | `caminho` |
| `SefazSim`, `NfseSim` | `clearFaults` | `limparFalhas` |
| `SefazSim` | `setParalisacao` | `definirParalisacao` |
| `SefazSim` | `setParalisacaoMdfe` | `definirParalisacaoMdfe` |
| `SefazSim` | `setProtocoloSemDigVal` | `definirProtocoloSemDigVal` |
| `SefazSim` | `setContingencia` | `definirContingencia` |
| `SefazSim` | `setAtivacaoSvc` | `definirAtivacaoSvc` |
| `SefazSim` | `settle` | `processarLotes` |
| `SefazSimOpcoes`, `ConfiguracaoSim`, `rejeicaoDaChave` | `offsetMinutes` | `deslocamentoMin` |
| `SefazSimOpcoes`, `ConfiguracaoSim`, `primeiraRejeicao` | `rules` | `regras` |
| `DefinicaoDeServico` | `operation` | `operacao` |
| `DefinicaoDeServico` | `style` | `estilo` |
| `ConferenciaDaAssinatura` | `certificateDer` | `certificadoDer` |
| `EntradaConferenciaAssinatura` | `doc` | `documento` |
| `EntradaConferenciaAssinatura` | `element` | `elemento` |
| `FalhaSim` | `kind` | `tipo` |
| `FalhaSim` | `phase` | `fase` |
| `RejeicaoSim`, `motivo`, `motivoMdfe`, `motivoRejeicao` | `params` | `parametros` |
| `PedidoSim` | `method` | `metodo` |
| `PedidoSim`, `RespostaSim` | `headers` | `cabecalhos` |
| `PedidoSim`, `RespostaSim` | `body` | `corpo` |
| `PedidoSim`, `TransporteSimOpcoes` | `clientCertificate` | `certificadoDoCliente` |
| `RespostaSim` | `effect` | `efeito` |
| `RespostaSim` | `delayMs` | `atrasoMs` |
| `RegraSim` | `source` | `fonte` |
| `RegraSim` | `check` | `conferir` |
| `TransporteSimOpcoes` | `policy` | `politica` |
| `TransporteSimOpcoes` | `rejectOn403` | `recusarEm403` |
| `VisaoSim` | `nfeByNumero` | `nfePorNumero` |
| `VisaoSim` | `pendenteByNumero` | `pendentePorNumero` |
| `CertificadoSintetico` | `keyPem` | `chavePem` |
| `CertificadoSintetico` | `tlsIdentity` | `identidadeTls` |
| `CertificadoSintetico` | `signTbs` | `assinarTbs` |
| `CertificadoSinteticoOpcoes` | `role` | `papel` |
| `CertificadoSinteticoOpcoes` | `validDays` | `diasDeValidade` |
| `CertificadoSinteticoOpcoes` | `issuer` | `emissor` |
| `CertificadoSinteticoOpcoes` | `omitDocumentExtension` | `omitirExtensaoDoDocumento` |
| `PfxSinteticoOpcoes` | `chain` | `cadeia` |
| `conferirAssinaturaDoDocumento` | `input` | `entrada` |
| `criarNfseSim`, `criarSefazSim`, `transporteSim`, `certificadoSintetico`, `pfxSintetico` e mais 2 | `options` | `opcoes` |
| `primeiraRejeicao` | `ctx` | `contexto` |
| `redirecionarNfseParaSim`, `redirecionarParaSim` | `transport` | `transporte` |
| `redirecionarNfseParaSim`, `redirecionarParaSim`, `ServidorSim` | `baseUrl` | `urlBase` |
| `pfxSintetico`, `ServidorSefazSimOpcoes` | `cert` | `certificado` |
| `ServidorSefazSimOpcoes` | `key` | `chave` |
| `ServidorSefazSimOpcoes` | `requestCert` | `pedirCertificado` |
| `ServidorSefazSimOpcoes` | `hostname` | `host` |
| `ServidorSefazSimOpcoes`, `ServidorSim` | `port` | `porta` |
| `ServidorSim` | `close` | `fechar` |

Valores de união literal e textos:

| Tipo | Antigo | Novo |
|---|---|---|
| `EfeitoSim` | `'respond'` | `'responder'` |
| `EfeitoSim` | `'drop'` | `'derrubar'` |
| `EfeitoSim` | `'hang'` | `'travar'` |
| `FalhaSim` | `'delay'` | `'atraso'` |
| `FalhaSim` | `'drop'` | `'derrubar'` |
| `FalhaSim` | `'hang'` | `'travar'` |
| `FalhaSim` | `'before'` | `'antes'` |
| `FalhaSim` | `'after'` | `'depois'` |

Chaves dos JSON de dados:

| Arquivo | Antigo | Novo |
|---|---|---|
| `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `schemaVersion` | `versaoDoFormato` |
| `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `source` | `fonte` |
| `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `retrievedAt` | `coletadoEm` |
| `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `note` | `nota` |
| `data/mdfe-status.json`, `data/status.json`, `data/svc.json` | `codes` | `codigos` |
