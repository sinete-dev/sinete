# `ibscbs_regime_nao_suportado`: o motor ainda não calcula este regime

A classificação ou os dados do item pedem um regime que o motor do IBS (Imposto sobre Bens e Serviços) e da CBS (Contribuição sobre Bens e Serviços) ainda não calcula. O campo `detalhes.regime` informa qual. O motor lança `ErroRegimeNaoSuportado` (`@sinete/ibs-cbs`), um `ErroSinete` com `code: 'ibscbs_regime_nao_suportado'`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'ibscbs_regime_nao_suportado')` de `@sinete/core`, nunca pela mensagem.

Na calculadora padrão de NF-e (Nota Fiscal Eletrônica), esse erro é convertido em uma ocorrência de validação do item, com o mesmo `code`.

## Causa

Os valores possíveis de `regime` são `monofasia` (tributação concentrada em uma etapa da cadeia), `imposto-seletivo`, `aliquotas-combinadas` (combinação de alíquota percentual com valor por unidade de medida) e `ajuste` (tratamento com ajuste quando o CST, Código de Situação Tributária, exige o grupo `gIBSCBS`). O motor nunca devolve valor zerado no lugar de um cálculo que não sabe fazer.

## Correção

Calcule o grupo de tributos em outro sistema ou em uma implementação própria e informe-o pronto no item (`impostos.ibsCbs.grupo` na NF-e). Outra opção é substituir a calculadora em `montagem.ibsCbs` do emissor por uma implementação da interface `CalculadoraIbsCbs`, exportada por `@sinete/nfe`.

## Armadilha

Não force outro CST só para o motor calcular: o valor sai, mas a classificação fica errada no documento.
