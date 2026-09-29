---
'@sinete/emissor': patch
---

O `cancelar` da NFS-e, depois de um pedido sem resposta, consulta o evento com o tipo 101101 e a sequência 1. Antes consultava só pelo tipo, a Sefin real respondia 404 e o emissor devolvia `pendente` mesmo com o cancelamento registrado.
