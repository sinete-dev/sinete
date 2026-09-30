# `cancelado`: o envio foi cancelado pelo chamador

O envio foi interrompido pelo `AbortSignal`, o sinal de cancelamento passado pelo chamador. O erro é um `TransportError` (`@sinete/transport`), que herda de `ErroSinete` e tem `code: 'cancelado'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'cancelado')` de `@sinete/core`, nunca pela mensagem.

## Causa

O seu código acionou o sinal de cancelamento da requisição, por exemplo, ao atingir um limite de tempo próprio, fechar a tela ou preparar o desligamento do processo.

## Correção

Se o cancelamento ocorreu depois de o pedido sair, trate como envio sem resposta: o pedido pode ter sido processado. O emissor de `@sinete/emissor` trata esse erro como envio sem resposta porque o documento pode ter chegado ao serviço autorizador. Antes de qualquer reenvio, ele consulta a chave do documento ou, no caso da NFS-e (Nota Fiscal de Serviço eletrônica), o identificador da DPS (Declaração de Prestação de Serviços). Essa recuperação usa o documento gravado antes do envio e preserva os mesmos bytes para um eventual reenvio.

## Armadilha

Interromper a requisição não desfaz o que a SEFAZ (Secretaria da Fazenda) ou o serviço autorizador da NFS-e já recebeu. O código `cancelado` indica o cancelamento do envio, não o cancelamento fiscal do documento. Não monte outro documento só porque a requisição foi cancelada.
