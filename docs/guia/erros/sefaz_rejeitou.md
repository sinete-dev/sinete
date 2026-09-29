# `sefaz_rejeitou`: a SEFAZ rejeitou e o código pediu o valor autorizado

Lançado só por `unwrapAuthorized`, do `@sinete/core`, quando o desfecho da Secretaria da Fazenda (SEFAZ) é `rejected` e o código pediu o valor de uma autorização. O erro é uma instância de `SefazError` (`@sinete/core`), que estende `SineteError` e tem `code: 'sefaz_rejeitou'`. Decida pelo `code` (`isSineteError(e, 'sefaz_rejeitou')`), nunca pela mensagem.

## Causa

Nas operações que retornam `SefazOutcome`, a rejeição vem como um valor, não como exceção. Isso não impede que falhas de transporte ou respostas inválidas lancem erros. `unwrapAuthorized(desfecho)` é um atalho que devolve o valor autorizado ou lança uma exceção. Com `status: 'rejected'`, lança este erro com `cStat`, o código de status retornado pela SEFAZ, e `xMotivo`, a mensagem oficial que explica o resultado.

A SEFAZ recusou a operação; corrigir a causa e reenviar é possível. Os campos `cStat` e `xMotivo` estão no erro. Para NF-e e NFC-e, o catálogo `sinete/rejeicoes`, consultado por `rejeicaoByCode(cStat)`, traz a origem da regra e, nos códigos com curadoria, a causa provável e a correção. A função retorna `undefined` se o código não estiver catalogado.

## Correção

Trate os quatro desfechos de `SefazOutcome` (`authorized`, `rejected`, `denied` e `pending`) com `matchOutcome`, do `@sinete/core`, ou um `switch` no `status`. Prefira esse tratamento a `unwrapAuthorized` quando o resultado não autorizado for esperado no fluxo.

Pelo emissor, o desfecho já vem normalizado no campo `tipo`: `autorizado`, `denegado`, `recusado`, `pendente` ou `divergente`. Esses desfechos são retornados como valores. Há, porém, erros locais que podem impedir uma nova tentativa: quando a barreira de recusa repetida está ativa e o limite é atingido, o emissor lança `RecusaRepetidaError`, com `code: 'recusa_repetida'`, antes de gravar ou enviar o documento novamente. Essa barreira depende de o store implementar `registrarRecusa` e `recusaRecente` e ajuda a evitar consumo indevido, associado ao código `656`.

## Armadilha

Usar `unwrapAuthorized` num fluxo de emissão transforma um desfecho normal em exceção, e um `catch` genérico pode tentar de novo montando outro documento, sem corrigir a causa da rejeição. Guarde o desfecho e trate o motivo da recusa antes de reenviar, em vez de guardar apenas o erro.
