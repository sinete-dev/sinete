---
'@sinete/nfe': patch
---

`resolverEnvioSemResposta` devolve `divergente` quando a consulta da chave responde 561, 562 ou 613 (a numeração tem outra NF-e), com a chave registrada extraída do `xMotivo` quando vier. Antes o desfecho era `indefinida`, e a retomada de bytes cujo número já tinha outra chave só alertava depois de várias tentativas.
