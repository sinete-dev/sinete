---
'@sinete/da': minor
---

O `cancelado` do `damdfe` aceita o `procEventoMDFe` do cancelamento (110111), lido pelo schema de eventos do MDF-e: o protocolo e a data do evento vão ao carimbo, como o `procEventoNFe` no `cancelamento` do `danfe`. Evento de outro MDF-e, de outro tipo ou sem retorno registrado (135, 134 ou 136) é `evento_incompativel`. O objeto `{ nProt, dhRegEvento }` e o `true` continuam valendo, com a mesma saída.
