# `falha_rede`: falha de rede

Indica uma falha de rede, como erro de DNS (resolução do nome do servidor) ou falta de rota, geralmente antes de estabelecer a conexão segura por TLS. O transporte também usa esse código para falhas que não se encaixam em uma classificação mais específica. Portanto, o código sozinho não garante que o pedido deixou de chegar ao servidor. O erro é um `TransportError` de `@sinete/transport`, derivado de `SineteError`, com `code: 'falha_rede'`. Decida pelo `code`, usando `isSineteError(e, 'falha_rede')` de `@sinete/core`, nunca pela mensagem.

## Causa

Ausência de conexão de rede, DNS sem resposta, falta de rota ou firewall bloqueando a saída na porta 443 para os hosts da SEFAZ (Secretaria da Fazenda). A classificação depende da falha relatada pelo transporte: uma conexão recusada, por exemplo, pode gerar `conexao_recusada`.

## Correção

Confira a resolução de DNS, as rotas e a liberação de saída do servidor para os hosts do ambiente. Pelo emissor, uma falha de envio com esse código é tratada como envio sem resposta, pois o documento pode ter chegado à SEFAZ. O emissor mantém os bytes gravados e consulta a situação do documento pela chave antes de qualquer reenvio. Se a consulta também ficar sem resposta, o resultado permanece pendente.

## Armadilha

Em ambientes com lista de hosts permitidos para saída, os hosts variam conforme a UF (estado ou Distrito Federal) e o serviço de contingência usado quando o autorizador habitual está indisponível. Esses serviços incluem a SVC-AN (Sefaz Virtual de Contingência do Ambiente Nacional) e a SVC-RS (Sefaz Virtual de Contingência do Rio Grande do Sul). Libere a lista retornada por `ambienteHosts(ambiente)`, de `@sinete/transport`, para o ambiente de homologação ou produção utilizado, em vez de liberar apenas um host.
