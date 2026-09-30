# `evento_incompativel`: o evento não é da nota ou não é o esperado

O evento informado, como um cancelamento ou uma Carta de Correção Eletrônica (CC-e), não corresponde ao documento ou ao tipo esperado. O erro também ocorre quando são solicitadas marcas de cancelamento e substituição ao mesmo tempo para uma Nota Fiscal de Serviço Eletrônica (NFS-e). É lançado como `DanfeError`, de `@sinete/da`, que estende `ErroSinete` e tem `code: 'evento_incompativel'`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'evento_incompativel')`, de `@sinete/core`, nunca pela mensagem.

## Causa

Na Nota Fiscal Eletrônica (NF-e) e na Nota Fiscal de Consumidor Eletrônica (NFC-e), o cancelamento informado pertence a outra chave de acesso, tem um tipo diferente de `110111` ou `110112`, ou não tem retorno com `cStat`, o código de status da resposta, igual a `135`, `136` ou `155`. Esses são os códigos aceitos para considerar o cancelamento registrado.

Na CC-e, o evento tem um tipo diferente de `110110` ou pertence a outra chave de acesso quando a NF-e é informada para conferência. A geração do documento auxiliar da CC-e não exige retorno de evento registrado.

No Manifesto Eletrônico de Documentos Fiscais (MDF-e), o cancelamento pertence a outra chave, tem um tipo diferente de `110111` ou não tem retorno com `cStat` igual a `135`, `134` ou `136`. O erro também ocorre se a chave, o tipo ou o número de sequência do retorno não corresponderem aos do evento enviado.

Na NFS-e Nacional, o evento pertence a outra chave ou não é aceito para a marca solicitada. A opção `cancelamento` aceita `e101101`, `e105104` e `e305101`; a opção `substituicao` aceita `e105102`. Ativar as duas marcas ao mesmo tempo também causa o erro, pois a substituição já representa um cancelamento.

O campo `detalhes` varia conforme a causa: pode trazer as chaves envolvidas, o tipo recebido e os tipos esperados, o `cStat` ou os dados do retorno que não correspondem ao evento.

## Correção

Passe o XML do evento registrado para o mesmo documento. No resultado de `cancelar` do emissor com desfecho `registrado`, esse XML está em `procEvento`: ele contém um `procEventoNFe` para NF-e ou NFC-e, um `procEventoMDFe` para MDF-e ou um `evento` para NFS-e Nacional. Para a CC-e, use o `procEventoNFe` da carta de correção e, se informar a NF-e, confira se a chave é a mesma.

Na geração do documento auxiliar da NFS-e, informe apenas a opção correspondente ao evento: `cancelamento` ou `substituicao`. O método `pdfCancelado(nfse, evento)` do emissor de NFS-e escolhe a opção conforme o tipo do evento.

Se `pdfCancelado` falhar por incompatibilidade do evento, corrija o XML informado antes de tentar gerar novamente. Decida explicitamente se mantém o PDF antigo, considerando que ele pode não representar a situação atual do documento.

## Armadilha

Não use `cancelamento: true` apenas para fazer o PDF parecer correto quando o evento informado falhar na validação. Na geração dos documentos auxiliares de NF-e e NFC-e, essa opção aplica o carimbo sem protocolo; na NFS-e, ativa a marca sem conferir um XML de evento. Embora a opção seja aceita nessas APIs, ela não comprova o cancelamento nem substitui o armazenamento do evento registrado.
