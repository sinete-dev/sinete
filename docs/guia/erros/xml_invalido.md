# `xml_invalido`: o XML do documento auxiliar é malformado

O `@sinete/da` não conseguiu ler o XML passado ao `danfe`, `danfce`, `damdfe`, `dacce` ou `danfse` (de `@sinete/da/nfse`). O erro também pode ocorrer ao ler um XML de evento informado nas opções, como o de cancelamento. A exceção é um `ErroDa` (`@sinete/da`), que estende `ErroSinete`, com `code: 'xml_invalido'`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'xml_invalido')` de `@sinete/core`, nunca pela mensagem.

## Causa

O texto não é XML bem formado: o arquivo foi truncado, houve um problema de codificação que comprometeu a estrutura ou o XML guardado foi alterado, por exemplo, substituindo `&amp;` por um `&` sem escape. O leitor de XML também recusa declarações `DOCTYPE` e documentos que excedem o limite de profundidade de elementos.

## Correção

Passe a string do XML autorizado sem alterações: use o campo `proc` do resultado da emissão ou o XML guardado originalmente. Para um evento, use o XML do evento registrado, também sem alterações. Se o problema surgiu ao ler o arquivo, confira a codificação usada nessa leitura.

## Armadilha

Consertar o XML apenas para imprimir pode permitir a geração do PDF e esconder o problema no arquivo guardado. Um XML malformado também impede a verificação da assinatura. Mesmo depois de corrigir a estrutura, alterações no conteúdo assinado podem invalidar a assinatura; conseguir gerar o PDF não comprova que ela continua válida.
