# Protocolo sinete-signer v1 (parte normativa)

Contrato entre o core JS do sinete (qualquer runtime) e o helper nativo `sinete-signer`, que termina o mTLS com a SEFAZ sem guardar a chave privada. É neutro de linguagem: o helper de referência é Go, mas qualquer processo que fale estes frames serve, e qualquer cliente (TS, Python, Go) pode dirigir o helper. A versão fica em `PROTOCOL_VERSION`; o formato do frame em `schema/frame.schema.json`; exemplos de ida e volta em `fixtures/`.

Status: rascunho do spike S4 (25/set/2026). Nada aqui é estável antes do ADR 0005 ser aceito.

## Transporte

Um objeto JSON por linha (NDJSON, UTF-8, `\n`). O canal padrão é o stdio do helper: o cliente JS sobe o helper como processo filho e escreve no stdin dele, e lê o stdout. O stderr é só log humano e não carrega frame. O canal é **bidirecional**: os dois lados fazem requisições e os dois respondem. O cliente faz `http.request`; no meio do handshake, o helper faz `sign` de volta.

Um canal alternativo, para o helper em contêiner próprio (o "sinete-signer" do desenho de custódia), é um socket Unix com o mesmo framing, sem porta TCP. Autenticar quem conecta (permissão do arquivo, `SO_PEERCRED`, ou mTLS interno) fica por conta da implantação; o protocolo não tem login, porque no stdio quem sobe o processo já é o dono do canal.

Fechar o stdin é o pedido de encerramento. O helper termina as requisições já recebidas e sai. Uma requisição que dependa de um `sign` ainda sem resposta falha com `sign_timeout`.

## Frame

```
{"v":1,"id":"c12","method":"http.request","params":{...}}   requisição
{"v":1,"id":"c12","result":{...}}                           resposta
{"v":1,"id":"c12","error":{"code":"guard","message":"..."}} erro
```

- `v` é a versão do protocolo em **todo** frame. Um frame com `v` diferente recebe `protocol_version` e não é executado. O helper não negocia versão: o cliente lê `hello` e decide.
- `id` é único por lado e por conexão. Por convenção, `c<n>` para o que o cliente inicia e `h<n>` para o que o helper inicia, para que as duas numerações nunca colidam.
- Requisições são concorrentes. As respostas podem voltar fora de ordem; correlacione por `id`.

## Métodos do cliente para o helper

**`hello`** devolve `protocol`, `helper` (nome e versão), `backends` disponíveis neste binário (`remote`, `pkcs11` só no sabor com cgo), `signModes` e `schemes`. O cliente deve chamar antes de tudo e recusar um helper cujo `protocol` não conhece.

**`identity.open`** registra uma identidade TLS sob um `id` escolhido pelo cliente. Não existe identidade padrão; toda requisição nomeia a sua.
- `backend: "remote"`: o cliente manda só a cadeia pública (`chain`, DER em base64, folha primeiro, sem a raiz) e o `mode` de assinatura (`digest` ou `message`). A chave fica com o cliente, que responde aos `sign`.
- `backend: "pkcs11"`: o helper abre o módulo (`module`), acha o token pelo rótulo (`token`), faz login com `pin` e usa a chave e o certificado com o rótulo `label`. `chain` opcional completa as intermediárias. O PIN atravessa o pipe e nunca vai para argv ou env.
- `backend: "inproc"`: só no modo laboratório; existe para medir a linha de base.

**`http.request`** faz uma requisição HTTP/1.1 com mTLS usando a identidade. Parâmetros: `identity`, `url`, `method`, `headers`, `body` (base64), `timeoutMs`, `service` (rótulo para a auditoria) e `freshConn` (fecha as conexões ociosas antes, para medir retomada). A resposta traz `status`, `headers`, `body` (base64), `ms` e um bloco `tls` com versão, suíte, número da conexão, se ela foi reaproveitada (`connReused`), handshakes e renegociações da conexão, retomada por handshake (`resumed`) e as assinaturas pedidas **durante esta requisição** (`signatures`). Esse bloco é o que permite ao cliente contabilizar cota de PSC.

**`pool.reset`** fecha as conexões ociosas da identidade; com `dropSessions: true`, descarta também o cache de sessão TLS.

**`stats`** devolve contadores por identidade (assinaturas pedidas).

`identity.close` está reservado para a v1 e ainda não foi implementado no spike.

## Método do helper para o cliente

**`sign`** é chamado no meio de um handshake TLS 1.2 que o próprio helper iniciou, quando o servidor manda CertificateRequest (no handshake inicial ou numa renegociação). Parâmetros:

- `identity`, `scheme` (`rsa_pkcs1_sha256`; `rsa_pkcs1_sha1` existe no contrato, mas o helper Go não o usa sem `GODEBUG=tlssha1=1`) e `mode`.
- `mode: "digest"`: `digest` é o hash pronto do transcript. Quem assina monta o DigestInfo e faz PKCS#1 v1.5. É o que PSC (DOC-ICP-17.01, RAW), OpenBao Transit (`prehashed`), PKCS#11 (`CKM_RSA_PKCS`) e `privateEncrypt` do Node/Bun fazem.
- `mode: "message"`: `message` é o transcript inteiro (as mensagens de handshake do ClientHello até antes do CertificateVerify, na forma em que entram no hash) e `messageSha256` é o hash para conferência. É o modo do WebCrypto, cuja `CryptoKey` não exportável só assina mensagem.
- `context`: `purpose` (sempre `tls12-client-certificate-verify`), `host`, `conn` e `handshake` (1 inicial, 2 renegociação).

A resposta é `{"signature": "<base64>"}`. Um erro `sign_refused` aborta o handshake; o helper não tenta de novo.

**Regras para quem assina:**
- Recusar `purpose` desconhecido, `host` fora da sua própria lista e `scheme` que não seja PKCS#1 v1.5.
- No modo `message`, conferir o transcript antes de assinar: o SNI do ClientHello tem de ser o `host` do contexto, e o certificado do servidor (mensagem Certificate, em claro no transcript TLS 1.2) tem de cobrir esse host. Isso não depende de confiar no helper: um helper comprometido não consegue fazer a chave autenticar em outro servidor sem que o transcript mostre o outro servidor.
- No modo `digest` não há o que conferir além do contexto. Nesse modo, a política é do helper, e o helper é o componente em que o titular precisa confiar.

## Garantias do helper

- **Só TLS 1.2** para os hosts SEFAZ, e só esquemas PKCS#1 v1.5 no CertificateVerify, mesmo que o servidor anuncie RSA-PSS primeiro.
- **Nunca expõe assinatura avulsa.** Não existe método que peça ao helper para assinar um hash qualquer com a chave de um token. O único caminho até o signer é um handshake com um host que passou pela guarda.
- **Guarda antes do socket:** host na lista compilada no binário, `https`, porta 443, sem credencial na URL. A lista por ambiente vem dos dados de endpoints do `@sinete/transport` e só muda por release.
- **Renegociação só a pedido do servidor e uma vez por conexão** (`RenegotiateOnceAsClient`). O Go exige que a folha do servidor não mude na renegociação (ataque 3SHAKE) e exige a extensão RFC 5746.
- **Auditoria:** uma linha por requisição autenticada (hora, identidade, host, serviço, resultado, assinaturas), sem segredo.

## Códigos de erro

`protocol_version`, `unknown_method`, `bad_request`, `guard` (recusado antes do socket), `forbidden`, `unknown_identity`, `pkcs11`, `transport` (rede, TLS ou HTTP; a mensagem traz o alerta TLS), `sign_refused`, `sign_timeout`, `error`.
