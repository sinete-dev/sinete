---
'@sinete/cert': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 2). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

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
