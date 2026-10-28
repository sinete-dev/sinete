---
'@sinete/nfe': patch
'@sinete/mdfe': patch
'@sinete/transport': minor
'sinete': minor
---

A mensagem real da SEFAZ não se perde mais:

- `@sinete/nfe`: evento rejeitado (CC-e, cancelamento, manifestação) volta como rejeição com o `cStat` e o `xMotivo` da SEFAZ, mesmo quando o `retEvento` da rejeição não repete chave, tipo e sequência (a SEFAZ-MT faz isso). Antes virava `resposta_invalida` "retEvento de outro evento". A conferência continua valendo para o evento registrado.
- `@sinete/nfe`: rejeição da consulta do recibo volta como rejeição antes de conferir o `nRec`, que pode vir vazio nela.
- `@sinete/nfe`: a CC-e manda `descEvento` e `xCondUso` na forma sem acento do enum do schema e110110. A SEFAZ-MT rejeita com 402 qualquer caractere acentuado no evento; a forma sem acento vale em todas as UFs.
- `@sinete/nfe` e `@sinete/mdfe`: a resposta fora do formato esperado (outro retorno, sem `cStat` no lugar, corpo que não é XML) leva no `ErroRespostaInvalida` o `cStat` e o `xMotivo` que vierem nela, na mensagem e nos `detalhes`.
- `@sinete/transport`: `lerMotivoDaSefaz(corpo)` lê o primeiro `cStat` e o `xMotivo` de uma resposta em qualquer elemento e namespace, mesmo sem XML bem formado.
