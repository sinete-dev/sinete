---
"@sinete/cert": patch
---

`criarAssinadorA1` e `abrirPfx` guardam uma cópia própria da chave PKCS#8. A chave de cada hash é importada no primeiro uso, então quem zerava o próprio buffer depois de criar o assinador (ou um leitor de PKCS#12 injetado que devolvia um buffer do chamador) via o SHA-256 falhar com `Invalid keyData` e o `tlsPem()` devolver uma chave zerada. A cópia usa `new Uint8Array`, porque o `slice()` de um `Buffer` compartilha a memória.
