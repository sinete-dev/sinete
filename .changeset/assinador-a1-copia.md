---
"@sinete/cert": patch
---

`criarAssinadorA1` copia a chave PKCS#8 que recebe. A chave de cada hash é importada no primeiro uso, então quem zerava o próprio buffer logo depois de criar o assinador via o SHA-256 falhar com `Invalid keyData`.
