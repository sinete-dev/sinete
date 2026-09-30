# `ibscbs_aliquotas_invalidas`: tabela de alíquotas malformada

A tabela de alíquotas foi recusada pela validação de `aliquotasOficiais`, de `@sinete/ibs-cbs`. A função lança `ErroDadosDeAliquotas`, um `ErroSinete` com `code: 'ibscbs_aliquotas_invalidas'`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'ibscbs_aliquotas_invalidas')`, de `@sinete/core`, nunca pela mensagem.

## Causa

A tabela apresenta versão de estrutura incompatível (`versaoDoFormato`), data de vigência em formato inválido, referência a uma fonte inexistente, percentual inválido, alíquota de referência com estado desconhecido (`situacao: 'desconhecida'`) e valor diferente de `null`, ou períodos de vigência sobrepostos para o mesmo tributo nas alíquotas de referência ou para o mesmo tributo e ente nas alíquotas próprias de estados e municípios.

Uma sobreposição de alíquotas passada a `comAliquotasInformadas` com tributo inválido, percentual fora do formato aceito ou motivo (`motivo`) ausente, vazio ou composto apenas de espaços lança `ErroDeConfiguracao`, com `code: 'config_invalida'`.

## Correção

Se você fornece uma tabela própria a `aliquotasOficiais`, confira sua estrutura conforme o tipo `TabelaDeAliquotas`. Use `versaoDoFormato: 2`, datas no formato `AAAA-MM-DD` e identificadores de fontes cadastrados em `fontes`. Corrija as vigências sobrepostas e mantenha `aliquota: null` nas alíquotas de referência com `situacao: 'desconhecida'`. Os percentuais devem ser textos de 0 a 100, com ponto como separador decimal e até 4 casas decimais, como `'8.8'`.

Para uma sobreposição com `comAliquotasInformadas`, informe `tributo`, `valor` nesse mesmo formato e `motivo` com o motivo da simulação. Os tributos aceitos são `CBS` (Contribuição sobre Bens e Serviços), `IBSUF` (parcela estadual do Imposto sobre Bens e Serviços) e `IBSMun` (parcela municipal desse imposto). A tabela oficial vem do pacote e é usada por `aliquotasOficiais()` quando você não fornece outra; não edite o JSON do pacote.

## Armadilha

O motivo da sobreposição é obrigatório: a alíquota aplicada por `comAliquotasInformadas` recebe `situacao: 'informada'` e mantém o `motivo` informado. Um cálculo que usa essa alíquota sai marcado como simulado. A ausência do motivo, porém, gera `config_invalida`, e não `ibscbs_aliquotas_invalidas`.
