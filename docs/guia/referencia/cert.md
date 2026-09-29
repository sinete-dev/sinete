# Referência: `@sinete/cert`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/cert/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/cert/x` é `sinete/cert/x`.

## `@sinete/cert`

`@sinete/cert`: certificado ICP-Brasil do titular.

Leitura de PFX em JS (inclusive o legado RC2-40 + 3DES), escolha do certificado do titular, trava de validade, identidade ICP-Brasil (CNPJ, CPF, responsável), cadeia até as raízes ICP-Brasil do bundle versionado, `KeyStore` e assinatura A1 via WebCrypto. Pacote puro: roda igual em Node, Bun, Deno e no browser.

### Funções

- `base64ToBytes`: `base64ToBytes(b64: string): Uint8Array`
- `buildChain`: Monta a cadeia do certificado até uma âncora, tentando todos os emissores candidatos (com retrocesso): a ordem dos certificados de entrada nunca esconde um caminho confiável, como o de uma intermediária com versão autoassinada e versão com certificação cruzada. `buildChain(leaf: CertificateInfo | Uint8Array, options?: BuildChainOptions): Promise<ChainResult>`
- `bytesToBase64`: Base64 e PEM sem `Buffer`: `atob`/`btoa` existem em Node, Bun, Deno e no browser. `bytesToBase64(bytes: Uint8Array): string`
- `certificateToPem`: Certificado em PEM (`CERTIFICATE`). `certificateToPem(cert: CertificateInfo | Uint8Array): string`
- `createA1Signer`: Signer A1 em memória, modo `data`. Recebe a chave em PKCS#8 DER (como sai do `openPfx`) e o certificado da folha. A importação acontece uma vez por hash; a `CryptoKey` não é exportável. `createA1Signer(pkcs8: Uint8Array, certificateDer: Uint8Array): Promise<DataSigner>`
- `derToPem`: PEM com linhas de 64 colunas, como o OpenSSL escreve. `derToPem(der: Uint8Array, label: string): string`
- `digestInfoOf`: Calcula o hash de `data` e devolve o DigestInfo DER, que é o que um `DigestSigner` assina. `digestInfoOf(data: Uint8Array, hash: SignatureHash): Promise<Uint8Array>`
- `digestSignerAsDataSigner`: Adaptador: um `DigestSigner` com a interface de `DataSigner`. A assinatura sai idêntica à do modo `data`. `digestSignerAsDataSigner(signer: DigestSigner): DataSigner`
- `encodeDigestInfo`: DigestInfo DER (`AlgorithmIdentifier` + hash) de um hash já calculado. `encodeDigestInfo(hash: SignatureHash, digest: Uint8Array): Uint8Array`
- `fingerprintSha256`: SHA-256 do DER em hexadecimal maiúsculo com `:`, no formato do OpenSSL e do Node (`fingerprint256`). `fingerprintSha256(cert: CertificateInfo | Uint8Array): Promise<string>`
- `icpBrasilCertificates`: Todos os certificados do bundle, com o DER já decodificado. `icpBrasilCertificates(): readonly IcpBundleCertificate[]`
- `icpBrasilTlsPem`: Conjunto de confiança TLS (raízes + intermediárias vistas), em PEM, para somar à loja padrão da runtime. `icpBrasilTlsPem(): string[]`
- `icpIdentity`: Extrai CNPJ, CPF e responsável de um certificado ICP-Brasil. Nunca lança: sem dados, `tipo` é `desconhecido`. `icpIdentity(cert: CertificateInfo): IcpIdentity`
- `legacyPasswordVariant`: Variante da senha para PFX gerados por ferramentas antigas (OpenSSL 1.0 e afins), que convertiam cada byte UTF-8 da senha num caractere BMP em vez de converter o caractere (ADR 0003, pendência). `ç` vira `Ã§`. `legacyPasswordVariant(password: string): string | undefined`
- `mayIssue`: O emissor na posição `depth` da cadeia (1 = emissor do titular) pode assinar o elo abaixo: é AC, tem `keyCertSign` quando declara KeyUsage e respeita o `pathLenConstraint` (intermediárias não autoemitidas abaixo dele). `mayIssue(issuer: CertificateInfo, below: readonly CertificateInfo[]): boolean`
- `namesMatch`: Nomes distintos equivalentes (RFC 5280, 7.1): mesmos tipos de atributo na mesma ordem e valores iguais depois da normalização, independente do tipo de string usado na codificação (PrintableString contra UTF8String). `namesMatch(a: DistinguishedName, b: DistinguishedName): boolean`
- `openPfx`: Abre um PFX A1 em memória e devolve o `KeyStore`. `openPfx(pfx: Uint8Array, options: OpenPfxOptions): Promise<A1KeyStore>`
- `parseCertificate`: Lê um certificado X.509 em DER. Lança `CertError('certificado_invalido')` se o DER não for um certificado. `parseCertificate(der: Uint8Array): CertificateInfo`
- `pemToDers`: Todos os blocos PEM com o rótulo dado (padrão `CERTIFICATE`), em DER, na ordem do texto. `pemToDers(pem: string, label?: string): Uint8Array[]`
- `signBytes`: Assina `data` com qualquer `Signer` (RSASSA-PKCS1-v1_5). `signBytes(signer: Signer, data: Uint8Array, hash: SignatureHash): Promise<Uint8Array>`
- `validityAt`: Validade de um certificado num instante. `validityAt(cert: CertificateInfo, clock: Clock): Validity`
- `verifyBytes`: Confere uma assinatura RSASSA-PKCS1-v1_5 com a chave pública do certificado. `verifyBytes(cert: CertificateInfo | Uint8Array, data: Uint8Array, signature: Uint8Array, hash: SignatureHash): Promise<boolean>`
- `verifyIssuedBy`: Confere se `issuer` assinou `cert`. `undefined` quando o algoritmo não é suportado (ex.: RSA-PSS, ECDSA). `verifyIssuedBy(cert: CertificateInfo, issuer: CertificateInfo): Promise<boolean | undefined>`

### Classes

- `CertError` (estende `SineteError<CertErrorCode>`)

### Interfaces

- `A1KeyStore` (estende `KeyStore`): Membros: `kind`, `signer()`, `tlsPem()`.
- `BuildChainOptions`: Membros: `intermediates`, `anchors`, `clock`, `maxDepth`.
- `CertificateInfo`: Membros: `der`, `version`, `serialNumber`, `subject`, `issuer`, `notBefore`, `notAfter`, `notBeforeIso`, `notAfterIso`, `isCA`, `pathLenConstraint`, `selfIssued`, `unsupportedCriticalExtensions`, `keyUsage`, `extKeyUsage`, `subjectAltNames`, `subjectKeyId`, `authorityKeyId`, `ocspUrls`, `caIssuersUrls`, `crlUrls`, `publicKey`, `spki`, `tbs`, `signatureAlgorithm`, `signature`.
- `ChainResult`: Membros: `status`, `chain`, `anchor`, `missingIssuer`, `expired`.
- `DistinguishedName`: Membros: `text`, `attributes`, `commonName`, `der`.
- `DnAttribute`: Atributo de um nome distinto (DN), na ordem em que aparece no certificado. Membros: `oid`, `type`, `value`.
- `IcpBundleCertificate`: Bundle ICP-Brasil como dado versionado (ADR 0004, decisão 2). Membros: `id`, `kind`, `tls`, `file`, `subject`, `subjectCN`, `issuerCN`, `sha256`, `notBefore`, `notAfter`, `keyType`, `source`, `der`.
- `IcpBundleInfo`: Membros: `schemaVersion`, `version`, `source`, `excluded`.
- `IcpIdentity`: Membros: `tipo`, `cnpj`, `cpf`, `pessoa`, `nome`, `source`.
- `IcpPessoa`: Dados de pessoa física do leiaute posicional (titular do e-CPF ou responsável do e-CNPJ). Membros: `cpf`, `dataNascimento`, `nome`.
- `KeyStore`: Membros: `kind`, `certificate`, `extraCertificates`, `identity`, `validity`, `signer()`.
- `OpenPfxOptions`: Membros: `password`, `clock`, `allowExpired`, `reader`.
- `OtherName`: `otherName` do SAN: OID e o valor já decodificado como texto. Membros: `oid`, `value`.
- `OtherPublicKey`: Membros: `algorithm`, `oid`.
- `Pkcs12Contents`: Conteúdo de um PFX já decifrado: chaves em PKCS#8 DER e certificados em DER, na ordem do arquivo. Membros: `privateKeys`, `certificates`.
- `Pkcs12Reader`: Quem abre o PFX. Deve lançar `CertError` com `pfx_invalido`, `pfx_senha_incorreta` ou `pfx_nao_suportado`. Nunca guarda a senha nem os bytes depois de devolver. Membros: `name`, `read()`.
- `RsaPublicKey`: Membros: `algorithm`, `modulusHex`, `exponentHex`, `bits`.
- `SubjectAltNames`: Membros: `otherNames`, `emails`, `dnsNames`, `uris`, `ipAddresses`.
- `TlsPemMaterial`: Material para TLS em processo: cadeia do cliente e chave, em PEM, só em memória. Membros: `certChain`, `key`.

### Tipos

- `CertErrorCode`: Códigos estáveis do `@sinete/cert`. Os detalhes nunca trazem senha, chave ou o PFX: só metadados públicos do certificado (titular, emissor, validade, fingerprint).
- `ChainStatus`
- `Validity`: `type Validity = 'valido' | 'expirado' | 'ainda_nao_valido'`

### Constantes

- `forgePkcs12Reader`: Leitor padrão, com o node-forge. Tenta a senha como veio e, se tiver acento, a variante legada. `forgePkcs12Reader: Pkcs12Reader`
- `ICP_BRASIL_BUNDLE`: `ICP_BRASIL_BUNDLE: IcpBundleInfo`
- `ICP_OIDS`: `ICP_OIDS: { readonly pessoaFisicaTitular: '2.16.76.1.3.1'; readonly nomeResponsavel: '2.16.76.1.3.2'; readonly cnpj: '2.16.76.1.3.3'; readonly pessoaFisicaResponsavel: '2.16.76.1.3.4'; readonly tituloEleitor: '2.16.76.1.3.5'; readonly ceiP…`
