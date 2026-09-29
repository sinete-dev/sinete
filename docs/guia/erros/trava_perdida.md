# `trava_perdida`: a trava venceu antes de o emissor terminar

O emissor (ou o store, que armazena as transmissões) percebeu que a trava do documento não está mais em vigor: ela venceu e pode ter sido assumida por outro processo. A trava garante que só um processo por vez possa trabalhar na transmissão daquele documento. O erro é um `TravaPerdidaError` (`@sinete/emissor`), que estende `SineteError` e tem `code: 'trava_perdida'`. Identifique-o pelo `code`, usando `isSineteError(e, 'trava_perdida')` de `@sinete/core`, nunca pela mensagem.

## Causa

A operação demorou mais que o prazo da trava sem conseguir renová-la, por exemplo, por uma pausa no processo, lentidão no banco ou um prazo curto demais. O erro pode ocorrer mesmo que nenhum outro processo tenha assumido a trava. O emissor confere a trava antes de guardar o desfecho e antes de devolver um desfecho que mantém os bytes do documento assinado. Se detectar a perda, não guarda o desfecho nem chama `aoDecidir`, a função do integrador responsável por guardá-lo. Um `TransmissaoStore` também lança este erro em `gravar` e `descartar` sem a trava em vigor, sem executar a gravação ou o descarte.

## Correção

Não desfaça a transmissão por causa deste erro. Se os bytes já estavam gravados, esta execução os preserva para que quem assumir a trava possa retomar a transmissão e decidir o desfecho. Se o erro ocorreu em `gravar`, essa chamada não gravou os bytes. Trate a perda da trava como "em processamento", sem concluir que a emissão falhou. Se acontece com frequência, aumente `trava.prazoMs` do emissor e confira a latência do banco. Por padrão, a renovação ocorre a cada terço do prazo; `trava.renovarACadaMs` permite ajustar esse intervalo, e o valor `0` desativa a renovação periódica.

## Armadilha

Não tente gravar o desfecho "mesmo assim" com o resultado que você tem em mãos: outro processo pode ter assumido a trava e chegado a outro desfecho. Cabe a quem estiver com a trava em vigor decidir. Na retomada automática, este erro conta como `ocupada`, sem incrementar o contador de tentativas.
