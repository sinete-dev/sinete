# `sefaz_denegou`: uso denegado e o código pediu o valor autorizado

Lançado só por `unwrapAuthorized` do `@sinete/core`, quando o desfecho da Secretaria da Fazenda (SEFAZ) é `status: 'denied'` e o código pediu o valor de uma autorização. O erro é uma instância de `SefazError` (`@sinete/core`), que estende `SineteError`, com `code: 'sefaz_denegou'`. Decida pelo `code` (`isSineteError(e, 'sefaz_denegou')`), nunca pela mensagem.

## Causa

Uma chamada que obtém uma resposta válida da SEFAZ devolve um valor (`SefazOutcome`), e rejeição não é exceção. `unwrapAuthorized(desfecho)` é um atalho que devolve o valor autorizado ou lança uma exceção. Com `status: 'denied'`, lança este erro com `cStat` (código de status da resposta) e `xMotivo` (mensagem oficial da SEFAZ). No uso denegado da Nota Fiscal Eletrônica (NF-e), identificado pelos códigos 110, 301, 302 e 303, o número fica consumido e o documento existe na SEFAZ com o protocolo de denegação (Manual de Orientação do Contribuinte, MOC 7.0, Anexo I, tabela 4.4.3). Guarde-o como denegado, com o protocolo; não reutilize o número.

## Correção

Trate os quatro desfechos de `SefazOutcome` (`authorized`, `rejected`, `denied` e `pending`) com `matchOutcome` do `@sinete/core` ou um `switch` no `status`, em vez de usar `unwrapAuthorized` onde esses resultados são esperados. Pelo `@sinete/emissor`, o desfecho de `emitir` e `retomar` já vem normalizado pelo campo `tipo`: `autorizado`, `denegado`, `recusado`, `pendente`, `divergente` ou `ja-guardado`. O emissor não lança uma exceção por nenhum desses desfechos. `ja-guardado` indica que o integrador já guardou o documento, conforme informado pelo gancho `jaGuardado`.

## Armadilha

Usar `unwrapAuthorized` num fluxo de emissão transforma um desfecho normal em exceção, e o `catch` genérico costuma "tentar de novo" montando outro documento. Guarde o desfecho, incluindo o protocolo de denegação presente em `value`, pois o erro lançado não carrega esse protocolo.
