# `tempo_esgotado`: a operação passou do prazo

A operação não terminou dentro do prazo configurado. A propriedade `timeoutMs` informa esse prazo em milissegundos. O erro é representado por `TimeoutError` (`@sinete/core`), um `SineteError` com `code: 'tempo_esgotado'`. Identifique-o pelo `code`, usando `isSineteError(e, 'tempo_esgotado')`, nunca pela mensagem.

## Causa

No transporte, `timeoutMs` é o prazo total da requisição (60 segundos por padrão), não apenas o tempo de inatividade da conexão. A resposta da SEFAZ (Secretaria da Fazenda) ou do serviço consultado não chegou completa a tempo. O pedido pode ter chegado e sido processado mesmo assim.

## Correção

Na emissão pelo emissor, o envio sem resposta é tratado automaticamente: ele consulta a chave do documento ou, na NFS-e, o identificador da DPS (Declaração de Prestação de Serviços), usando o XML assinado e gravado. Se a consulta indicar reenvio, ele reenvia os mesmos bytes, uma vez. O resultado pode ser `autorizado`, `pendente` ou outro desfecho determinado pela resposta. Se receber `pendente`, retome depois com os mesmos bytes ([retomada](../como-fazer/retomada.md)).

Se você usa o cliente diretamente, chame `resolverEnvioSemResposta(client, assinada)` de `@sinete/nfe`, `@sinete/mdfe` ou `@sinete/nfse`, conforme o documento, antes de qualquer reenvio. `assinada` deve conter o XML assinado original. Siga a ação retornada; reenvie somente se ela for `reenviar`, preservando os mesmos bytes.

Em eventos de NF-e ou MDF-e, como CC-e (Carta de Correção Eletrônica) ou encerramento do MDF-e (Manifesto Eletrônico de Documentos Fiscais), consulte `recuperarEventoRegistrado(client, chave, tpEvento)` do pacote correspondente antes de reenviar. `tpEvento` é o código do tipo de evento. Confira o evento recuperado: quando há vários do mesmo tipo, a função retorna o de maior sequência. Um resultado com `registrado: false` não prova que o evento não existe; examine também `consulta`. No cancelamento de NFS-e (Nota Fiscal de Serviço Eletrônica), o emissor consulta automaticamente os eventos após um envio sem resposta; com o cliente direto, use `consultarEventos`.

## Armadilha

Nunca monte nem assine o documento de novo após um envio sem resposta, antes de esclarecer o resultado: ele pode já estar autorizado. Na NF-e (Nota Fiscal Eletrônica), a remontagem pode alterar o `cNF` (código numérico que compõe a chave de acesso) e o `dhEmi` (data e hora de emissão). Isso pode causar a rejeição 539, duplicidade de NF-e com diferença na chave de acesso, ou gerar uma segunda nota se o número também mudar. Aumentar `timeoutMs` pode diminuir a frequência do erro, mas não elimina a possibilidade de um envio sem resposta.
