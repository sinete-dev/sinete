---
"sinete": patch
---

Os reexports dos subpaths experimentais (`sinete/emissor/perfil`, `sinete/nfe/ibs-cbs`, `sinete/transport/signer`) passam a levar `@experimental` no comentário de módulo, herdado da fonte como pede o ADR 0016 (seção 5), e o README lista os três. O gerador lê a marca do comentário de módulo da fonte, e o `--check` falha se o README divergir.
