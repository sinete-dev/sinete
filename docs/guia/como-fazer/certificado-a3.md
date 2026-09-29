# Como usar certificado A3 e chave fora do processo

Com certificado A1 em Node ou Bun, o transporte do sinete faz o mTLS, a autenticação TLS com certificados do cliente e do servidor, no próprio processo. Esta página trata dos casos em que a chave privada fica fora do processo ou não pode ser exportada: certificado A3 num token acessado por PKCS#11, a interface de comunicação com o dispositivo; A3 em nuvem de um PSC, um prestador de serviço de confiança; chave num OpenBao Transit; ou uma `CryptoKey` não exportável. Para essas chaves, o sinete usa um programa auxiliar nativo, o `sinete-signer`. Ele estabelece a conexão TLS com os serviços fiscais, como os da SEFAZ, a Secretaria da Fazenda, e pede a quem tem a chave as assinaturas necessárias ao handshake, a negociação da conexão. O cliente do helper é exportado por `sinete/transport/signer` e `@sinete/transport/signer`.

## 1. O binário

Há duas variantes do mesmo helper. A estática serve para chaves acessadas pelo seu código, localmente ou por um serviço remoto, como PSC, OpenBao e `CryptoKey`. Ela roda em Linux, macOS e Windows, em x64 e arm64, sem dependências nativas adicionais. A variante `-p11` acrescenta o suporte a PKCS#11 para o token físico e exige o módulo do fabricante. Está disponível para Linux com glibc 2.34 ou mais nova, macOS e Windows x64. No Windows arm64, só há a variante estática.

O `startSigner` de `sinete/transport/signer` recebe o caminho do executável em `binary`; sem ele, lê `SINETE_SIGNER_BIN`, ou `SINETE_SIGNER_P11_BIN` com `pkcs11: true`. O caminho pode ser absoluto ou relativo ao diretório atual; o executável não é procurado no `PATH`. Outra opção é instalar o pacote npm `@sinete/signer` e importar dele o `startSigner`, que localiza o binário da plataforma instalado como dependência opcional. Nessa opção, `binary` e a variável de ambiente correspondente continuam tendo prioridade. Os exemplos abaixo usam o cliente do transporte e pressupõem que a variável correspondente esteja definida. O build é reproduzível: ao baixar o binário de uma versão, confira seu SHA-256 com o `SHA256SUMS` daquela versão antes de usar.

`startSigner` inicia o helper como processo filho com um ambiente mínimo: `PATH`, `HOME` e `SYSTEMROOT`, quando disponível, mais as variáveis passadas em `env`. A comunicação usa a entrada e a saída padrão do processo, o stdio. `ambientes` é obrigatório fora do modo de laboratório (`lab: true`) e seleciona os hosts permitidos. Essa lista é compilada no helper a partir dos mesmos dados de endpoints do transporte. A opção `tpAmb` faz o helper conferir também os elementos `<tpAmb>` do corpo, que indicam o ambiente fiscal: `'1'` para produção e `'2'` para homologação.

## 2. Token A3 (PKCS#11)

```ts
import { createNfeEmissor } from 'sinete/emissor/nfe';
import { certificadoAberto, startSigner } from 'sinete/transport/signer';

const signer = await startSigner({ pkcs11: true, ambientes: ['homologacao'], tpAmb: '2' });
const a3 = await signer.openPkcs11({
  module: '/usr/lib/libaetpkss.so',
  token: 'MEU TOKEN',
  label: 'certificado',
  pin: () => pedirPinAoUsuario(),
});
const nfe = await createNfeEmissor({ certificado: certificadoAberto(a3), ambiente: 'homologacao', store, aoDecidir });
```

No exemplo, `module` é o caminho absoluto do módulo PKCS#11 do fabricante, e `token` é o rótulo do dispositivo. `pedirPinAoUsuario`, `store` e `aoDecidir` são fornecidos pela aplicação.

O helper encontra o certificado pelo rótulo (`label`) ou pelo atributo `CKA_ID` (`keyId`, em hexadecimal), que identifica o par de certificado e chave. Ele usa a chave privada de mesmo `CKA_ID`. O PIN, a senha de acesso ao token, é pedido na abertura e transmitido apenas pelo canal com o helper, nunca por argumento de linha de comando nem variável de ambiente. Se o token guarda só o certificado do titular, passe os certificados das autoridades certificadoras intermediárias em `chain`, como uma lista de `Uint8Array` em formato DER.

`certificadoAberto` monta o objeto que o emissor aceita no lugar de `pfx` e `senha`: a identidade do mTLS, o titular lido do certificado e o assinador dos documentos. Com token, esse assinador (`documentSigner`) assina o XML pelo próprio helper. Antes de assinar, o helper confere o `SignedInfo`, o trecho do XML que descreve a assinatura, e o `Id`, o identificador do elemento referenciado, conforme o perfil dos documentos fiscais eletrônicos, os DF-e.

Essa validação abrange a Nota Fiscal Eletrônica (NF-e), a Nota Fiscal de Consumidor Eletrônica (NFC-e), o Manifesto Eletrônico de Documentos Fiscais (MDF-e), o Conhecimento de Transporte Eletrônico (CT-e), eventos, inutilização de numeração, a Declaração de Prestação de Serviço (DPS) e pedidos de registro de evento da Nota Fiscal de Serviço Eletrônica Nacional (NFS-e). Nos documentos da SEFAZ, o certificado da matriz cobre as filiais do mesmo CNPJ-base, os oito primeiros caracteres do CNPJ.

O `documentSigner` envia também o elemento referenciado quando recebe esse contexto da assinatura. O helper confere seu resumo criptográfico e, em eventos, o autor informado no próprio elemento. Isso permite assinar a manifestação do destinatário, o evento em que ele se pronuncia sobre uma NF-e recebida, embora o `Id` contenha a chave de acesso de outro emitente. O mesmo `certificadoAberto` serve para `createMdfeEmissor` e `createNfseEmissor`, e a identidade (`a3.tlsIdentity`) serve para qualquer `createTransport`.

## 3. A3 em nuvem, OpenBao ou `CryptoKey`

Quando a chave é acessada pelo seu código, localmente ou por um serviço remoto, o helper pede cada assinatura de handshake por um `TlsSigner`. Há dois modos. No modo `digest`, seu código recebe o resumo SHA-256 das mensagens do handshake e devolve uma assinatura RSA PKCS#1 v1.5 sobre o `DigestInfo`, a estrutura que combina o resumo e a identificação do algoritmo. `digestTlsSigner` adapta um `DigestSigner` de `sinete/core`: monta o `DigestInfo` e chama `signDigestInfo`. Esse modo atende integrações com PSC que ofereçam assinatura RAW, OpenBao Transit com `prehashed` e módulos de segurança criptográfica, os HSM, desde que o adaptador implemente esse contrato.

No modo `message`, seu código recebe as mensagens completas do handshake para assinar com WebCrypto. `cryptoKeyTlsSigner` recebe uma `CryptoKey` configurada para `RSASSA-PKCS1-v1_5` com SHA-256 e a cadeia de certificados em DER. A chave pode ser não exportável.

```ts
import type { DigestSigner } from 'sinete/core';
import { ambienteHosts, createTransport } from 'sinete/transport';
import { certificadoAberto, digestTlsSigner, startSigner } from 'sinete/transport/signer';

declare const psc: DigestSigner; // o seu cliente do PSC ou do OpenBao

const signer = await startSigner({ ambientes: ['producao'] });
const nuvem = await signer.openRemote({
  signer: digestTlsSigner(psc),
  allowedHosts: ambienteHosts('producao'),
  signTimeoutMs: 60_000,
});
const transport = createTransport({ identity: nuvem.tlsIdentity });
const certificado = certificadoAberto(nuvem, { signer: psc });
```

`allowedHosts` define a política de quem tem a chave, independente da política do helper: o cliente recusa qualquer pedido de assinatura para um host fora dessa lista. No modo `message`, o cliente confere ainda, antes de assinar, que o SNI, o nome do servidor indicado no handshake, corresponde ao host pedido e que o certificado apresentado pelo servidor cobre esse host. Para conexões por endereço IP, confere o IP no certificado. Com chave remota, quem assina os documentos é seu próprio `DigestSigner` ou `DataSigner`: passe-o a `certificadoAberto`.

## 4. O que o helper garante

- Usa apenas TLS 1.2 e o esquema `rsa_pkcs1_sha256` na mensagem `CertificateVerify`, que comprova a posse da chave privada do cliente. Esse perfil atende tokens e assinadores remotos que não oferecem RSA-PSS, mesmo quando o servidor prefere esse esquema.
- Recusa a requisição antes de abrir uma conexão se o host não pertence aos ambientes liberados, se a URL não usa `https` e a porta 443, se há credencial na URL ou se o cabeçalho `Host` difere do host da URL. O transporte aplica sua `HostPolicy`, a política de destinos permitidos, antes de encaminhar a requisição, e o helper aplica a própria política novamente.
- Não oferece assinatura avulsa: a chave só é usada num handshake com host aprovado ou numa chamada validada de `dfe.sign`, o método de assinatura de documentos do protocolo.
- Aceita renegociação TLS iniciada pelo servidor uma vez por conexão, como exigem os servidores IIS de São Paulo, Bahia, SEFAZ Virtual do Ambiente Nacional (SVAN), Ambiente Nacional (AN) e Secretaria de Finanças Nacional (Sefin). Por isso, a identidade do helper funciona também no Deno, inclusive nos hosts que o transporte do Deno recusa com o certificado no próprio processo.
- Encaminha o `AbortSignal` do envio ao helper, que deixa de esperar a resposta do servidor e não envia a requisição se o handshake ainda não terminou. Um cancelamento não desfaz o que já foi transmitido. Se o envio já ocorreu, o resultado é incerto e precisa ser verificado por consulta, como no transporte no próprio processo.
- Produz uma linha de auditoria por requisição e por documento assinado, com hora, identidade, host ou referência, resultado e quantidade de assinaturas, sem registrar segredos nem o corpo da requisição. A auditoria chega ao `logger` fornecido ao cliente ou é gravada em `auditFile`. Sem um `logger` configurado nem `auditFile`, o cliente descarta esses registros.

## 5. Quantas assinaturas cada envio custa

Uma conexão nova que pede o certificado do cliente custa uma assinatura por handshake autenticado. Reaproveitar uma conexão já autenticada normalmente não exige outra assinatura. Nos hosts que só pedem o certificado durante a renegociação, a assinatura acontece no meio da primeira requisição da conexão. Se o servidor pedir autenticação tanto no handshake inicial quanto na renegociação, haverá uma assinatura em cada etapa.

O helper mantém um cache de sessões TLS e permite retomá-las quando o servidor oferece esse recurso. Nos servidores da SEFAZ medidos, que não emitem tickets de sessão, não há essa economia; manter a conexão viva permite evitar novas assinaturas. `TlsInfo.signatures` informa quantas assinaturas TLS foram atribuídas à requisição, e `signer.stats()` informa o total por identidade, incluindo handshakes e assinaturas de documentos por `dfe.sign`. Esses dados permitem contabilizar o uso da cota de um PSC.

Feche o transporte e o signer com `close()` ao encerrar. Fechar o signer iniciado por `startSigner` encerra o processo do helper e as sessões do token.

## Erros

Falhas de rede e de TLS usam os mesmos códigos do transporte no próprio processo, como [`certificado_recusado`](../erros/certificado_recusado.md), [`cadeia_servidor_nao_confiavel`](../erros/cadeia_servidor_nao_confiavel.md) e [`politica_recusou`](../erros/politica_recusou.md). Os códigos específicos do helper são [`signer_indisponivel`](../erros/signer_indisponivel.md), [`signer_protocolo`](../erros/signer_protocolo.md), [`assinatura_tls_recusada`](../erros/assinatura_tls_recusada.md), [`assinatura_tls_expirou`](../erros/assinatura_tls_expirou.md), [`pkcs11_falhou`](../erros/pkcs11_falhou.md) e [`assinatura_documento_recusada`](../erros/assinatura_documento_recusada.md).
