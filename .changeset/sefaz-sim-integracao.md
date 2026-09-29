---
'@sinete/sefaz-sim': minor
---

Novo `redirectToSim(transport, baseUrl)`: envolve um `Transport` e manda ao simulador os pedidos que um cliente de documento resolveu pelos dados de endpoints (NF-e e NFC-e), trocando só a URL pelo caminho do autorizador simulado (`simAutorizadorOf`), e recusa pedido sem endpoint. O 110112 passa a ser validado pelo e110112 oficial (só `tpAutor` 1; outro autor é 493), e a inutilização ganha a regra I02a da NT 2018.001 (266 para série 910 a 969).
