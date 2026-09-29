# `ibscbs_expressao_invalida`: expressão de cálculo do dataset fora da gramática

Uma expressão de cálculo do dataset (conjunto de dados) do IBS (Imposto sobre Bens e Serviços) e da CBS (Contribuição sobre Bens e Serviços) usa uma variável ou sintaxe que o motor não reconhece, ou resulta em divisão por zero. O erro é uma instância de `ExpressionError` (`@sinete/ibs-cbs`), que estende `SineteError` e tem `code: 'ibscbs_expressao_invalida'`. O campo `details.expression` traz a expressão. Identifique o erro pelo `code`, usando `isSineteError(e, 'ibscbs_expressao_invalida')`, de `@sinete/core`, nunca pelo texto da mensagem.

## Causa

Uma versão nova da Calculadora da RFB (Receita Federal do Brasil) pode trazer uma expressão com variável ou sintaxe que o motor ainda não suporta no dataset (`@sinete/ibs-cbs-dados`). O erro também ocorre quando uma expressão está malformada ou quando seu cálculo encontra um divisor igual a zero. Usar o dataset embarcado de uma versão testada evita incompatibilidades conhecidas entre as expressões e o motor, mas não garante a ausência de divisão por zero.

## Correção

Use o dataset embarcado da versão instalada ou atualize o `@sinete/ibs-cbs` junto com o `@sinete/ibs-cbs-dados`, mantendo versões compatíveis. Se o dataset é carregado de fora com `loadDataset`, de `@sinete/ibs-cbs-dados`, use uma versão compatível com o motor e abra uma issue com a expressão que causou o erro. Se a mensagem indicar divisão por zero, confira também os valores usados no cálculo dessa expressão.

## Armadilha

Não altere a expressão no JSON do dataset à mão: os hashes (resumos usados para verificar a integridade dos dados) deixam de corresponder aos registrados no manifesto, e `verifyDataset`, de `@sinete/ibs-cbs-dados`, rejeita o conjunto de dados. Para dados obtidos fora do pacote, execute `await verifyDataset(bundle)` antes de `loadDataset(bundle)`: o carregamento não verifica os hashes automaticamente.
