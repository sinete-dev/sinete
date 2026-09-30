# `ibscbs_aliquota_desconhecida`: a alíquota ainda não foi publicada

O cálculo precisa de uma alíquota do IBS (Imposto sobre Bens e Serviços) ou da CBS (Contribuição sobre Bens e Serviços) que não está disponível nos dados usados pela biblioteca nem foi informada. O erro é representado por `ErroAliquotaDesconhecida` (`@sinete/ibs-cbs`), uma classe derivada de `ErroSinete` com `code: 'ibscbs_aliquota_desconhecida'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'ibscbs_aliquota_desconhecida')` de `sinete/core`, nunca pela mensagem.

## Causa

A data do fato gerador, o evento que dá origem à obrigação tributária, cai num período sem alíquota conhecida pela biblioteca. Na tabela incluída no pacote, a CBS de 2027 e 2028 está marcada como desconhecida: a referência legal registrada é o art. 347 da Lei Complementar 214/2025, que prevê a alíquota de referência fixada pelo Senado reduzida em 0,1 ponto percentual. A partir de 2029, tanto as alíquotas do IBS quanto a da CBS estão marcadas como desconhecidas. Nenhuma alíquota desconhecida vira zero.

O erro também ocorre quando a classificação tributária exige uma alíquota fixa ou uniforme setorial e esse valor não consta no conjunto de dados usado pelo cálculo.

## Correção

Para simular com alíquotas nominais ou de referência, informe os valores e o motivo (`motivo`) com `comAliquotasInformadas` de `sinete/ibs-cbs/aliquotas`. Na NF-e (Nota Fiscal Eletrônica), passe esse provedor em `calculadoraIbsCbs({ rates })`, de `sinete/nfe`, e use a calculadora na opção `ibsCbs` da montagem. Para alíquotas fixas ou uniformes setoriais ausentes, informe os valores e o motivo em `aliquotasInformadas` do item ao usar diretamente o motor de cálculo. O resultado do motor fica marcado como simulado.

Para emitir com as alíquotas oficiais, aguarde a publicação dos valores ausentes e atualize os pacotes para uma versão que os inclua. Na montagem da NF-e, este erro retorna como ocorrência da nota, com `caminho: 'impostos.ibsCbs'` e `origem: 'montagem'`.

## Armadilha

Um teste que depende do relógio do sistema pode passar hoje e começar a falhar quando a data cruzar um período sem alíquota conhecida pela biblioteca. Use `relogioFixo` ou `relogioManual`, de `sinete/core`, para controlar a data nos testes.
