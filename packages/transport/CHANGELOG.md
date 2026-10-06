# @sinete/transport

## 0.3.0

### Minor Changes

- 30d6381: Dois códigos novos em `CodigoErroTransporte`: `certificado_expirado` (alerta TLS 45, `certificate_expired`) e `certificado_revogado` (alerta 44, `certificate_revoked`), com a mensagem e a dica de cada um, no transporte em processo e no helper `sinete-signer`. O alerta continua em `detalhes.alerta`.
  
  Caso novo de união aberta (ADR 0016, seção 2): `certificado_recusado` deixa de cobrir os alertas 44 e 45 e fica com os alertas 43, 46, 48 e 49. Quem comparava `code === 'certificado_recusado'` para dizer "certificado não aceito" passa a receber os dois códigos novos nesses casos; quem compara o prefixo `certificado_` não muda. O `certificado_expirado` é o mesmo `code` que o `@sinete/cert` já usa para o PFX vencido na abertura, e a página `docs/guia/erros/certificado_expirado.md` passa a cobrir os dois.

### Patch Changes

- Updated dependencies [4ba29b8]
  - @sinete/cert@0.2.2

## 0.2.1

### Patch Changes

- 64b8d8a: **Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.
- Updated dependencies [5547ca1]
- Updated dependencies [64b8d8a]
  - @sinete/core@0.3.0
  - @sinete/cert@0.2.1

## 0.2.0

### Minor Changes

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
- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `AuditEvent` | `EventoDeAuditoria` |
  | `ExternalTlsHelper` | `HelperTlsExterno` |
  | `HelperHttpRequest` | `PedidoHttpDoHelper` |
  | `HostPolicy` | `PoliticaDeHosts` |
  | `PolicyRequest` | `PedidoParaPolitica` |
  | `TlsIdentity` | `IdentidadeTls` |
  | `TlsInfo` | `DescricaoTls` |
  | `TlsSignContext` | `ContextoAssinaturaTls` |
  | `TlsSigner` | `AssinadorTls` |
  | `Transport` | `Transporte` |
  | `TransportCapabilities` | `CapacidadesDoTransporte` |
  | `TransportOptions` | `TransporteOpcoes` |
  | `TransportRequest` | `PedidoTransporte` |
  | `TransportResponse` | `RespostaTransporte` |
  | `TransportRuntime` | `RuntimeDoTransporte` |
  | `PolicyError` | `ErroPolitica` |
  | `SignerError` | `ErroSigner` |
  | `SignerErrorCode` | `CodigoErroSigner` |
  | `TransportError` | `ErroTransporte` |
  | `TransportErrorCode` | `CodigoErroTransporte` |
  | `TransportUnsupportedError` | `ErroTransporteNaoSuportado` |
  | `ENDPOINT_DATA` | `DADOS_DE_ENDPOINTS` |
  | `EndpointDataInfo` | `DescricaoDadosDeEndpoints` |
  | `EndpointRef` | `EndpointResolvido` |
  | `NfceConsultaUrls` | `UrlsConsultaNfce` |
  | `NfceEndpointQuery` | `BuscaEndpointNfce` |
  | `NfeEndpointQuery` | `BuscaEndpointNfe` |
  | `TlsProfile` | `PerfilTls` |
  | `allEndpoints` | `todosOsEndpoints` |
  | `ambienteHosts` | `hostsDoAmbiente` |
  | `nfceConsultaUrls` | `urlsConsultaNfce` |
  | `tlsProfileForHost` | `perfilTlsDoHost` |
  | `tlsProfiles` | `perfisTls` |
  | `AllowlistPolicyOptions` | `PoliticaDeHostsPermitidosOpcoes` |
  | `allowlistPolicy` | `politicaDeHostsPermitidos` |
  | `allPolicies` | `todasAsPoliticas` |
  | `DENO_CAPABILITIES` | `CAPACIDADES_DENO` |
  | `DenoHttpApi` | `ApiHttpDeno` |
  | `DenoTransportOptions` | `TransporteDenoOpcoes` |
  | `createDenoTransport` | `criarTransporteDeno` |
  | `NodeTransportOptions` | `TransporteNodeOpcoes` |
  | `checkLocalCertificate` | `conferirCertificadoLocal` |
  | `createNodeTransport` | `criarTransporteNode` |
  | `CreateTransportOptions` | `CriarTransporteOpcoes` |
  | `createTransport` | `criarTransporte` |
  | `HelperFailureData` | `DadosDaFalhaDoHelper` |
  | `classifyHelperFailure` | `classificarFalhaDoHelper` |
  | `classifyTransportFailure` | `classificarFalhaDeTransporte` |
  | `http403Error` | `erroHttp403` |
  | `detectRuntime` | `detectarRuntime` |
  | `unsupportedReasons` | `motivosNaoSuportado` |
  | `pemIdentity` | `identidadePem` |
  | `soap12ContentType` | `contentTypeSoap12` |
  | `soap12Envelope` | `envelopeSoap12` |
  | `soapBody` | `lerBodySoap` |
  | `soapFault` | `lerSoapFault` |
  | `OpenPkcs11Options` | `AbrirPkcs11Opcoes` |
  | `OpenRemoteOptions` | `AbrirRemotoOpcoes` |
  | `SIGNER_PROTOCOL_VERSION` | `VERSAO_PROTOCOLO_SIGNER` |
  | `SignerChannel` | `CanalSigner` |
  | `SignerClientOptions` | `ClienteSignerOpcoes` |
  | `SignerConnection` | `ConexaoSigner` |
  | `SignerHello` | `HelloDoSigner` |
  | `SignerIdentity` | `IdentidadeSigner` |
  | `connectSignerChannel` | `conectarCanalSigner` |
  | `cryptoKeyTlsSigner` | `assinadorTlsDeCryptoKey` |
  | `digestTlsSigner` | `assinadorTlsDeDigest` |
  | `lineSplitter` | `divisorDeLinhas` |
  | `parseTlsTranscript` | `lerTranscricaoTls` |
  | `StartSignerOptions` | `IniciarSignerOpcoes` |
  | `connectSigner` | `conectarSigner` |
  | `startSigner` | `iniciarSigner` |
  | `toSineteError` | `paraErroSinete` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `CanalSigner` | `onLine.listener.line` | `aoReceberLinha.ouvinte.linha` |
  | `CanalSigner` | `onClose.listener.reason` | `aoFechar.ouvinte.motivo` |
  | `IdentidadeSigner` | `resetPool.options.dropSessions` | `reiniciarPool.opcoes.descartarSessoes` |
  | `HelperTlsExterno` | `request.identity` | `enviar.identidade` |
  | `HelperTlsExterno` | `request.request` | `enviar.pedido` |
  | `PoliticaDeHosts` | `check.request` | `conferir.pedido` |
  | `AssinadorTls` | `sign.input` | `assinar.entrada` |
  | `AssinadorTls` | `sign.scheme` | `assinar.esquema` |
  | `AssinadorTls` | `sign.context` | `assinar.contexto` |
  | `Transporte` | `send.request` | `enviar.pedido` |
  | `TransporteOpcoes` | `audit.event` | `auditoria.evento` |
  | `ErroPolitica` | `constructor.details` | `constructor.detalhes` |
  | `identidadePem` | `options.chain` | `opcoes.cadeia` |
  | `ErroSigner`, `ErroTransporte`, `ErroTransporteNaoSuportado` | `constructor.options` | `constructor.opcoes` |
  | `envelopeSoap12` | `options.header` | `opcoes.cabecalho` |
  | `ErroTransporteNaoSuportado` | `constructor.reasons` | `constructor.motivos` |
  | `ErroTransporteNaoSuportado` | `constructor.alternative` | `constructor.alternativa` |
  | `conectarSigner` | `options.socketPath` | `opcoes.caminhoDoSocket` |
  | `CanalSigner` | `send.line` | `enviar.linha` |
  | `CanalSigner` | `onLine.listener` | `aoReceberLinha.ouvinte` |
  | `CanalSigner` | `onClose.listener` | `aoFechar.ouvinte` |
  | `ConexaoSigner` | `openRemote.options` | `abrirRemoto.opcoes` |
  | `ConexaoSigner` | `openPkcs11.options` | `abrirPkcs11.opcoes` |
  | `IdentidadeSigner` | `resetPool.options` | `reiniciarPool.opcoes` |
  | `certificadoAberto` | `options.signer` | `opcoes.assinador` |
  | `certificadoAberto` | `@retorno.signer` | `@retorno.assinador` |
  | `divisorDeLinhas` | `onLine.line` | `aoReceberLinha.linha` |
  | `divisorDeLinhas` | `@retorno.chunk` | `@retorno.pedaco` |
  | `lerTranscricaoTls` | `@retorno.serverCertificate` | `@retorno.certificadoDoServidor` |
  | `criarTransporte`, `politicaDeHostsPermitidos`, `criarTransporteDeno`, `identidadePem`, `envelopeSoap12` e mais 5 | `options` | `opcoes` |
  | `PoliticaDeHostsPermitidosOpcoes` | `ports` | `portas` |
  | `PoliticaDeHostsPermitidosOpcoes` | `requireTpAmbInBody` | `exigirTpAmbNoCorpo` |
  | `EventoDeAuditoria` | `path` | `caminho` |
  | `EventoDeAuditoria`, `PedidoHttpDoHelper`, `PedidoParaPolitica`, `PedidoTransporte` | `method` | `metodo` |
  | `EventoDeAuditoria` | `errorCode` | `codigoDoErro` |
  | `EventoDeAuditoria` | `durationMs` | `duracaoMs` |
  | `TransporteDenoOpcoes` | `unknownHosts` | `hostsDesconhecidos` |
  | `DescricaoDadosDeEndpoints` | `endpointsVersion` | `versaoDosEndpoints` |
  | `DescricaoDadosDeEndpoints` | `tlsProfilesVersion` | `versaoDosPerfisTls` |
  | `DescricaoDadosDeEndpoints` | `tlsProfilesSource` | `fonteDosPerfisTls` |
  | `EndpointResolvido`, `UrlsConsultaNfce` | `source` | `fonte` |
  | `HelperTlsExterno` | `protocolVersion` | `versaoDoProtocolo` |
  | `HelperTlsExterno` | `request` | `enviar` |
  | `HelperTlsExterno`, `Transporte`, `CanalSigner`, `IdentidadeSigner` | `close` | `fechar` |
  | `PedidoHttpDoHelper`, `PedidoTransporte`, `RespostaTransporte` | `headers` | `cabecalhos` |
  | `PedidoHttpDoHelper`, `PedidoParaPolitica`, `PedidoTransporte`, `RespostaTransporte`, `envelopeSoap12` | `body` | `corpo` |
  | `PoliticaDeHosts` | `check` | `conferir` |
  | `IdentidadeTls` | `kind` | `tipo` |
  | `IdentidadeTls` | `certChain` | `cadeia` |
  | `IdentidadeTls`, `assinadorTlsDeCryptoKey` | `key` | `chave` |
  | `IdentidadeTls`, `TransporteOpcoes`, `certificadoAberto` | `identity` | `identidade` |
  | `DescricaoTls` | `protocol` | `protocolo` |
  | `DescricaoTls`, `PerfilTls` | `cipher` | `cifra` |
  | `DescricaoTls` | `resumed` | `retomada` |
  | `DescricaoTls` | `clientCertificateLoaded` | `certificadoLocalCarregado` |
  | `DescricaoTls` | `signatures` | `assinaturas` |
  | `PerfilTls` | `uses` | `usos` |
  | `PerfilTls` | `tlsVersions` | `versoesTls` |
  | `PerfilTls` | `maxTls` | `tlsMaximo` |
  | `PerfilTls` | `keyExchange` | `trocaDeChaves` |
  | `PerfilTls` | `clientCert` | `certificadoDoCliente` |
  | `PerfilTls` | `clientCertEvidence` | `evidenciaDoCertificadoDoCliente` |
  | `PerfilTls` | `serverRoot` | `raizDoServidor` |
  | `PerfilTls` | `serverRootName` | `nomeDaRaizDoServidor` |
  | `PerfilTls` | `sessionResumption` | `retomadaDeSessao` |
  | `ContextoAssinaturaTls` | `purpose` | `finalidade` |
  | `ContextoAssinaturaTls` | `connectionId` | `idDaConexao` |
  | `AssinadorTls` | `certificateChain` | `cadeia` |
  | `AssinadorTls` | `sign` | `assinar` |
  | `Transporte`, `motivosNaoSuportado` | `capabilities` | `capacidades` |
  | `Transporte`, `CanalSigner` | `send` | `enviar` |
  | `CapacidadesDoTransporte` | `renegotiation` | `renegociacao` |
  | `CapacidadesDoTransporte` | `sigalgsControl` | `controleDeSigalgs` |
  | `CapacidadesDoTransporte` | `clientCertificateCheck` | `conferenciaDoCertificadoLocal` |
  | `TransporteOpcoes` | `policy` | `politica` |
  | `TransporteOpcoes`, `AbrirPkcs11Opcoes`, `AbrirRemotoOpcoes` | `additionalCa` | `acsAdicionais` |
  | `TransporteOpcoes` | `rejectOn403` | `recusarEm403` |
  | `TransporteOpcoes` | `audit` | `auditoria` |
  | `RespostaTransporte` | `text` | `texto` |
  | `todasAsPoliticas` | `policies` | `politicas` |
  | `classificarFalhaDoHelper` | `data` | `dados` |
  | `classificarFalhaDeTransporte` | `err` | `erro` |
  | `classificarFalhaDeTransporte` | `context` | `contexto` |
  | `mdfeEndpoint`, `nfceEndpoint`, `nfeEndpoint`, `nfseEndpoint` | `query` | `busca` |
  | `identidadePem` | `keyStore` | `certificado` |
  | `contentTypeSoap12` | `action` | `acao` |
  | `ErroTransporteNaoSuportado` | `reasons` | `motivos` |
  | `motivosNaoSuportado` | `profile` | `perfil` |
  | `TransporteNodeOpcoes` | `trust` | `confianca` |
  | `TransporteNodeOpcoes` | `keepAlive` | `manterConexao` |
  | `conferirCertificadoLocal` | `expectedLeaf` | `folhaEsperada` |
  | `AbrirPkcs11Opcoes` | `module` | `modulo` |
  | `AbrirPkcs11Opcoes` | `serial` | `numeroDeSerie` |
  | `AbrirPkcs11Opcoes` | `label` | `rotulo` |
  | `AbrirPkcs11Opcoes` | `keyId` | `idDaChave` |
  | `AbrirPkcs11Opcoes`, `IdentidadeSigner`, `assinadorTlsDeCryptoKey`, `assinadorTlsDeDigest` | `chain` | `cadeia` |
  | `AbrirRemotoOpcoes`, `assinadorTlsDeDigest` | `signer` | `assinador` |
  | `AbrirRemotoOpcoes` | `allowedHosts` | `hostsPermitidos` |
  | `AbrirRemotoOpcoes` | `signTimeoutMs` | `prazoDaAssinaturaMs` |
  | `CanalSigner`, `divisorDeLinhas` | `onLine` | `aoReceberLinha` |
  | `CanalSigner` | `onClose` | `aoFechar` |
  | `ClienteSignerOpcoes` | `client` | `cliente` |
  | `ClienteSignerOpcoes` | `controlTimeoutMs` | `prazoDeControleMs` |
  | `ConexaoSigner` | `openRemote` | `abrirRemoto` |
  | `ConexaoSigner` | `openPkcs11` | `abrirPkcs11` |
  | `ConexaoSigner` | `stats` | `estatisticas` |
  | `IdentidadeSigner` | `tlsIdentity` | `identidadeTls` |
  | `IdentidadeSigner` | `documentSigner` | `assinadorDeDocumentos` |
  | `IdentidadeSigner` | `resetPool` | `reiniciarPool` |
  | `conectarCanalSigner` | `channel` | `canal` |
  | `lerTranscricaoTls` | `transcript` | `transcricao` |
  | `IniciarSignerOpcoes` | `binary` | `binario` |
  | `IniciarSignerOpcoes` | `rootsFiles` | `arquivosDeRaizes` |
  | `IniciarSignerOpcoes` | `auditFile` | `arquivoDeAuditoria` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `TransporteDenoOpcoes` | `'allow'` | `'permitir'` |
  | `TransporteDenoOpcoes` | `'refuse'` | `'recusar'` |
  | `TransporteNodeOpcoes` | `'bundled'` | `'embarcada'` |
  | `TransporteNodeOpcoes` | `'system'` | `'sistema'` |
  | `PerfilTls` | `'renegotiation'` | `'renegociacao'` |
  | `RuntimeDoTransporte` | `'custom'` | `'personalizada'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/endpoints.json` | `authorizers` | `autorizadores` |
  | `data/endpoints.json` | `ufMap` | `mapaDeUfs` |
  | `data/endpoints.json` | `retrievedAt` | `coletadoEm` |
  | `data/endpoints.json`, `data/tls-profiles.json` | `source` | `fonte` |
  | `data/endpoints.json` | `consultasSource` | `fonteDasConsultas` |
  | `data/endpoints.json` | `sources` | `fontes` |
  | `data/endpoints.json` | `ufMapRule` | `regraDoMapaDeUfs` |
  | `data/endpoints.json` | `sourceUpdatedAt` | `fonteAtualizadaEm` |
  | `data/tls-profiles.json` | `cipher` | `cifra` |
  | `data/tls-profiles.json` | `clientCert` | `certificadoDoCliente` |
  | `data/tls-profiles.json` | `clientCertEvidence` | `evidenciaDoCertificadoDoCliente` |
  | `data/tls-profiles.json` | `keyExchange` | `trocaDeChaves` |
  | `data/tls-profiles.json` | `maxTls` | `tlsMaximo` |
  | `data/tls-profiles.json` | `serverRoot` | `raizDoServidor` |
  | `data/tls-profiles.json` | `serverRootName` | `nomeDaRaizDoServidor` |
  | `data/tls-profiles.json` | `sessionResumption` | `retomadaDeSessao` |
  | `data/tls-profiles.json` | `tlsVersions` | `versoesTls` |
  | `data/tls-profiles.json` | `uses` | `usos` |
  | `data/endpoints.json`, `data/tls-profiles.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/endpoints.json`, `data/tls-profiles.json` | `version` | `versao` |
  | `data/tls-profiles.json` | `probedAt` | `sondadoEm` |
  Também mudam nesta versão:
  
  - `name` de cada classe de erro é o nome novo da classe (`ErroTransporte`, `ErroSigner`, `ErroPolitica`, `ErroTransporteNaoSuportado`).
  - Chaves de `detalhes`: `reasons` → `motivos` e `alternative` → `alternativa` (`ErroTransporteNaoSuportado`), `alert` → `alerta`, `systemCode` → `codigoDoSistema`, `stage` → `etapa` e `helper` → `mensagemDoHelper` (falhas de rede e TLS), `source` → `fonte` (`servico_nao_oferecido`), `code` → `codigo` (`ErroSigner` com o código do helper).
  - `detectarRuntime()` devolve `'navegador'` onde antes devolvia `'browser'`.
  - Campos do log do helper: `line` → `linha`.
  - `src/data/endpoints.json` e `src/data/tls-profiles.json`: além das chaves, `certificadoDoCliente: 'renegotiation'` passa a `'renegociacao'`, e `versaoDoFormato` sobe para 2.
  - Os nomes do protocolo do helper `sinete-signer` no fio (métodos, campos, `stage`, `x509`, `mode`, `scheme`, `purpose`, `backend`) ficam como estão (exceção 1 do ADR 0015); `Signer` segue como nome próprio (`iniciarSigner`, `ErroSigner`).

### Patch Changes

- Updated dependencies [2a46db6]
- Updated dependencies [ae8ab90]
- Updated dependencies [ae8ab90]
  - @sinete/cert@0.2.0
  - @sinete/core@0.2.0

## 0.1.1

### Patch Changes

- 14defbd: O transporte de Node e Bun fixa `rejectUnauthorized: true` no `https.Agent`. Antes, `NODE_TLS_REJECT_UNAUTHORIZED=0` no processo desligava também a conferência do certificado da SEFAZ feita pelo sinete, que passava a aceitar qualquer servidor.

## 0.1.0

### Minor Changes

- 515861a: A API de geração do DANFSe do ADN, suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026), sai dos dados e do simulador. Mudança de API: `NfseApi` do `@sinete/transport` não tem mais `'danfse'`, e o `nfseEndpoint` não resolve mais essa base; no `@sinete/sefaz-sim`, `NFSE_SIM_PREFIXOS` perde a chave `danfse`, `NfseRota` perde a rota `'danfse'` e o `GET /danfse/{chave}` passa a responder 404. O DANFSe v2 sai do XML da NFS-e pelo `@sinete/da/nfse`.
- 515861a: Novo código `servico_nao_oferecido` (`ServicoNaoOferecidoError`) para o serviço que a tabela oficial de web services não lista para a UF ou o ambiente, como a consulta cadastro de uma UF que a SVRS não atende nesse serviço. Antes esses casos saíam como `config_invalida`, que continua valendo só para defeito de integração. `details` traz `autorizador`, `servico`, `ambiente` e, quando informada, a `uf`.
- 515861a: Primeira versão do @sinete/transport: `Transport` com identidade TLS plugável (`pem` em processo; `helper`, `external` e `pkcs11` como interface do ADR 0005), Node e Bun sobre `node:https` (renegociação, CBC, `sigalgs`, conferência do certificado local), Deno sobre `Deno.createHttpClient` com recusa tipada dos hosts incompatíveis, endpoints de NF-e, MDF-e e NFS-e Nacional e perfis TLS por host como dados, SOAP 1.2, `HostPolicy` com allowlist e erros tipados a partir dos alertas TLS e respostas HTTP observados.
- 515861a: Endpoints da NFC-e (modelo 65) como dados: autorizadores próprios (AM, GO, MG, MS, MT, PR, RS, SP) e a SVRS para as demais UFs, em produção e homologação, da relação de serviços da SVRS e da página da SEF/MG. Novos `nfceEndpoint`, `nfceAutorizadorDaUf` e `nfceConsultaUrls` (QR Code e consulta por chave onde a tabela oficial os publica), `DocumentoFiscal` ganha `nfce`, e os hosts da NFC-e entram em `allEndpoints` e `ambienteHosts`.
- 515861a: Novo subpath `@sinete/transport/signer` (e `sinete/transport/signer`): cliente do helper nativo `sinete-signer` para certificado A3 em token PKCS#11, A3 em nuvem de PSC, OpenBao Transit e `CryptoKey` não exportável. `startSigner` sobe o binário, `connectSigner` conecta no socket Unix, `connectSignerChannel` fala o protocolo sobre qualquer canal; `openRemote` aplica a política do dono da chave e `openPkcs11` devolve também o `documentSigner`, que assina XML pelo `dfe.sign` validado pelo helper; `certificadoAberto` monta o certificado que o `@sinete/emissor` aceita. Falhas do helper viram os `TransportError` de sempre (`classifyHelperFailure`) ou o novo `SignerError` (`signer_indisponivel`, `signer_protocolo`, `assinatura_tls_recusada`, `assinatura_tls_expirou`, `pkcs11_falhou`, `assinatura_documento_recusada`). `TlsInfo` ganha `signatures`.
  
  Mudança incompatível: `TlsIdentity` fica com `pem` e `helper`. Os tipos `external` e `pkcs11`, que só lançavam `UnsupportedError`, saíram; use `openRemote` e `openPkcs11`, que devolvem a identidade `helper`. `TlsSignContext.purpose` passa a ser `'tls12-client-certificate-verify'`, o valor do protocolo.
- 515861a: A SVC não oferece a inutilização (NT 2013.007 v1.03, item 04.5): `nfeEndpoint` com `contingencia: 'svc'` recusa `NfeInutilizacao` com `servico_nao_oferecido` também na SVC-AN, que o portal lista no quadro dela, com a NT como `source` do erro. Os dados registram a exclusão em `nfe.svcSemServicos`, e o builder a aplica sobre a tabela do portal.

### Patch Changes

- 515861a: A consulta cadastro de toda UF autorizada pela SVRS volta a ir para a SVRS. O `nfeEndpoint` recusava as UFs fora da linha de consulta cadastro do portal (DF, CE e outras), mas o serviço da SVRS responde por elas: em produção respondeu consultas do DF com 259 e 264. A UF que a SVRS não atender responde com a rejeição dela, como desfecho.
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
  - @sinete/core@0.1.0
