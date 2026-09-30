# `serializacao_invalida`: o valor não serializa no tipo do XSD

O serializador canônico do `@sinete/schemas` recebeu um valor incompatível com a estrutura esperada pelo XSD, o arquivo que define os tipos e a estrutura do XML. Ele lança `SerializeError`, exportado por `@sinete/schemas`, que é um `ErroSinete` com `code: 'serializacao_invalida'`. A mensagem começa pelo caminho do campo, também disponível em `path`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'serializacao_invalida')` de `@sinete/core`, nunca pela mensagem.

## Causa

Um campo simples recebeu um valor que não é texto, ou um grupo recebeu um valor que não é um objeto, como `null`. Os valores simples do leiaute devem ser strings no formato esperado pelo XSD, inclusive decimais: `'123.40'`. O erro também ocorre quando `$any`, usado para inserir XML bruto, não é um array de strings, ou quando o objeto combina campos de alternativas mutuamente exclusivas de um `choice` do XSD.

Usar um grupo de outro pacote de liberação (PL), que reúne os schemas de uma versão do leiaute, pode causar incompatibilidades. O serializador, porém, não verifica a origem do objeto nem faz a validação completa do XSD.

## Correção

Monte os documentos pela API correspondente: `buildNfe` de `@sinete/nfe`, `buildMdfe` de `@sinete/mdfe` ou `buildDps` de `@sinete/nfse`. Essas funções convertem os dados de entrada para os tipos do schema. Ao usar o serializador diretamente, passe os valores simples como texto já formatado e os grupos como objetos compatíveis com o schema escolhido. Respeite as alternativas exclusivas e use um array de strings para `$any`.

## Armadilha

Converter número para texto com `String(1.1 + 2.2)` produz `3.3000000000000003`. Para calcular, use o `Decimal` exportado por `@sinete/nfe` ou `@sinete/mdfe`, partindo de valores exatos, como strings. Para um valor já calculado, use texto no formato exigido pelo campo. O serializador direto exige strings mesmo quando o cálculo foi feito com `Decimal`; `@sinete/nfse` não exporta essa classe.
