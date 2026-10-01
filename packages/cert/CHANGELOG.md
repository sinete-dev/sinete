# @sinete/cert

## 0.2.1

### Patch Changes

- 64b8d8a: **Atualize todos os `@sinete/*` juntos.** Nesta versão, parte dos pacotes sobe para 0.3.0 (`@sinete/core`, `@sinete/emissor`, `@sinete/mdfe`, `@sinete/nfe`, `@sinete/nfse`, `@sinete/rejeicoes` e o `sinete`) e o resto sobe em patch (0.2.1, e o `@sinete/ibs-cbs-dados` para a versão do mês), com faixas `^` entre si. Quem fixa versões exatas em `resolutions` (Yarn, Bun) ou `overrides` (npm, pnpm) precisa subir todos os `@sinete/*` na mesma mudança. Um pacote em 0.3.0 com outro preso numa versão anterior força uma combinação que nenhum deles declara: o `@sinete/nfe` 0.3.0 com o `@sinete/core` preso em 0.2.0 roda sem o que a 0.3.0 do core trouxe, ou o gerenciador instala duas cópias do core e o `instanceof` dos erros (`ErroDeValidacao`, `ErroSefaz`) falha entre elas. Quem usa só o `sinete` recebe as versões certas pelo guarda-chuva.
- Updated dependencies [5547ca1]
- Updated dependencies [64b8d8a]
  - @sinete/core@0.3.0

## 0.2.0

### Minor Changes

- 2a46db6: Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.
  
  Nomes exportados:
  
  | Antigo | Novo |
  |---|---|
  | `A1KeyStore` | `CertificadoA1` |
  | `KeyStore` | `Certificado` |
  | `OpenPfxOptions` | `AbrirPfxOpcoes` |
  | `TlsPemMaterial` | `MaterialTlsPem` |
  | `Validity` | `Validade` |
  | `openPfx` | `abrirPfx` |
  | `validityAt` | `validadeEm` |
  | `BuildChainOptions` | `MontarCadeiaOpcoes` |
  | `ChainResult` | `ResultadoCadeia` |
  | `ChainStatus` | `SituacaoCadeia` |
  | `buildChain` | `montarCadeia` |
  | `mayIssue` | `podeEmitir` |
  | `verifyIssuedBy` | `conferirEmitidoPor` |
  | `CertError` | `ErroCertificado` |
  | `CertErrorCode` | `CodigoErroCertificado` |
  | `CertificateInfo` | `CertificadoX509` |
  | `DistinguishedName` | `NomeDistinto` |
  | `DnAttribute` | `AtributoDoNome` |
  | `OtherPublicKey` | `OutraChavePublica` |
  | `RsaPublicKey` | `ChavePublicaRsa` |
  | `certificateToPem` | `pemDoCertificado` |
  | `fingerprintSha256` | `impressaoDigitalSha256` |
  | `namesMatch` | `nomesIguais` |
  | `parseCertificate` | `lerCertificado` |
  | `IcpBundleCertificate` | `CertificadoDoBundleIcp` |
  | `IcpBundleInfo` | `DescricaoBundleIcp` |
  | `icpBrasilCertificates` | `certificadosIcpBrasil` |
  | `icpBrasilTlsPem` | `pemTlsIcpBrasil` |
  | `IcpIdentity` | `IdentidadeIcp` |
  | `icpIdentity` | `identidadeIcp` |
  | `Pkcs12Contents` | `ConteudoPkcs12` |
  | `Pkcs12Reader` | `LeitorPkcs12` |
  | `forgePkcs12Reader` | `leitorPkcs12Forge` |
  | `legacyPasswordVariant` | `senhaNoFormatoLegado` |
  | `base64ToBytes` | `decodificarBase64` |
  | `bytesToBase64` | `codificarBase64` |
  | `derToPem` | `pemDoDer` |
  | `pemToDers` | `dersDoPem` |
  | `createA1Signer` | `criarAssinadorA1` |
  | `digestInfoOf` | `digestInfoDe` |
  | `digestSignerAsDataSigner` | `comoAssinadorDeDados` |
  | `encodeDigestInfo` | `codificarDigestInfo` |
  | `signBytes` | `assinarBytes` |
  | `verifyBytes` | `conferirBytes` |
  
  Membros e parâmetros com nome:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `CertificadoA1` | `tlsPem.options.chain` | `tlsPem.opcoes.cadeia` |
  | `DescricaoBundleIcp` | `source.hashUrl` | `fonte.urlDoHash` |
  | `DescricaoBundleIcp` | `source.retrievedAt` | `fonte.coletadoEm` |
  | `DescricaoBundleIcp` | `source.zipCertificates` | `fonte.certificadosNoZip` |
  | `ErroCertificado` | `constructor.options` | `constructor.opcoes` |
  | `CertificadoA1` | `tlsPem.options` | `tlsPem.opcoes` |
  | `LeitorPkcs12` | `read.password` | `ler.senha` |
  | `CertificadoDoBundleIcp`, `CertificadoA1`, `Certificado` | `kind` | `tipo` |
  | `CertificadoDoBundleIcp` | `file` | `arquivo` |
  | `CertificadoDoBundleIcp` | `keyType` | `tipoDeChave` |
  | `CertificadoDoBundleIcp`, `DescricaoBundleIcp` | `source` | `fonte` |
  | `DescricaoBundleIcp` | `schemaVersion` | `versaoDoFormato` |
  | `DescricaoBundleIcp` | `version` | `versao` |
  | `DescricaoBundleIcp` | `excluded` | `excluidos` |
  | `MontarCadeiaOpcoes` | `intermediates` | `intermediarias` |
  | `MontarCadeiaOpcoes` | `anchors` | `ancoras` |
  | `MontarCadeiaOpcoes`, `AbrirPfxOpcoes`, `validadeEm` | `clock` | `relogio` |
  | `MontarCadeiaOpcoes` | `maxDepth` | `profundidadeMaxima` |
  | `ResultadoCadeia` | `status` | `situacao` |
  | `ResultadoCadeia` | `chain` | `cadeia` |
  | `ResultadoCadeia` | `anchor` | `ancora` |
  | `ResultadoCadeia` | `missingIssuer` | `emissorAusente` |
  | `ResultadoCadeia` | `expired` | `vencidos` |
  | `montarCadeia` | `leaf` | `folha` |
  | `montarCadeia`, `abrirPfx` | `options` | `opcoes` |
  | `podeEmitir`, `conferirEmitidoPor` | `issuer` | `emissor` |
  | `podeEmitir` | `below` | `abaixo` |
  | `IdentidadeIcp` | `source` | `origem` |
  | `CertificadoA1`, `Certificado`, `comoAssinadorDeDados`, `assinarBytes` | `signer` | `assinador` |
  | `Certificado` | `certificate` | `certificado` |
  | `Certificado` | `extraCertificates` | `certificadosExtras` |
  | `Certificado` | `identity` | `identidade` |
  | `Certificado` | `validity` | `validade` |
  | `AbrirPfxOpcoes`, `senhaNoFormatoLegado` | `password` | `senha` |
  | `AbrirPfxOpcoes` | `allowExpired` | `aceitarVencido` |
  | `AbrirPfxOpcoes` | `reader` | `leitor` |
  | `MaterialTlsPem` | `certChain` | `cadeia` |
  | `MaterialTlsPem` | `key` | `chave` |
  | `pemDoDer`, `dersDoPem` | `label` | `rotulo` |
  | `ConteudoPkcs12` | `privateKeys` | `chavesPrivadas` |
  | `ConteudoPkcs12` | `certificates` | `certificados` |
  | `LeitorPkcs12` | `name` | `nome` |
  | `LeitorPkcs12` | `read` | `ler` |
  | `criarAssinadorA1` | `certificateDer` | `certificadoDer` |
  | `digestInfoDe`, `assinarBytes`, `conferirBytes` | `data` | `dados` |
  | `conferirBytes` | `signature` | `assinatura` |
  | `CertificadoX509` | `unsupportedCriticalExtensions` | `extensoesCriticasNaoSuportadas` |
  | `CertificadoX509` | `ocspUrls` | `urlsOcsp` |
  | `CertificadoX509` | `caIssuersUrls` | `urlsCaIssuers` |
  | `CertificadoX509` | `crlUrls` | `urlsCrl` |
  | `CertificadoX509` | `publicKey` | `chavePublica` |
  | `NomeDistinto` | `text` | `texto` |
  | `NomeDistinto` | `attributes` | `atributos` |
  | `OutraChavePublica`, `ChavePublicaRsa` | `algorithm` | `algoritmo` |
  | `ChavePublicaRsa` | `modulusHex` | `moduloHex` |
  | `ChavePublicaRsa` | `exponentHex` | `expoenteHex` |
  | `SubjectAltNames` | `dnsNames` | `nomesDns` |
  | `SubjectAltNames` | `ipAddresses` | `enderecosIp` |
  
  Valores de união literal e textos:
  
  | Tipo | Antigo | Novo |
  |---|---|---|
  | `CertificadoDoBundleIcp` | `'root'` | `'raiz'` |
  | `CertificadoDoBundleIcp` | `'intermediate'` | `'intermediaria'` |
  
  Chaves dos JSON de dados:
  
  | Arquivo | Antigo | Novo |
  |---|---|---|
  | `data/icp-brasil.json` | `file` | `arquivo` |
  | `data/icp-brasil.json` | `keyType` | `tipoDeChave` |
  | `data/icp-brasil.json` | `kind` | `tipo` |
  | `data/icp-brasil.json` | `source` | `fonte` |
  | `data/icp-brasil.json` | `seenOn` | `vistoEm` |
  | `data/icp-brasil.json` | `why` | `motivo` |
  | `data/icp-brasil.json` | `reason` | `motivo` |
  | `data/icp-brasil.json` | `hashUrl` | `urlDoHash` |
  | `data/icp-brasil.json` | `retrievedAt` | `coletadoEm` |
  | `data/icp-brasil.json` | `zipCertificates` | `certificadosNoZip` |
  | `data/icp-brasil.json` | `certificates` | `certificados` |
  | `data/icp-brasil.json` | `excluded` | `excluidos` |
  | `data/icp-brasil.json` | `schemaVersion` | `versaoDoFormato` |
  | `data/icp-brasil.json` | `version` | `versao` |
  Também mudam nesta versão:
  
  - `name` de cada classe de erro é o nome novo da classe (`ErroCertificado`).
  - Chaves de `detalhes`: `certificates` → `certificados`.
  - `src/data/icp-brasil.json`: além das chaves, os valores de `tipo` passam a `raiz` e `intermediaria`, e `versaoDoFormato` sobe para 2.
  - Os campos do certificado com o nome da RFC 5280 (`subject`, `issuer`, `serialNumber`, `notBefore`, `notAfter`, `keyUsage`, `extKeyUsage`, `signatureAlgorithm`) ficam em inglês (exceção 1 do ADR 0015).
- ae8ab90: Acompanham a fase 1 do ADR 0015 (`@sinete/core`, `@sinete/validators` e `@sinete/rejeicoes` com nomes em português). Nenhum nome próprio destes pacotes muda nesta fase, mas os tipos do core que eles recebem e devolvem mudam, e o código de quem os usa muda junto. Os mais visíveis:
  
  | Onde aparece | Antigo | Novo |
  |---|---|---|
  | desfecho dos clientes (`ResultadoSefaz`, antes `SefazOutcome`) | `status: 'authorized' \| 'rejected' \| 'denied' \| 'pending'` | `tipo: 'autorizado' \| 'recusado' \| 'denegado' \| 'pendente'` |
  | desfecho autorizado ou denegado | `value` | `valor` |
  | desfecho recusado | `hint` (`probableCause`, `suggestedFix`, `source`) | `dica` (`causaProvavel`, `comoCorrigir`, `fonte`) |
  | desfecho pendente | `ref`, `retryAfterMs` | `referencia`, `aguardarMs` |
  | erros (`ErroSinete`, antes `SineteError`) | `details`, `docs` | `detalhes`, `pagina` |
  | ocorrências (`Ocorrencia`, antes `ValidationIssue`) | `path`, `message` | `caminho`, `mensagem` |
  | `ErroDeValidacao` (antes `ValidationError`) | `issues` | `ocorrencias` |
  | assinador (`Assinador`, antes `Signer`) | `kind: 'data' \| 'digest'`, `sign`, `signDigestInfo`, `certificateDer` | `tipo: 'dados' \| 'digest'`, `assinar`, `assinarDigestInfo`, `certificadoDer` |
  | relógio (`Relogio`, antes `Clock`) | `now()` | `agora()` |
  | resultado local (`Resultado`, antes `Result`) | `value`, `error` | `valor`, `erro` |
  
  A tabela completa de cada pacote da fase está nos changesets do `@sinete/core`, do `@sinete/validators` e do `@sinete/rejeicoes`.

### Patch Changes

- Updated dependencies [ae8ab90]
  - @sinete/core@0.2.0

## 0.1.0

### Minor Changes

- 515861a: Primeira versão do @sinete/cert: leitura de PFX em JS (inclusive o legado RC2-40 + 3DES) com node-forge atrás de `Pkcs12Reader`, escolha do titular pela validade mais longa, trava de validade com `allowExpired`, identidade ICP-Brasil (CNPJ, CPF, responsável), cadeia até as raízes ICP-Brasil do bundle versionado (v5, v10, v11, v12 e intermediárias SSL vistas), `KeyStore`, signer A1 via WebCrypto (SHA-1 e SHA-256) e adaptador de `DigestSigner`.
- 515861a: `SubjectAltNames` ganha `ipAddresses`: os `iPAddress` do SAN, IPv4 com pontos e IPv6 na forma curta da RFC 5952. O cliente do `sinete-signer` usa o campo para conferir, no modo `message`, que o certificado do servidor cobre o endereço quando o destino é um IP. Quem monta um `SubjectAltNames` à mão precisa incluir o campo.

### Patch Changes

- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
- Updated dependencies [515861a]
  - @sinete/core@0.1.0
