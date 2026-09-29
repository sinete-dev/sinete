# 0005. Helper nativo de mTLS com chave externa (sinete-signer)

Status: proposta (spike S4, 25/set/2026); implementada em 28/set/2026 em `helpers/signer-tls/` e `@sinete/transport/signer` (seção Implementação). Código descartável do spike em `spikes/s4-signer-tls/`.

## Contexto

O ADR 0004 mostrou que nenhuma runtime JS (Node, Bun, Deno) aceita chave privada externa no handshake TLS: não há callback de assinatura nem provider. Com A3 (token PKCS#11, A3 em nuvem de PSC), com a chave no OpenBao Transit ou com a chave numa `CryptoKey` não exportável do navegador, o mTLS em JS puro é inviável. O desenho de custódia (`custodia-a1.md`, seção 4.6) já previa um serviço "sinete-signer" dono do TLS mútuo.

A pergunta do S4: um helper nativo pequeno, OSS, consegue terminar o mTLS com a SEFAZ usando uma chave que ele **não** guarda, pedindo a assinatura do `CertificateVerify` a um signer externo, enquanto o core JS fala com ele por um canal local simples? E consegue isso com as particularidades medidas no S2: só TLS 1.2, renegociação iniciada pelo servidor (SP, BA, SVAN, AN, MT homologação, Sefin), hosts só com CBC ou só com DHE, e servidores que escolhem RSA-PSS se o cliente deixar, quando os assinadores remotos só fazem PKCS#1 v1.5.

Ambiente: Go 1.26.6, Bun 1.4.2, Node 26.3.1 (servidor de lab), Deno 2.9.1, OpenSSL 3.6.4, SoftHSM 2.7.0, macOS arm64.

## O que foi construído

- `cmd/sinete-signer/`: o helper, cerca de 1.050 linhas de Go só com a biblioteca padrão, mais `github.com/miekg/pkcs11` (BSD-3) no sabor com cgo. Termina HTTP/1.1 + mTLS com `crypto/tls`, e a chave privada do `tls.Certificate` é um `crypto.Signer` que encaminha a assinatura para fora.
- `contract/`: o protocolo v1 (`PROTOCOL.md`, `PROTOCOL_VERSION`, `schema/frame.schema.json`, `fixtures/`), no molde do contrato do whatsapp-connector.
- `keyholder.ts`: o lado JS. Sobe o helper, fala o protocolo e responde aos pedidos de assinatura com uma chave que só ele tem.
- Backends de assinatura testados: `remote` em modo `digest` (KeyObject do Bun, `privateEncrypt` sobre DigestInfo, que é o formato de PSC, OpenBao e PKCS#11), `remote` em modo `message` (WebCrypto não exportável, que só assina mensagem), `pkcs11` (SoftHSM, chave gerada dentro do token) e `inproc` (chave Go em memória, só para linha de base).
- `lab/`: PKI descartável, token SoftHSM, servidores locais (Node com e sem renegociação, `openssl s_server` só CBC, só DHE, só CBC-SHA384 e só troca de chave RSA) e a bateria `run-lab.ts`. `sefaz/`: execuções contra homologação. `cmd/probe/`: sondagem de suítes do Go sem certificado de cliente.

## Evidência

### 1. O que o `crypto/tls` do Go 1.26 faz (lido no código-fonte)

- **Signer externo nos dois modos.** O cliente TLS 1.2 assina o `CertificateVerify` com `crypto.SignMessage(key, rand, hs.finishedHash.buffer, opts)` (`handshake_client.go:827`). Se a chave implementa `crypto.MessageSigner` (Go 1.25+), ela recebe o **transcript inteiro**; senão, recebe o hash via `Sign`. Isso corrige a seção 4.4 da pesquisa de custódia, que dizia que o navegador como assinador do TLS exigia rustls porque "com Go `crypto.Signer` não dá". Dá, e foi testado (item 5).
- **Controle do esquema.** `tls.Certificate.SupportedSignatureAlgorithms` filtra os esquemas que a chave aceita, e o cliente escolhe o primeiro da lista do servidor que esteja nesse filtro. Com `[PKCS1WithSHA256, PKCS1WithSHA1]`, o PSS nunca é escolhido. SHA-1 em TLS 1.2 está desligado desde o Go 1.25 sem `GODEBUG=tlssha1=1`, então na prática fica só `rsa_pkcs1_sha256`.
- **Renegociação.** `Renegotiation: RenegotiateOnceAsClient` atende o HelloRequest do IIS. A renegociação nunca retoma sessão (`handshake_client.go:374`), exige a mesma folha do servidor (proteção contra 3SHAKE) e exige a extensão RFC 5746. Detalhe que custou um bug de contagem no spike: `VerifyConnection` não é chamado no handshake de renegociação.
- **Suítes.** O Go não implementa **nenhuma** suíte DHE nem `ECDHE-RSA-AES256-CBC-SHA384`. Tem ECDHE com CBC-SHA (no padrão) e CBC-SHA256 (fora do padrão, liberada se listada), e troca de chave RSA (fora do padrão desde o 1.22, liberada se listada em `CipherSuites`, sem precisar de GODEBUG).
- **Retomada.** O cliente TLS 1.2 do Go só retoma por **session ticket**; ele não guarda sessão para retomar por session ID (`handshake_client.go:1029` e `:1053`).

### 2. Suítes contra os hosts difíceis (sem certificado de cliente, só handshake)

`openssl s_client -cipher` com listas separadas e `cmd/probe` (padrão do Go e perfil do helper), dados em `results/probe-go-suites.json`:

| Host | O servidor aceita | Go padrão | Perfil do helper |
|---|---|---|---|
| `nfe.sefaz.go.gov.br` (GO produção) | DHE-RSA-AES128-GCM e AES128-GCM-SHA256 (troca RSA); nenhuma ECDHE | falha (alerta 40) | `TLS_RSA_WITH_AES_128_GCM_SHA256`, para no alerta 46 por falta de certificado |
| `nfe.sefaz.ba.gov.br`, `www.nfe.fazenda.gov.br`, `hom1.nfe.fazenda.gov.br` | ECDHE-RSA-AES256-SHA, ECDHE-RSA-AES128-SHA256, troca RSA GCM; ECDHE-GCM leva TCP reset | `ECDHE_RSA_WITH_AES_256_CBC_SHA` | `ECDHE_RSA_WITH_AES_128_CBC_SHA256` |
| `nfe.sefa.pr.gov.br`, `homologacao.nfe.sefa.pr.gov.br` | ECDHE-RSA-AES128-SHA e -SHA256 | `ECDHE_RSA_WITH_AES_128_CBC_SHA` | igual (preferência do servidor) |

O "ECDHE-AES256-SHA384" da tabela do S2 é só a preferência do OpenSSL; esses servidores aceitam suítes que o Go tem. **Todos os hosts mapeados funcionam com Go.** O único que exige ajuste é GO produção, que precisa de troca de chave RSA (sem sigilo futuro) porque o Go não tem DHE. Por isso o helper liga a troca RSA só para hosts cujo perfil pede. Se GO produção um dia tirar a troca RSA e ficar só com DHE, o Go para de servir esse host (item 3 de Consequências).

### 3. Lab local (N = 20 por medida, loopback)

`results/lab.json`. "Assinatura" é o tempo medido no helper entre pedir e receber a assinatura, incluindo o trajeto pelo pipe; RSA 2048 em todos.

| Backend | Handshake completo p50 | Assinatura p50 / p90 | Handshake retomado p50 |
|---|---|---|---|
| `inproc` (chave no Go, linha de base) | 2,63 ms | 1,09 / 1,10 ms | 0,28 ms |
| `remote` digest (KeyObject no Bun) | 2,26 ms | 0,77 / 0,90 ms | 0,29 ms |
| `remote` message (WebCrypto no Bun) | 2,61 ms | 0,98 / 1,38 ms | 0,24 ms |
| `pkcs11` (SoftHSM) | 2,82 ms | 1,08 / 1,19 ms | 0,22 ms |

- **O salto pelo pipe custa menos que a própria operação RSA.** Os quatro backends ficam dentro do ruído; o overhead do protocolo é bem menor que 1 ms. Em produção, o que manda é o backend (PSC na rede, token USB), não o helper.
- **Keep-alive:** 20 requisições, 1 conexão, 1 assinatura, nos quatro backends.
- **Retomada (servidor Node, que emite ticket):** 19 de 20 conexões novas retomaram, com 0 assinatura, e o servidor continuou vendo o certificado do cliente nas 20.
- **Renegociação (servidor que imita o IIS):** cada conexão nova custa 2 handshakes e 1 assinatura, **mesmo quando o handshake inicial retoma**, porque a renegociação é sempre completa. A requisição seguinte na mesma conexão não renegocia e não assina.
- **Suítes:** CBC-SHA256 com o servidor pedindo PSS primeiro (`-client_sigalgs RSA-PSS+SHA256:...`) passou com `rsa_pkcs1_sha256`; só DHE e só CBC-SHA384 falham com alerta 40; troca RSA passa.
- **PKCS#11:** o par foi gerado dentro do SoftHSM com `CKA_SENSITIVE` e sem `CKA_EXTRACTABLE`; ler `CKA_PRIVATE_EXPONENT` dá `CKR_ATTRIBUTE_SENSITIVE`. O helper só vê o certificado (lido do token) e pede `C_Sign` com `CKM_RSA_PKCS` sobre o DigestInfo.
- **Políticas:** a guarda do helper recusa host fora do loopback no lab antes de abrir socket; e o dono da chave, quando o host não está na lista dele, responde `sign_refused` e o handshake aborta.
- **Deno dirigindo o helper** (`results/deno-helper.txt`): com a chave WebCrypto não exportável no Deno, em modo message, passou no servidor que renegocia e no só CBC-SHA256, que são justamente as duas coisas que o rustls do Deno não faz.

### 4. SEFAZ homologação com o certificado descartável do lab

`results/sefaz-nocert.json`. O helper roda fora do lab (guarda de homologação e ledger ligados) e o certificado é o autoassinado do lab. Em todos os hosts o helper chegou ao `CertificateRequest` e pediu uma assinatura `rsa_pkcs1_sha256` ao processo Bun:

- SP, SVRS e BA: handshake completo (SP e BA via renegociação), depois **HTTP 403** do IIS.
- GO: **HTTP 200 com cStat 999**, "Rejeição: Erro não catalogado". É novo: no S2, sem certificado, o GO alertava. Com um certificado não confiável, ele aceita o TLS e recusa na aplicação. O mapeamento de erro do `Transport` precisa tratar 999 do GO como possível certificado recusado.
- MG: alerta 40 (handshake failure) logo depois do nosso Certificate/CertificateVerify.
- PR: alerta 46 (certificate unknown).
- A guarda recusou antes do socket: URL de produção, ação SOAP de autorização e corpo com `tpAmb` 1.

### 5. SEFAZ homologação com o e-CNPJ A1 real (chave só na memória do Bun)

Mesmo certificado do S2 (`CN=FAZER AI LTDA:59554465000137`, raiz v5, cadeia de 3 enviada). O PFX e a senha foram lidos só por `op-agentes` e abertos com node-forge no processo Bun (reuso de `s2-tls/real/cert.ts`). O helper recebeu só a cadeia pública em DER e rodou com env mínimo (`PATH`, `HOME`). Guarda: 14 hosts de NF-e e MDF-e homologação compilados no binário, só POST com ação `NfeStatusServico`/`MDFeStatusServico`, `tpAmb` 2. **30 usos** no total, todos no ledger (`~/.local/state/sinete/cert-usage.log`, linhas `go-helper s4`). Uma varredura em `spikes/s4-signer-tls/` fora de `.local/` não achou material de chave.

Status de serviço pelo helper, modo digest (`results/sefaz-real.json`; contagem de renegociação em `results/sefaz-real-recount.json`, porque a primeira rodada saiu com o bug de contagem do item 1):

| Alvo | Suíte | Renegociação | 1ª requisição (handshake) | Mesma conexão | Conexão nova com cache de sessão |
|---|---|---|---|---|---|
| SP | ECDHE-AES256-GCM | sim | 107, 244 ms (58 ms), 1 assinatura | 107, 26 ms, 0 | 107, 157 ms, 1, sem retomada |
| SVRS | ECDHE-AES256-GCM | não | 107, 272 ms (110 ms), 1 | 107, 32 ms, 0 | 107, 154 ms, 1, sem retomada |
| BA | ECDHE-AES256-GCM | sim | 107, 574 ms (193 ms), 1 | 107, 104 ms, 0 | 107, 634 ms, 1, sem retomada |
| GO | ECDHE-AES128-GCM | não | 107, 148 ms (64 ms), 1 | **conexão fechada pelo servidor**: 107, 129 ms, 1 | 107, 127 ms, 1, sem retomada |
| MG | ECDHE-AES128-GCM | não | 107, 142 ms (64 ms), 1 | 107, 42 ms, 0 | 107, 161 ms, 1, sem retomada |
| PR | ECDHE-AES128-CBC-SHA | não | 107, 160 ms (83 ms), 1 | 107, 29 ms, 0 | 107, 161 ms, 1, sem retomada |

- **Todo CertificateVerify saiu `rsa_pkcs1_sha256`**, inclusive em SVRS e SP, que anunciam PSS e onde o Node do S2 escolheu `rsa_pss_rsae_sha256`.
- **Nenhuma retomada com o Go.** Nenhum desses seis servidores emite session ticket (S2: sem `session ticket lifetime hint`), e SP, BA e GO só retomam por session ID, que o cliente Go não faz. Em SP e BA isso não mudaria nada, porque a renegociação é completa de qualquer jeito. Em GO, que ainda fecha a conexão a cada resposta, o custo é **uma assinatura por requisição**.
- **Keep-alive é o que economiza assinatura:** nos outros cinco, a conexão reaproveitada respondeu em 26 a 104 ms sem nova assinatura.
- **Modo message** (WebCrypto não exportável, com a checagem de transcript ligada no Bun): SP e SVRS deram 107. No SP a assinatura foi pedida na renegociação (`handshake` 2), com transcript de 10.053 bytes; no SVRS, 20.269 bytes. Nos dois, o SNI do ClientHello e o certificado do servidor dentro do transcript (`*.svrs.rs.gov.br` no SVRS) conferiram com o host antes de assinar.
- **Latência do assinador:** com atraso artificial de 3 s e de 10 s por assinatura, SP (renegociação) e SVRS responderam 107 em 3,15 s e 10,16 s. Um PSC com centenas de ms cabe com folga; uma aprovação humana curta também. Não testei acima de 10 s.

## Decisão proposta

1. **Construir o `sinete-signer` em Go**, com `crypto/tls` da biblioteca padrão, como pacote OSS do sinete (Apache 2.0, como o core). Rust com rustls fica descartado: não renegocia, não tem CBC nem troca RSA, e deixaria de fora SP, BA, SVAN, AN, MT homologação, Sefin, PR e GO produção. Um helper sobre OpenSSL resolveria DHE, mas traz o custo de distribuir OpenSSL e de usar provider ou ENGINE (removido no OpenSSL 4) para a chave externa, e hoje nenhum host precisa disso.
2. **Dois sabores do mesmo código:**
   - `sinete-signer` estático (`CGO_ENABLED=0`, cerca de 6,3 MB): backend `remote` nos modos `digest` e `message`. Cobre A3 em nuvem (PSC RAW), OpenBao Transit, A1 guardado no processo JS e chave no navegador. Compila cruzado de uma máquina só: linux/amd64, linux/arm64, windows/amd64, darwin/amd64 e darwin/arm64 foram gerados neste spike.
   - `sinete-signer-p11` com cgo: acrescenta o backend `pkcs11` (dlopen do módulo do fabricante). Cgo não compila cruzado sem toolchain do alvo (confirmado: o build linux com cgo a partir do macOS falha), então esse sabor precisa de runner nativo por SO no CI, ou de `zig cc`. É o binário do agente desktop com token.
3. **Protocolo v1 como em `spikes/s4-signer-tls/contract/`**: NDJSON bidirecional sobre o stdio do processo filho, `v` em todo frame, `hello` para descobrir backends, `identity.open`, `http.request`, `pool.reset`, `stats` do cliente para o helper e `sign` do helper para o cliente. Socket Unix com o mesmo framing para o helper em contêiner próprio. O contrato vira especificação versionada em `docs/signer-contract/`, com schema e fixtures, e o helper e o cliente TS são testados contra as fixtures (era um pacote `@sinete/signer-contract` até o ADR 0008).
4. **Perfil TLS do helper:** só TLS 1.2 para SEFAZ (e para o ADN, que aceita 1.2, quando a identidade for de signer remoto: RSA em 1.3 exige PSS); `SupportedSignatureAlgorithms` só PKCS#1; suítes ECDHE-GCM, ECDHE-ChaCha20 e ECDHE-CBC (SHA e SHA256) sempre, troca RSA só para o host cujo perfil em `@sinete/transport` pedir (hoje, GO produção); `RenegotiateOnceAsClient`; HTTP/1.1 sem h2; pool keep-alive por identidade e host; cache de sessão ligado (vale onde houver ticket).
5. **Postura de segurança:**
   - Lista fechada de hosts por ambiente, compilada no binário a partir dos dados de endpoints; muda só por release. Recusa antes do socket.
   - Não existe método de assinatura avulsa. O `crypto.Signer` só é criado dentro do `GetClientCertificate` de uma conexão que passou pela guarda, e o `sign` que sai para o dono da chave carrega `purpose`, `host`, conexão e número do handshake.
   - O dono da chave aplica a própria política: no modo message, confere SNI e certificado do servidor no transcript; em qualquer modo, confere host, propósito e esquema. No modo digest (PSC, OpenBao, PKCS#11) essa conferência não é possível, e a política fica com o helper. É por isso que o helper precisa ser OSS e auditável.
   - A assinatura de DF-e (XMLDSig) com chave que o helper controla (PKCS#11, OpenBao) entra como método próprio (`dfe.sign`) só com validação do documento pelo helper: namespace do portal fiscal, CNPJ ou CPF do certificado igual ao emitente ou autor, digest calculado pelo próprio helper. Nunca hash cego. Isso não foi construído no spike.
   - Env mínimo no processo do helper, PIN e cadeia só pelo canal, ledger de auditoria sem segredo.
6. **Como o `Transport` JS escolhe o caminho** (estende o `TlsIdentity` do ADR 0004):

   ```ts
   type TlsIdentity =
     | { kind: "pem"; certChain: string; key: string }                 // A1 em memória no processo JS
     | { kind: "external"; signer: Signer }                           // A1 WebCrypto, PSC, OpenBao: o JS responde aos "sign"
     | { kind: "pkcs11"; module: string; token: string; label: string; pin: () => Promise<string> } // token local
     | { kind: "helper"; helper: SignerHelperConnection; identity: string }; // signer em contêiner, chave nunca no app
   interface Signer { readonly mode: "digest" | "message"; certificateChain(): Promise<Uint8Array[]>; sign(input: Uint8Array, scheme: "rsa_pkcs1_sha256", ctx: SignContext): Promise<Uint8Array> }
   ```

   | Identidade | Node e Bun | Deno |
   |---|---|---|
   | `pem` | em processo, `node:https` (caminho do S2), sem helper | em processo quando o perfil do endpoint for compatível; nos hosts de renegociação ou só CBC, usa o helper em modo message com a chave importada como `CryptoKey` não exportável se houver helper configurado, senão `TransportUnsupportedError` |
   | `external` | helper estático, backend `remote` | helper estático, backend `remote` |
   | `pkcs11` | helper `-p11` | helper `-p11` |
   | `helper` | só fala com o helper; nunca vê chave | idem |

   O `Transport` só sobe o helper quando uma identidade precisa dele. O binário vem por `optionalDependencies` por plataforma (`@sinete/signer-darwin-arm64` e afins, o padrão do esbuild), ou por caminho configurado. Sem binário para a plataforma, o erro diz qual pacote instalar.

## Consequências

- O sinete ganha um componente nativo, mas isolado e opcional. Quem usa A1 em Node ou Bun continua sem binário nenhum. O helper vira obrigatório só para A3, chave fora do processo JS, e para Deno nos hosts incompatíveis com rustls.
- **Custo de assinatura por conexão.** Com o Go não há retomada nos hosts SEFAZ medidos, então cada conexão TCP nova custa uma assinatura, e GO homologação custa uma por requisição. Para PSC com cota, o pool keep-alive por (identidade, host) é obrigatório, e o `Transport` expõe `tls.signatures` por requisição para a contabilidade. Implementar retomada por session ID exigiria fork do `crypto/tls`; não vale enquanto keep-alive resolve e a renegociação anula a retomada em metade dos hosts.
- **Risco de GO produção:** o helper depende da troca RSA desse host. Se ela sumir e sobrar só DHE, as saídas são um fork mínimo do `crypto/tls` com DHE (BSD-3; é acrescentar um tipo de troca de chave) ou um helper OpenSSL só para esse host. O job de sondagem do ADR 0004 precisa alertar essa mudança.
- Distribuição: binário assinado por plataforma; no desktop, assinatura de código (SmartScreen no Windows, notarização no macOS) e atualização automática. O sabor `-p11` precisa de CI com runner nativo por SO.
- A pesquisa de custódia (seção 4.4, "alternativa a prototipar") e a de A3 (seção 3.2, "Rust integra melhor") ficam desatualizadas nesse ponto: o Go serve também para o navegador como assinador.

## Implementação (28/set/2026)

O helper saiu do spike para `helpers/signer-tls/` (módulo Go próprio, só biblioteca padrão mais `github.com/miekg/pkcs11` v1.1.2, BSD-3, no sabor com cgo), o contrato para `docs/signer-contract/` e o cliente para o subpath `@sinete/transport/signer`. A distribuição e o lugar do cliente estão no [ADR 0014](0014-distribuicao-do-signer.md). O que mudou em relação à decisão proposta, e por quê:

- **Protocolo v1 normativo** (`docs/signer-contract/PROTOCOL.md`, schema e fixtures). O backend `inproc` do spike saiu (era só linha de base). Entraram `identity.close`, `dfe.sign`, os códigos `identity_exists`, `dfe_refused` e `closed`, e o `data` estruturado nos erros de transporte (`stage`, `alert`, `x509`, `timeout`, `reset`), que o cliente converte nos mesmos `TransportError` do transporte em processo. `rsa_pkcs1_sha1` saiu do contrato: o Go não o usa em TLS 1.2 sem `GODEBUG`.
- **Correções do spike**: o spike seguia redirecionamento (o `http.Client` padrão); o helper devolve o 3xx, como o transporte. O spike não fechava o prazo das chamadas `sign` quando o canal fechava; agora elas falham na hora com `closed`. O mapa de conexões do spike crescia sem limite; a contabilidade agora vive na própria conexão. A assinatura devolvida pelo dono da chave é conferida com a chave pública da folha antes de ir ao servidor, para uma chave errada virar `sign_refused` em vez de um `decrypt_error` que parece recusa do certificado.
- **Guarda**: a lista de hosts por ambiente sai de `ambienteHosts()` e a troca RSA sai dos perfis TLS (`keyExchange: dhe`, hoje só GO produção), gerados em `internal/policy/data_gen.go` por `scripts/gen-data.ts` e conferidos no `bun run check`. `--ambiente` é obrigatório (sem padrão silencioso para produção), `--tpamb` repete a checagem do corpo, e o `Host` diferente do da URL é recusado, como no transporte. Os casos de `fixtures/guard.json` rodam na guarda do helper e na `allowlistPolicy`.
- **`dfe.sign` construído**, com a validação sobre os bytes canônicos, e não sobre o documento: o helper confere o perfil do `SignedInfo` dos DF-e, calcula ele mesmo o hash, e exige que o `Id` referenciado seja de documento fiscal com o CNPJ ou o CPF do titular (do SubjectAltName ICP-Brasil) na posição do emitente. Para evento cujo `Id` traz a chave de outro emitente, o cliente pode mandar o elemento canonicalizado, e o helper confere o digest e o autor. A C14N fica no cliente: um cliente que mentisse nela só produziria uma assinatura que não confere no documento real, e o que a chave assina é sempre um `SignedInfo` de documento do titular. Implementar C14N em Go para revalidar o documento inteiro não muda o que a chave assina e dobraria o código de canonicalização a manter.
- **PKCS#11**: o certificado é achado pelo rótulo ou pelo `CKA_ID`, e a chave pelo `CKA_ID` do certificado (os tokens reais dão rótulos diferentes aos dois). Identidades do mesmo módulo dividem o `C_Initialize`, e fechar uma não faz `C_Logout`, que derrubaria as outras sessões do mesmo token.
- **Socket Unix** (`--socket`, 0600, fora do Windows): cada conexão tem as próprias identidades.
- **`TlsIdentity`**: ficam `pem` e `helper`. Os tipos `external` e `pkcs11` saíram do transporte; `openRemote` e `openPkcs11` devolvem a identidade `helper` (ADR 0014, decisão 1).

Testado: a guarda, o `dfe.sign`, o protocolo e o transporte em testes Go com PKI descartável (inclusive troca RSA, TLS 1.3 recusado, AC fora da confiança, prazo do `sign`, canal que fecha com `sign` pendente); SoftHSM 2.7 no Go e no cliente TS (par gerado no token, sensível e não extraível, mTLS na renegociação e `dfe.sign`); o laboratório TLS do `@sinete/transport` (renegociação como o IIS, só CBC, só DHE) com o binário de verdade nos modos `digest` e `message`; e o `@sinete/emissor` emitindo NF-e, MDF-e de emitente pessoa física e NFS-e Nacional contra o `@sinete/sefaz-sim` com o certificado aberto do token. Não testado: token físico, PSC e OpenBao reais, os binários Linux e Windows executados (só compilados), o relay por WebSocket e a SEFAZ real (nenhuma requisição saiu do loopback nesta etapa).

## Pendências

- Token físico real (SafeNet, GD StarSign) e o middleware PKCS#11 de PSC (Bird ID) no `-p11`; só o SoftHSM foi testado. Verificar sessão PKCS#11 com PIN cacheado e token removido no meio.
- PSC real: `POST /signature` RAW SHA-256 como backend `remote` digest, termos de uso para autenticação TLS e como a cota conta. Exige contrato com o PSC.
- OpenBao Transit (`sign` com `prehashed=true`, `signature_algorithm=pkcs1v15`): o caminho de código é o do digest remoto, mas não havia OpenBao para testar.
- Tempo de ociosidade do keep-alive de cada IIS e de cada Tomcat da SEFAZ, que define quantas assinaturas por hora um pool gasta.
- ADN da NFS-e pelo helper, limitado a TLS 1.2 com PKCS#1 (o S2 só testou 1.3 com Node).
- `dfe.sign` feito (seção Implementação), com o elemento: o `@sinete/core` entrega ao signer `data` o elemento referenciado canonicalizado (`SignContext`), e o `documentSigner` o manda ao helper, o que faz a manifestação do destinatário passar pela regra do autor.
- Relay do `sign` para o navegador por WebSocket (o app repassa os frames). O modo message e a latência de 10 s foram provados; o relay não.
- `identity.close` e `sign_timeout` feitos. Faltam limites de taxa por identidade e a reabertura da sessão PKCS#11 depois de token removido (hoje a identidade precisa ser fechada e aberta de novo).
- Os resultados do spike ficam em `spikes/s4-signer-tls/results/`, que o `.gitignore` da raiz ignora (`results/`), como no S2 e no S3.
