# `sefaz_denegou`: uso denegado e o código pediu o valor autorizado

Lançado só por `exigirAutorizado` do `@sinete/core`, quando o desfecho da Secretaria da Fazenda (SEFAZ) é `tipo: 'denegado'` e o código pediu o valor de uma autorização. O erro é uma instância de `ErroSefaz` (`@sinete/core`), que estende `ErroSinete`, com `code: 'sefaz_denegou'`. Decida pelo `code` (`ehErroSinete(e, 'sefaz_denegou')`), nunca pela mensagem.

## Causa

Uma chamada que obtém uma resposta válida da SEFAZ devolve um valor (`ResultadoSefaz`), e rejeição não é exceção. `exigirAutorizado(desfecho)` é um atalho que devolve o valor autorizado ou lança uma exceção. Com `tipo: 'denegado'`, lança este erro com `cStat` (código de status da resposta) e `xMotivo` (mensagem oficial da SEFAZ). No uso denegado da Nota Fiscal Eletrônica (NF-e), identificado pelos códigos 110, 301, 302 e 303, o número fica consumido e o documento existe na SEFAZ com o protocolo de denegação (Manual de Orientação do Contribuinte, MOC 7.0, Anexo I, tabela 4.4.3). Guarde-o como denegado, com o protocolo; não reutilize o número.

## Correção

Trate os quatro desfechos de `ResultadoSefaz` (`autorizado`, `recusado`, `denegado` e `pendente`) com `tratarResultado` do `@sinete/core` ou um `switch` no `tipo`, em vez de usar `exigirAutorizado` onde esses resultados são esperados. Pelo `@sinete/emissor`, o desfecho de `emitir` e `retomar` já vem normalizado pelo campo `tipo`: `autorizado`, `denegado`, `recusado`, `pendente`, `divergente` ou `ja-guardado`. O emissor não lança uma exceção por nenhum desses desfechos. `ja-guardado` indica que o integrador já guardou o documento, conforme informado pelo gancho `jaGuardado`.

## Armadilha

Usar `exigirAutorizado` num fluxo de emissão transforma um desfecho normal em exceção, e o `catch` genérico costuma "tentar de novo" montando outro documento. Guarde o desfecho, incluindo o protocolo de denegação presente em `valor`, pois o erro lançado não carrega esse protocolo.
