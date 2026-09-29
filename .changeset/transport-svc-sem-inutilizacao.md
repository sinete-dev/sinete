---
'@sinete/transport': minor
---

A SVC não oferece a inutilização (NT 2013.007 v1.03, item 04.5): `nfeEndpoint` com `contingencia: 'svc'` recusa `NfeInutilizacao` com `servico_nao_oferecido` também na SVC-AN, que o portal lista no quadro dela, com a NT como `source` do erro. Os dados registram a exclusão em `nfe.svcSemServicos`, e o builder a aplica sobre a tabela do portal.
