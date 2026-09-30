# Referência: `@sinete/transport`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/transport/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/transport/x` é `sinete/transport/x`.

## `@sinete/transport`

`@sinete/transport`: transporte mTLS dos DF-e.

`Transporte` com identidade TLS plugável, endpoints e perfis TLS por host como dados, SOAP 1.2, política de hosts e erros tipados. Esta é a entrada `default` (browser, Deno sem condição `node`, bundlers): `criarTransporte` só cria o transporte do Deno. Node e Bun resolvem a entrada `node`, que acrescenta o transporte sobre `node:https`.

### Funções

- `classificarFalhaDeTransporte`: Converte a falha de uma runtime num erro tipado do sinete. `ErroSinete` passa direto. `classificarFalhaDeTransporte(erro: unknown, contexto: { readonly host: string; }): ErroSinete`
- `classificarFalhaDoHelper`: Converte a falha de transporte relatada pelo helper (código `transport` com `data` estruturado) no mesmo erro tipado que o transporte em processo produziria. O prazo estourado fica de fora: quem chama lança `ErroDeTempoEsgotado`. `classificarFalhaDoHelper(dados: DadosDaFalhaDoHelper, mensagem: string, host: string): ErroTransporte`
- `conferirCertificadoLocal` (só na condição `node`): Confere se o socket carregou o certificado da identidade. `undefined` quando a runtime não expõe o certificado local (o transporte então não afirma nada). `conferirCertificadoLocal(socket: { getCertificate?: () => LocalCert | null | undefined; }, folhaEsperada: Uint8Array): boolean | undefined`
- `contentTypeSoap12`: `Content-Type` do SOAP 1.2, com a `action` do WSDL quando houver (`<namespace do WSDL>/<operação>`). `contentTypeSoap12(acao?: string): string`
- `criarTransporte`: Cria o transporte da runtime atual. Nesta entrada só há o do Deno; em outra runtime, lança `ErroNaoSuportado` em vez de cair num `fetch` genérico que ignoraria a identidade TLS. `criarTransporte(opcoes: CriarTransporteOpcoes): Transporte`
- `criarTransporteDeno`: Cria o transporte do Deno. Fora do Deno, só com `deno` e `fetch` injetados. `criarTransporteDeno(opcoes: TransporteDenoOpcoes): Transporte`
- `criarTransporteNode` (só na condição `node`): Cria o transporte de Node e Bun. `criarTransporteNode(opcoes: TransporteNodeOpcoes): Transporte`
- `detectarRuntime`: Detecta a runtime pelo global, sem depender de condição de export. `detectarRuntime(): RuntimeDoTransporte | 'navegador' | 'desconhecida'`
- `envelopeSoap12`: Envelope SOAP 1.2 com o corpo (e o cabeçalho, se houver) inseridos como texto, sem tocar neles. `envelopeSoap12(corpo: string, opcoes?: { readonly cabecalho?: string; }): string`
- `erroHttp403`: HTTP 403 do IIS da SEFAZ: certificado ausente ou recusado (o subcódigo 403.7/403.16 só às vezes vem no corpo). `erroHttp403(host: string): ErroTransporte`
- `hostsDoAmbiente`: Hosts distintos de um ambiente (base para a allowlist de homologação, por exemplo). `hostsDoAmbiente(ambiente: Ambiente): string[]`
- `identidadePem`: Identidade `pem` a partir de um A1 aberto pelo `@sinete/cert`. Por padrão manda o titular e as intermediárias que vieram no PFX; passe `cadeia` (o resultado de `montarCadeia`) para mandar a cadeia completada. `identidadePem(certificado: CertificadoA1, opcoes?: { readonly cadeia?: readonly CertificadoX509[]; }): Extract<IdentidadeTls, { tipo: 'pem'; }>`
- `lerBodySoap`: Conteúdo do `Body` da resposta, como fatia da string recebida (sem parse nem reserialização). Lança `ErroRespostaInvalida` se não houver `Body`. `lerBodySoap(envelope: string): string`
- `lerSoapFault`: Fault SOAP 1.2 (ou 1.1) da resposta, se houver. `lerSoapFault(envelope: string): SoapFault | undefined`
- `mdfeEndpoint`: Resolve o endpoint de um serviço de MDF-e 3.00 (sempre SVRS). `mdfeEndpoint(busca: { readonly ambiente: Ambiente; readonly servico: MdfeServico; }): EndpointResolvido`
- `motivosNaoSuportado`: Motivos pelos quais uma runtime não fala com um host, pelo perfil TLS medido. Vazio: compatível. `motivosNaoSuportado(perfil: PerfilTls | undefined, capacidades: CapacidadesDoTransporte): string[]`
- `nfceAutorizadorDaUf`: Autorizador de NFC-e da UF no ambiente. As tabelas oficiais listam os autorizadores com ambiente próprio da NFC-e (relação da SVRS e página da SEF/MG); a UF que não tem um autoriza na SVRS (`nfce.regraDoMapaDeUfs` nos dados). `nfceAutorizadorDaUf(uf: Uf, ambiente: Ambiente): NfceAutorizador`
- `nfceEndpoint`: Resolve o endpoint de um serviço da NFC-e 4.00 (modelo 65). Em várias UFs o host é outro que o da NF-e (SP, MG, PR, RS, a SVRS). A NFC-e não tem Distribuição DF-e nem SVC, e a consulta cadastro só existe onde a tabela a lista. `nfceEndpoint(busca: BuscaEndpointNfce): EndpointResolvido`
- `nfeAutorizadorDaUf`: Autorizador normal de NF-e da UF no ambiente (sem contingência). `nfeAutorizadorDaUf(uf: Uf, ambiente: Ambiente): NfeAutorizador`
- `nfeContingenciaDaUf`: Autorizador de contingência (SVC) da UF no ambiente. `nfeContingenciaDaUf(uf: Uf, ambiente: Ambiente): 'SVC-AN' | 'SVC-RS'`
- `nfeEndpoint`: Resolve o endpoint de um serviço de NF-e 4.00. `nfeEndpoint(busca: BuscaEndpointNfe): EndpointResolvido`
- `nfseEndpoint`: Base REST de uma API da NFS-e Nacional. `homologacao` é a produção restrita. `nfseEndpoint(busca: { readonly ambiente: Ambiente; readonly api: NfseApi; }): EndpointResolvido`
- `perfilTlsDoHost`: Perfil TLS medido do host, ou `undefined` para host fora dos dados. `perfilTlsDoHost(host: string): PerfilTls | undefined`
- `perfisTls`: Todos os perfis conhecidos. `perfisTls(): readonly PerfilTls[]`
- `politicaDeHostsPermitidos`: Allowlist fechada de hosts, portas e, opcionalmente, do `tpAmb` do corpo. `politicaDeHostsPermitidos(opcoes: PoliticaDeHostsPermitidosOpcoes): PoliticaDeHosts`
- `todasAsPoliticas`: Todas as políticas precisam aceitar, na ordem. `todasAsPoliticas(...politicas: readonly PoliticaDeHosts[]): PoliticaDeHosts`
- `todosOsEndpoints`: Todos os endpoints de um ambiente, para montar allowlists e sondar hosts. `todosOsEndpoints(ambiente: Ambiente): EndpointResolvido[]`
- `urlsConsultaNfce`: URLs do QR Code e da consulta por chave da NFC-e da UF, quando a tabela oficial de web services do autorizador as publica (hoje, MG). `undefined` nas demais: a UF publica essas URLs fora das tabelas de web services. `urlsConsultaNfce(uf: Uf, ambiente: Ambiente): UrlsConsultaNfce | undefined`

### Classes

- `ErroPolitica` (estende `ErroTransporte`): Recusa da `PoliticaDeHosts`. Sempre antes de qualquer socket.
- `ErroSigner` (estende `ErroSinete<CodigoErroSigner>`)
- `ErroTransporte` (estende `ErroSinete<CodigoErroTransporte>`)
- `ErroTransporteNaoSuportado` (estende `ErroNaoSuportado`): A runtime não consegue falar com o host pedido (ADR 0004, decisão 4): hoje, o Deno (rustls) diante de um host que pede o certificado numa renegociação ou que só oferece CBC ou DHE. `detalhes` traz `host`, `motivos` e `alternativa`. O código é o `nao_suportado` do core. Membros: `host`, `motivos`.

### Interfaces

- `ApiHttpDeno`: O pedaço da API do Deno que o transporte usa (injetável nos testes). Membros: `createHttpClient()`.
- `AssinadorTls`: Quem assina o CertificateVerify fora do processo TLS (A1 em `CryptoKey` não exportável, A3 em nuvem de PSC, OpenBao Transit, chave no navegador). Membros: `mode`, `cadeia()`, `assinar()`.
- `BuscaEndpointNfce`: Membros: `ambiente`, `servico`, `uf`, `autorizador`.
- `BuscaEndpointNfe`: Membros: `ambiente`, `servico`, `uf`, `autorizador`, `contingencia`.
- `CapacidadesDoTransporte`: O que a implementação consegue fazer. O perfil TLS de cada host diz o que ele exige. Membros: `runtime`, `renegociacao`, `tls12Cbc`, `tls12Dhe`, `controleDeSigalgs`, `conferenciaDoCertificadoLocal`.
- `ContextoAssinaturaTls`: Contexto de uma assinatura pedida pelo helper `sinete-signer` durante o handshake (ADR 0005). Membros: `host`, `finalidade`, `idDaConexao`, `handshake`.
- `DadosDaFalhaDoHelper`: O `data` de um erro `transport` do helper `sinete-signer` (docs/signer-contract/PROTOCOL.md). Membros: `stage`, `alert`, `x509`, `timeout`, `reset`, `refused`, `dns`, `notTls`.
- `DescricaoDadosDeEndpoints`: Membros: `versaoDosEndpoints`, `versaoDosPerfisTls`, `fonteDosPerfisTls`.
- `DescricaoTls`: Membros: `protocolo`, `cifra`, `retomada`, `certificadoLocalCarregado`, `assinaturas`.
- `EndpointResolvido`: Endpoint resolvido: para onde vai, de onde veio o dado e o perfil TLS do host. Membros: `documento`, `ambiente`, `autorizador`, `servico`, `versao`, `url`, `host`, `fonte`, `tls`.
- `EventoDeAuditoria`: Um uso do certificado, para auditoria (o app grava onde quiser). Sem segredo e sem corpo. Membros: `runtime`, `host`, `caminho`, `metodo`, `status`, `codigoDoErro`, `duracaoMs`.
- `HelperTlsExterno`: Conexão com o helper nativo `sinete-signer` (ADR 0005), que termina o mTLS com uma chave que não está no processo. O cliente do protocolo v1 é o `@sinete/transport/signer` (`iniciarSigner`, `conectarSigner`); o `Transporte` aplica a política e delega a requisição. Membros: `versaoDoProtocolo`, `enviar()`, `fechar()`.
- `PedidoHttpDoHelper`: Requisição HTTP entregue ao helper, já aprovada pela política. Membros: `url`, `metodo`, `cabecalhos`, `corpo`, `timeoutMs`.
- `PedidoParaPolitica`: Pedido que a política examina antes de qualquer socket. Membros: `url`, `metodo`, `corpo`, `endpoint`.
- `PedidoTransporte`: Membros: `url`, `metodo`, `cabecalhos`, `corpo`, `signal`, `timeoutMs`, `endpoint`.
- `PerfilTls`: Perfil TLS medido de um host. Membros: `host`, `usos`, `versoesTls`, `tlsMaximo`, `cifra`, `trocaDeChaves`, `ecdheAead`, `certificadoDoCliente`, `evidenciaDoCertificadoDoCliente`, `raizDoServidor`, `nomeDaRaizDoServidor`, `ocspStapling`, `retomadaDeSessao`.
- `PoliticaDeHosts`: Política de hosts: lança `ErroPolitica` para recusar. Roda antes de abrir socket, em todo envio. Membros: `conferir()`.
- `PoliticaDeHostsPermitidosOpcoes`: Membros: `hosts`, `portas`, `tpAmb`, `exigirTpAmbNoCorpo`.
- `RespostaTransporte`: Membros: `status`, `cabecalhos`, `corpo`, `tls`, `texto()`.
- `SoapFault`: Membros: `code`, `reason`.
- `Transporte`: Membros: `capacidades`, `enviar()`, `fechar()`.
- `TransporteDenoOpcoes` (estende `TransporteOpcoes`): Membros: `hostsDesconhecidos`, `deno`, `fetch`.
- `TransporteNodeOpcoes` (estende `TransporteOpcoes`; só na condição `node`): Membros: `confianca`, `sigalgs`, `manterConexao`.
- `TransporteOpcoes`: Opções comuns às implementações. Membros: `identidade`, `politica`, `acsAdicionais`, `timeoutMs`, `recusarEm403`, `logger`, `auditoria`.
- `UrlsConsultaNfce`: URLs públicas da NFC-e por UF, só onde a tabela oficial de web services as publica. Membros: `qrCode`, `consultaChave`, `fonte`.

### Tipos

- `CodigoErroSigner`: Códigos do cliente do helper `sinete-signer` (`@sinete/transport/signer`, ADR 0005). As falhas de rede e TLS do helper viram os mesmos `ErroTransporte` do transporte em processo; estes são os que só existem com o helper.
- `CodigoErroTransporte`: Códigos estáveis do `@sinete/transport`, mapeados do que a SEFAZ faz de fato (ADR 0004, seção 4 e decisão 4). Os detalhes trazem host, alerta TLS, código do sistema e status HTTP; nunca corpo, chave ou certificado.
- `CriarTransporteOpcoes`: Opções aceitas por `criarTransporte` em qualquer entrada. `type CriarTransporteOpcoes = TransporteDenoOpcoes`
- `DocumentoFiscal`: `type DocumentoFiscal = 'nfe' | 'nfce' | 'mdfe' | 'nfse'`
- `IdentidadeTls`: Identidade TLS do cliente. `pem` roda em processo; `helper` passa pelo `sinete-signer` do ADR 0005, e é o que `abrirRemoto` e `abrirPkcs11` do `@sinete/transport/signer` devolvem (A3 em token, A3 em nuvem, OpenBao, `CryptoKey` não exportável). `type IdentidadeTls = /** A1 em memória: cadeia (titular primeiro) e chave PKCS#8 em PEM, como saem de `CertificadoA1.tlsPem()`. */ { readonly tipo: 'pem'; readonly cadeia: string; readonly chave: string; } /** Identidade aberta no helper`
- `MdfeServico`: `type MdfeServico = 'MDFeRecepcaoSinc' | 'MDFeConsulta' | 'MDFeStatusServico' | 'MDFeRecepcaoEvento' | 'MDFeConsNaoEnc' | 'MDFeDistribuicaoDFe'`
- `NfceAutorizador`: Autorizador de NFC-e (modelo 65): UF com ambiente próprio da NFC-e ou a SVRS. Não há SVC para a NFC-e: a contingência dela é off-line (tpEmis 9) e a nota vai depois ao mesmo autorizador. `type NfceAutorizador = 'AM' | 'GO' | 'MG' | 'MS' | 'MT' | 'PR' | 'RS' | 'SP' | 'SVRS'`
- `NfeAutorizador`: Autorizador de NF-e: UF com sefaz própria, virtual (SVAN, SVRS), contingência (SVC-AN, SVC-RS) ou AN. `type NfeAutorizador = 'AM' | 'BA' | 'GO' | 'MG' | 'MS' | 'MT' | 'PE' | 'PR' | 'RS' | 'SP' | 'SVAN' | 'SVRS' | 'SVC-AN' | 'SVC-RS' | 'AN'`
- `NfeServico`: Serviços NF-e 4.00 como o portal nacional os nomeia. `type NfeServico = 'NFeAutorizacao' | 'NFeRetAutorizacao' | 'NfeConsultaProtocolo' | 'NfeInutilizacao' | 'NfeStatusServico' | 'NfeConsultaCadastro' | 'RecepcaoEvento' | 'NFeDistribuicaoDFe'`
- `NfseApi`: APIs REST da NFS-e Nacional. Em homologação, o ambiente é a produção restrita. A API de geração do DANFSe do ADN foi suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026 v1.02, 1) e saiu da lista: o DANFSe é gerado pelo `@sinete/da/nfse`. `type NfseApi = 'sefin' | 'adn' | 'adnContribuintes' | 'parametrizacao' | 'cnc'`
- `RuntimeDoTransporte`: `type RuntimeDoTransporte = 'node' | 'bun' | 'deno' | 'personalizada'`

### Constantes

- `CAPACIDADES_DENO`: `CAPACIDADES_DENO: CapacidadesDoTransporte`
- `DADOS_DE_ENDPOINTS`: `DADOS_DE_ENDPOINTS: DescricaoDadosDeEndpoints`
- `SOAP12_NS`: SOAP 1.2 mínimo dos web services da SEFAZ (NF-e 4.00, MDF-e 3.00), montado a partir dos WSDL oficiais. `SOAP12_NS = "http://www.w3.org/2003/05/soap-envelope"`

## `@sinete/transport/signer`

`@sinete/transport/signer`: cliente do protocolo v1 do helper `sinete-signer` (ADR 0005, `docs/signer-contract/PROTOCOL.md`), que termina o mTLS com uma chave que não está no processo JS.

Esta entrada é pura: fala o protocolo sobre qualquer `CanalSigner` (o stdio de um processo filho, um socket Unix, um WebSocket até o navegador). A entrada `node` acrescenta `iniciarSigner`, que sobe o binário, e `conectarSigner`, que conecta no socket Unix do helper em contêiner.

Identidades: - `abrirRemoto`: a chave fica com quem chamou, num `AssinadorTls` (A1 em `CryptoKey` não exportável, A3 em nuvem de PSC, OpenBao Transit). O helper pede `sign` no meio do handshake; este cliente aplica a política do dono da chave (host, propósito, esquema e, no modo `message`, o transcript) antes de chamar o `AssinadorTls`. - `abrirPkcs11`: token local pelo helper `-p11`. O `assinadorDeDocumentos` assina XML dos DF-e pelo `dfe.sign`, que o helper valida antes de usar a chave do token.

### Funções

- `assinadorTlsDeCryptoKey`: `AssinadorTls` sobre uma `CryptoKey` RSASSA-PKCS1-v1_5 com SHA-256 (não exportável serve), no modo `message`: o helper manda o transcript e a chave assina a mensagem. É o caminho do A1 guardado como `CryptoKey` e da chave no navegador. `assinadorTlsDeCryptoKey(chave: CryptoKey, cadeia: readonly Uint8Array[]): AssinadorTls`
- `assinadorTlsDeDigest`: `AssinadorTls` no modo `digest` sobre um `AssinadorDeDigest` do `@sinete/core` (PSC em RAW, OpenBao Transit com `prehashed`, HSM): monta o DigestInfo SHA-256 e pede só o RSA. `assinadorTlsDeDigest(assinador: AssinadorDeDigest, cadeia?: readonly Uint8Array[]): AssinadorTls`
- `certificadoAberto`: O certificado aberto que o `@sinete/emissor` aceita no lugar do PFX (`OpcoesEmissor.certificado`): o signer dos documentos, o titular lido da folha e a identidade do mTLS pelo helper. `certificadoAberto(identidade: IdentidadeSigner, opcoes?: { readonly assinador?: Assinador; }): { readonly assinador: Assinador; readonly titular: IdentidadeIcp; readonly identidade: IdentidadeTls; }`
- `conectarCanalSigner`: Conecta ao helper por um canal já aberto e faz o `hello`. Recusa helper de outra versão do protocolo (`signer_protocolo`). `conectarCanalSigner(canal: CanalSigner, opcoes?: ClienteSignerOpcoes): Promise<ConexaoSigner>`
- `conectarSigner` (só na condição `node`): Conecta no helper que atende num socket Unix (`sinete-signer --socket caminho`), em contêiner próprio. `conectarSigner(opcoes: ClienteSignerOpcoes & { readonly caminhoDoSocket: string; }): Promise<ConexaoSigner>`
- `divisorDeLinhas`: Converte linhas cruas (com `\n`) em linhas de frame, guardando o pedaço incompleto. `divisorDeLinhas(aoReceberLinha: (linha: string) => void): (pedaco: string) => void`
- `iniciarSigner` (só na condição `node`): Sobe o helper como processo filho e conecta pelo stdio. Fechar a conexão fecha o stdin, e o helper encerra as requisições em andamento, fecha as identidades (sessões PKCS#11 inclusive) e sai. `iniciarSigner(opcoes: IniciarSignerOpcoes): Promise<ConexaoSigner>`
- `lerTranscricaoTls`: Lê do transcript TLS 1.2 o SNI do ClientHello e o primeiro certificado da mensagem Certificate do servidor. O transcript é a sequência de mensagens de handshake (tipo, 3 bytes de tamanho, corpo), RFC 5246, seção 7.4. `lerTranscricaoTls(transcricao: Uint8Array): { readonly sni: string | undefined; readonly certificadoDoServidor: Uint8Array | undefined; }`

### Interfaces

- `AbrirPkcs11Opcoes`: Membros: `id`, `modulo`, `token`, `numeroDeSerie`, `rotulo`, `idDaChave`, `pin`, `cadeia`, `acsAdicionais`.
- `AbrirRemotoOpcoes`: Membros: `id`, `assinador`, `hostsPermitidos`, `prazoDaAssinaturaMs`, `acsAdicionais`.
- `CanalSigner`: Um canal de linhas até o helper. Cada linha é um frame JSON, sem o `\n`. Membros: `enviar()`, `aoReceberLinha()`, `aoFechar()`, `fechar()`.
- `ClienteSignerOpcoes`: Membros: `cliente`, `prazoDeControleMs`, `logger`.
- `ConexaoSigner` (estende `HelperTlsExterno`): A conexão com o helper. É também o `HelperTlsExterno` que as identidades usam. Membros: `hello`, `abrirRemoto()`, `abrirPkcs11()`, `estatisticas()`.
- `HelloDoSigner`: O que o helper disse no `hello`. Membros: `protocol`, `helper`, `lab`, `ambientes`, `backends`, `signModes`, `schemes`, `methods`, `dataVersion`.
- `IdentidadeSigner`: Uma identidade aberta no helper. Membros: `id`, `backend`, `identidadeTls`, `cadeia`, `subject`, `notAfter`, `cnpj`, `cpf`, `assinadorDeDocumentos`, `reiniciarPool()`, `fechar()`.
- `IniciarSignerOpcoes` (estende `ClienteSignerOpcoes`; só na condição `node`): Membros: `binario`, `pkcs11`, `ambientes`, `tpAmb`, `lab`, `arquivosDeRaizes`, `arquivoDeAuditoria`, `env`.

### Constantes

- `VERSAO_PROTOCOLO_SIGNER`: Versão do protocolo falada por este cliente (`docs/signer-contract/PROTOCOL_VERSION`). `VERSAO_PROTOCOLO_SIGNER = 1`
