# `ibscbs_dados_versao_incompativel`: o formato do dataset não é o que o código lê

O conjunto de dados (dataset) declara, no campo `manifesto.versaoDoFormato` do bundle, uma versão de formato diferente da constante `VERSAO_DO_FORMATO_DOS_DADOS` aceita pelo código instalado. O erro é uma instância de `ErroDadosIbsCbs` (`@sinete/ibs-cbs-dados`), que estende `ErroSinete`, com `code: 'ibscbs_dados_versao_incompativel'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'ibscbs_dados_versao_incompativel')`, de `@sinete/core`, nunca pela mensagem.

## Causa

O bundle, que reúne as tabelas e os metadados do dataset, usa um formato mais novo ou mais antigo que o aceito pelo código instalado. Qualquer valor inteiro de `versaoDoFormato` diferente de `VERSAO_DO_FORMATO_DOS_DADOS` causa esse erro.

## Correção

Atualize o `@sinete/ibs-cbs-dados` e o `@sinete/ibs-cbs` juntos. O pacote `sinete`, que reúne os demais pacotes, já fixa um conjunto de versões testadas em conjunto. Como alternativa, carregue um bundle cujo `manifesto.versaoDoFormato` seja igual ao `VERSAO_DO_FORMATO_DOS_DADOS` do código instalado.

## Armadilha

O pacote de dados é versionado pelo mês dos dados (`AAAA.M.patch`), independentemente das versões dos demais pacotes. O número da versão do pacote não identifica o formato dos dados; quem o identifica é o campo `versaoDoFormato`.
