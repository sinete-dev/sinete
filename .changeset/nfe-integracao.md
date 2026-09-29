---
'@sinete/nfe': minor
---

Documento modelo 65 usa a tabela da NFC-e do `@sinete/transport` (a opção `nfceEndpoint` passa a sobrepor, e sem ela a operação não é mais recusada), sempre no autorizador normal, também com o cliente em contingência SVC. O cancelamento por substituição monta e valida o `detEvento` pelo schema oficial do e110112. A inutilização recusa emitente CPF e a série 910 a 969 antes de enviar (NT 2018.001 v1.10, itens 6.1 e 6.2), em vez de mandar `000` + CPF no campo CNPJ.
