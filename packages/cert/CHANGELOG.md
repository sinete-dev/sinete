# @sinete/cert

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
