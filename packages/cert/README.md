# @sinete/cert

Certificado ICP-Brasil do titular: leitura de PFX em JS (inclusive o legado RC2-40 + 3DES), escolha do certificado, trava de validade, identidade ICP-Brasil (CNPJ, CPF, responsável), cadeia até as raízes ICP-Brasil de um bundle versionado, `KeyStore` e assinatura A1 via WebCrypto. Pacote puro: roda igual em Node (`^20.19.0 || >=22.12.0`), Bun, Deno e no browser.

Status: pré-alfa, API instável até a 1.0.

```ts
import { systemClock } from '@sinete/core';
import { buildChain, openPfx } from '@sinete/cert';

const ks = await openPfx(pfxBytes, { password, clock: systemClock });
ks.identity; // { tipo: 'e-CNPJ', cnpj: '11222333000181', pessoa: { cpf, dataNascimento, nome }, ... }
ks.certificate.notAfterIso; // '2027-01-01T00:00:00Z'

const signer = await ks.signer(); // DataSigner do @sinete/core (RSASSA-PKCS1-v1_5, SHA-1 ou SHA-256)
const chain = await buildChain(ks.certificate, { intermediates: ks.extraCertificates, clock: systemClock });
chain.status; // 'confiavel' | 'raiz_desconhecida' | 'incompleta' | 'assinatura_invalida' | 'emissor_nao_autorizado'

const { certChain, key } = ks.tlsPem(); // para o @sinete/transport; só em memória
```

## Decisões que valem aqui

- ADR 0003: PFX lido em JS com node-forge atrás de `Pkcs12Reader`; a chave sai como PKCS#8 para o WebCrypto; nunca passar `pfx` ao TLS, porque o OpenSSL 3 do Node recusa o PFX legado.
- ADR 0004: bundle ICP-Brasil como dado, versionado pela data de coleta do `ACcompactado.zip`, com o SHA-512 do zip e o SHA-256 de cada certificado. Raízes v5, v10, v11 e v12 e as intermediárias SSL vistas nos servidores DF-e; v6 e v7 ficam de fora.
- Nenhum certificado real no repo: os testes usam os PFX sintéticos de `test/fixtures/` (gerados por `test/fixtures/gerar.ts`) e chaves geradas na hora.

## PFX

`openPfx(bytes, { password, clock, allowExpired?, reader? })`:

- Lê PBES2/AES, 3DES e o legado RC2-40 + 3DES (perfil de A1 antigo exportado pelo Windows). RC2-128 não é lido (`pfx_nao_suportado`).
- Senha com acento: tenta a conversão correta (UTF-16, como o OpenSSL 3) e, se o MAC não conferir, a variante de ferramentas antigas que convertiam byte a byte (`legacyPasswordVariant`).
- Titular: o certificado de fim de cadeia que casa com uma chave do PFX e tem a validade mais longa. Folhas antigas da mesma chave não viram intermediárias.
- Validade: fora dela, `certificado_expirado` ou `certificado_ainda_nao_valido`, salvo `allowExpired: true` (o `KeyStore` sai com `validity` marcada).
- Tolera bytes extras depois do DER (visto em PFX guardado em base64 num cofre).

## Identidade ICP-Brasil

`icpIdentity(cert)` lê os `otherName` do SubjectAltName (DOC-ICP-04, item 7.1.2.3): 2.16.76.1.3.3 (CNPJ), 2.16.76.1.3.4 (responsável pelo e-CNPJ: nascimento e CPF), 2.16.76.1.3.2 (nome do responsável) e 2.16.76.1.3.1 (titular do e-CPF). Aceita o valor como OCTET STRING, PrintableString ou UTF8String. CNPJ alfanumérico (IN RFB 2.229/2024) é aceito sem perder as letras. Sem os OIDs, usa o padrão `NOME:DOCUMENTO` do CN e marca `source: 'cn'`.

Na cadeia, cada emissor precisa poder emitir (RFC 5280, 6.1.4): BasicConstraints de AC, `keyCertSign` quando há KeyUsage e `pathLenConstraint` respeitado; senão, `emissor_nao_autorizado`.

## Assinatura

- `createA1Signer(pkcs8, certDer)` / `ks.signer()`: `DataSigner` com a chave importada no WebCrypto como não exportável.
- `digestSignerAsDataSigner(signer)`: faz um `DigestSigner` (PKCS#11, A3 em nuvem, HSM) servir onde se espera `DataSigner`; calcula o hash e monta o DigestInfo. A assinatura sai idêntica à do modo `data`.
- `signBytes(signer, data, hash)` e `verifyBytes(cert, data, sig, hash)`.

## Bundle ICP-Brasil

`icpBrasilCertificates()`, `icpBrasilTlsPem()` e `ICP_BRASIL_BUNDLE` (versão e proveniência). O dado vive em `src/data/icp-brasil.json`, gerado por `tools/icp-bundle/build-bundle.ts`; `--check` confere que o arquivo versionado bate com o zip do ITI. Atualizar o bundle é release minor deste pacote.

## Erros

`CertError` com `code`: `pfx_invalido`, `pfx_senha_incorreta`, `pfx_nao_suportado`, `pfx_sem_chave`, `pfx_sem_certificado_da_chave`, `certificado_expirado`, `certificado_ainda_nao_valido`, `certificado_invalido`, `algoritmo_nao_suportado`. Detalhes nunca trazem senha, chave ou o PFX.

## Dependências

`node-forge` (licença dupla `BSD-3-Clause OR GPL-2.0`, usado sob a BSD-3; ver NOTICE), só dentro de `src/pkcs12.ts`. Nenhum tipo dele aparece na API.
