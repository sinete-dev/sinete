---
'@sinete/cert': minor
---

Primeira versão do @sinete/cert: leitura de PFX em JS (inclusive o legado RC2-40 + 3DES) com node-forge atrás de `Pkcs12Reader`, escolha do titular pela validade mais longa, trava de validade com `allowExpired`, identidade ICP-Brasil (CNPJ, CPF, responsável), cadeia até as raízes ICP-Brasil do bundle versionado (v5, v10, v11, v12 e intermediárias SSL vistas), `KeyStore`, signer A1 via WebCrypto (SHA-1 e SHA-256) e adaptador de `DigestSigner`.
