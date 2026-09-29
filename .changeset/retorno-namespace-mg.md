---
'@sinete/nfe': patch
---

A consulta cadastro da SEFAZ-MG volta a funcionar. A MG devolve o `retConsCad` sem o namespace da NF-e (ele herda o do WSDL) e declara o namespace só nos filhos; o cliente recusava a resposta com `resposta_invalida`. Agora aceita o elemento de retorno fora do namespace quando todos os filhos estão no da NF-e, e registra `nfe.soap.retorno_fora_do_namespace` no log.
