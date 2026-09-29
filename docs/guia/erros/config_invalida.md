# `config_invalida`: opção ou argumento fora do domínio

Uma opção ou um argumento passado ao sinete está ausente, malformado ou fora dos valores aceitos. O erro é representado por `ConfigError` (`@sinete/core`), uma subclasse de `SineteError` com `code: 'config_invalida'`. No código da integração, identifique o erro por `isSineteError(e, 'config_invalida')`, nunca pelo texto da mensagem.

## Causa

Alguns exemplos reais: instante sem fuso explícito (`2026-09-26T10:00:00` em vez de `2026-09-26T10:00:00-03:00`); emissor criado sem `store`, com `pfx` e `certificado` juntos, sem nenhum dos dois ou com `pfx` sem `senha`; `emitir` ou `retomar` sem `aoDecidir` no emissor nem na chamada; prazo da trava ou política de retomada com número não finito; serviço sem documento, como consulta de status ou inutilização de numeração, num `NfeClient` sem `uf` (unidade federativa); chamada a `pdf` do emissor sem conseguir carregar `@sinete/da` e sem o módulo correspondente na opção `da`; nota assinada que não corresponde à chave de acesso consultada; pool de emissores usado depois de `fechar()`; `nSeqEvento`, o número sequencial do evento, fora da faixa aceita para aquele evento. A propriedade opcional `details` pode trazer o valor recusado, sem incluir segredos.

## Correção

Leia a mensagem para identificar a opção ou o argumento recusado, corrija a chamada e execute novamente. Confira se o valor vem da configuração da integração ou de um dado recebido pela aplicação antes de decidir onde corrigi-lo. Instantes em texto precisam de fuso explícito (`Z` ou `±hh:mm`). No emissor, `store` é obrigatório e armazena os bytes assinados antes do envio; veja [como implementar o store](../como-fazer/store-sql.md). Informe `pfx` e `senha` juntos ou passe o certificado já aberto em `certificado`. A função `aoDecidir`, responsável por guardar o documento após a decisão da emissão, deve ser informada no emissor ou em cada chamada a `emitir` ou `retomar`. Para gerar o PDF no Deno e no navegador, importe estaticamente `sinete/da/nfe`, `sinete/da/mdfe` ou `sinete/da/nfse`, conforme o emissor, e passe o módulo na opção `da`.

## Armadilha

Não mostre a mensagem técnica diretamente a quem preenche a nota nem suponha que sempre exista um campo do formulário capaz de resolver o erro. O código `config_invalida` também pode indicar um argumento derivado da entrada, como um número decimal inválido; a integração precisa identificar sua origem. Não o trate como falha de rede para tentar novamente: repetir a mesma chamada sem corrigir a causa não resolve. Documento assinado malformado também pode gerar esse erro, pois o serviço não corrige o documento de quem chama. Não reserialize o XML assinado para “limpar”: isso pode invalidar a assinatura.
