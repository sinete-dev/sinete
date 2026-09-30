---
'@sinete/transport': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

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
