# ADR 0004: TLS, cadeia ICP-Brasil e transporte mTLS (spike S2, parte 1)

Status: proposto; a parte do Deno (item 5 da decisão) foi aceita em 25/set/2026. Data: 25/set/2026. Spike: `spikes/s2-tls/` (código descartável).

## Contexto

O plano da fase 1 (seções 2 a 4) exige que o sinete rode em Node, Bun e Deno sem binário nativo e sem openssl externo, com endpoints e cadeia ICP-Brasil como dados versionados. O S2 pergunta se o mTLS com certificado ICP-Brasil funciona nas três runtimes contra todos os autorizadores.

Esta parte roda sem certificado ICP-Brasil válido. Nenhum certificado real desta máquina foi usado. O que foi feito: levantamento dos endpoints nas fontes oficiais, sondagem TLS leve de cada host (no máximo uns 12 handshakes por host, espalhados em minutos), montagem do bundle ICP-Brasil e prova de que cada runtime apresenta o certificado de cliente, usando um certificado autoassinado descartável (`CN=sinete-spike-throwaway-client`). A SEFAZ recusa esse certificado, como esperado; o que se mede é até onde o handshake vai e se o certificado sai no fio.

Ambiente: macOS, Node 26.3.1 (OpenSSL 3, undici 8.5.0 embutido), Bun 1.4.2 (BoringSSL), Deno 2.9.1 (rustls), OpenSSL 3.6.4 para as sondagens.

## Evidência

### 1. Endpoints (dados)

`spikes/s2-tls/endpoints.json`, gerado por `build-endpoints.ts` a partir das páginas salvas em `raw/`:

- NF-e 4.00, produção e homologação, 15 autorizadores (AM, BA, GO, MG, MS, MT, PE, PR, RS, SP, SVAN, SVRS, SVC-AN, SVC-RS, AN) e o mapa UF para autorizador, de `https://www.nfe.fazenda.gov.br/portal/webServices.aspx?tipoConteudo=OUC/YVNWZfo=` e do equivalente em `hom.nfe.fazenda.gov.br`.
- MDF-e 3.00 (SVRS), de `https://dfe-portal.svrs.rs.gov.br/Mdfe/Servicos`.
- NFS-e Nacional (Sefin, ADN, parametrização, DANFSe, CNC; produção restrita e produção), de `https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao` (página atualizada em 20/ago/2026).
- Coleta em 25/set/2026. São 35 hosts distintos (`hosts.json`).

Diferenças contra a lista de 2024 do brafis: AM ganhou `CadConsultaCadastro4`; a consulta cadastro do RS saiu de `cad.sefazrs.rs.gov.br` para `cad.svrs.rs.gov.br`; e o PI usa SVC-AN em produção mas SVC-RS em homologação. O mapa de contingência, portanto, precisa ser por ambiente e não só por UF.

### 2. Sondagem TLS por host

Scripts: `probe-openssl.ts` (handshake completo com `-showcerts -status`, retomada de sessão e um handshake por versão de 1.0 a 1.3), `runtime-trust.ts` (loja padrão de cada runtime e loja padrão somada às raízes ICP-Brasil), `build-bundle.ts` (cadeias) e `summarize.ts` (tabela abaixo, também em `out/summary.json`). Dados brutos em `out/openssl/`, `out/trust/` e `out/http/`.

Legenda: "Pede cert" indica onde o servidor manda o CertificateRequest. "no handshake" quer dizer já no handshake inicial; "renegociação" quer dizer que o handshake inicial não pede certificado e o servidor (IIS) manda HelloRequest depois de ver a requisição HTTP e renegocia pedindo o certificado. "Sem cert" é o que acontece sem certificado de cliente. "n/a (exige cert)" quer dizer que o servidor aborta o handshake antes de a runtime reportar a validação da cadeia. "+ICP" é a loja padrão somada às raízes v5, v10, v11 e v12, no formato Node/Bun/Deno quando divergem.

| Host | Uso | TLS aceitos | Cifra (openssl) | Pede cert | Sem cert | Raiz | Node/Bun padrão | Deno padrão | +ICP (N/B/D) | Deno viável | OCSP staple | Retomada |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `nfe.sefaz.am.gov.br` | nfe:prod:AM | 1.0, 1.1, 1.2 | ECDHE-AES128-GCM-SHA256 | no handshake | alerta TLS: bad certificate | ICP-Brasil v10 | n/a (exige cert) | falha (CA) | n/a (exige cert) | ok | não | não |
| `nfe.sefaz.ba.gov.br` | nfe:prod:BA | 1.0, 1.1, 1.2 | ECDHE-AES256-SHA384 | renegociação (provável, IIS) | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (cifra) | ok/ok/falha (cifra) | NÃO (sem ECDHE+AEAD) | sim | sim |
| `nfe.sefaz.go.gov.br` | nfe:prod:GO | 1.0, 1.1, 1.2 | DHE-AES128-GCM-SHA256 | no handshake | alerta TLS: certificate unknown | ICP-Brasil v10 | n/a (exige cert) | n/a (exige cert) | n/a (exige cert) | NÃO (sem ECDHE+AEAD) | não | não |
| `nfe.fazenda.mg.gov.br` | nfe:prod:MG | 1.2 | ECDHE-AES128-GCM-SHA256 | no handshake | alerta TLS: handshake failure | Sectigo R46 | n/a (exige cert) | n/a (exige cert) | n/a (exige cert) | ok | não | não |
| `nfe.sefaz.ms.gov.br` | nfe:prod:MS | 1.2 | ECDHE-AES128-GCM-SHA256 | no handshake | TCP reset após a requisição | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | não | sim |
| `nfe.sefaz.mt.gov.br` | nfe:prod:MT | 1.2 | ECDHE-AES128-GCM-SHA256 | no handshake | HTTP 200 (GET ?wsdl sem cert) | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | não | sim |
| `nfe.sefaz.pe.gov.br` | nfe:prod:PE | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | não | não |
| `nfe.sefa.pr.gov.br` | nfe:prod:PR | 1.2 | ECDHE-AES128-SHA256 | no handshake | alerta TLS: bad certificate | ICP-Brasil v10 | n/a (exige cert) | n/a (exige cert) | n/a (exige cert) | NÃO (sem ECDHE+AEAD) | não | não |
| `nfe.sefazrs.rs.gov.br` | nfe:prod:RS | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | sim | não |
| `cad.svrs.rs.gov.br` | nfe:prod:RS nfe:prod:SVRS | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | não testado | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | sim | não |
| `nfe.fazenda.sp.gov.br` | nfe:prod:SP | 1.2 | ECDHE-AES256-GCM-SHA384 | renegociação (provável, IIS) | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | NÃO (renegociação) | sim | sim |
| `www.sefazvirtual.fazenda.gov.br` | nfe:prod:SVAN nfe:prod:SVC-AN | 1.0, 1.1, 1.2 | ECDHE-AES256-GCM-SHA384 | renegociação (provável, IIS) | HTTP 403 | GlobalSign Root R46 | ok | ok | ok | NÃO (renegociação) | sim | não |
| `nfe.svrs.rs.gov.br` | nfe:prod:SVC-RS nfe:prod:SVRS | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | sim | não |
| `www1.nfe.fazenda.gov.br` | nfe:prod:AN | 1.0, 1.1, 1.2 | ECDHE-AES256-GCM-SHA384 | renegociação (provável, IIS) | HTTP 403 | GlobalSign Root R46 | ok | ok | ok | NÃO (renegociação) | sim | não |
| `www.nfe.fazenda.gov.br` | nfe:prod:AN | 1.0, 1.1, 1.2 | ECDHE-AES256-SHA384 | renegociação (provável, IIS) | não testado | ISRG Root X1 | ok | falha (cifra) | ok/ok/falha (cifra) | NÃO (sem ECDHE+AEAD) | não | não |
| `homnfe.sefaz.am.gov.br` | nfe:hom:AM | 1.0, 1.1, 1.2 | ECDHE-AES128-GCM-SHA256 | no handshake | alerta TLS: bad certificate | ICP-Brasil v10 | n/a (exige cert) | falha (CA) | n/a (exige cert) | ok | não | não |
| `hnfe.sefaz.ba.gov.br` | nfe:hom:BA | 1.0, 1.1, 1.2 | ECDHE-AES256-GCM-SHA384 | renegociação (verificado) | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | NÃO (renegociação) | sim | sim |
| `homolog.sefaz.go.gov.br` | nfe:hom:GO | 1.0, 1.1, 1.2 | ECDHE-AES128-GCM-SHA256 | no handshake | alerta TLS após a requisição: handshake failure | ISRG Root X1 | ok | ok | ok | ok | não | sim |
| `hnfe.fazenda.mg.gov.br` | nfe:hom:MG | 1.2 | ECDHE-AES128-GCM-SHA256 | no handshake | alerta TLS: handshake failure | Sectigo R46 | n/a (exige cert) | n/a (exige cert) | n/a (exige cert) | ok | não | não |
| `hom.nfe.sefaz.ms.gov.br` | nfe:hom:MS | 1.2 | ECDHE-AES128-GCM-SHA256 | no handshake | TCP reset após a requisição | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | não | sim |
| `homologacao.sefaz.mt.gov.br` | nfe:hom:MT | 1.2 | ECDHE-AES128-GCM-SHA256 | renegociação (verificado) | TCP reset após a requisição | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | NÃO (renegociação) | não | sim |
| `nfehomolog.sefaz.pe.gov.br` | nfe:hom:PE | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | não | sim |
| `homologacao.nfe.sefa.pr.gov.br` | nfe:hom:PR | 1.2 | ECDHE-AES128-SHA256 | no handshake | alerta TLS: bad certificate | ICP-Brasil v10 | n/a (exige cert) | n/a (exige cert) | n/a (exige cert) | NÃO (sem ECDHE+AEAD) | não | não |
| `nfe-homologacao.sefazrs.rs.gov.br` | nfe:hom:RS | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | sim | sim |
| `cad-homologacao.svrs.rs.gov.br` | nfe:hom:RS nfe:hom:SVRS | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | não testado | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | sim | sim |
| `homologacao.nfe.fazenda.sp.gov.br` | nfe:hom:SP | 1.2 | ECDHE-AES256-GCM-SHA384 | renegociação (verificado) | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | NÃO (renegociação) | não | sim |
| `hom.sefazvirtual.fazenda.gov.br` | nfe:hom:SVAN nfe:hom:SVC-AN | 1.0, 1.1, 1.2 | ECDHE-AES256-GCM-SHA384 | renegociação (verificado) | HTTP 403 | GlobalSign Root R46 | ok | ok | ok | NÃO (renegociação) | sim | sim |
| `nfe-homologacao.svrs.rs.gov.br` | nfe:hom:SVC-RS nfe:hom:SVRS | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | sim | não |
| `hom1.nfe.fazenda.gov.br` | nfe:hom:AN | 1.0, 1.1, 1.2 | ECDHE-AES256-SHA384 | renegociação (verificado) | HTTP 403 | GlobalSign Root R46 | ok | falha (cifra) | ok/ok/falha (cifra) | NÃO (sem ECDHE+AEAD) | sim | sim |
| `mdfe.svrs.rs.gov.br` | mdfe:producao | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | sim | não |
| `mdfe-homologacao.svrs.rs.gov.br` | mdfe:homologacao | 1.2 | ECDHE-AES256-GCM-SHA384 | no handshake | HTTP 403 | ICP-Brasil v10 | falha (CA) | falha (CA) | ok | ok | sim | sim |
| `sefin.producaorestrita.nfse.gov.br` | nfse:producaoRestrita | 1.0, 1.1, 1.2 | ECDHE-AES256-GCM-SHA384 | renegociação (verificado) | HTTP 403 | GlobalSign Root R46 | ok | ok | ok | NÃO (renegociação) | sim | sim |
| `adn.producaorestrita.nfse.gov.br` | nfse:producaoRestrita | 1.2, 1.3 | CHACHA20 (1.3) | no handshake (1.3) | 1.2: handshake failure; 1.3: bad record mac | ISRG Root X1 | ok | ok | ok | ok | não | não |
| `sefin.nfse.gov.br` | nfse:producao | 1.0, 1.1, 1.2 | ECDHE-AES256-GCM-SHA384 | renegociação (provável, IIS) | HTTP 403 | GlobalSign Root R46 | ok | ok | ok | NÃO (renegociação) | sim | sim |
| `adn.nfse.gov.br` | nfse:producao | 1.2, 1.3 | CHACHA20 (1.3) | no handshake (1.3) | 1.2: handshake failure; 1.3: bad record mac | ISRG Root X1 | ok | ok | ok | ok | não | não |

O que a tabela mostra:

- **Versões.** Todos os autorizadores SEFAZ negociam só TLS 1.2. Só o ADN da NFS-e aceita 1.3. Onze hosts ainda aceitam 1.0 e 1.1, o que não importa, porque o sinete fixa o mínimo em 1.2.
- **Cadeia.** 25 dos 35 hosts usam certificado de servidor ICP-Brasil, sempre sob a **raiz v10** e por uma de três intermediárias: AC SERPRO SSLv1, AC SOLUTI SSL EV G4 e AC Certisign ICP-Brasil SSL EV G4. Nenhuma runtime confia nisso por padrão: Node (120 raízes), Bun (121) e Deno (151, webpki) falham todas. Os outros 10 hosts (MG, AN, SVAN/SVC-AN, GO homologação, Sefin e ADN) usam CA pública (GlobalSign R46, Sectigo R46, Let's Encrypt) e validam em qualquer runtime. Todos os servidores mandam a intermediária; seis mandam a raiz junto, o que não atrapalha.
- **Certificado de cliente, três comportamentos.**
  1. O servidor pede no handshake inicial e aborta sem certificado: AM, GO produção, MG e PR, com alerta TLS 40, 42 ou 46. MS e MT homologação dão TCP reset. GO homologação alerta depois da requisição.
  2. O servidor pede no handshake inicial, mas o certificado é opcional no TLS e a recusa vem no HTTP (403): SVRS, RS, PE e MDF-e. MT produção chega a servir o WSDL sem certificado.
  3. **Renegociação TLS 1.2 iniciada pelo servidor**: o handshake inicial não tem CertificateRequest, e depois do cabeçalho HTTP o IIS manda HelloRequest e renegocia pedindo o certificado. Isso foi verificado com `openssl s_client -msg` em BA homologação, SP homologação, SVAN homologação, AN homologação (`hom1`), MT homologação e Sefin produção restrita. Pela mesma assinatura (IIS sem CertificateRequest inicial), é quase certo também em BA, SP, SVAN, AN (`www1` e `www`) e Sefin de produção.
- **Cifras.** BA produção, AN produção de eventos (`www.nfe.fazenda.gov.br`), AN homologação (`hom1`) e PR (os dois ambientes) não oferecem nenhuma suíte ECDHE com AEAD: são só CBC. GO produção só oferece DHE-GCM. Isso foi confirmado forçando `-cipher 'ECDHE+AESGCM:ECDHE+CHACHA20'`.
- **Retomada de sessão** funciona em 17 dos 35 hosts. **OCSP stapling** existe só nos IIS (SVRS, RS, BA, SP, SVAN, AN, Sefin). Os leaf ICP têm OCSP e AIA HTTP (`ocsp.serpro.gov.br/acserprosslv1`, `ocsp3.acsoluti.com.br`, `ocsp-ac-certisign-icp-br-ssl.certisign.com.br`). Os leaf da Let's Encrypt (cadeia nova YR1 > Root YR, com cross-sign na ISRG X1) não têm OCSP.
- **Lista de CAs aceitas para o cliente** (no CertificateRequest): SVRS, RS e MDF-e de **produção** listam só v2, v5 e v10, **sem v12**. Homologação SVRS, AM, PR, PE e ADN listam v12. A maioria dos e-CNPJ novos sai de ACs sob v12 (25 ACs no zip do ITI) ou v5 (139).

### 3. Bundle ICP-Brasil

Fonte: `http://acraiz.icpbrasil.gov.br/credenciadas/CertificadosAC-ICP-Brasil/ACcompactado.zip`, com 180 certificados de 25/ago/2026. O SHA-512 (`4585a999...a59d7985`) confere com o `hashsha512.txt` publicado pelo ITI, e `build-bundle.ts` recusa o zip se não conferir. As raízes avulsas `ICP-Brasilv{5,10,11}.crt` do mesmo site são idênticas às do zip. A v12 não existe como arquivo avulso (404) e só vem no zip. Saída: `spikes/s2-tls/icp/icp-brasil-bundle.json` (com PEM, fonte e hash) e `icp-brasil-roots.pem`.

| Tipo | Certificado | Validade | Chave | SHA-256 |
|---|---|---|---|---|
| raiz | AC Raiz Brasileira v5 | 2029-03-02 | RSA 4096 | `CA:A5:3F:C6:09:1C:69:51:88:7C:97:6E:37:8F:6E:F8:9A:A6:37:7C:55:D9:7B:64:75:42:2B:71:ED:7E:9B:17` |
| raiz | AC Raiz Brasileira v10 | 2032-07-01 | RSA 4096 | `6E:0B:FF:06:9A:26:99:4C:15:DE:2C:48:88:CC:54:AF:84:88:2E:54:95:B7:FB:F6:6B:E9:CC:FF:EC:74:89:F6` |
| raiz | AC Raiz Brasileira v11 | 2032-07-01 | RSA 4096 | `14:06:71:00:58:18:0F:A4:08:1A:AB:3F:24:6F:17:02:42:9C:55:2A:11:FA:31:43:B8:4C:88:CB:3A:B8:E5:E7` |
| raiz | AC Raiz Brasileira v12 | 2037-10-22 | RSA 4096 | `D8:47:8E:37:CE:19:C6:90:CF:65:73:81:E6:8F:E6:00:E4:E1:A0:42:53:68:30:F0:68:47:E0:3E:55:4C:4B:01` |
| raiz (fora do TLS) | AC Raiz Brasileira v6 | 2038-12-28 | Ed448 | `3B:DB:9B:50:93:52:F1:D3:D7:1C:2B:F6:4D:9A:38:A4:E6:CE:BD:A2:78:09:D7:7F:7A:C4:76:CB:DE:6E:31:4A` |
| raiz (fora do TLS) | AC Raiz Brasileira v7 | 2038-12-28 | OID 1.3.6.1.4.1.44588.2.1 | `56:57:E7:05:80:EB:67:89:83:F3:ED:7D:FC:E0:91:D8:4C:AE:65:49:38:9A:47:FC:CD:A8:D0:E4:DC:2C:F5:76` |
| intermediária vista | AC SERPRO SSLv1 (13 hosts) | 2032-07-01 | RSA 4096 | `08:FC:94:2D:51:76:E5:68:AC:BE:F9:C5:95:F3:6A:20:DE:6A:CF:9E:A3:0C:6F:5F:CE:DD:48:21:6E:D5:B0:70` |
| intermediária vista | AC SOLUTI SSL EV G4 (8 hosts) | 2032-07-01 | RSA 4096 | `8E:30:F7:F0:B6:78:CA:14:40:A9:4A:5B:E4:16:BE:D9:AE:5A:FF:7F:0F:2E:08:D4:BB:E2:8A:F2:C8:EB:86:60` |
| intermediária vista | AC Certisign ICP-Brasil SSL EV G4 (2 hosts) | 2032-07-01 | RSA 4096 | `1E:36:DC:C2:8B:C6:FB:DB:23:D5:DF:49:E5:5C:FB:6B:27:E2:9D:99:CC:0D:55:52:26:C2:E1:E0:7B:83:8A:23` |

Achados sobre o bundle:

- Carregar v6 e v7 como CA funciona nas três runtimes. Porém `new X509Certificate(v6).publicKey` quebra no Bun (BoringSSL não conhece Ed448), e com a v7 quebra no Node e no Bun. Essas raízes não emitem TLS nem e-CNPJ hoje, então ficam no catálogo marcadas `tls: false` e fora do conjunto de confiança.
- Somar CAs sem substituir a loja: no Node e no Bun, a opção `ca` **substitui** a loja (verificado: `ca` só com ICP falha num host Let's Encrypt), então o certo é `ca: [...tls.rootCertificates, ...icp]` por Agent. No Deno, `caCerts` **soma** à loja padrão (verificado: com só ICP em `caCerts`, o ADN com Let's Encrypt continua validando). `NODE_EXTRA_CA_CERTS` e `tls.setDefaultCACertificates` (presentes em Node, Bun e Deno) mexem no processo inteiro, e uma biblioteca não deve usá-los.

### 4. Certificado de cliente por runtime

Scripts: `mtls-server.ts` (servidor local que devolve o certificado recebido), `capture-proxy.ts` (proxy CONNECT que só repassa bytes e decodifica o handshake TLS 1.2, que trafega em claro, inclusive a mensagem Certificate do cliente), `mtls-clients.ts`, `reneg-trace.ts` (`enableTrace()` do Node, que mostra o handshake decifrado, inclusive o da renegociação) e `sigalgs-test.ts`.

| Caminho | Local (pede cert no handshake) | SVRS homologação, cert no fio (proxy) | Renegociação (BA, SP e Sefin homologação) |
|---|---|---|---|
| Node `node:https` + `https.Agent({cert,key,ca})` | apresenta | apresenta (1 cert + CertificateVerify, esquema 0x0804 RSA-PSS) | apresenta: o trace mostra `Certificate, Length=879` depois do HelloRequest, e o IIS responde 403 |
| Node `undici.fetch` + `undici.Agent({connect:{cert,key,ca}})` | apresenta | apresenta | falha com `NGHTTP2_HTTP_1_1_REQUIRED` enquanto `allowH2` não for `false`; com `allowH2: false` chega ao 403 |
| Node `fetch` global + dispatcher do pacote `undici` | apresenta | apresenta | mesma coisa: exige `allowH2: false` |
| Node `fetch` global com a opção `tls` do Bun (bug do brafis) | **não apresenta**, sem erro | **0 certificados no fio**, e a SEFAZ devolve o mesmo 403 de quem não tem certificado | n/a |
| Node `fetch` global puro | n/a (não tem como passar cert) | n/a | também falha em HTTP/2 (`NGHTTP2_HTTP_1_1_REQUIRED`): o Node 26 negocia h2 por ALPN por padrão |
| Bun `node:https` + `https.Agent` | apresenta | apresenta (0x0804) | 403 nos três hosts; no servidor local que renegocia, apresenta |
| Bun `fetch(url, {tls:{cert,key,ca}})` | apresenta | apresenta (0x0804) | 403 nos três hosts; no servidor local que renegocia, apresenta |
| Deno `fetch` + `Deno.createHttpClient({cert,key,caCerts})` | apresenta | apresenta (0x0806 RSA-PSS SHA-512) | **falha**: em h2, "endpoint requires HTTP/1.1"; com `http2:false`, TCP reset. O rustls não implementa renegociação. |
| Deno `node:https` + `https.Agent` | apresenta | apresenta | **falha** ("socket hang up"), porque o `node:tls` do Deno também é rustls |

Como a SEFAZ recusa conforme o caso: sem certificado, o PR responde alerta 42 (bad_certificate); com certificado não confiável, alerta 46 (certificate_unknown). O AM responde 46 e o MG responde 40 com certificado não confiável. O IIS responde HTTP 403 nos dois casos, e o subcódigo (403.7 ou 403.16) só aparece às vezes no corpo (RS produção mostrou 403.7). No ADN, o TLS 1.3 sem certificado aparece no cliente como "bad record mac", porque o servidor manda o alerta com a chave de handshake. Um servidor local em Node que renegocia deu falso negativo para o cliente Node, porque o `getPeerCertificate()` do servidor fica velho depois do `renegotiate()`. O trace do lado do cliente contra o IIS real é a evidência que vale.

### 5. Notas para A3

- Os autorizadores SEFAZ são só TLS 1.2, e em TLS 1.2 o PKCS#1 v1.5 continua permitido. Mesmo assim, Node, Bun e Deno **escolhem RSA-PSS por conta própria** quando o servidor anuncia PSS (SVRS: 0x0804 e 0x0806). Contra AM, PR e MG, que não anunciam PSS, escolheram 0x0601 e 0x0401.
- `sigalgs: 'RSA+SHA256:RSA+SHA384:RSA+SHA512'` com `maxVersion: 'TLSv1.2'` num `https.Agent` força 0x0401 (PKCS#1 SHA-256) **no Node e no Bun** (verificado no fio). O Deno não tem esse ajuste.
- O ADN aceita TLS 1.3, onde RSA exige PSS. Um signer que só faz PKCS#1 precisa limitar o ADN a 1.2, e o ADN aceita.
- Nenhuma das três runtimes aceita chave privada externa (callback de assinatura) no handshake TLS. Com A3, o mTLS em JS puro é inviável. É preciso o helper nativo do S4, que termina o TLS ou expõe um proxy local. Cada handshake completo custa uma assinatura no token ou no HSM remoto, e nos hosts que renegociam cada conexão nova custa dois handshakes. Por isso, keep-alive e retomada de sessão importam: 17 dos 35 hosts retomam, e falta saber se a sessão retomada preserva a autenticação do cliente.

### 6. Com certificado real (25/set/2026)

Certificado: e-CNPJ A1 da FAZER.AI LTDA (`CN=FAZER AI LTDA:59554465000137`, serial `48126C57E6D1ABA9`, emitido pela AC SAFEWEB RFB v5, válido de 12/jan/2026 a 12/jan/2027). Cadeia: folha, AC SAFEWEB RFB v5, AC Secretaria da Receita Federal do Brasil v4, **raiz v5**. O PFX é legado (RC2-40 + 3DES) e só traz a folha; a cadeia foi completada em memória com o catálogo do ITI (`icp/raw/ac`). O base64 guardado no cofre tem 1 byte a mais no fim, e o node-forge só abre com `parseAllBytes: false`.

**Controles aplicados** (código em `spikes/s2-tls/real/`):

- `guard.ts` tem uma allowlist fechada, escrita à mão, com 17 hosts: NF-e homologação (10 UFs, SVAN/SVC-AN, SVRS/SVC-RS, cadastro SVRS e AN), MDF-e homologação e NFS-e produção restrita (Sefin e ADN). Ela recusa, antes de abrir socket: qualquer outro host, `http`, porta diferente de 443, credencial na URL e corpo com `tpAmb` diferente de 2. Tem 7 testes unitários (`bun test guard.test.ts`, 256 asserções), inclusive um que tenta todas as URLs de produção do `endpoints.json`.
- Cada uso do certificado grava uma linha em `~/.local/state/sinete/cert-usage.log` (hora, runtime, host, serviço, resultado), sem segredo. Foram 50 usos no total.
- `cert.ts` lê o PFX e a senha só por `op-agentes` (spawn sem shell, `OP_AGENTES_NO_CACHE=1`) e abre o PFX com node-forge em memória. PFX, chave, PEM e senha nunca foram gravados, impressos nem passados em argv ou env. Uma varredura em `real/` e `results/` não achou material de chave.

**Status de serviço (operação 1).** Os 15 alvos responderam **cStat 107** em Node e em Bun: as 10 UFs, SVAN, SVRS, SVC-AN, SVC-RS e MDF-e (este, sem `mdfeCabecMsg` no SOAP). No Deno, os 9 compatíveis deram 107, e os 6 incompatíveis foram recusados pelo próprio transporte, sem tentativa: BA, MT, PR, SP, SVAN e SVC-AN. O trace TLS do Node (`enableTrace`, filtrado para `results/trace-node-status.txt`, sem material de chave) mostrou o seguinte:

| Alvo | Cifra | Renegociação | CertificateVerify do cliente |
|---|---|---|---|
| AM | ECDHE-AES128-GCM | não | rsa_pkcs1_sha512 (0x0601) |
| BA | ECDHE-AES256-GCM | **sim** | rsa_pkcs1_sha512 (0x0601) |
| GO | ECDHE-AES128-GCM | não | rsa_pkcs1_sha256 (0x0401) |
| MG | ECDHE-AES128-GCM | não | rsa_pkcs1_sha256 (0x0401) |
| MS | ECDHE-AES128-GCM | não | rsa_pkcs1_sha256 (0x0401) |
| MT | ECDHE-AES128-GCM | **sim** | rsa_pkcs1_sha256 (0x0401) |
| PE | ECDHE-AES256-GCM | não | **rsa_pkcs1_sha224 (0x0301)** |
| PR | ECDHE-AES128-SHA256 (CBC) | não | rsa_pkcs1_sha512 (0x0601) |
| RS, SVRS, SVC-RS, MDF-e | ECDHE-AES256-GCM | não | rsa_pss_rsae_sha256 (0x0804) |
| SP | ECDHE-AES256-GCM | **sim** | rsa_pss_rsae_sha256 (0x0804) |
| SVAN, SVC-AN | ECDHE-AES256-GCM | **sim** | rsa_pkcs1_sha512 (0x0601) |

- A renegociação com certificado de verdade funciona no Node e no Bun: BA, MT, SP e SVAN responderam 107 nas duas runtimes. Com isso fica fechada a dúvida sobre o Bun, que antes só tinha sido provado no servidor local. O item 2 das pendências está resolvido.
- O cliente manda folha + 2 intermediárias (5.400 bytes de certificate_list). Não foi testado se os servidores aceitariam só a folha, que é o que o PFX traz (respondido na seção 8: aceitam).
- O esquema de assinatura do handshake varia por servidor. O PE fica em SHA-224 porque o OpenSSL escolhe o primeiro da lista do servidor. Isso importa para o A3: o `sigalgs` fixo em PKCS#1 SHA-256 (item 5 da evidência) é o que torna o comportamento previsível.
- A preocupação com a raiz v12 não se aplica a este certificado, que está sob a v5, e todos os servidores listam a v5. O teste com um e-CNPJ sob a v12 segue pendente.

**Consultas (operações 2 e 3).**
- ConsultaCadastro do próprio CNPJ, em SP e no RS (via SVRS): as duas deram **cStat 257** ("Solicitante não habilitado para emissão da NF-e"). É o esperado para quem não tem IE; o serviço autentica e aplica a regra antes de consultar.
- Distribuição DF-e no AN, `distNSU` 0: **cStat 137** ("Nenhum documento localizado"), `ultNSU` = `maxNSU` = 0. O AN de homologação renegocia, e o Node passou.

**Autorização de NF-e em SP homologação (operação 4), uma tentativa.** A NF-e foi montada com o codec do S1 (PL_010f): CRT 1, porque a empresa é do Simples Nacional; emitente sem IE, que é opcional no XSD; destinatário com o próprio CNPJ e `xNome` "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"; um item de R$ 1,00 com CSOSN 102; sem grupo IBS/CBS, que é opcional para o CRT 1. A assinatura saiu do signer do S3 (RSA-SHA1, C14N 1.0, splice na string). Antes do envio passou por três checagens: o validador do S1, o verificador do S3 e o `xmllint` contra o `nfe_v4.00.xsd` oficial. Resultado:

- chave `35260959554465000137550010000000011136373150`;
- lote com **cStat 104** ("Lote processado");
- protocolo com **cStat 166**, "Rejeição: UF de autorização não permitida para contribuinte exclusivo do IBS/CBS", em `dhRecbto` 2026-09-25T20:43:11-03:00.

Por que isso prova que TLS, schema e assinatura foram aceitos: pela ordem de validação do MOC, a SEFAZ confere primeiro o certificado de transmissão (TLS), depois a mensagem (tamanho, SOAP, versão), depois o schema XML (rejeição 225 no nível do lote), depois o certificado da assinatura (rejeições 290 a 296) e a própria assinatura (297 "assinatura difere do calculado", 298 "assinatura difere do padrão"), e só então as regras de negócio. Aqui o lote foi processado (104), o que já exclui 225 e as falhas de mensagem, e o protocolo trouxe uma rejeição de regra de negócio sobre o cadastro do emitente. Portanto TLS, XSD, certificado de assinatura e assinatura passaram. A 166 também diz algo de negócio: sem IE, a SEFAZ-SP trata a empresa como contribuinte exclusivo do IBS/CBS e não aceita autorizar por SP. Não tentamos contornar, conforme combinado.

**NFS-e Nacional, produção restrita (operação 5).**
- O caminho do manual de contribuintes v1.0 na Sefin (`/API/SefinNacional/parametros_municipais/3550308/convenio`) deu **404**. O caminho vigente está no ADN: `https://adn.producaorestrita.nfse.gov.br/parametrizacao/3550308/convenio`. Achei esse caminho no cliente do SDK nfse-php, depois de 4 GETs sem sucesso na documentação Redoc do ADN.
- O convênio de São Paulo (3550308) respondeu `aderenteAmbienteNacional: 1`, `aderenteEmissorNacional: 1`, `situacaoEmissaoPadraoContribuintesRFB: 1`, `aderenteMAN: 0`. O ADN negociou TLS 1.3 com ChaCha20 e aceitou o certificado.
- Por isso foi feita **uma** emissão de DPS (esquemas v1.01 de 09/fev/2026): prestador = emitente, Simples ME/EPP, sem tomador, cTribNac 010101, R$ 1,00. Assinatura do S3 (RSA-SHA1), `POST /nfse` com `dpsXmlGZipB64`. Resultado: **HTTP 400, E1229 "Xml não está utilizando codificação UTF-8."** O XML foi enviado sem a declaração `<?xml version="1.0" encoding="UTF-8"?>`, e a Sefin exige essa declaração. Essa checagem vem antes do schema e da assinatura, então a tentativa **não prova** a aceitação do DPS. A correção é trivial e não mexe na assinatura, porque a declaração fica fora do elemento assinado. Não reenviei porque o combinado era uma tentativa.
- Achado de schema: o XSD oficial v1.01 declara `TSSerieDPS` com pattern `^0{0,4}\d{1,5}$`. Em regex de XSD, `^` e `$` são literais, então nenhuma série passa num validador conforme (libxml2). A validação local usou uma cópia com só essa âncora removida (`real/nfse-xsd/patched`). Isso afeta o S1 e o S5 quando os XSD da NFS-e entrarem no codegen.

**Rodada 2 (25/set/2026, mesmos controles).**

- **DPS corrigida.** Enviei a mesma DPS, com a mesma assinatura, acrescentando só a declaração `<?xml version="1.0" encoding="UTF-8"?>`. A Sefin respondeu HTTP 400 com **E0312**: "O código de tributação nacional informado não está administrado pelo município de incidência do ISSQN na data de competência informada na DPS". No Anexo I v1.01 (aba "RN DPS_NFS-e"), as regras de assinatura E0714 a E0718 (assinatura inválida, certificado inválido, fora do padrão, ausente, de outro emitente) são de **nível 1**, consistência do leiaute. A E0312 é de **nível 3**, regra específica do município parametrizado. Uma rejeição de nível 3 indica que schema e assinatura passaram. A ordem sequencial dos níveis é leitura da planilha: o Anexo não a declara textualmente. Ainda não temos número de NFS-e. Não usei a tentativa extra, porque ela só valia para erro de formatação antes da assinatura. A E0312 depende de parametrização municipal: São Paulo, em produção restrita, não administra o cTribNac 010101.
- **NT 2026.007, lida na fonte primária** (portal nacional, v1.00 de jul/2026; homologação desde 01/09/2026, produção em 03/11/2026):
  - O contribuinte exclusivo do IBS/CBS é identificado pela **ausência de `emit/IE`**, com CNPJ ativo e sem IE de ICMS habilitada no CCC. Não existe indicador novo no leiaute.
  - A autorização é **só na SVRS** (regra C17-11, rejeição 166 em qualquer outra autorizadora). A `cUF` e a chave continuam com a UF do emitente; a SVRS dispensa as rejeições 226, 247 e 249 por divergência de UF (exceções em B02-10, C12-10 e P12-40).
  - O `emit/CNPJ` é obrigatório (157), a IEST é proibida (158), o grupo ICMS e o ICMSUFDest são proibidos (161), e o grupo IBSCBS é obrigatório (162).
  - O CFOP precisa ter `indExcIBSCBS=1` na tabela do IT 2023.002 v2.10 (159). São 72 CFOPs; na saída interna, 5551 a 5557, 5908 a 5916 e 5921. Até 03/11/2026 essa regra só informa.
  - O CRT tem de bater com o regime na LCC-RFB (180): empresa do Simples usa CRT 1.
  - Os eventos do próprio emitente também vão para a SVRS (188).
- **Autorização na SVRS homologação.** O host `nfe-homologacao.svrs.rs.gov.br` já estava na allowlist. A nota saiu sem IE, sem ICMS, com CFOP 5551 (venda de ativo imobilizado), CRT 1 e grupo IBSCBS (CST 000, cClassTrib 000001, CBS 0,9%, IBS UF 0,1%, IBS Mun 0%, com IBSCBSTot), e passou no S1, no S3 e no XSD. O lote voltou com **cStat 410**, "UF informada no campo cUF não é atendida pelo Web Service". Uma consulta de status com cUF 35 na mesma SVRS também devolveu 410. A SVRS de homologação não atende a UF SP em nenhum serviço, então ela ainda não implementou o roteamento da NT para emitentes de outras UFs. Isso não é erro de schema nem de posição de campo, e mudar a cUF para 43 falsearia a UF do emitente. Parei com 1 das 2 tentativas; **não há cStat 100**. Uma NF-e de teste sem terceiro com IE depende de a SVRS habilitar isso em homologação, o que dá para acompanhar pelo status com cUF 35.
- Usos do certificado nesta rodada: 1 DPS, 1 autorização na SVRS e 1 status de diagnóstico.

**Rodada 3 (25/set/2026, descoberta read-only; DPS não enviada).**

- O código de serviço na parametrização do ADN tem 9 dígitos **com pontos**: `/parametrizacao/3550308/01.01.01.000/historicoaliquotas`. Sem pontos (`010101` ou `010101000`), o ADN responde 400 com "O código do serviço deve ser composto por nove dígitos". A alíquota de uma competência fica em `/parametrizacao/3550308/{codigo}/{AAAA-MM-DD}/aliquota`.
- Em São Paulo, na produção restrita, todos os códigos de software consultados têm vigência **encerrada**. 01.01.01 teve 5% de 17/03 a 31/08/2025 e 2,90% só em 01/09/2025. 01.02, 01.04, 01.05, 01.06 e 01.08 tiveram 2,90% só em 17/03/2025. 01.03 teve 2,90% de 17 a 31/03/2025 e em 22/10/2025. 01.07 não tem histórico. Para a competência 25/09/2026, a alíquota de 01.01.01 e de 01.03.01 volta 404 ("Alíquotas não encontradas").
- Códigos fora de software também não ajudam: 17.01.01 teve vigência só em 17/03/2025, e 17.02.01, 07.02.01, 14.01.01, 04.01.01 e 08.02.01 não têm histórico.
- Não há código de software administrado por São Paulo na competência atual da produção restrita. Por isso não enviei a DPS: ela repetiria a E0312. A única alternativa seria uma competência retroativa dentro de uma dessas janelas de um dia, o que não estava autorizado. Foram 21 GETs de descoberta, todos no ledger.

**Rodada 4 (28/set/2026): primeira NFS-e gerada pelo sinete e cancelada.**

- A DPS montada e assinada pelo `@sinete/nfse` gerou NFS-e na Sefin de produção restrita (`POST /nfse`), e o cancelamento (e101101) foi registrado; o sinete devolve 100 "Evento registrado" por convenção (`situacoes.json`). `GET /nfse/{chave}` e `GET /dps/{id}` responderam no formato que o cliente já lia. Chave, CNPJ e XML da nota ficam fora do repositório.
- **Consulta de eventos.** O caminho do Swagger com partes opcionais não vale na Sefin real: `GET /nfse/{chave}/eventos` respondeu **405**, `GET /nfse/{chave}/eventos/101101` respondeu **404 com a página HTML do IIS**, e só `GET /nfse/{chave}/eventos/101101/1` respondeu **200**, com `{"dataHoraProcessamento","tipoAmbiente":2,"versaoAplicativo":"SefinNacional_1.6.0","eventos":[{"chaveAcesso","tipoEvento":"101101","numeroPedidoRegistroEvento":"1","dataHoraRecebimento":"AAAA-MM-DDTHH:MM:SS.mmm","arquivoXml"}]}`. O `arquivoXml` tem uma camada a mais que os outros documentos: é o base64 do texto do gzip em base64 (começa com `SDRzSUFBQUFB`, que decodifica para `H4sIAAAA`).
- Consequência no código: o cliente lia só os campos `...XmlGZipB64` e mandava o emissor consultar sem a sequência. Contra a Sefin real, a consulta devolvia lista vazia e o emissor não enxergava o cancelamento registrado. `consultarEventos` passou a exigir o tipo e a sequência (o e101101 é sempre a sequência 1), decodifica o `arquivoXml` nas duas camadas e trata o 404 do caminho completo, com qualquer corpo, como evento não registrado. O simulador segue o mesmo contrato.
- O DANFSe do ADN (`GET {danfse}/{chave}`) respondeu 404 para a NFS-e gerada. A causa é a suspensão da API de geração em 03/08/2026 (NT SE/CGNFS-e 008/2026 v1.02, 1): o DANFSe v2 passou a ser gerado localmente (ADR 0006, decisão 16), e o `obterDanfse` saiu do `@sinete/nfse`.

### 7. Laboratório TLS local do M0 (25/set/2026)

O `@sinete/transport` ganhou um laboratório em `packages/transport/test/tls-lab.test.ts`, que roda no CI sem falar com a SEFAZ: `openssl s_server` local com uma PKI descartável gerada a cada execução, e o mesmo cliente em Bun (em processo), Node e Deno (subprocessos). O servidor que imita o IIS não pede certificado no handshake inicial; depois de ler a requisição HTTP, renegocia pedindo o certificado, sem retomar a sessão (`-no_resumption_on_reneg -no_ticket`), e o log `-msg` mostra se o cliente mandou Certificate e CertificateVerify. Um servidor em Node com `socket.renegotiate()` não serviu de imitação: contra o cliente Node, o próprio servidor abortou com `no renegotiation`, enquanto o Bun passou. O `s_server` sem retomada reproduz o IIS de forma estável e deixa a prova no log, o que também tira a dúvida do falso negativo da seção 4.

| Cenário | Node 26 (OpenSSL) | Bun 1.4.2 (BoringSSL) | Deno 2.9 (rustls) |
|---|---|---|---|
| certificado pedido no handshake | apresenta | apresenta | apresenta |
| renegociação iniciada pelo servidor | apresenta (Certificate + CertificateVerify, `verify return:1`) | apresenta | responde `no_renegotiation` e o servidor aborta |
| só CBC (`ECDHE-RSA-AES128-SHA256`) | ok | ok | `handshake_failure` |
| só DHE (`DHE-RSA-AES128-GCM-SHA256`) | ok | **`handshake_failure`: o BoringSSL do Bun não tem nenhuma suíte DHE** | `handshake_failure` |
| PFX legado lido em JS e passado como PEM | apresenta | apresenta | apresenta |

Consequências para a decisão 4: `tls12CbcAndDhe` virou duas capacidades, `tls12Cbc` e `tls12Dhe`, e o transporte de Node e Bun também recusa antes do socket quando o perfil do host exige o que a runtime não faz. Hoje isso tira do Bun só o GO produção (DHE puro), além do que já saía do Deno. A pendência "validar GO produção e PR com o Bun" fica resolvida no laboratório: PR (CBC) funciona, GO produção não. No TLS 1.3, um servidor que exige certificado faz o Bun só fechar o socket, sem o alerta 116; o transporte vê `conexao_recusada`.

### 8. Com os pacotes publicados (26/set/2026)

Fechamento do M1, com o mesmo certificado da seção 6 e controles equivalentes, mas pelos pacotes na forma publicada (`dist`): `openPfx` e `buildChain` do `@sinete/cert`, `createTransport` com `allowlistPolicy` (15 hosts de NF-e e MDF-e de homologação, `tpAmb` 2) do `@sinete/transport`, `createNfeClient`, `buildNfe` e `signNfe` do `@sinete/nfe` e o `main` do `@sinete/cli`. Runner em `tools/homologacao/`; resultado completo em [validacao-homologacao.md](../validacao-homologacao.md).

- `statusServico`: cStat 107 nos 12 autorizadores e nos dois SVC em Node e em Bun; no Deno, 107 nos 8 compatíveis e `nao_suportado` antes do socket em BA, MT, PR, SP, SVAN e SVC-AN.
- `consultarCadastro` SP do próprio CNPJ: 257. `distribuicaoDFe` no AN com `distNSU` 0: 137.
- Uma autorização em SP (NF-e montada e assinada pelo `@sinete/nfe`, conferida contra o XSD oficial): lote 104 e protocolo 166, o mesmo desfecho do spike. TLS, schema, certificado da assinatura e assinatura passaram.
- `sinete doctor --uf RS` com o PFX em memória: handshake ok, certificado de cliente carregado, saída sem material de chave.
- **Só a folha.** O bundle ICP-Brasil do `@sinete/cert` não traz as intermediárias da AC SAFEWEB, então o `pemIdentity` mandou só o certificado do titular, e todos os hosts aceitaram, inclusive os que renegociam. Isso responde a pendência 10 para NF-e de homologação e este emissor.
- SVC-AN e SVC-RS saíram na conexão keep-alive já aberta com SVAN e SVRS, e a checagem do certificado local no socket reaproveitado passou (parte da pendência 4).

### 9. Emitente do DF com IE e transmissor terceiro (26/set/2026)

Rodada 2 do fechamento do M1, com um e-CPF A1 de produtor rural do DF com IE (AC SAFEWEB RFB v5) e a guarda `homologacaoDfPolicy` (SVRS, SVC-AN e AN de homologação; só os serviços e os eventos da rodada; `tpAmb` 2 obrigatório). Resultado completo em [validacao-homologacao.md](../validacao-homologacao.md#rodada-2-emitente-do-df-com-ie-26set2026).

- Status com cUF 53: 107 na SVRS e no SVC-AN. Seis autorizações na SVRS, todas com **cStat 100** (CST 00, 40, 30, 70 e 20 e uma transmitida por terceiro); CC-e seq 1 e 2 e cancelamento com 135; consulta protocolo com 100 e 101. É a primeira NF-e autorizada pelos pacotes.
- **Transmissor terceiro.** A nota assinada pelo e-CPF do emitente e enviada com o e-CNPJ de outra pessoa no TLS foi autorizada, e a consulta pelo mesmo transmissor respondeu. A SVRS não amarra o certificado do TLS ao emitente; o `Transport` com identidade separada do `Signer` cobre o caso de um escritório ou plataforma que transmite pelos clientes.
- **Só a folha** de novo bastou, agora com um e-CPF, na SVRS, no SVC-AN e no AN.
- Distribuição DF-e no AN com o TLS do e-CPF: 137 com `distNSU` 0; a repetição cerca de 20 minutos depois deu 656 (consumo indevido). O transporte e a autenticação passaram nas duas.

## Decisão proposta

1. **Endpoints como dados em `@sinete/transport`**, gerados das páginas oficiais por script, com `source`, `retrievedAt` e mapa UF para autorizador **por ambiente**. Cada host ganha um perfil TLS medido, que alimenta a checagem de capacidade da runtime: `clientCert: "handshake" | "renegotiation"`, `ecdheAead: boolean`, `maxTls`, `serverRoot: "icp-v10" | "public"`. Um job periódico refaz a sondagem (a mesma do spike, leve) e abre PR quando algo muda.
2. **Bundle ICP-Brasil como dado em `@sinete/cert`**, versionado pela data do `ACcompactado.zip` (por exemplo `2026.09.25`), com o SHA-512 do zip e o SHA-256 de cada certificado. No conjunto de confiança TLS entram as raízes v5, v10, v11 e v12. As intermediárias SSL vistas (SERPRO SSLv1, SOLUTI SSL EV G4, Certisign SSL EV G4) entram como extra, para o caso de um servidor deixar de mandá-las. v6 e v7 ficam só no catálogo. O catálogo completo (180 ACs) fica disponível para validar a cadeia do certificado do emitente e para a verificação de XMLDSig. Atualizar o bundle é uma release minor de `@sinete/cert`, disparada por um job que compara o `hashsha512.txt`.
3. **Confiança sem mexer no processo.** Node e Bun: `ca: [...tls.rootCertificates, ...icpTls]` por Agent, com opção `trust: "bundled" | "system"`, onde "system" usa `tls.getCACertificates("system")` para quem tem proxy corporativo. Deno: `caCerts: icpTls`, que já soma. Proibido `NODE_EXTRA_CA_CERTS`, `setDefaultCACertificates` e `rejectUnauthorized: false`. Sem pinning, porque os hosts trocam de CA (Sectigo, GlobalSign e Let's Encrypt convivem com ICP). Sem checagem online de revogação no caminho quente; o `sinete doctor` consulta OCSP sob demanda.
4. **`Transport` com identidade plugável e detecção de runtime:**

   ```ts
   type TlsIdentity =
     | { kind: "pem"; certChain: string; key: string }   // @sinete/cert converte PFX legado (RC2/3DES) em JS
     | { kind: "external"; helper: ExternalTlsHelper };  // A3, S4
   interface TransportCapabilities {
     runtime: "node" | "bun" | "deno" | "custom";
     renegotiation: boolean;        // node/bun: true; deno: false
     tls12CbcAndDhe: boolean;       // node/bun: true; deno: false
     sigalgsControl: boolean;       // node/bun: true; deno: false
   }
   interface Transport {
     readonly capabilities: TransportCapabilities;
     send(req: { endpoint: EndpointRef; url: string; method: "POST" | "GET"; headers: Record<string, string>; body: Uint8Array | string; signal?: AbortSignal }): Promise<{ status: number; headers: Headers; body: Uint8Array; tls: { protocol: string; cipher: string; resumed: boolean } }>;
     close(): Promise<void>;
   }
   ```

   - **Node e Bun: uma implementação só, sobre `node:https` + `https.Agent`** (HTTP/1.1, keep-alive, `ca` somado, `minVersion: "TLSv1.2"`, `sigalgs` quando a identidade pedir). Ela passou nas três situações nas duas runtimes e dispensa dependência. Nada de `fetch` no Node: o global não tem como levar certificado sem o pacote `undici`, e com ele o h2 padrão quebra os hosts que renegociam. O `fetch` do Bun com `tls` funciona, mas não se justifica ter um segundo caminho.
   - **Falha barulhenta.** Antes do primeiro envio, o Transport confere se a identidade entrou no contexto: `tlsSocket.getCertificate()` não pode ser nulo depois do `secureConnect`. Se a runtime não for reconhecida, lança erro em vez de cair num `fetch` genérico. As opções vão num objeto tipado e fechado, então não existe caminho para uma opção de outra runtime ser ignorada em silêncio, como no bug do brafis.
   - **Deno: implementação própria com `Deno.createHttpClient({cert, key, caCerts, http2: false})`**, e recusa explícita (`TransportUnsupportedError`, com host, motivo e alternativa) quando o perfil do endpoint pede renegociação ou só tem CBC/DHE. Isso tira do Deno SP, BA, PR, GO produção, SVAN (MA), SVC-AN, o AN inteiro (Distribuição DF-e, manifestação e eventos) e a Sefin da NFS-e. Continuam viáveis AM, MG, MS, MT produção, PE, RS, SVRS (16 UFs), SVC-RS, MDF-e e ADN.
   - **Erros tipados a partir do que foi observado.** Alertas 40 e 42 e o 116 do TLS 1.3 sem certificado viram `certificado_nao_apresentado`. Os alertas 46 e 48 com certificado viram `certificado_recusado`. O "bad record mac" do TLS 1.3 no ADN e o HTTP 403 do IIS viram `certificado_ausente_ou_recusado`. TCP reset após a requisição (MS e MT homologação) vira `conexao_recusada`, com dica de certificado. `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` e `UnknownIssuer` viram `cadeia_servidor_nao_confiavel`, com dica do bundle ICP.
5. **Princípio 5 do plano, ajustado.** O core (XML, schemas, validação, assinatura A1, DANFE) roda nas três runtimes. A transmissão com mTLS é de primeira classe em Node e Bun. No Deno, ela é parcial e declarada por endpoint; quem precisar dos hosts bloqueados injeta um `Transport` próprio. Isso é limitação do rustls (sem renegociação, sem CBC, sem DHE), não escolha do sinete, e nenhuma opção do Deno contorna. **Aceito em 25/set/2026:** o core roda nas três runtimes; o transporte do Deno recusa explicitamente os hosts sabidamente incompatíveis; o usuário pode injetar o próprio `Transport`.

## Consequências

- O sinete precisa de dados TLS por host, além da URL. A sondagem vira ferramenta do repo (`sinete doctor --endpoints`) e não pode continuar só no spike.
- O caminho único `node:https` simplifica o código e os testes, mas amarra o sinete à compatibilidade `node:https` do Bun. Isso passou aqui; o CI testa em Bun a cada release.
- Deno fica como runtime de segunda classe para transmissão. A documentação precisa dizer isso com a lista de hosts, e o erro precisa ser explícito.
- A3 depende do S4 e não entra no `Transport` JS puro. A interface já nasce com `kind: "external"`.
- O bundle ICP é dado com dono: raiz nova (v13, v14) ou intermediária SSL nova exige release. O job de hash reduz o atraso.

## Pendências

- **O que falta testar com certificado real** (a rodada de 25/set resolveu status, renegociação e PFX legado; ver seção 6):
  1. Feito: status 107 em todos os autorizadores de homologação e no MDF-e, em Node e Bun, e no Deno onde ele é compatível.
  2. Feito: nos hosts que renegociam (BA, MT, SP, SVAN, SVC-AN e AN), o Node e o Bun apresentam o certificado na renegociação e são aceitos.
  3. Certificados sob a raiz **v12** em SVRS, RS e MDF-e de **produção**, que não listam v12 como CA aceita. O certificado testado é v5, então isso continua aberto; é crítico para o integrador em produção, onde é preciso conferir de qual raiz vem o certificado de cada emitente.
  4. Se a retomada de sessão preserva a autenticação do cliente, e como o keep-alive se comporta nos hosts que renegociam.
  5. O TCP reset de MS e MT homologação sem certificado sumiu com o certificado válido (107 nos dois). Era recusa por falta de certificado.
  6. Feito em parte: o ADN em TLS 1.3 aceitou o certificado real (GET do convênio). Falta o ADN limitado a TLS 1.2 com PKCS#1.
  7. Feito: PFX legado RC2-40 + 3DES lido em JS (node-forge) e passado como PEM ao `https.Agent` no Node e no Bun, e ao `createHttpClient` no Deno.
  8. Feito no laboratório TLS (06/10/2026, Bun, Node e Deno): o alerta 45 vira `certificado_expirado` e o 44 vira `certificado_revogado`. Falta ver os dois alertas vindos de uma SEFAZ real.
  9. Feito (rodada 4): NFS-e gerada e cancelada na produção restrita, com a consulta de eventos corrigida pelo que a Sefin respondeu. O 404 do DANFSe do ADN é a suspensão da API (NT 008/2026).
  10. Feito em parte (seção 8): os autorizadores de NF-e de homologação aceitam só a folha deste emissor (AC SAFEWEB RFB v5). Falta produção e um emissor de outra AC antes de decidir se o `@sinete/cert` completa a cadeia sempre ou só quando necessário.
  11. Contribuinte exclusivo do IBS/CBS: a NT 2026.007 manda autorizar na SVRS, mas a SVRS de homologação responde 410 para cUF 35 (autorização e status). Refazer só quando o status com cUF 35 der 107.
- Feito no laboratório TLS (seção 7): o Bun fala CBC (PR), mas não tem DHE, então GO produção fica fora do Bun enquanto o host só oferecer DHE.
- Endpoints de produção da NFS-e (Sefin e ADN de produção) só foram sondados no TLS, sem requisição HTTP autenticada.
- NFS-e no M6: o `@sinete/nfse` confere o `tpAmb` da DPS e do pedido de evento antes do envio, porque a `HostPolicy` só enxerga o corpo em texto e o da NFS-e é JSON com o XML em gzip e base64. Na produção restrita já foram vistos `POST /nfse`, as consultas por chave e por Id da DPS, o registro e a consulta de eventos (rodada 4) e a parametrização (convênio, alíquota, histórico); o DANFSe respondeu 404 e a substituição e a análise fiscal não foram sondadas.
- Rodar `probe-openssl.ts` de novo de uma máquina Linux na nuvem, para descartar diferenças de rede ou de ISP.
- Os scripts do spike ficam em `spikes/s2-tls/` (dados brutos em `raw/`, `out/` e `icp/`). O certificado descartável fica em `out/throwaway/`, ignorado pelo git.
