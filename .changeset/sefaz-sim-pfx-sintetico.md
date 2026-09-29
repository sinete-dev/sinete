---
'@sinete/sefaz-sim': minor
---

Novo `syntheticPfx(certificado, senha, { chain })`: o PFX de um certificado sintético (PBE com 3DES, a AC como intermediária), para testar quem recebe o certificado como arquivo e senha, como os emissores do `@sinete/emissor`. O node-forge entra como dependência, o mesmo leitor do `@sinete/cert`.
