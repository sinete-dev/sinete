# `conexao_recusada`: o servidor fechou ou recusou a conexão

A conexão foi recusada ou fechada pelo servidor, antes ou depois do envio da requisição. O erro é uma instância de `ErroTransporte` (`@sinete/transport`), que estende `ErroSinete`, com `code: 'conexao_recusada'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'conexao_recusada')` de `@sinete/core`, nunca pela mensagem.

## Causa

O serviço que autoriza o documento pode estar fora do ar, um balanceador pode ter encerrado a conexão ou pode ter ocorrido uma interrupção abrupta da conexão TCP depois da requisição. Na SEFAZ (Secretaria da Fazenda), essa interrupção pode indicar falta de apresentação do certificado de cliente. O pedido pode ter chegado e sido processado mesmo sem uma resposta.

No Bun, quando o servidor negocia TLS 1.3, uma recusa do certificado de cliente também aparece como `conexao_recusada`. Nessa versão do protocolo o servidor confere o certificado depois que o cliente já enviou a requisição, e o Bun não entrega o alerta, só o fechamento da conexão. No Node e no Deno o mesmo caso sai como `certificado_expirado`, `certificado_revogado` ou `certificado_recusado`, com o alerta em `detalhes.alerta`.

## Correção

No emissor, essa falha durante a autorização é tratada como envio sem resposta, pois o documento pode ter chegado ao serviço autorizador. Antes de qualquer reenvio, ele usa o XML assinado já gravado para consultar a situação do documento: pela chave de acesso na NF-e, na NFC-e e no MDF-e; pelo identificador da DPS (Declaração de Prestação de Serviços) na NFS-e Nacional.

Com o cliente direto, use `resolverEnvioSemResposta` do pacote correspondente (`@sinete/nfe` para NF-e e NFC-e, `@sinete/mdfe` para MDF-e ou `@sinete/nfse` para NFS-e Nacional), passando o cliente e o XML assinado original. Só reenvie se o resultado indicar `acao: 'reenviar'`, preservando os mesmos bytes.

Se persistir, verifique a apresentação e a validade do certificado (no Bun com TLS 1.3, um certificado vencido ou revogado chega aqui) e, na NF-e, na NFC-e ou no MDF-e, consulte `statusServico` no cliente. Na NF-e, considere a [contingência](../como-fazer/contingencia.md), respeitando a resolução dos envios pendentes antes de mudar a forma de emissão.

## Armadilha

Tratar o erro como certeza de que o pedido não chegou e montar o documento de novo pode causar rejeição por duplicidade ou gerar uma segunda nota, se você mudar a numeração.
