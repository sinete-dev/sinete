---
'@sinete/sefaz-sim': minor
---

Ativação da SVC por UF (NT 2013.007 v1.03): `setAtivacaoSvc(ativacao, uf?)` com `ativa` (107 no status da SVC), `desativando` até uma hora (113, com a data e a hora no `xMotivo`, e a autorização ainda aceita) ou `inativa` (114 no status e na autorização, regras C03.2, GB02.2 e K05.1). Com a SVC desligada, o simulador responde 114 em vez de HTTP 503, e o retorno e a consulta da SVC continuam atendendo. `setContingencia` segue ligando a UF em 108 com a SVC ativada, e desfaz o ajuste por UF.
