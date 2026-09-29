# `ibscbs_dados_versao_incompativel`: o formato do dataset não é o que o código lê

O conjunto de dados (dataset) declara, no campo `manifest.dataSchemaVersion` do bundle, uma versão de formato diferente da constante `DATA_SCHEMA_VERSION` aceita pelo código instalado. O erro é uma instância de `IbsCbsDataError` (`@sinete/ibs-cbs-dados`), que estende `SineteError`, com `code: 'ibscbs_dados_versao_incompativel'`. Identifique-o pelo `code`, usando `isSineteError(e, 'ibscbs_dados_versao_incompativel')`, de `@sinete/core`, nunca pela mensagem.

## Causa

O bundle, que reúne as tabelas e os metadados do dataset, usa um formato mais novo ou mais antigo que o aceito pelo código instalado. Qualquer valor inteiro de `dataSchemaVersion` diferente de `DATA_SCHEMA_VERSION` causa esse erro.

## Correção

Atualize o `@sinete/ibs-cbs-dados` e o `@sinete/ibs-cbs` juntos. O pacote `sinete`, que reúne os demais pacotes, já fixa um conjunto de versões testadas em conjunto. Como alternativa, carregue um bundle cujo `manifest.dataSchemaVersion` seja igual ao `DATA_SCHEMA_VERSION` do código instalado.

## Armadilha

O pacote de dados é versionado pelo mês dos dados (`AAAA.M.patch`), independentemente das versões dos demais pacotes. O número da versão do pacote não identifica o formato dos dados; quem o identifica é o campo `dataSchemaVersion`.
