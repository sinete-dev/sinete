# Referência: `@sinete/transport`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/transport/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/transport/x` é `sinete/transport/x`.

## `@sinete/transport`

`@sinete/transport`: transporte mTLS dos DF-e.

`Transport` com identidade TLS plugável, endpoints e perfis TLS por host como dados, SOAP 1.2, política de hosts e erros tipados. Esta é a entrada `default` (browser, Deno sem condição `node`, bundlers): `createTransport` só cria o transporte do Deno. Node e Bun resolvem a entrada `node`, que acrescenta o transporte sobre `node:https`.

### Funções

- `allEndpoints`: Todos os endpoints de um ambiente, para montar allowlists e sondar hosts. `allEndpoints(ambiente: Ambiente): EndpointRef[]`
- `allowlistPolicy`: Allowlist fechada de hosts, portas e, opcionalmente, do `tpAmb` do corpo. `allowlistPolicy(options: AllowlistPolicyOptions): HostPolicy`
- `allPolicies`: Todas as políticas precisam aceitar, na ordem. `allPolicies(...policies: readonly HostPolicy[]): HostPolicy`
- `ambienteHosts`: Hosts distintos de um ambiente (base para a allowlist de homologação, por exemplo). `ambienteHosts(ambiente: Ambiente): string[]`
- `checkLocalCertificate` (só na condição `node`): Confere se o socket carregou o certificado da identidade. `undefined` quando a runtime não expõe o certificado local (o transporte então não afirma nada). `checkLocalCertificate(socket: { getCertificate?: () => LocalCert | null | undefined; }, expectedLeaf: Uint8Array): boolean | undefined`
- `classifyHelperFailure`: Converte a falha de transporte relatada pelo helper (código `transport` com `data` estruturado) no mesmo erro tipado que o transporte em processo produziria. O prazo estourado fica de fora: quem chama lança `ErroDeTempoEsgotado`. `classifyHelperFailure(data: HelperFailureData, message: string, host: string): TransportError`
- `classifyTransportFailure`: Converte a falha de uma runtime num erro tipado do sinete. `ErroSinete` passa direto. `classifyTransportFailure(err: unknown, context: { readonly host: string; }): ErroSinete`
- `createDenoTransport`: Cria o transporte do Deno. Fora do Deno, só com `deno` e `fetch` injetados. `createDenoTransport(options: DenoTransportOptions): Transport`
- `createNodeTransport` (só na condição `node`): Cria o transporte de Node e Bun. `createNodeTransport(options: NodeTransportOptions): Transport`
- `createTransport`: Cria o transporte da runtime atual. Nesta entrada só há o do Deno; em outra runtime, lança `ErroNaoSuportado` em vez de cair num `fetch` genérico que ignoraria a identidade TLS. `createTransport(options: CreateTransportOptions): Transport`
- `detectRuntime`: Detecta a runtime pelo global, sem depender de condição de export. `detectRuntime(): TransportRuntime | 'browser' | 'desconhecida'`
- `http403Error`: HTTP 403 do IIS da SEFAZ: certificado ausente ou recusado (o subcódigo 403.7/403.16 só às vezes vem no corpo). `http403Error(host: string): TransportError`
- `mdfeEndpoint`: Resolve o endpoint de um serviço de MDF-e 3.00 (sempre SVRS). `mdfeEndpoint(query: { readonly ambiente: Ambiente; readonly servico: MdfeServico; }): EndpointRef`
- `nfceAutorizadorDaUf`: Autorizador de NFC-e da UF no ambiente. As tabelas oficiais listam os autorizadores com ambiente próprio da NFC-e (relação da SVRS e página da SEF/MG); a UF que não tem um autoriza na SVRS (`nfce.ufMapRule` nos dados). `nfceAutorizadorDaUf(uf: Uf, ambiente: Ambiente): NfceAutorizador`
- `nfceConsultaUrls`: URLs do QR Code e da consulta por chave da NFC-e da UF, quando a tabela oficial de web services do autorizador as publica (hoje, MG). `undefined` nas demais: a UF publica essas URLs fora das tabelas de web services. `nfceConsultaUrls(uf: Uf, ambiente: Ambiente): NfceConsultaUrls | undefined`
- `nfceEndpoint`: Resolve o endpoint de um serviço da NFC-e 4.00 (modelo 65). Em várias UFs o host é outro que o da NF-e (SP, MG, PR, RS, a SVRS). A NFC-e não tem Distribuição DF-e nem SVC, e a consulta cadastro só existe onde a tabela a lista. `nfceEndpoint(query: NfceEndpointQuery): EndpointRef`
- `nfeAutorizadorDaUf`: Autorizador normal de NF-e da UF no ambiente (sem contingência). `nfeAutorizadorDaUf(uf: Uf, ambiente: Ambiente): NfeAutorizador`
- `nfeContingenciaDaUf`: Autorizador de contingência (SVC) da UF no ambiente. `nfeContingenciaDaUf(uf: Uf, ambiente: Ambiente): 'SVC-AN' | 'SVC-RS'`
- `nfeEndpoint`: Resolve o endpoint de um serviço de NF-e 4.00. `nfeEndpoint(query: NfeEndpointQuery): EndpointRef`
- `nfseEndpoint`: Base REST de uma API da NFS-e Nacional. `homologacao` é a produção restrita. `nfseEndpoint(query: { readonly ambiente: Ambiente; readonly api: NfseApi; }): EndpointRef`
- `pemIdentity`: Identidade `pem` a partir de um A1 aberto pelo `@sinete/cert`. Por padrão manda o titular e as intermediárias que vieram no PFX; passe `chain` (o resultado de `buildChain`) para mandar a cadeia completada. `pemIdentity(keyStore: A1KeyStore, options?: { readonly chain?: readonly CertificateInfo[]; }): Extract<TlsIdentity, { kind: 'pem'; }>`
- `soap12ContentType`: `Content-Type` do SOAP 1.2, com a `action` do WSDL quando houver (`<namespace do WSDL>/<operação>`). `soap12ContentType(action?: string): string`
- `soap12Envelope`: Envelope SOAP 1.2 com o corpo (e o cabeçalho, se houver) inseridos como texto, sem tocar neles. `soap12Envelope(body: string, options?: { readonly header?: string; }): string`
- `soapBody`: Conteúdo do `Body` da resposta, como fatia da string recebida (sem parse nem reserialização). Lança `ErroRespostaInvalida` se não houver `Body`. `soapBody(envelope: string): string`
- `soapFault`: Fault SOAP 1.2 (ou 1.1) da resposta, se houver. `soapFault(envelope: string): SoapFault | undefined`
- `tlsProfileForHost`: Perfil TLS medido do host, ou `undefined` para host fora dos dados. `tlsProfileForHost(host: string): TlsProfile | undefined`
- `tlsProfiles`: Todos os perfis conhecidos. `tlsProfiles(): readonly TlsProfile[]`
- `unsupportedReasons`: Motivos pelos quais uma runtime não fala com um host, pelo perfil TLS medido. Vazio: compatível. `unsupportedReasons(profile: TlsProfile | undefined, capabilities: TransportCapabilities): string[]`

### Classes

- `PolicyError` (estende `TransportError`): Recusa da `HostPolicy`. Sempre antes de qualquer socket.
- `SignerError` (estende `ErroSinete<SignerErrorCode>`)
- `TransportError` (estende `ErroSinete<TransportErrorCode>`)
- `TransportUnsupportedError` (estende `ErroNaoSuportado`): A runtime não consegue falar com o host pedido (ADR 0004, decisão 4): hoje, o Deno (rustls) diante de um host que pede o certificado numa renegociação ou que só oferece CBC ou DHE. `detalhes` traz `host`, `reasons` e `alternative`. O código é o `nao_suportado` do core. Membros: `host`, `reasons`.

### Interfaces

- `AllowlistPolicyOptions`: Membros: `hosts`, `ports`, `tpAmb`, `requireTpAmbInBody`.
- `AuditEvent`: Um uso do certificado, para auditoria (o app grava onde quiser). Sem segredo e sem corpo. Membros: `runtime`, `host`, `path`, `method`, `status`, `errorCode`, `durationMs`.
- `DenoHttpApi`: O pedaço da API do Deno que o transporte usa (injetável nos testes). Membros: `createHttpClient()`.
- `DenoTransportOptions` (estende `TransportOptions`): Membros: `unknownHosts`, `deno`, `fetch`.
- `EndpointDataInfo`: Membros: `endpointsVersion`, `tlsProfilesVersion`, `tlsProfilesSource`.
- `EndpointRef`: Endpoint resolvido: para onde vai, de onde veio o dado e o perfil TLS do host. Membros: `documento`, `ambiente`, `autorizador`, `servico`, `versao`, `url`, `host`, `source`, `tls`.
- `ExternalTlsHelper`: Conexão com o helper nativo `sinete-signer` (ADR 0005), que termina o mTLS com uma chave que não está no processo. O cliente do protocolo v1 é o `@sinete/transport/signer` (`startSigner`, `connectSigner`); o `Transport` aplica a política e delega a requisição. Membros: `protocolVersion`, `request()`, `close()`.
- `HelperFailureData`: O `data` de um erro `transport` do helper `sinete-signer` (docs/signer-contract/PROTOCOL.md). Membros: `stage`, `alert`, `x509`, `timeout`, `reset`, `refused`, `dns`, `notTls`.
- `HelperHttpRequest`: Requisição HTTP entregue ao helper, já aprovada pela política. Membros: `url`, `method`, `headers`, `body`, `timeoutMs`.
- `HostPolicy`: Política de hosts: lança `PolicyError` para recusar. Roda antes de abrir socket, em todo envio. Membros: `check()`.
- `NfceConsultaUrls`: URLs públicas da NFC-e por UF, só onde a tabela oficial de web services as publica. Membros: `qrCode`, `consultaChave`, `source`.
- `NfceEndpointQuery`: Membros: `ambiente`, `servico`, `uf`, `autorizador`.
- `NfeEndpointQuery`: Membros: `ambiente`, `servico`, `uf`, `autorizador`, `contingencia`.
- `NodeTransportOptions` (estende `TransportOptions`; só na condição `node`): Membros: `trust`, `sigalgs`, `keepAlive`.
- `PolicyRequest`: Pedido que a política examina antes de qualquer socket. Membros: `url`, `method`, `body`, `endpoint`.
- `SoapFault`: Membros: `code`, `reason`.
- `TlsInfo`: Membros: `protocol`, `cipher`, `resumed`, `clientCertificateLoaded`, `signatures`.
- `TlsProfile`: Perfil TLS medido de um host. Membros: `host`, `uses`, `tlsVersions`, `maxTls`, `cipher`, `keyExchange`, `ecdheAead`, `clientCert`, `clientCertEvidence`, `serverRoot`, `serverRootName`, `ocspStapling`, `sessionResumption`.
- `TlsSignContext`: Contexto de uma assinatura pedida pelo helper `sinete-signer` durante o handshake (ADR 0005). Membros: `host`, `purpose`, `connectionId`, `handshake`.
- `TlsSigner`: Quem assina o CertificateVerify fora do processo TLS (A1 em `CryptoKey` não exportável, A3 em nuvem de PSC, OpenBao Transit, chave no navegador). Membros: `mode`, `certificateChain()`, `sign()`.
- `Transport`: Membros: `capabilities`, `send()`, `close()`.
- `TransportCapabilities`: O que a implementação consegue fazer. O perfil TLS de cada host diz o que ele exige. Membros: `runtime`, `renegotiation`, `tls12Cbc`, `tls12Dhe`, `sigalgsControl`, `clientCertificateCheck`.
- `TransportOptions`: Opções comuns às implementações. Membros: `identity`, `policy`, `additionalCa`, `timeoutMs`, `rejectOn403`, `logger`, `audit`.
- `TransportRequest`: Membros: `url`, `method`, `headers`, `body`, `signal`, `timeoutMs`, `endpoint`.
- `TransportResponse`: Membros: `status`, `headers`, `body`, `tls`, `text()`.

### Tipos

- `CreateTransportOptions`: Opções aceitas por `createTransport` em qualquer entrada. `type CreateTransportOptions = DenoTransportOptions`
- `DocumentoFiscal`: `type DocumentoFiscal = 'nfe' | 'nfce' | 'mdfe' | 'nfse'`
- `MdfeServico`: `type MdfeServico = 'MDFeRecepcaoSinc' | 'MDFeConsulta' | 'MDFeStatusServico' | 'MDFeRecepcaoEvento' | 'MDFeConsNaoEnc' | 'MDFeDistribuicaoDFe'`
- `NfceAutorizador`: Autorizador de NFC-e (modelo 65): UF com ambiente próprio da NFC-e ou a SVRS. Não há SVC para a NFC-e: a contingência dela é off-line (tpEmis 9) e a nota vai depois ao mesmo autorizador. `type NfceAutorizador = 'AM' | 'GO' | 'MG' | 'MS' | 'MT' | 'PR' | 'RS' | 'SP' | 'SVRS'`
- `NfeAutorizador`: Autorizador de NF-e: UF com sefaz própria, virtual (SVAN, SVRS), contingência (SVC-AN, SVC-RS) ou AN. `type NfeAutorizador = 'AM' | 'BA' | 'GO' | 'MG' | 'MS' | 'MT' | 'PE' | 'PR' | 'RS' | 'SP' | 'SVAN' | 'SVRS' | 'SVC-AN' | 'SVC-RS' | 'AN'`
- `NfeServico`: Serviços NF-e 4.00 como o portal nacional os nomeia. `type NfeServico = 'NFeAutorizacao' | 'NFeRetAutorizacao' | 'NfeConsultaProtocolo' | 'NfeInutilizacao' | 'NfeStatusServico' | 'NfeConsultaCadastro' | 'RecepcaoEvento' | 'NFeDistribuicaoDFe'`
- `NfseApi`: APIs REST da NFS-e Nacional. Em homologação, o ambiente é a produção restrita. A API de geração do DANFSe do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026 v1.02, 1) e saiu da lista: o DANFSe é gerado pelo `@sinete/da/nfse`. `type NfseApi = 'sefin' | 'adn' | 'adnContribuintes' | 'parametrizacao' | 'cnc'`
- `SignerErrorCode`: Códigos do cliente do helper `sinete-signer` (`@sinete/transport/signer`, ADR 0005). As falhas de rede e TLS do helper viram os mesmos `TransportError` do transporte em processo; estes são os que só existem com o helper.
- `TlsIdentity`: Identidade TLS do cliente. `pem` roda em processo; `helper` passa pelo `sinete-signer` do ADR 0005, e é o que `openRemote` e `openPkcs11` do `@sinete/transport/signer` devolvem (A3 em token, A3 em nuvem, OpenBao, `CryptoKey` não exportável). `type TlsIdentity = /** A1 em memória: cadeia (titular primeiro) e chave PKCS#8 em PEM, como saem de `A1KeyStore.tlsPem()`. */ { readonly kind: 'pem'; readonly certChain: string; readonly key: string; } /** Identidade aberta no helper`
- `TransportErrorCode`: Códigos estáveis do `@sinete/transport`, mapeados do que a SEFAZ faz de fato (ADR 0004, seção 4 e decisão 4). Os detalhes trazem host, alerta TLS, código do sistema e status HTTP; nunca corpo, chave ou certificado.
- `TransportRuntime`: `type TransportRuntime = 'node' | 'bun' | 'deno' | 'custom'`

### Constantes

- `DENO_CAPABILITIES`: `DENO_CAPABILITIES: TransportCapabilities`
- `ENDPOINT_DATA`: `ENDPOINT_DATA: EndpointDataInfo`
- `SOAP12_NS`: SOAP 1.2 mínimo dos web services da SEFAZ (NF-e 4.00, MDF-e 3.00), montado a partir dos WSDL oficiais. `SOAP12_NS = "http://www.w3.org/2003/05/soap-envelope"`

## `@sinete/transport/signer`

`@sinete/transport/signer`: cliente do protocolo v1 do helper `sinete-signer` (ADR 0005, `docs/signer-contract/PROTOCOL.md`), que termina o mTLS com uma chave que não está no processo JS.

Esta entrada é pura: fala o protocolo sobre qualquer `SignerChannel` (o stdio de um processo filho, um socket Unix, um WebSocket até o navegador). A entrada `node` acrescenta `startSigner`, que sobe o binário, e `connectSigner`, que conecta no socket Unix do helper em contêiner.

Identidades: - `openRemote`: a chave fica com quem chamou, num `TlsSigner` (A1 em `CryptoKey` não exportável, A3 em nuvem de PSC, OpenBao Transit). O helper pede `sign` no meio do handshake; este cliente aplica a política do dono da chave (host, propósito, esquema e, no modo `message`, o transcript) antes de chamar o `TlsSigner`. - `openPkcs11`: token local pelo helper `-p11`. O `documentSigner` assina XML dos DF-e pelo `dfe.sign`, que o helper valida antes de usar a chave do token.

### Funções

- `certificadoAberto`: O certificado aberto que o `@sinete/emissor` aceita no lugar do PFX (`OpcoesEmissor.certificado`): o signer dos documentos, o titular lido da folha e a identidade do mTLS pelo helper. `certificadoAberto(identity: SignerIdentity, options?: { readonly signer?: Assinador; }): { readonly signer: Assinador; readonly titular: IcpIdentity; readonly identidade: TlsIdentity; }`
- `connectSigner` (só na condição `node`): Conecta no helper que atende num socket Unix (`sinete-signer --socket caminho`), em contêiner próprio. `connectSigner(options: SignerClientOptions & { readonly socketPath: string; }): Promise<SignerConnection>`
- `connectSignerChannel`: Conecta ao helper por um canal já aberto e faz o `hello`. Recusa helper de outra versão do protocolo (`signer_protocolo`). `connectSignerChannel(channel: SignerChannel, options?: SignerClientOptions): Promise<SignerConnection>`
- `cryptoKeyTlsSigner`: `TlsSigner` sobre uma `CryptoKey` RSASSA-PKCS1-v1_5 com SHA-256 (não exportável serve), no modo `message`: o helper manda o transcript e a chave assina a mensagem. É o caminho do A1 guardado como `CryptoKey` e da chave no navegador. `cryptoKeyTlsSigner(key: CryptoKey, chain: readonly Uint8Array[]): TlsSigner`
- `digestTlsSigner`: `TlsSigner` no modo `digest` sobre um `AssinadorDeDigest` do `@sinete/core` (PSC em RAW, OpenBao Transit com `prehashed`, HSM): monta o DigestInfo SHA-256 e pede só o RSA. `digestTlsSigner(signer: AssinadorDeDigest, chain?: readonly Uint8Array[]): TlsSigner`
- `lineSplitter`: Converte linhas cruas (com `\n`) em linhas de frame, guardando o pedaço incompleto. `lineSplitter(onLine: (line: string) => void): (chunk: string) => void`
- `parseTlsTranscript`: Lê do transcript TLS 1.2 o SNI do ClientHello e o primeiro certificado da mensagem Certificate do servidor. O transcript é a sequência de mensagens de handshake (tipo, 3 bytes de tamanho, corpo), RFC 5246, seção 7.4. `parseTlsTranscript(transcript: Uint8Array): { readonly sni: string | undefined; readonly serverCertificate: Uint8Array | undefined; }`
- `startSigner` (só na condição `node`): Sobe o helper como processo filho e conecta pelo stdio. Fechar a conexão fecha o stdin, e o helper encerra as requisições em andamento, fecha as identidades (sessões PKCS#11 inclusive) e sai. `startSigner(options: StartSignerOptions): Promise<SignerConnection>`

### Interfaces

- `OpenPkcs11Options`: Membros: `id`, `module`, `token`, `serial`, `label`, `keyId`, `pin`, `chain`, `additionalCa`.
- `OpenRemoteOptions`: Membros: `id`, `signer`, `allowedHosts`, `signTimeoutMs`, `additionalCa`.
- `SignerChannel`: Um canal de linhas até o helper. Cada linha é um frame JSON, sem o `\n`. Membros: `send()`, `onLine()`, `onClose()`, `close()`.
- `SignerClientOptions`: Membros: `client`, `controlTimeoutMs`, `logger`.
- `SignerConnection` (estende `ExternalTlsHelper`): A conexão com o helper. É também o `ExternalTlsHelper` que as identidades usam. Membros: `hello`, `openRemote()`, `openPkcs11()`, `stats()`.
- `SignerHello`: O que o helper disse no `hello`. Membros: `protocol`, `helper`, `lab`, `ambientes`, `backends`, `signModes`, `schemes`, `methods`, `dataVersion`.
- `SignerIdentity`: Uma identidade aberta no helper. Membros: `id`, `backend`, `tlsIdentity`, `chain`, `subject`, `notAfter`, `cnpj`, `cpf`, `documentSigner`, `resetPool()`, `close()`.
- `StartSignerOptions` (estende `SignerClientOptions`; só na condição `node`): Membros: `binary`, `pkcs11`, `ambientes`, `tpAmb`, `lab`, `rootsFiles`, `auditFile`, `env`.

### Constantes

- `SIGNER_PROTOCOL_VERSION`: Versão do protocolo falada por este cliente (`docs/signer-contract/PROTOCOL_VERSION`). `SIGNER_PROTOCOL_VERSION = 1`
