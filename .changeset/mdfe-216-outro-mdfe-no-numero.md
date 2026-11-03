---
'@sinete/mdfe': minor
'sinete': minor
---

`@sinete/mdfe`: `resolverEnvioSemResposta` devolve `divergente` quando a consulta da chave gravada responde 216 ou 600. Antes devolvia `indefinida`.

A SEFAZ procura o MDF-e consultado pelo emitente, série e número (MOC MDF-e 3.00b, Visão Geral, item 4.3.5, regra G04) e responde 216 quando o cMDF da chave difere do registrado (G05) e 600 quando outra parte da chave difere (G06). Nos dois casos o número já tem outro MDF-e e os bytes gravados nunca serão autorizados, a mesma situação da 539 no envio e do 561, 562 e 613 da NF-e. Com `indefinida`, o integrador mandava tentar de novo mais tarde e a retomada repetia a consulta sem chegar a um desfecho. A tabela `cStat` do MDF-e ganha a classe `outroMdfeNoNumero`. No `@sinete/emissor`, a retomada desse caso passa de `pendente` (`consulta-indefinida`) para `divergente`, com o `cStat` da consulta; o `chaveRegistrada` vem quando o `xMotivo` do 600 traz a chave.
