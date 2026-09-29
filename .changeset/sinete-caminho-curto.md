---
'sinete': minor
---

Novo `sinete/emissor` com os subpaths `sinete/emissor/nfe`, `/mdfe`, `/nfse`, `/memoria` e `/contrato`, que reexportam o `@sinete/emissor`; os emissores de poucas linhas (`createNfeEmissor`, `createMdfeEmissor`, `createNfseEmissor`) estão lá, não em `sinete/nfe`, `sinete/mdfe` e `sinete/nfse`. Acompanha as renomeações do ADR 0009 nos clientes.
