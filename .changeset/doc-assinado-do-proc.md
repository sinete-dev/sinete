---
'@sinete/nfe': minor
'@sinete/mdfe': minor
---

`nfeAssinadaDoProc(xml)` e `mdfeAssinadoDoProc(xml)`: o documento assinado de dentro do `nfeProc` ou do `mdfeProc` guardado (ou o próprio documento), como fatia do texto. Os namespaces que a raiz herdava do envelope são declarados nela, porque `consultar`, `resolverEnvioSemResposta` e a retomada recusam raiz sem `xmlns` próprio; o C14N do elemento assinado não muda, então a assinatura confere dentro e fora do proc. Sem documento assinado, `ConfigError`.
