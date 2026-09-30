# @sinete/transport

Transporte mTLS dos DF-e: `Transporte` com identidade TLS plugável, endpoints e perfis TLS por host como dados, SOAP 1.2, política de hosts e erros tipados a partir do que a SEFAZ faz de fato. Node e Bun sobre `node:https`; Deno sobre `Deno.createHttpClient`, com recusa explícita dos hosts que o rustls não alcança.

Status: pré-alfa, API instável até a 1.0.

```ts
import { relogioDoSistema } from '@sinete/core';
import { abrirPfx } from '@sinete/cert';
import { politicaDeHostsPermitidos, hostsDoAmbiente, criarTransporte, nfeEndpoint, identidadePem, contentTypeSoap12, envelopeSoap12 } from '@sinete/transport';

const ks = await abrirPfx(pfx, { senha: password, relogio: relogioDoSistema });
const transport = criarTransporte({
  identidade: identidadePem(ks),
  // só homologação: hosts dos dados + tpAmb 2 no corpo, conferidos antes de abrir socket
  politica: politicaDeHostsPermitidos({ hosts: hostsDoAmbiente('homologacao'), tpAmb: '2' }),
});
const endpoint = nfeEndpoint({ ambiente: 'homologacao', uf: 'SP', servico: 'NfeStatusServico' });
const res = await transport.enviar({
  url: endpoint.url,
  endpoint,
  cabecalhos: { 'content-type': contentTypeSoap12(`http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF`) },
  corpo: envelopeSoap12(dadosMsg),
});
await transport.fechar();
```

## Decisões que valem aqui

- ADR 0004: Node e Bun sobre `node:https` + `https.Agent` (HTTP/1.1, keep-alive, renegociação iniciada pelo servidor permitida, `sigalgs` opcional); Deno com `Deno.createHttpClient({ http2: false })` e `ErroTransporteNaoSuportado` nos hosts cujo perfil exige renegociação, só CBC ou só DHE. Confiança somada por conexão (`ca` = raízes da runtime + ICP-Brasil do `@sinete/cert`); proibidos `NODE_EXTRA_CA_CERTS`, `setDefaultCACertificates` e `rejectUnauthorized: false`.
- ADR 0005 e ADR 0014: `IdentidadeTls` com `pem` (em processo) e `helper` (identidade aberta no helper nativo `sinete-signer`, pelo subpath `@sinete/transport/signer`).
- Referência: `spikes/s2-tls/`.

## Entradas e runtimes

| Condição | Arquivo | `criarTransporte` |
|---|---|---|
| `node` (Node, Bun, Deno via `npm:`) | `index.node` | Node e Bun: `node:https`; Deno: `Deno.createHttpClient` |
| `default` (browser, bundlers) | `index` | só Deno; em outra runtime lança `ErroNaoSuportado` em vez de cair num `fetch` que ignoraria o certificado |

`capacidades` diz o que cada implementação faz. O laboratório TLS (`test/tls-lab.test.ts`) mediu:

| Runtime | Renegociação | Só CBC | Só DHE |
|---|---|---|---|
| Node (OpenSSL) | sim | sim | sim |
| Bun (BoringSSL) | sim | sim | **não** (o BoringSSL não tem suíte DHE; GO produção fica fora do Bun) |
| Deno (rustls) | não | não | não |

Antes de abrir socket, o transporte cruza o perfil TLS do host com as capacidades e recusa com `ErroTransporteNaoSuportado` (`code: 'nao_suportado'`, `detalhes: { host, motivos, alternativa }`).

## Dados

- `src/data/endpoints.json`: NF-e 4.00 (15 autorizadores, mapa UF para autorizador e contingência **por ambiente**), NFC-e 4.00 (AM, GO, MG, MS, MT, PR, RS, SP e SVRS, da relação da SVRS e da página da SEF/MG; a UF sem autorizador próprio autoriza na SVRS), MDF-e 3.00 (SVRS) e bases REST da NFS-e Nacional (produção e produção restrita), com a URL de origem e a data de coleta. Gerado por `tools/transport-data/build.ts endpoints`. URLs do QR Code e da consulta da NFC-e só onde a tabela oficial de web services as publica (hoje MG, `urlsConsultaNfce`).
- `src/data/tls-profiles.json`: perfil medido de cada um dos 35 hosts (versões, cifra, `certificadoDoCliente: 'handshake' | 'renegociacao'`, `ecdheAead`, `trocaDeChaves`, raiz do servidor, OCSP stapling, retomada). Gerado por `tools/transport-data/build.ts perfis` a partir da sondagem do ADR 0004.
- `nfeEndpoint`, `nfceEndpoint`, `nfceAutorizadorDaUf`, `urlsConsultaNfce`, `mdfeEndpoint`, `nfseEndpoint`, `todosOsEndpoints`, `hostsDoAmbiente`, `perfilTlsDoHost`. A sondagem TLS não cobriu os hosts só de NFC-e: eles vêm sem perfil (`tls: undefined`), e o transporte não os recusa por capacidade antes do socket.

## Garantias do envio

- Travas fixas antes da política: só `https`, sem credencial na URL.
- Redirecionamento nunca é seguido (o `node:https` não segue; no Deno, `redirect: 'manual'`): a política só vale para a URL conferida, e um 307/308 reenviaria o documento. O 3xx volta como resposta.
- `timeoutMs` é prazo total da requisição, não inatividade do socket.
- `PoliticaDeHosts` roda antes de qualquer socket. `politicaDeHostsPermitidos({ hosts, portas?, tpAmb?, exigirTpAmbNoCorpo? })` generaliza a guarda do spike; `todasAsPoliticas` combina.
- Node e Bun conferem, depois do handshake (inclusive no socket reaproveitado do pool), que o certificado local do socket é o da identidade (`certificado_nao_carregado` se não for). `tls.certificadoLocalCarregado` sai na resposta.
- `auditoria` recebe um evento por envio (host, caminho, método, status ou código de erro, duração), sem corpo nem segredo.

## Erros

`ErroTransporte` com `code`: `certificado_nao_apresentado` (alertas 40, 42, 116), `certificado_recusado` (43 a 46, 48, 49), `certificado_ausente_ou_recusado` (HTTP 403 do IIS, "bad record mac" do ADN), `certificado_nao_carregado`, `conexao_recusada`, `cadeia_servidor_nao_confiavel`, `nome_servidor_divergente`, `falha_tls`, `falha_rede`, `politica_recusou` (`ErroPolitica`), `cancelado`. Mais `ErroDeTempoEsgotado`, `ErroDeConfiguracao` e `ErroTransporteNaoSuportado` do core. O alerta 40 é ambíguo (a SEFAZ o manda por falta de certificado, mas ele também sai sem cifra em comum); a mensagem diz isso e `detalhes.alerta` traz o alerta.

## Chave fora do processo: `@sinete/transport/signer`

Cliente do helper nativo `sinete-signer` (ADR 0005), para A3 em token PKCS#11, A3 em nuvem de PSC, OpenBao Transit e `CryptoKey` não exportável. Contrato em `docs/signer-contract/`; o helper em `helpers/signer-tls/`.

```ts
import { criarTransporte } from '@sinete/transport';
import { certificadoAberto, iniciarSigner } from '@sinete/transport/signer';

const signer = await iniciarSigner({ binario: '/opt/sinete/sinete-signer-p11', pkcs11: true, ambientes: ['homologacao'] });
const a3 = await signer.abrirPkcs11({ modulo: '/usr/lib/libaetpkss.so', token: 'MEU TOKEN', rotulo: 'certificado', pin: async () => '0000' });
const transport = criarTransporte({ identidade: a3.identidadeTls });
const certificado = certificadoAberto(a3); // para o @sinete/emissor: signer (dfe.sign), titular e identidade
```

- Entrada `default` (pura): `conectarCanalSigner` sobre qualquer canal de linhas, `assinadorTlsDeCryptoKey` (modo `message`), `assinadorTlsDeDigest` (modo `digest`, sobre um `AssinadorDeDigest` do core), `certificadoAberto`, `lerTranscricaoTls`. Entrada `node`: `iniciarSigner` (processo filho com ambiente mínimo) e `conectarSigner` (socket Unix).
- `abrirRemoto({ assinador, hostsPermitidos })`: a chave fica com quem chamou. O cliente aplica a política do dono da chave antes de chamar o `AssinadorTls`: host em `hostsPermitidos`, propósito, esquema PKCS#1 SHA-256 e, no modo `message`, SNI e certificado do servidor dentro do transcript.
- `abrirPkcs11({ modulo, token, rotulo | idDaChave, pin })`: token pelo helper `-p11`; `assinadorDeDocumentos` assina XML pelo `dfe.sign`, que o helper valida (perfil XMLDSig dos DF-e e `Id` de documento do titular).
- `DescricaoTls.assinaturas` diz quantas assinaturas de handshake a requisição custou; `estatisticas()` dá o total por identidade.
- Falhas de rede e TLS do helper viram os mesmos `ErroTransporte` (`classificarFalhaDoHelper`); as próprias do helper viram `ErroSigner`: `signer_indisponivel`, `signer_protocolo`, `assinatura_tls_recusada`, `assinatura_tls_expirou`, `pkcs11_falhou`, `assinatura_documento_recusada`.

## SOAP 1.2

`envelopeSoap12(body, { header? })` insere o corpo como texto (o XML assinado nunca é reparseado) e recusa corpo com declaração XML; `contentTypeSoap12(action)`, `lerBodySoap(resposta)` (fatia da string) e `lerSoapFault`.

## Testes

Nenhum teste fala com a SEFAZ. O helper `sinete-signer` é compilado na hora e testado contra o contrato (`signer-contract.test.ts`), o laboratório TLS e um token SoftHSM (`signer-lab.test.ts`, pulado sem Go ou sem SoftHSM) e os pacotes npm montados (`signer-npm.test.ts`). O laboratório sobe servidores locais com `openssl s_server` (renegociação iniciada pelo servidor como no IIS, só CBC, só DHE, certificado exigido, AC recusada, cadeia não confiável, nome errado) e roda o mesmo cliente em Bun (em processo), Node e Deno (subprocessos). A PKI é gerada na hora e apagada no fim.
