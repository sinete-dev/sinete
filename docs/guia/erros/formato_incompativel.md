# `formato_incompativel`: o formato pedido não se aplica ao modelo

O `formato` pedido à função `danfe` (`@sinete/da/nfe`) não se aplica ao modelo da nota. O erro também ocorre ao passar uma nota de outro modelo à função `danfce` (`@sinete/da/nfce`), exclusiva do modelo 65. É um `DanfeError` de `@sinete/da`, que estende `ErroSinete` e tem `code: 'formato_incompativel'`. Identifique o erro pelo `code`, com `ehErroSinete(e, 'formato_incompativel')` de `@sinete/core`, nunca pela mensagem.

## Causa

Um formato do DANFE, documento auxiliar da Nota Fiscal Eletrônica (NF-e, modelo 55), foi pedido para uma Nota Fiscal de Consumidor Eletrônica (NFC-e, modelo 65). Isso ocorre com `retrato`, `paisagem`, `simplificado`, `etiqueta` ou `simplificado-tipo2`. O erro também ocorre no sentido inverso: pedir `formato: 'nfce'`, que gera o documento auxiliar da NFC-e (DANFC-e), para uma NF-e, ou passar uma NF-e à função `danfce`.

## Correção

Na chamada a `danfe`, deixe o `formato` de fora: o modelo 65 sai como DANFC-e, e o 55 segue o `tpImp`, campo do XML que indica o tipo de impressão. Para o modelo 55, `tpImp` igual a `2` seleciona `paisagem`, `3` seleciona `simplificado` e `6` seleciona `simplificado-tipo2`; os demais valores selecionam `retrato`. Informe `formato` só para escolher explicitamente um formato que se aplica ao modelo.

Se estiver passando uma NF-e à função `danfce`, use `danfe` de `@sinete/da/nfe`.

## Armadilha

O `tpImp` da nota é uma escolha de quem emite e fica registrado no XML. A opção `formato` permite gerar o documento auxiliar em outro formato, sem alterar esse campo. Essa diferença entre o tipo de impressão registrado e o formato impresso pode confundir quem confere o documento.
