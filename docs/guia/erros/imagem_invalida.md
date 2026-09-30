# `imagem_invalida`: o logotipo não é PNG nem JPEG legível

O logotipo passado em `logo` não pôde ser lido. O erro lançado é um `ErroDa` (`@sinete/da`), que herda de `ErroSinete` e tem `code: 'imagem_invalida'`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'imagem_invalida')` de `@sinete/core`, nunca pelo texto da mensagem.

## Causa

O arquivo não é PNG nem JPEG, ou está corrompido.

## Correção

Converta o logotipo para PNG ou JPEG e passe os bytes do arquivo em `logo`, como `Uint8Array`. Se o arquivo estiver corrompido, gere uma nova imagem válida.

PNG é lido em todas as profundidades de bits e tipos de cor previstos pelo formato, com suporte a paleta, transparência e entrelaçamento. JPEG é incorporado ao PDF sem decodificação.

## Armadilha

SVG e WebP não são aceitos. Converta uma vez e guarde o PNG, em vez de converter a cada impressão.
