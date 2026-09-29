# `ibscbs_classificacao_invalida`: a classificação do IBS/CBS não é aceita pelos dados oficiais

O motor de cálculo do Imposto sobre Bens e Serviços (IBS) e da Contribuição sobre Bens e Serviços (CBS) recusou a classificação informada: Código de Situação Tributária (CST), código de classificação tributária (`cClassTrib`), crédito presumido ou grupos de informações tributárias. O erro é uma instância de `ClassificationError` (`@sinete/ibs-cbs`), que herda de `SineteError` e tem `code: 'ibscbs_classificacao_invalida'`. O campo `details.reason` informa o motivo; `details.item`, quando presente, informa o número do item (`nItem`). Trate o erro pelo `code`, usando `isSineteError(e, 'ibscbs_classificacao_invalida')` de `@sinete/core`, nunca pela mensagem.

## Causa

Os motivos possíveis em `details.reason` são:

- `cst_inexistente`: CST inexistente ou fora de vigência na data do fato gerador, quando ocorre a operação que dá origem ao tributo.
- `cclasstrib_inexistente`: `cClassTrib` inexistente ou fora de vigência nessa data.
- `cclasstrib_fora_da_cst`: o `cClassTrib` não pertence à CST informada.
- `nao_habilitado_no_dfe`: o `cClassTrib` não é permitido no modelo de documento fiscal eletrônico usado.
- `tratamento_ausente`: falta o tratamento tributário nos dados usados pelo motor.
- `tributacao_regular_obrigatoria`: falta o grupo de tributação regular (`gTribRegular`), exigido pela classificação.
- `tributacao_regular_invalida`: a classificação informada para o `gTribRegular` não pode ser usada como tributação regular.
- `grupo_obrigatorio`: falta um grupo de informações exigido.
- `grupo_vedado`: foi informado um grupo não permitido.
- `grupos_exclusivos`: foram informados grupos que não podem ser usados juntos.
- `ccredpres_inexistente`: o código de crédito presumido (`cCredPres`) não existe nos dados consultados.
- `ccredpres_fora_de_vigencia`: o crédito presumido não está vigente na data do fato gerador.
- `dados_incompletos`: faltam dados necessários ao cálculo.
- `entrada_invalida`: a entrada contém um valor ou formato inválido.

As regras vêm dos dados oficiais distribuídos em `@sinete/ibs-cbs-dados`, provenientes da Calculadora da Receita Federal do Brasil (RFB) e do Informe Técnico (IT) 2025.002. O motor consulta esses dados conforme a data do fato gerador.

## Correção

Use `details.reason` para corrigir a classificação no cadastro do item ou os dados enviados ao cálculo. Para encontrar os códigos válidos a partir de fatos do negócio, como a Nomenclatura Comum do Mercosul (NCM), que identifica a mercadoria, a natureza da operação e os participantes envolvidos, use `determine` (`sinete/nfe/ibs-cbs` ou `sinete/ibs-cbs/determinar`). O resultado inclui os candidatos e o motivo de cada exclusão. Veja [como informar o IBS e a CBS](../como-fazer/ibs-cbs.md).

Na montagem da Nota Fiscal eletrônica (NF-e), este erro é convertido em uma ocorrência de validação no caminho do item, com `origem: 'entrada'`. Quando o erro não informa o número do item, a ocorrência é associada ao primeiro item da solicitação de cálculo.

## Armadilha

A vigência conta: um `cClassTrib` válido hoje pode não valer na data do fato gerador de uma nota antiga, e o contrário também pode ocorrer. Informe o relógio correto em `TimeContext.fatoGerador`, o campo que fornece esse instante ao motor, em vez de trocar o código apenas para contornar o erro.
