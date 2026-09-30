# `ibscbs_aliquotas_invalidas`: tabela de alíquotas malformada

A tabela de alíquotas foi recusada pela validação de `officialRates`, de `@sinete/ibs-cbs`. A função lança `RatesDataError`, um `ErroSinete` com `code: 'ibscbs_aliquotas_invalidas'`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'ibscbs_aliquotas_invalidas')`, de `@sinete/core`, nunca pela mensagem.

## Causa

A tabela apresenta versão de estrutura incompatível (`schemaVersion`), data de vigência em formato inválido, referência a uma fonte inexistente, percentual inválido, alíquota de referência com estado desconhecido (`status: 'unknown'`) e valor diferente de `null`, ou períodos de vigência sobrepostos para o mesmo tributo nas alíquotas de referência ou para o mesmo tributo e ente nas alíquotas próprias de estados e municípios.

Uma sobreposição de alíquotas passada a `withOverrides` com tributo inválido, percentual fora do formato aceito ou motivo (`reason`) ausente, vazio ou composto apenas de espaços lança `ErroDeConfiguracao`, com `code: 'config_invalida'`.

## Correção

Se você fornece uma tabela própria a `officialRates`, confira sua estrutura conforme o tipo `RatesTable`. Use `schemaVersion: 1`, datas no formato `AAAA-MM-DD` e identificadores de fontes cadastrados em `sources`. Corrija as vigências sobrepostas e mantenha `rate: null` nas alíquotas de referência com `status: 'unknown'`. Os percentuais devem ser textos de 0 a 100, com ponto como separador decimal e até 4 casas decimais, como `'8.8'`.

Para uma sobreposição com `withOverrides`, informe `tributo`, `value` nesse mesmo formato e `reason` com o motivo da simulação. Os tributos aceitos são `CBS` (Contribuição sobre Bens e Serviços), `IBSUF` (parcela estadual do Imposto sobre Bens e Serviços) e `IBSMun` (parcela municipal desse imposto). A tabela oficial vem do pacote e é usada por `officialRates()` quando você não fornece outra; não edite o JSON do pacote.

## Armadilha

O motivo da sobreposição é obrigatório: a alíquota aplicada por `withOverrides` recebe `status: 'user-provided'` e mantém o `reason` informado. Um cálculo que usa essa alíquota sai marcado como simulado. A ausência do motivo, porém, gera `config_invalida`, e não `ibscbs_aliquotas_invalidas`.
