---
'@sinete/nfe': minor
---

Porta do IBS/CBS: `IbsCbsItemRequest` leva `vICMSUFDest` e `vFCPUFDest` (ICMS e FCP de partilha para a UF de destino, zero sem o grupo), para a função `base` da calculadora deduzi-los sem que quem emite os passe por fora. A classificação do item (`ClassificacaoIbsCbs`) e o pedido aceitam `gTribRegular: { CSTReg, cClassTribReg }`, que a calculadora padrão passa ao motor: os cClassTrib que exigem a tributação regular (550001 e afins) deixam de precisar do grupo pronto.

Quebra: quem monta um `IbsCbsItemRequest` à mão (dublê de teste de uma calculadora) precisa dos dois campos novos.
