---
"@sinete/validators": minor
"@sinete/nfe": minor
"@sinete/sefaz-sim": minor
"sinete": minor
---

Tabela de CFOP do Portal da NF-e no `@sinete/validators` (`indicadoresCfop`, `TABELA_CFOP`; IT 2023.002 v2.10). Com ela, o `montarNfe` confere antes de assinar o CFOP de devolução fora da devolução (I08-144, rejeição 328) e o CST com destinatário não contribuinte (N12-70, rejeição 508, com as exceções da NT 2023.001 e da NT 2023.003), e o `@sinete/sefaz-sim` recusa os dois casos com o mesmo código.
