---
'@sinete/nfe': minor
---

`BuildNfeOptions.pagamentoIgualTotal`: o `vPag` do único `detPag` passa a ser o `vNF` calculado na mesma montagem, sem montar a nota duas vezes para descobrir o total. Nenhum, mais de um `detPag` ou `tPag` 90 dão a ocorrência nova `pagamento_igual_total`. Serve também no emissor do `@sinete/emissor/nfe`, pela opção `montagem`.
