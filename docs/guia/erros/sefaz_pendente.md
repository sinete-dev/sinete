# `sefaz_pendente`: o documento ainda está em processamento e o código pediu o valor autorizado

Lançado só por `exigirAutorizado`, do `@sinete/core`, quando o desfecho da SEFAZ (Secretaria da Fazenda) é `pendente` e o código pediu o valor autorizado. O erro é uma instância de `ErroSefaz` (`@sinete/core`), que estende `ErroSinete`, com `code: 'sefaz_pendente'`. Decida pelo `code` (`ehErroSinete(e, 'sefaz_pendente')`), nunca pela mensagem.

## Causa

Nas operações que retornam `ResultadoSefaz`, o desfecho da resposta da SEFAZ é um valor, e uma rejeição não é exceção. Falhas que impedem obter ou interpretar a resposta ainda podem lançar erros. `exigirAutorizado(desfecho)` é um atalho que devolve o valor autorizado ou lança uma exceção. Com `tipo: 'pendente'`, lança este erro com `cStat` (código de status da resposta) e `xMotivo` (mensagem oficial que descreve o status).

Na NF-e (Nota Fiscal Eletrônica) com processamento assíncrono, o código 103 indica que o lote foi recebido, e o 105 indica que continua em processamento. Consulte o recibo do lote ou a chave de acesso depois. A pendência não invalida os bytes enviados nem confirma a autorização: preserve o documento assinado enquanto aguarda o desfecho.

## Correção

Trate os quatro desfechos de `ResultadoSefaz` com `tratarResultado`, do `@sinete/core`, ou um `switch` no `tipo`: `autorizado`, `recusado`, `denegado` e `pendente`. Evite `exigirAutorizado` quando um resultado diferente de autorização faz parte do fluxo esperado.

Pelo `@sinete/emissor`, os métodos `emitir` e `retomar` já devolvem o desfecho normalizado pelo campo `tipo`: `autorizado`, `denegado`, `recusado`, `pendente`, `divergente` ou `ja-guardado`. O último indica que o integrador já guardou o documento, conforme o gancho `jaGuardado`. Esses desfechos não provocam exceções por si só. Para um documento pendente, preserve a gravação dos bytes assinados e use `retomar` para continuar depois.

## Armadilha

Usar `exigirAutorizado` num fluxo de emissão transforma um desfecho normal em exceção, e um `catch` genérico pode tentar novamente montando outro documento. Guarde o desfecho original: o erro não preserva os campos opcionais `referencia` (referência para consulta, como o número do recibo) e `aguardarMs` (espera mínima sugerida, em milissegundos), que podem ser necessários para continuar o processamento.
