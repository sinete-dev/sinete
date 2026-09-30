# Referência: `@sinete/cert`

Gerado dos `.d.ts` publicados por `scripts/docs-gerados.ts`; não edite à mão. Cada nome exportado traz o tipo, a primeira frase do TSDoc e, nas funções, a assinatura. A assinatura completa dos tipos e das interfaces está nos `.d.ts` do pacote instalado (`node_modules/@sinete/cert/dist/`), que é a palavra final. Pelo guarda-chuva, `@sinete/cert/x` é `sinete/cert/x`.

## `@sinete/cert`

`@sinete/cert`: certificado ICP-Brasil do titular.

Leitura de PFX em JS (inclusive o legado RC2-40 + 3DES), escolha do certificado do titular, trava de validade, identidade ICP-Brasil (CNPJ, CPF, responsável), cadeia até as raízes ICP-Brasil do bundle versionado, `Certificado` e assinatura A1 via WebCrypto. Pacote puro: roda igual em Node, Bun, Deno e no browser.

### Funções

- `abrirPfx`: Abre um PFX A1 em memória e devolve o `Certificado`. `abrirPfx(pfx: Uint8Array, opcoes: AbrirPfxOpcoes): Promise<CertificadoA1>`
- `assinarBytes`: Assina os bytes com qualquer `Assinador` (RSASSA-PKCS1-v1_5). `assinarBytes(assinador: Assinador, dados: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array>`
- `certificadosIcpBrasil`: Todos os certificados do bundle, com o DER já decodificado. `certificadosIcpBrasil(): readonly CertificadoDoBundleIcp[]`
- `codificarBase64`: Base64 e PEM sem `Buffer`: `atob`/`btoa` existem em Node, Bun, Deno e no browser. `codificarBase64(bytes: Uint8Array): string`
- `codificarDigestInfo`: DigestInfo DER (`AlgorithmIdentifier` + hash) de um hash já calculado. `codificarDigestInfo(hash: HashDaAssinatura, digest: Uint8Array): Uint8Array`
- `comoAssinadorDeDados`: Adaptador: um `AssinadorDeDigest` com a interface de `AssinadorDeDados`. A assinatura sai idêntica à do modo `dados`. `comoAssinadorDeDados(assinador: AssinadorDeDigest): AssinadorDeDados`
- `conferirBytes`: Confere uma assinatura RSASSA-PKCS1-v1_5 com a chave pública do certificado. `conferirBytes(cert: CertificadoX509 | Uint8Array, dados: Uint8Array, assinatura: Uint8Array, hash: HashDaAssinatura): Promise<boolean>`
- `conferirEmitidoPor`: Confere se `emissor` assinou `cert`. `undefined` quando o algoritmo não é suportado (ex.: RSA-PSS, ECDSA). `conferirEmitidoPor(cert: CertificadoX509, emissor: CertificadoX509): Promise<boolean | undefined>`
- `criarAssinadorA1`: Assinador A1 em memória, modo `dados`. Recebe a chave em PKCS#8 DER (como sai do `abrirPfx`) e o certificado da folha. A importação acontece uma vez por hash; a `CryptoKey` não é exportável. `criarAssinadorA1(pkcs8: Uint8Array, certificadoDer: Uint8Array): Promise<AssinadorDeDados>`
- `decodificarBase64`: `decodificarBase64(b64: string): Uint8Array`
- `dersDoPem`: Todos os blocos PEM com o rótulo dado (padrão `CERTIFICATE`), em DER, na ordem do texto. `dersDoPem(pem: string, rotulo?: string): Uint8Array[]`
- `digestInfoDe`: Calcula o hash dos bytes e devolve o DigestInfo DER, que é o que um `AssinadorDeDigest` assina. `digestInfoDe(dados: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array>`
- `identidadeIcp`: Extrai CNPJ, CPF e responsável de um certificado ICP-Brasil. Nunca lança: sem dados, `tipo` é `desconhecido`. `identidadeIcp(cert: CertificadoX509): IdentidadeIcp`
- `impressaoDigitalSha256`: SHA-256 do DER em hexadecimal maiúsculo com `:`, no formato do OpenSSL e do Node (`fingerprint256`). `impressaoDigitalSha256(cert: CertificadoX509 | Uint8Array): Promise<string>`
- `lerCertificado`: Lê um certificado X.509 em DER. Lança `ErroCertificado('certificado_invalido')` se o DER não for um certificado. `lerCertificado(der: Uint8Array): CertificadoX509`
- `montarCadeia`: Monta a cadeia do certificado até uma âncora, tentando todos os emissores candidatos (com retrocesso): a ordem dos certificados de entrada nunca esconde um caminho confiável, como o de uma intermediária com versão autoassinada e versão com certificação cruzada. `montarCadeia(folha: CertificadoX509 | Uint8Array, opcoes?: MontarCadeiaOpcoes): Promise<ResultadoCadeia>`
- `nomesIguais`: Nomes distintos equivalentes (RFC 5280, 7.1): mesmos tipos de atributo na mesma ordem e valores iguais depois da normalização, independente do tipo de string usado na codificação (PrintableString contra UTF8String). `nomesIguais(a: NomeDistinto, b: NomeDistinto): boolean`
- `pemDoCertificado`: Certificado em PEM (`CERTIFICATE`). `pemDoCertificado(cert: CertificadoX509 | Uint8Array): string`
- `pemDoDer`: PEM com linhas de 64 colunas, como o OpenSSL escreve. `pemDoDer(der: Uint8Array, rotulo: string): string`
- `pemTlsIcpBrasil`: Conjunto de confiança TLS (raízes + intermediárias vistas), em PEM, para somar à loja padrão da runtime. `pemTlsIcpBrasil(): string[]`
- `podeEmitir`: O emissor na posição `depth` da cadeia (1 = emissor do titular) pode assinar o elo abaixo: é AC, tem `keyCertSign` quando declara KeyUsage e respeita o `pathLenConstraint` (intermediárias não autoemitidas abaixo dele). `podeEmitir(emissor: CertificadoX509, abaixo: readonly CertificadoX509[]): boolean`
- `senhaNoFormatoLegado`: Variante da senha para PFX gerados por ferramentas antigas (OpenSSL 1.0 e afins), que convertiam cada byte UTF-8 da senha num caractere BMP em vez de converter o caractere (ADR 0003, pendência). `ç` vira `Ã§`. `senhaNoFormatoLegado(senha: string): string | undefined`
- `validadeEm`: Validade de um certificado num instante. `validadeEm(cert: CertificadoX509, relogio: Relogio): Validade`

### Classes

- `ErroCertificado` (estende `ErroSinete<CodigoErroCertificado>`)

### Interfaces

- `AbrirPfxOpcoes`: Membros: `senha`, `relogio`, `aceitarVencido`, `leitor`.
- `AtributoDoNome`: Atributo de um nome distinto (DN), na ordem em que aparece no certificado. Membros: `oid`, `type`, `value`.
- `Certificado`: Membros: `tipo`, `certificado`, `certificadosExtras`, `identidade`, `validade`, `assinador()`.
- `CertificadoA1` (estende `Certificado`): Membros: `tipo`, `assinador()`, `tlsPem()`.
- `CertificadoDoBundleIcp`: Bundle ICP-Brasil como dado versionado (ADR 0004, decisão 2). Membros: `id`, `tipo`, `tls`, `arquivo`, `subject`, `subjectCN`, `issuerCN`, `sha256`, `notBefore`, `notAfter`, `tipoDeChave`, `fonte`, `der`.
- `CertificadoX509`: Membros: `der`, `version`, `serialNumber`, `subject`, `issuer`, `notBefore`, `notAfter`, `notBeforeIso`, `notAfterIso`, `isCA`, `pathLenConstraint`, `selfIssued`, `extensoesCriticasNaoSuportadas`, `keyUsage`, `extKeyUsage`, `subjectAltNames`, `subjectKeyId`, `authorityKeyId`, `urlsOcsp`, `urlsCaIssuers`, `urlsCrl`, `chavePublica`, `spki`, `tbs`, `signatureAlgorithm`, `signature`.
- `ChavePublicaRsa`: Membros: `algoritmo`, `moduloHex`, `expoenteHex`, `bits`.
- `ConteudoPkcs12`: Conteúdo de um PFX já decifrado: chaves em PKCS#8 DER e certificados em DER, na ordem do arquivo. Membros: `chavesPrivadas`, `certificados`.
- `DescricaoBundleIcp`: Membros: `versaoDoFormato`, `versao`, `fonte`, `excluidos`.
- `IcpPessoa`: Dados de pessoa física do leiaute posicional (titular do e-CPF ou responsável do e-CNPJ). Membros: `cpf`, `dataNascimento`, `nome`.
- `IdentidadeIcp`: Membros: `tipo`, `cnpj`, `cpf`, `pessoa`, `nome`, `origem`.
- `LeitorPkcs12`: Quem abre o PFX. Deve lançar `ErroCertificado` com `pfx_invalido`, `pfx_senha_incorreta` ou `pfx_nao_suportado`. Nunca guarda a senha nem os bytes depois de devolver. Membros: `nome`, `ler()`.
- `MaterialTlsPem`: Material para TLS em processo: cadeia do cliente e chave, em PEM, só em memória. Membros: `cadeia`, `chave`.
- `MontarCadeiaOpcoes`: Membros: `intermediarias`, `ancoras`, `relogio`, `profundidadeMaxima`.
- `NomeDistinto`: Membros: `texto`, `atributos`, `commonName`, `der`.
- `OtherName`: `otherName` do SAN: OID e o valor já decodificado como texto. Membros: `oid`, `value`.
- `OutraChavePublica`: Membros: `algoritmo`, `oid`.
- `ResultadoCadeia`: Membros: `situacao`, `cadeia`, `ancora`, `emissorAusente`, `vencidos`.
- `SubjectAltNames`: Membros: `otherNames`, `emails`, `nomesDns`, `uris`, `enderecosIp`.

### Tipos

- `CodigoErroCertificado`: Códigos estáveis do `@sinete/cert`. Os detalhes nunca trazem senha, chave ou o PFX: só metadados públicos do certificado (titular, emissor, validade, fingerprint).
- `SituacaoCadeia`
- `Validade`: `type Validade = 'valido' | 'expirado' | 'ainda_nao_valido'`

### Constantes

- `ICP_BRASIL_BUNDLE`: `ICP_BRASIL_BUNDLE: DescricaoBundleIcp`
- `ICP_OIDS`: `ICP_OIDS: { readonly pessoaFisicaTitular: '2.16.76.1.3.1'; readonly nomeResponsavel: '2.16.76.1.3.2'; readonly cnpj: '2.16.76.1.3.3'; readonly pessoaFisicaResponsavel: '2.16.76.1.3.4'; readonly tituloEleitor: '2.16.76.1.3.5'; readonly ceiP…`
- `leitorPkcs12Forge`: Leitor padrão, com o node-forge. Tenta a senha como veio e, se tiver acento, a variante legada. `leitorPkcs12Forge: LeitorPkcs12`
