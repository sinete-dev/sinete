# `resposta_invalida`: a resposta não segue o leiaute esperado

Chegou uma resposta, mas ela não segue o formato esperado: XML malformado, SOAP fault (mensagem de falha do serviço SOAP), grupo obrigatório ausente, `cStat` (código de situação da resposta) inválido ou uma resposta que não corresponde ao pedido. O erro é uma instância de `ProtocolError`, de `@sinete/core`, que estende `SineteError` com `code: 'resposta_invalida'`. Decida pelo `code` (`isSineteError(e, 'resposta_invalida')`), nunca pela mensagem.

## Causa

Exemplos: resposta HTTP 5xx com corpo fora do formato esperado ou página HTML de um balanceador no lugar do XML; retorno sem `cStat`; protocolo de outra chave de acesso; `digVal` (resumo criptográfico do conteúdo autorizado, informado no protocolo) diferente do `DigestValue` (resumo criptográfico presente na assinatura) da nota enviada; retorno de evento que não corresponde ao evento enviado. Na NFS-e (Nota Fiscal de Serviço eletrônica), também pode ser uma nota devolvida que não corresponde à DPS (Declaração de Prestação de Serviços) enviada ou um status HTTP inesperado. Na NF-e (Nota Fiscal eletrônica) e no MDF-e (Manifesto Eletrônico de Documentos Fiscais), o sinete confere a correspondência entre documento e protocolo antes de montar o XML processado, que reúne os dois nos elementos `nfeProc` ou `mdfeProc`.

## Correção

Se o erro ocorreu no envio para autorização, trate como envio sem resposta: o pedido pode ter sido processado. Os emissores de `@sinete/emissor` já fazem essa recuperação: consultam a chave do documento ou, na NFS-e, o identificador da DPS, e decidem o próximo passo. Com o cliente direto, use `resolverEnvioSemResposta` do pacote correspondente (`@sinete/nfe`, `@sinete/mdfe` ou `@sinete/nfse`) antes de reenviar. Só reenvie quando o resultado indicar `acao: 'reenviar'`, preservando os mesmos bytes do XML assinado.

Se a resposta fora do leiaute se repetir no mesmo host, investigue o serviço e os intermediários da conexão. Isso pode indicar uma mudança ou falha na SEFAZ (Secretaria da Fazenda) ou no serviço nacional de NFS-e, mas a repetição sozinha não confirma a causa. Registre `details`, incluindo o status HTTP quando disponível, e o host utilizado, que não é garantido em `details`, e abra uma issue com essas informações.

## Armadilha

Não guarde o XML de uma resposta recusada por essa validação como se fosse o protocolo, nem monte o `nfeProc` à mão com ela. O sinete só monta o `nfeProc` ou o `mdfeProc` quando a chave corresponde ao documento e o `digVal` está presente e confere com o `DigestValue` do XML assinado enviado. Sem `digVal`, o protocolo não comprova o conteúdo autorizado e o XML processado não é montado. Essa verificação evita guardar uma autorização que não corresponde ao documento enviado.
