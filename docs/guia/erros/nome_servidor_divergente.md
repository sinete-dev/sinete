# `nome_servidor_divergente`: o certificado do servidor é de outro host

O certificado apresentado pelo servidor não é válido para o host solicitado, isto é, o nome ou endereço IP do servidor na URL. O transporte lança um `TransportError` de `@sinete/transport`, que é um `SineteError` com `code: 'nome_servidor_divergente'`. Trate o erro pelo `code`, usando `isSineteError(e, 'nome_servidor_divergente')` de `@sinete/core`, nunca pelo texto da mensagem.

## Causa

O DNS pode estar apontando para outro servidor, um proxy pode estar apresentando um certificado incompatível, ou a URL do serviço pode ter sido escrita à mão com o host errado.

## Correção

Use os endereços dos serviços (endpoints) fornecidos por `@sinete/transport`, que o emissor e os clientes já usam por padrão, em vez de escrever uma URL fixa. Confira o DNS e o proxy da rede.

## Armadilha

Não desative a verificação do nome do servidor para aceitar o certificado de outro host. Essa verificação protege a conexão contra um servidor que se passa pelo destino solicitado.
