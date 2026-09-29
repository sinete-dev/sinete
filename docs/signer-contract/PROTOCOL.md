# Protocolo sinete-signer v1

Parte normativa do contrato entre um cliente (o `@sinete/transport/signer`, ou qualquer processo que fale estes frames) e o helper nativo `sinete-signer` (`helpers/signer-tls/`), que termina o mTLS com a SEFAZ sem guardar a chave privada e, no sabor com PKCS#11, assina documento fiscal com a chave do token. A versão fica em `PROTOCOL_VERSION`; o formato de cada frame, em `schema/frame.schema.json`; exemplos de ida e volta, em `fixtures/`. Decisão: ADR 0005.

Status: estável na v1. Mudança incompatível (método removido, campo obrigatório novo, semântica diferente) sobe a versão; campo opcional novo e código de erro novo não sobem, e o cliente ignora o que não conhece no resultado.

## Canal

Um objeto JSON por linha (NDJSON, UTF-8, `\n`), no máximo 64 MiB por linha. O canal padrão é o stdio: o cliente sobe o helper como processo filho, escreve no stdin e lê o stdout. O stderr é só log humano e auditoria, nunca frame. O canal alternativo é um socket Unix (`--socket`, permissão 0600) com o mesmo framing, para o helper em contêiner próprio; cada conexão tem as próprias identidades, e quem conecta é autenticado pela permissão do arquivo, porque o protocolo não tem login.

O canal é bidirecional: os dois lados fazem requisições e os dois respondem. O cliente pede `http.request`; no meio do handshake, o helper pede `sign`.

Fechar o stdin (ou a conexão do socket) é o pedido de encerramento. O helper falha na hora as chamadas `sign` pendentes (a requisição que dependia delas volta com `sign_refused` ou `closed`), espera as requisições em andamento terminarem, fecha as identidades (sessões PKCS#11 inclusive) e sai.

## Frame

```
{"v":1,"id":"c12","method":"http.request","params":{...}}      requisição
{"v":1,"id":"c12","result":{...}}                              resposta
{"v":1,"id":"c12","error":{"code":"guard","message":"...","data":{...}}}   erro
```

- `v` vai em todo frame. Frame com `v` diferente recebe `protocol_version` e não é executado. O helper não negocia versão: o cliente lê o `hello` e decide.
- `id` é único por lado e por canal: `c<n>` para o que o cliente inicia, `h<n>` para o que o helper inicia. As duas numerações nunca colidem.
- Requisições são concorrentes e as respostas podem voltar fora de ordem; correlacione por `id`.
- `error.data` é opcional e estruturado (estágio, alerta TLS); nunca leva segredo nem corpo.
- Corpos, cadeias, digests e assinaturas vão em base64 padrão (RFC 4648, seção 4, com `=`).

## Métodos do cliente para o helper

**`hello`** (`protocol`, `client`) devolve `protocol`, `helper` (`sinete-signer/<versão>`), `lab`, `ambientes` liberados na linha de comando, `backends` deste binário (`remote` sempre; `pkcs11` só no sabor com cgo), `signModes`, `schemes`, `methods` e `dataVersion` (versão dos endpoints, perfis TLS e bundle ICP compilados). O cliente chama antes de tudo e recusa helper cujo `protocol` não conhece.

**`identity.open`** registra uma identidade TLS sob um `id` escolhido pelo cliente. Não existe identidade padrão: toda requisição nomeia a sua. `id` repetido recebe `identity_exists`.
- `backend: "remote"`: o cliente manda só a cadeia pública (`chain`, DER em base64, titular primeiro, sem a raiz), o `mode` de assinatura (`digest` ou `message`) e, opcional, `signTimeoutMs` (padrão 30 s, máximo 5 min). A chave fica com o cliente, que responde aos `sign`.
- `backend: "pkcs11"`: o helper abre o módulo (`module`, caminho absoluto), acha o token pelo rótulo (`token`; `serial` desempata), faz login com `pin` e usa o certificado de rótulo `label` (ou de `keyId`, o `CKA_ID` em hexadecimal) e a chave privada com o mesmo `CKA_ID` do certificado. `chain` completa as intermediárias. O PIN atravessa o canal e nunca vai para argv ou env.
- `additionalCa` (PEMs) soma ACs à confiança do servidor só desta identidade (AC de teste, proxy corporativo). Não amplia a lista de hosts.
- A resposta traz `subject`, validade, a `chain` efetiva, `cnpj` ou `cpf` do titular (do SubjectAltName ICP-Brasil, DOC-ICP-04) e `dfeSign` (se a identidade aceita `dfe.sign`).

**`identity.close`** (`identity`) fecha o pool e a sessão PKCS#11 da identidade.

**`http.request`** faz uma requisição HTTP/1.1 com mTLS pela identidade. Parâmetros: `identity`, `url`, `method` (`POST` ou `GET`), `headers`, `body` (base64), `timeoutMs` (prazo total, padrão 60 s), `service` (rótulo para a auditoria) e `freshConn` (fecha as conexões ociosas antes, para medir retomada). Redirecionamento nunca é seguido: o 3xx volta como resposta. A resposta traz `status`, `headers` (nomes em minúsculas, valores repetidos juntados por `, `), `body` (base64), `ms` e o bloco `tls`: `version`, `cipher`, `conn` (número da conexão), `connReused`, `handshakes` e `renegotiations` da conexão, `resumed` por handshake, `certRequests`, `handshakeMs`, `peerChain` (CN da cadeia do servidor) e `signatures`, as assinaturas pedidas **durante esta requisição**. É esse bloco que permite ao cliente contabilizar a cota de um PSC.

**`pool.reset`** (`identity`, `dropSessions`) fecha as conexões ociosas da identidade; com `dropSessions: true`, descarta também o cache de sessão TLS.

**`cancel`** (`id`) cancela a requisição do cliente com esse `id` que ainda estiver em andamento (hoje, na prática, um `http.request` cujo chamador desistiu) e devolve `cancelled` (`false` se ela já terminou ou nunca existiu). A requisição cancelada para de esperar o servidor e responde com o erro que o cancelamento provocar, que o cliente ignora. O cancelamento não desfaz o que já saiu: se o corpo já foi enviado, a SEFAZ pode tê-lo recebido, e o chamador trata o envio como de resultado incerto. Um handshake em andamento pode terminar em segundo plano e deixar a conexão no pool, sem enviar a requisição.

**`stats`** devolve, em `identities`, as assinaturas feitas por identidade (handshakes e `dfe.sign`).

**`dfe.sign`** assina um documento fiscal com a chave que o helper controla (só backend `pkcs11`; no `remote` o cliente já tem a chave e recebe `forbidden`). Parâmetros: `identity`, `signedInfo` (o `SignedInfo` canonicalizado, C14N 1.0, exatamente os bytes que a assinatura cobre), `hash` (`SHA-1` nos leiautes atuais) e, opcional, `element` (o elemento referenciado, canonicalizado). Não existe hash cego. Antes de assinar, o helper:
1. confere que o `SignedInfo` tem o perfil que o `@sinete/core/xml` produz: namespace da XMLDSig, C14N 1.0, `SignatureMethod` RSA-SHA1 ou RSA-SHA256 igual ao `hash`, um só `Reference` com URI local, transformações enveloped-signature e C14N 1.0, `DigestMethod` e `DigestValue` coerentes, sem comentário, texto solto ou elemento a mais;
2. confere que a referência é Id de documento fiscal e que o documento nele é o titular do certificado: NF-e, NFC-e, MDF-e e CT-e (`NFe`, `MDFe`, `CTe` + chave, emitente nas posições 7 a 20 da chave, MOC 7.0 item 5.4), evento (`ID` + tpEvento + chave + sequência), inutilização (`ID` + cUF + ano + CNPJ + ...), DPS e pedido de registro de evento da NFS-e Nacional (`DPS`, `PRE`, leiaute 1.01). CPF entra com três zeros à esquerda, como nos Ids. Titular com CNPJ cobre também os estabelecimentos do mesmo CNPJ-base nos documentos da SEFAZ (NF-e, NFC-e, MDF-e, CT-e, evento e inutilização), como a SEFAZ aceita (NF-e F03, rejeição 213): o certificado da matriz assina o documento da filial. Na NFS-e e para CPF, só o mesmo documento; e um documento que começa com `000` (a forma de um CPF no Id) só passa por igualdade;
3. com `element`, confere que o hash dele é o `DigestValue` e, se for evento (`infEvento`, `infPedReg`), que o autor (`CNPJ`/`CPF`, `CNPJAutor`/`CPFAutor`) é o titular. É assim que passa o evento cujo Id traz a chave de outro emitente (manifestação do destinatário);
4. calcula o hash do `SignedInfo` e pede `C_Sign` com `CKM_RSA_PKCS` sobre o DigestInfo.

A C14N é do cliente; o helper valida os bytes canônicos, que são o que a assinatura cobre. Um cliente que mentisse na C14N só produziria uma assinatura que não confere no documento real. A resposta traz `signature`, `reference` e `kind`. Recusa: `dfe_refused`.

## Método do helper para o cliente

**`sign`** chega no meio de um handshake TLS 1.2 que o próprio helper iniciou, quando o servidor manda CertificateRequest (no handshake inicial ou numa renegociação). Parâmetros:

- `identity`, `scheme` (sempre `rsa_pkcs1_sha256`) e `mode`.
- `mode: "digest"`: `digest` é o SHA-256 do transcript. Quem assina monta o DigestInfo e faz PKCS#1 v1.5. É o que PSC (RAW), OpenBao Transit (`prehashed`), PKCS#11 (`CKM_RSA_PKCS`) e o `privateEncrypt` do Node e do Bun fazem.
- `mode: "message"`: `message` é o transcript inteiro (as mensagens de handshake do ClientHello até antes do CertificateVerify) e `messageSha256`, o hash para conferência. É o modo do WebCrypto, cuja `CryptoKey` não exportável só assina mensagem.
- `context`: `purpose` (sempre `tls12-client-certificate-verify`), `host`, `conn` e `handshake` (1 inicial, 2 renegociação).

A resposta é `{"signature": "<base64>"}`. O helper confere a assinatura com a chave pública da folha antes de mandá-la ao servidor. Qualquer erro na resposta aborta o handshake e a requisição volta com `sign_refused` (ou `sign_timeout`, se o prazo da identidade estourar); o helper não tenta de novo.

**Regras para quem assina:**
- Recusar `purpose` desconhecido, `host` fora da própria lista e `scheme` que não seja PKCS#1 v1.5.
- No modo `message`, conferir o transcript antes de assinar: o SNI do ClientHello tem de ser o `host` do contexto (em IP não pode haver SNI, RFC 6066), e o certificado do servidor (mensagem Certificate, em claro no TLS 1.2) tem de cobrir esse host: pelo `dNSName` do SAN (ou pelo CN, sem SAN DNS) para nome, pelo `iPAddress` do SAN para endereço IP. Isso não depende de confiar no helper: um helper comprometido não consegue fazer a chave autenticar em outro servidor sem que o transcript mostre o outro servidor. A cadeia do certificado do servidor não é validada, de propósito: a assinatura cobre o transcript, que contém a mensagem Certificate, e só é aceita por um servidor cujo handshake traz aquele mesmo certificado. Um certificado autoassinado com o nome do host só aparece no handshake com um servidor do próprio atacante, a quem a assinatura não dá acesso a nada; um servidor de terceiros aparece no transcript com o certificado dele, que o nome recusa; e quem repassa o handshake do servidor verdadeiro mostra o certificado verdadeiro, que passaria em qualquer validação de cadeia.
- No modo `digest` não há o que conferir além do contexto. Nesse modo a política é do helper, e o helper é o componente em que o titular precisa confiar.

## Garantias do helper

- **Só TLS 1.2** e só `rsa_pkcs1_sha256` no CertificateVerify, mesmo que o servidor anuncie RSA-PSS primeiro. Suítes ECDHE com GCM, ChaCha20 e CBC sempre; troca de chave RSA só no host cujo perfil TLS medido só oferece DHE (dados do `@sinete/transport`).
- **Nunca expõe assinatura avulsa.** O único caminho até a chave num handshake é uma conexão com host aprovado pela guarda, e o único caminho até a chave para documento é o `dfe.sign` validado.
- **Guarda antes do socket:** `https`, porta 443, sem credencial na URL, `Host` igual ao da URL, host na lista compilada dos ambientes liberados (`--ambiente`), e, com `--tpamb`, todo `<tpAmb>` do corpo com o valor exigido. É a mesma semântica da `allowlistPolicy` do `@sinete/transport`, conferida pelos casos de `fixtures/guard.json`. A lista muda só por release. `--lab` aceita só loopback.
- **Renegociação só a pedido do servidor e uma vez por conexão.** O Go exige que a folha do servidor não mude na renegociação (3SHAKE) e exige a extensão da RFC 5746.
- **HTTP/1.1 sempre**, pool keep-alive por identidade e host, cache de sessão TLS por identidade.
- **Auditoria:** uma linha JSON por requisição autenticada e por `dfe.sign` (hora, identidade, titular, host ou referência, serviço, status ou erro, assinaturas), sem segredo, no stderr (`audit ` no começo) ou em `--audit-file`.

## Códigos de erro

| Código | Quando |
|---|---|
| `protocol_version` | frame com `v` diferente, ou `hello` com `protocol` que o helper não fala |
| `unknown_method` | método que o lado que recebeu não atende |
| `bad_request` | parâmetro ausente ou inválido |
| `guard` | recusado pela guarda, antes do socket |
| `forbidden` | operação não permitida para a identidade (`dfe.sign` no `remote`) |
| `unknown_identity` | identidade não aberta neste canal |
| `identity_exists` | `identity.open` com `id` já aberto |
| `pkcs11` | módulo, token, login, objeto ou `C_Sign` falharam; ou o binário é o sabor estático |
| `transport` | rede, TLS ou HTTP; `data.stage` (`dial`, `handshake`, `request`, `response`) e, quando houver, `alert` (alerta TLS recebido), `x509` (`unknown_authority`, `hostname`, `invalid`), `timeout`, `reset`, `refused`, `dns`, `notTls` |
| `sign_refused` | quem assina recusou ou devolveu assinatura inválida; o handshake abortou |
| `sign_timeout` | quem assina não respondeu no prazo da identidade |
| `dfe_refused` | `dfe.sign` recusado pela validação do documento |
| `closed` | o canal fechou com a chamada pendente |
| `error` | falha não classificada |
