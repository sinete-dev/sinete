---
'@sinete/sefaz-sim': patch
---

A consulta cadastro do MT no simulador segue o MT de verdade: exige `nfeDadosMsg` dentro de `consultaCadastro` e responde com `consultaCadastroResult` dentro de `nfeResultMsg`. As outras UFs aceitam as duas formas e respondem na forma recebida.
