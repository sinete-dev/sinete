# @sinete/sefaz-sim

## 0.4.0

### Minor Changes

- 40ed7f6: MDF-e transportado no modal aquaviário (`infMDFeTransp`). `DadosMdfeAquaviario` aceita `descarregamentos[].mdfe` (`MdfeTransportado`: chave, `indReentrega`, `unidadesTransporte` no tipo `TUnidadeTransp` do leiaute e `perigosos`), e o `tot` ganha `qMDFe` pela contagem. `CamposMdfe` passa a ter um parâmetro de tipo para o descarregamento (`CamposMdfe<D extends Descarregamento = Descarregamento>`, com `DescarregamentoAquaviario` no aquaviário); quem usa `CamposMdfe` sem parâmetro não muda. O município que só tem MDF-e transportado deixa de ser recusado pela F26 (616), como o texto oficial da 616 já previa.
  
  O montador confere F43 (647, só no aquaviário, inclusive para quem passa `mdfe` sem tipos em outro modal), F44 (648, carregamento ou descarregamento no AM ou no AP), F45 (649, chave de MDF-e com DV e modelo 58) e F45a (520, chave anterior a 6 meses, NT 2024.001), com `origem: 'entrada'` e o caminho `descarregamentos[i].mdfe[j]`. `rotuloDoCaminho` rotula esses caminhos como os da NF-e e do CT-e (`Documento 1 do descarregamento 1, Chave de acesso`).
  
  O simulador confere F45 (649), F45a (520), F46 (655, MDF-e referenciado que ele não autorizou), F48 (657, cancelado) e F49 (658, modal que não é o rodoviário). Um teste que referenciava uma chave inventada e esperava 100 passa a receber 655.
- 5961eaf: NF-e com DANFE Simplificado Tipo 2 (`tpImp` 6) sob as regras da NFC-e que a NT 2026.002 v1.11 estende a ela (homologação desde 01/07/2026, produção desde 03/08/2026). O `montarNfe` passa a recusar na entrada, com o caminho do campo, `origem: 'entrada'` e a rejeição na mensagem, o que antes só a SEFAZ recusava: `dhSaiEnt` (B10-10, 705), `tpNF` 0 (B11-10, 706), `idDest` diferente de 1 (B11a-10, 707), `finNFe` diferente de 1 (B25-20, 715), `indFinal` 0 (B25a-10, 716), `indPres` fora de 1, 4 e 5 (B25b-20, 717), nota referenciada (BA01-10, 708), `emitente.IEST` (C18-10, 718), destinatário ausente na entrega a domicílio (E01-20, 787), os grupos de item, transporte, cobrança, compra e cana que a NFC-e não tem, e duas regras novas para a NFC-e e a Tipo 2: local de retirada (F01-10, 669) e item fora do total, `indTot` 0 (I17b-10, 774).
  
  Os padrões mudam na Tipo 2: sem `indPres`, sai 1 (era 9, que a SEFAZ recusa com 717); sem `idDest`, sai 1 mesmo com o consumidor em outra UF (era 2, recusado com 707). Em homologação, a descrição do primeiro item da Tipo 2 é a literal da I04-10, como na NFC-e. O local de entrega (G01-10, 670) não é conferido: a NT o marca como implementação futura. A mensagem das regras da NFC-e na Tipo 2 começa por "NF-e com DANFE Simplificado Tipo 2" em vez de "NFC-e".
  
  O simulador recusa a NF-e Tipo 2 com 706, 707, 715, 716 e 717, como a NFC-e.
- d878b71: O simulador segue a NT 2026.007 v1.10 para a NF-e sem IE do emitente (contribuinte exclusivo do IBS/CBS): a C17-10 foi excluída e a 229 deixa de sair. A NF-e sem IE é autorizada quando o simulador faz o papel da SVRS, decidido pela UF configurada nos dados de endpoints do `@sinete/transport`, inclusive de outra UF (sem 410 no lote nem 226 na B02-10), e a consulta e os eventos do emitente dela respondem ali (a P08-10 deixa de recusar com 250 o `cOrgao` da UF da chave); a exceção vale só no endpoint normal da SVRS, e a NF-e sem IE em contingência pela SVC recebe 166; fora da SVRS ela é recusada com 166 (C17-11). A NFC-e sem IE é recusada com 156 (C17-42) até o fim de 2032, como no montador: só quando a data local do `dhEmi` e o instante do recebimento caem antes de 2033. A IE zerada passa de 229 para 209.

### Patch Changes

- Updated dependencies [cab3b84]
  - @sinete/rejeicoes@0.4.1

## 0.3.0

### Minor Changes

- 2b724ae: MDF-e do modal aéreo. `DadosMdfe` passa a ser a união `DadosMdfeRodoviario | DadosMdfeAereo` (com `CamposMdfe` para os campos comuns): quem passa `rodoviario` continua compilando, mas quem lê `dados.rodoviario` de um `DadosMdfe` precisa estreitar para `DadosMdfeRodoviario`. O grupo `aereo` (nac, matr, nVoo, cAerEmb, cAerDes, dVoo) monta `modal` 2, e o CT-e ganha `entregaParcial` (corte de voo, `infEntregaParcial`). As regras do Anexo I que só valem no rodoviário (percurso F90, seguro F91 a F93, produto predominante F54/F55 e as do veículo) deixam de valer no aéreo; F23 (705) recusa o carregamento posterior fora do rodoviário e F34 (702) a entrega parcial fora do aéreo. Entrada sem modal ou com dois vira ocorrência (`campo_obrigatorio` em `rodoviario`, `combinacao_invalida` em `aereo`), não exceção. `rotuloDoCaminho` ganha os rótulos do aéreo, e `infMDFe.infModal` sozinho passa de "Transporte rodoviário" para "Modal".
  
  No `@sinete/sefaz-sim`, a recepção do MDF-e aplica F23 (705) e F34 (702).
- 61b48f6: MDF-e do modal aquaviário, o último dos quatro. `DadosMdfe` ganha o caso `DadosMdfeAquaviario`, com o grupo `aquaviario` (irin, tpEmb, cEmbar, xEmbar, nViag, cPrtEmb, cPrtDest, prtTrans, tpNav, `terminaisCarregamento` e `terminaisDescarregamento` até 5, `comboio` até 30, `unidadesCargaVazias`, `unidadesTransporteVazias` e o `MMSI` opcional da NT 2025.001), que monta `modal` 3. Como nos outros modais, as regras do rodoviário não se aplicam, F23 (705) e F34 (702) seguem o modal. Lista acima do limite do leiaute é `campo_invalido` no grupo. O MDF-e transportado (`infMDFeTransp`, F43 a F49) fica para a #57. `rotuloDoCaminho` ganha os rótulos de terminais, comboio e unidades vazias.
  
  No `@sinete/sefaz-sim`, a recepção do MDF-e aplica F43 (647) e F44 (648) ao MDF-e transportado (`infMDFeTransp`).
- adb6148: Tabela de CFOP do Portal da NF-e no `@sinete/validators` (`indicadoresCfop`, `TABELA_CFOP`; IT 2023.002 v2.10). Com ela, o `montarNfe` confere antes de assinar o CFOP de devolução fora da devolução (I08-144, rejeição 328) e o CST com destinatário não contribuinte (N12-70, rejeição 508, com as exceções da NT 2023.001 e da NT 2023.003), e o `@sinete/sefaz-sim` recusa os dois casos com o mesmo código.
- e6c8f28: NF-e com DANFE Simplificado Tipo 2 (`tpImp` 6, NT 2026.002 v1.11): o `montarNfe` gera o `infNFeSupl` com o QR Code versão 3 na URL da NFC-e da UF, recusa a versão 2 (672) e aceita a contingência off-line (`tpEmis` 9) nela; a chave de acesso passa a aceitar `tpEmis` 9 no modelo 55. O `@sinete/sefaz-sim` deixa de recusar o `infNFeSupl` da NF-e (393, que saiu da NT), exige o QR Code na NF-e Tipo 2 (394) e confere a versão (672). O catálogo do `@sinete/rejeicoes` ganha o 672 (ZX02-220), e o `campoVolatil` do emissor acompanha.

### Patch Changes

- Updated dependencies [4ba29b8]
- Updated dependencies [adb6148]
- Updated dependencies [cc09d66]
- Updated dependencies [e6c8f28]
- Updated dependencies [eb06ce6]
- Updated dependencies [dec66f5]
- Updated dependencies [30d6381]
  - @sinete/cert@0.2.2
  - @sinete/validators@0.3.0
  - @sinete/rejeicoes@0.4.0
  - @sinete/schemas@0.3.0
  - @sinete/transport@0.3.0

## 0.2.1

### Patch Changes

- 64b8d8a: **Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.
- Updated dependencies [395f19c]
- Updated dependencies [5547ca1]
- Updated dependencies [64b8d8a]
  - @sinete/rejeicoes@0.3.0
  - @sinete/core@0.3.0
  - @sinete/cert@0.2.1
  - @sinete/schemas@0.2.1
  - @sinete/transport@0.2.1
  - @sinete/validators@0.2.1

## 0.2.0

### Minor Changes

- 2a46db6: Acompanham a fase 2 do ADR 0015 (`@sinete/cert`, `@sinete/transport`, runtime do `@sinete/schemas`, `@sinete/ibs-cbs-dados` e `@sinete/ibs-cbs` com nomes em português). Os tipos desses pacotes que estes recebem e devolvem mudam, e o código de quem os usa muda junto; a tabela completa está nos changesets de cada pacote da fase. Nomes destes pacotes que também mudam:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | `CertificadoAberto` (`@sinete/emissor`) | `signer` | `assinador` |
  | `syntheticCertificate(...).tlsIdentity` (`@sinete/sefaz-sim`) | `{ kind: 'pem', certChain, key }` | `{ tipo: 'pem', cadeia, chave }`, a forma da `IdentidadeTls` |
  | `simTransport` (`@sinete/sefaz-sim`) | `runtime: 'custom'` | `runtime: 'personalizada'` |
- ae8ab90: Acompanham a fase 1 do ADR 0015 (`@sinete/core`, `@sinete/validators` e `@sinete/rejeicoes` com nomes em português). Nenhum nome próprio destes pacotes muda nesta fase, mas os tipos do core que eles recebem e devolvem mudam, e o código de quem os usa muda junto. Os mais visíveis:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | desfecho dos clientes (`ResultadoSefaz`, antes `SefazOutcome`) | `status: 'authorized' \| 'rejected' \| 'denied' \| 'pending'` | `tipo: 'autorizado' \| 'recusado' \| 'denegado' \| 'pendente'` |
  | desfecho autorizado ou denegado | `value` | `valor` |
  | desfecho recusado | `hint` (`probableCause`, `suggestedFix`, `source`) | `dica` (`causaProvavel`, `comoCorrigir`, `fonte`) |
  | desfecho pendente | `ref`, `retryAfterMs` | `referencia`, `aguardarMs` |
  | erros (`ErroSinete`, antes `SineteError`) | `details`, `docs` | `detalhes`, `pagina` |
  | ocorrências (`Ocorrencia`, antes `ValidationIssue`) | `path`, `message` | `caminho`, `mensagem` |
  | `ErroDeValidacao` (antes `ValidationError`) | `issues` | `ocorrencias` |
  | assinador (`Assinador`, antes `Signer`) | `kind: 'data' \| 'digest'`, `sign`, `signDigestInfo`, `certificateDer` | `tipo: 'dados' \| 'digest'`, `assinar`, `assinarDigestInfo`, `certificadoDer` |
  | relógio (`Relogio`, antes `Clock`) | `now()` | `agora()` |
  | resultado local (`Resultado`, antes `Result`) | `value`, `error` | `valor`, `erro` |
  
  A tabela completa de cada pacote da fase está nos changesets do `@sinete/core`, do `@sinete/validators` e do `@sinete/rejeicoes`.
- 84080ad: Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
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

### Patch Changes

- Updated dependencies [4a3d258]
- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [ae8ab90]
- Updated dependencies [ae8ab90]
- Updated dependencies [2a46db6]
- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [d824983]
  - @sinete/validators@0.2.0
  - @sinete/cert@0.2.0
  - @sinete/core@0.2.0
  - @sinete/transport@0.2.0
  - @sinete/schemas@0.2.0
  - @sinete/rejeicoes@0.2.0

## 0.1.0

### Minor Changes

- 515861a: Protocolo sem `digVal` (opcional no leiaute) deixa de prender a gravação. A denegação (110, 301, 302, 303) é decisão sobre a chave: na resposta do envio e na consulta, o emissor devolve `denegado`, definitivo, mesmo sem `digVal`, com `conteudo` (`confere`, `sem-digval` ou `difere`), os bytes gravados em `xml` e o `proc` só quando o `digVal` confere (`proc` passa a ser opcional no `DesfechoDenegado`). A autorização sem `digVal` nem na consulta vira `divergente` com `conteudo: 'sem-digval'`, com os bytes mantidos e alerta na primeira retomada, em vez de `pendente` para sempre; o mesmo vale para o MDF-e. No `@sinete/nfe` e no `@sinete/mdfe`, o `resolverEnvioSemResposta` ganha a ação `sem-prova` e, na NF-e, conclui a denegação com qualquer conteúdo, dizendo qual em `conteudo`. O `@sinete/sefaz-sim` ganha `setProtocoloSemDigVal` para reproduzir o caso.
- 515861a: A API de geração do DANFSe do ADN, suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026), sai dos dados e do simulador. Mudança de API: `NfseApi` do `@sinete/transport` não tem mais `'danfse'`, e o `nfseEndpoint` não resolve mais essa base; no `@sinete/sefaz-sim`, `NFSE_SIM_PREFIXOS` perde a chave `danfse`, `NfseRota` perde a rota `'danfse'` e o `GET /danfse/{chave}` passa a responder 404. O DANFSe v2 sai do XML da NFS-e pelo `@sinete/da/nfse`.
- 515861a: Ativação da SVC por UF (NT 2013.007 v1.03): `setAtivacaoSvc(ativacao, uf?)` com `ativa` (107 no status da SVC), `desativando` até uma hora (113, com a data e a hora no `xMotivo`, e a autorização ainda aceita) ou `inativa` (114 no status e na autorização, regras C03.2, GB02.2 e K05.1). Com a SVC desligada, o simulador responde 114 em vez de HTTP 503, e o retorno e a consulta da SVC continuam atendendo. `setContingencia` segue ligando a UF em 108 com a SVC ativada, e desfaz o ajuste por UF.
- 515861a: Primeira versão do @sinete/sefaz-sim: SEFAZ simulada com estado e relógio injetado para testes. Atende os web services da NF-e 4.00 com os nomes reais dos WSDL (status, autorização síncrona e assíncrona com recibo, consulta de recibo e de protocolo, eventos de cancelamento, cancelamento por substituição, CC-e e manifestação no AN, inutilização, consulta cadastro e distribuição de DF-e com docZip), valida na ordem da SEFAZ (schema oficial, assinatura, certificado do transmissor e regras de negócio plugáveis com a origem no MOC 7.0), gera protocolos e recibos determinísticos, simula paralisação, contingência SVC, atraso, queda e falta de resposta depois de processar, e roda em processo (`simTransport`) ou como servidor HTTPS com mTLS (`startSefazSimServer`). Traz certificados sintéticos (AC, e-CNPJ, e-CPF e servidor) gerados na hora.
- 515861a: Novo `redirectToSim(transport, baseUrl)`: envolve um `Transport` e manda ao simulador os pedidos que um cliente de documento resolveu pelos dados de endpoints (NF-e e NFC-e), trocando só a URL pelo caminho do autorizador simulado (`simAutorizadorOf`), e recusa pedido sem endpoint. O 110112 passa a ser validado pelo e110112 oficial (só `tpAutor` 1; outro autor é 493), e a inutilização ganha a regra I02a da NT 2018.001 (266 para série 910 a 969).
- 515861a: MDF-e 3.00b no simulador: `MDFeStatusServico`, `MDFeRecepcaoSinc` (área de dados em GZip e Base64), `MDFeConsulta`, `MDFeConsNaoEnc` e `MDFeRecepcaoEvento` (cancelamento, encerramento, inclusão de condutor, inclusão de DF-e e pagamento da operação), com estado próprio e as regras do MOC do MDF-e: duplicidade (204 e 539), não encerrados (611, 686, 462, 662), prazo de cancelamento, encerramento e cancelamento que mudam a situação, contingência off-line e emissão normal atrasada (228), QR Code e as regras J e K dos eventos. Novas opções `prazoCancelamentoMdfeHoras`, `tamanhoMaximoMdfe` e `regrasMdfeDesligadas`, `setParalisacaoMdfe`, `inspect.mdfe`, `MDFE_SERVICES`; o `redirectToSim` passa a aceitar os pedidos do MDF-e. Também as regras da NT 2024.001 (518, 519, 523 e o encerramento pelo transportador terceiro, J09 e K11), com a área de dados compactada lida aos pedaços e recusada com 214 ao passar do limite.
- 515861a: Autorização da NFC-e (modelo 65): regras da identificação (706, 709, 710, 711, 715 a 717), do QR Code (393, 394, 396 a 398, 444, 445, 474, 583, com a assinatura da versão 3 off-line conferida), lote de uma NFC-e só (126) e rejeição 781 no lugar da denegação.
- 515861a: A consulta de eventos da NFS-e simulada segue a Sefin real (produção restrita, 28/09/2026): 405 em `GET /sefin/nfse/{chave}/eventos`, 404 com página HTML em `.../eventos/{tipo}`, 200 em `.../eventos/{tipo}/{seq}` com `eventos[]` (`chaveAcesso`, `tipoEvento`, `numeroPedidoRegistroEvento`, `dataHoraRecebimento`, `arquivoXml` em base64 do gzip em base64) e 404 com `{}` sem o evento. `EventoNfseRegistro` ganha `recebidoEm`.
- 515861a: NFS-e Nacional simulada (`createNfseSim`): Sefin e ADN com estado e relógio injetado, atendidos pelo `simTransport` em processo e pelo novo `startSimServer` genérico em HTTPS com mTLS. `redirectNfseToSim` troca a base de cada API pelo simulador.
  
  - **Recepção.** Na ordem do Anexo I: certificado do canal, base64, gzip, declaração UTF-8, prefixo de namespace e schema do leiaute vigente, depois a assinatura (E0714 a E0718).
  - **Regras de negócio como dado** (`NFSE_REGRAS_PADRAO`), com a fonte na planilha: E0006, E0015, E0037, E0038, E1270, E0014, E0042, E0046, E0312, E0617 e, nos eventos, E1845, E1831, E0840 e E0822.
  - **NFS-e gerada.** Traz a DPS embutida byte a byte e a assinatura da Sefin simulada.
  - **Substituição.** Registra o e105102 na NFS-e substituída.
  - **Outras rotas.** Cancelamento e análise fiscal, consultas, parametrização municipal e um DANFSe de teste.
  - **Falhas injetáveis por rota.**
- 515861a: Novo `syntheticPfx(certificado, senha, { chain })`: o PFX de um certificado sintético (PBE com 3DES, a AC como intermediária), para testar quem recebe o certificado como arquivo e senha, como os emissores do `@sinete/emissor`. O node-forge entra como dependência, o mesmo leitor do `@sinete/cert`.

### Patch Changes

- 515861a: A consulta cadastro do MT no simulador segue o MT de verdade: exige `nfeDadosMsg` dentro de `consultaCadastro` e responde com `consultaCadastroResult` dentro de `nfeResultMsg`. As outras UFs aceitam as duas formas e respondem na forma recebida.
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/cert@0.1.0
  - @sinete/transport@0.1.0
  - @sinete/core@0.1.0
  - @sinete/rejeicoes@0.1.0
  - @sinete/schemas@0.1.0
  - @sinete/validators@0.1.0
