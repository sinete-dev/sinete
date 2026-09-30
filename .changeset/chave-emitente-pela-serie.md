---
'@sinete/validators': patch
---

`lerChaveAcesso` decide pela série quando as 14 posições do emitente formam ao mesmo tempo um CNPJ válido e `000` seguido de um CPF válido (cerca de 1,4% dos CPFs): nas séries de pessoa física (910 a 969) devolve só o `cpf`, nas de CNPJ só o `cnpj`. Antes devolvia os dois, e o cliente da NF-e tomava o CNPJ como autor dos eventos do emitente, recusando o cancelamento e a CC-e de um produtor pessoa física com `autor_difere_do_emitente` (P12-44).
