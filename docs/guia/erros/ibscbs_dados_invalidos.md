# `ibscbs_dados_invalidos`: o bundle de dados do IBS/CBS não confere

O bundle, conjunto de tabelas e manifesto do IBS (Imposto sobre Bens e Serviços) e da CBS (Contribuição sobre Bens e Serviços), não passou na validação de estrutura ou integridade. O erro é um `ErroDadosIbsCbs` (`@sinete/ibs-cbs-dados`), que herda de `ErroSinete` e tem `code: 'ibscbs_dados_invalidos'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'ibscbs_dados_invalidos')` de `sinete/core`, nunca pela mensagem.

## Causa

Bundle sem `manifesto` ou `tabelas`, tabela obrigatória ausente ou que não seja um array, ou `versaoDoFormato` ausente ou não inteiro. O manifesto (`manifesto`) descreve a versão e os dados esperados das tabelas. Em `conferirDataset`, também causam esse erro: manifesto que não lista cada tabela obrigatória exatamente uma vez, hash SHA-256 ou quantidade de registros de uma tabela divergente, ou `sha256DoDataset`, o hash do conjunto, que não confere.

Em `carregarDataset`, o erro também ocorre quando um vínculo aponta para um registro inexistente de `cClassTrib`, o código de classificação tributária.

Uma data inválida passada a `dataset.em(data)`, seja pelo formato diferente de `AAAA-MM-DD` ou por não existir no calendário, gera `ErroDeConfiguracao` com `code: 'config_invalida'`.

## Correção

Use o conjunto de dados incluído no pacote: `datasetEmbarcado()` de `sinete/ibs-cbs-dados/bundled`, ou `await carregarDatasetEmbarcado()` de `sinete/nfe`. Para um bundle externo, execute `await conferirDataset(bundle)` antes de `carregarDataset(bundle)`, ambos de `sinete/ibs-cbs-dados`. `carregarDataset` valida a estrutura e os vínculos, mas não confere os hashes.

Se a verificação falhar, obtenha novamente as tabelas e o manifesto correspondentes à mesma versão dos dados. Garanta que `versaoDoFormato` seja um inteiro compatível com o leitor; um inteiro diferente da versão suportada gera `ibscbs_dados_versao_incompativel`. Nas consultas, use datas existentes no formato `AAAA-MM-DD`.

## Armadilha

Os hashes são calculados sobre uma representação padronizada das tabelas, não sobre os bytes do arquivo baixado. Alterar a indentação do JSON ou a ordem das propriedades dos objetos não invalida os hashes. Compressão sem perda e conversão de codificação que preserve o conteúdo também não os invalidam. Já mudanças nos valores ou na ordem dos registros podem causar divergência. Preserve o conteúdo das tabelas e o manifesto correspondente ao armazenar e servir o bundle.
