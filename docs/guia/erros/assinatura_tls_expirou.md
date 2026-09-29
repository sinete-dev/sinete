# `assinatura_tls_expirou`: quem assina não respondeu a tempo

O helper `sinete-signer` pediu uma assinatura para o handshake TLS, a negociação da conexão segura, e o dono da chave não respondeu dentro do prazo da identidade (`signTimeoutMs`, padrão 30 s). O erro é um `SignerError` (`@sinete/transport`), que estende `SineteError` e tem `code: 'assinatura_tls_expirou'`. Identifique-o pelo `code`, usando `isSineteError(e, 'assinatura_tls_expirou')` de `@sinete/core`, nunca pela mensagem.

## Causa

Um Prestador de Serviço de Confiança (PSC) lento ou fora do ar, uma aprovação humana por notificação no celular que não veio, um navegador que fechou a aba com a chave `CryptoKey`, ou um `TlsSigner` que nunca conclui a promessa de assinatura.

## Correção

Aumente `signTimeoutMs` na chamada a `openRemote` do cliente `@sinete/transport/signer` quando a assinatura depender de uma pessoa. O limite é 300 000 ms. Confira também a disponibilidade do assinador. O servidor da Secretaria da Fazenda (SEFAZ) também tem prazo para o handshake. Nas medições registradas no ADR 0005, as requisições funcionaram com atrasos artificiais de 3 s e de 10 s por assinatura, mas não foram testados atrasos acima de 10 s.

## Armadilha

Uma conexão nova pode exigir uma assinatura; a retomada de uma sessão TLS pode dispensá-la. Nos servidores que pedem o certificado por renegociação TLS, o pedido de assinatura chega durante a requisição. Reutilizar as conexões do transporte (keep-alive) reduz o número de assinaturas e, com elas, as chances de estourar o prazo.
