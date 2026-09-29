---
'@sinete/emissor': patch
---

O `cancelar` da NFS-e trata a E0840 (Anexo II v1.01: outro evento já vinculado à NFS-e) como o 573 da NF-e: consulta o e101101 com a sequência 1 e, se o cancelamento já estiver registrado (a resposta do primeiro pedido se perdeu), devolve `registrado` com `recuperado: true`, o XML do evento e a E0840 em `bruto`. Sem o evento na consulta, a E0840 continua `recusado`. O código vem da lista `eventoJaRegistrado` da NFS-e no `data/cstat.json`, conferida contra o catálogo do `@sinete/rejeicoes`.
