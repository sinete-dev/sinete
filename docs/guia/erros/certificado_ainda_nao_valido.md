# `certificado_ainda_nao_valido`: o certificado ainda não começou a valer

O início da validade do certificado é posterior ao instante indicado pelo `relogio` passado a `abrirPfx`, de `@sinete/cert`. A função lança um `ErroCertificado`, que estende `ErroSinete`, com `code: 'certificado_ainda_nao_valido'`. Trate o erro pelo `code`, usando `ehErroSinete(e, 'certificado_ainda_nao_valido')`, de `@sinete/core`, nunca pela mensagem.

## Causa

O certificado tem início de validade no futuro, o relógio da máquina está atrasado ou o relógio passado ao sinete indica uma data anterior ao início da validade. Isso pode acontecer com um `relogioFixo`, relógio fixado em um instante para testes ou reprocessamento, especialmente ao usar um certificado recém-emitido para uma data antiga.

## Correção

Sincronize o relógio da máquina por NTP, protocolo de sincronização de horário. Confira com `sinete doctor`: a comparação com o relógio do servidor exige `--status` ou `--relogio-url <url>` e uma resposta com o cabeçalho HTTP `Date` válido. Sem essa referência externa, o comando apenas verifica a validade do certificado pelo relógio local.

Confira o início da validade em `detalhes.notBefore` do erro. Se o horário estiver correto e o certificado ainda não tiver começado a valer, aguarde esse instante ou use outro certificado válido.

Ao emitir ou retransmitir um documento agora, use o horário atual em `emissao` do `ContextoDeTempo`, de `@sinete/core`. A data da operação documentada, como a venda ou a prestação de serviço, pertence a `fatoGerador`, o outro relógio desse contexto. Para diagnóstico ou reprocessamento local com uma data histórica, `abrirPfx` aceita `aceitarVencido: true`, que permite abrir também um certificado cuja validade ainda não começou naquele instante.

## Armadilha

A rejeição 703 da SEFAZ, a Secretaria da Fazenda, indica que a data e hora de emissão da NF-e ou NFC-e são posteriores ao horário de recebimento. Um relógio adiantado pode causar essa rejeição; um relógio atrasado pode fazer um certificado parecer ainda não válido. Os erros não necessariamente aparecem juntos: `certificado_ainda_nao_valido` é lançado localmente ao abrir o certificado, antes da transmissão. Permitir a abertura com `aceitarVencido: true` não torna o certificado válido perante o servidor.
