---
'sinete': minor
---

Primeira versão do guarda-chuva `sinete`: um pacote só, sem entrada raiz, com um subpath por entrada dos `@sinete/*` (`sinete/nfe`, `sinete/nfe/ibs-cbs`, `sinete/mdfe`, `sinete/nfse`, `sinete/da` e `sinete/da/nfe`, `/nfce`, `/mdfe`, `/cce`, `sinete/ibs-cbs` e os subpaths, `sinete/ibs-cbs-dados`, `sinete/validators`, `sinete/cert`, `sinete/transport`, `sinete/rejeicoes`, `sinete/schemas/...`, `sinete/core` e `sinete/core/xml`), cada um reexportando o pacote correspondente, e o bin `sinete` com a CLI. As versões dos `@sinete/*` vão fixadas, então cada versão do guarda-chuva é um conjunto testado junto. Sobe de `0.0.0`, o marcador já publicado no npm.
