---
"@sinete/nfse": minor
"@sinete/emissor": patch
"sinete": minor
---

`recuperarEventoRegistrado(cliente, chave, tpEvento, nSeqEvento = 1, opcoes?)` na NFS-e, como na NF-e e no MDF-e: depois de um pedido de evento sem resposta, ou recusado com E0840, consulta o evento na Sefin e devolve `{ registrado: true, evento }` ou `{ registrado: false }`, sem concluir pelo código do pedido (a E0840 também sai com a substituição vinculada). Falha de rede, resposta fora do contrato e `signal` cancelado lançam, como no `consultarEventos`. A sequência é parâmetro com padrão 1 porque a Sefin só atende a consulta com o tipo e a sequência, e o cancelamento é sempre a 1. Quem usava o `ClienteNfse` sem o emissor não tinha como recuperar um cancelamento cujo retorno se perdeu. O `@sinete/emissor` passa a usar a primitiva no cancelamento da NFS-e, com o mesmo desfecho de antes.
