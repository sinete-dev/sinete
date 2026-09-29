# `assinatura_tls_recusada`: quem assina recusou o handshake

Durante o handshake TLS, a negociação da conexão segura, o helper `sinete-signer` pediu a assinatura da mensagem CertificateVerify, que comprova a posse da chave privada do cliente. Quem controla a chave recusou o pedido ou devolveu uma assinatura que não confere com a chave pública do certificado. A negociação foi interrompida. O erro é representado por `SignerError` (`@sinete/transport`), um `SineteError` com `code: 'assinatura_tls_recusada'`. Decida pelo `code`, usando `isSineteError(e, 'assinatura_tls_recusada')` de `@sinete/core`, nunca pela mensagem. `details.host` traz o host de destino.

## Causa

Nas identidades abertas com `openRemote`, o cliente de `@sinete/transport/signer` aplica a política do dono da chave antes de chamar o `TlsSigner`: o host tem de estar em `allowedHosts`, o propósito tem de ser o CertificateVerify de um handshake TLS 1.2 e o esquema de assinatura, RSA PKCS#1 v1.5 com SHA-256. O modo solicitado também precisa corresponder ao modo do `TlsSigner`.

No modo `message`, o cliente recebe o transcript, a sequência de mensagens do handshake, e confere seu hash SHA-256. Para um host com nome DNS, o SNI, campo que indica o nome do servidor, precisa corresponder ao host, e o certificado do servidor no transcript precisa cobrir esse nome. Para um endereço IP, o SNI deve estar ausente, e o certificado precisa incluir o endereço entre seus nomes alternativos. No modo `digest`, o cliente recebe apenas o hash e verifica se ele tem 32 bytes.

Qualquer uma dessas falhas, ou um erro lançado pelo próprio `TlsSigner`, como a recusa de um Prestador de Serviço de Confiança (PSC) ou a falta de permissão no OpenBao, vira esta recusa. O helper também recusa respostas de assinatura inválidas, vazias ou fora do formato base64. Uma assinatura que não confere pode indicar que a chave e o certificado são de pares diferentes.

## Correção

Confira `allowedHosts`: `ambienteHosts('producao')` e `ambienteHosts('homologacao')`, de `@sinete/transport`, devolvem os hosts dos endpoints cadastrados para cada ambiente. Selecione os hosts nos quais a chave deve autenticar. Confira também a cadeia devolvida por `certificateChain()` e se a chave do PSC ou do OpenBao corresponde ao primeiro certificado da cadeia, o certificado do titular.

Verifique se o `TlsSigner` assina conforme o modo declarado: em `message`, ele recebe o transcript inteiro; em `digest`, recebe o hash SHA-256 de 32 bytes. A assinatura deve usar RSA PKCS#1 v1.5 com SHA-256. A mensagem do erro traz o motivo da recusa do cliente ou de quem assina, ou a falha detectada pelo helper ao conferir a resposta.

## Armadilha

Não amplie `allowedHosts` indiscriminadamente para "fazer funcionar". Essa lista aplica a restrição de destinos do dono da chave, independentemente das verificações do helper. Uma lista vazia é rejeitada por `openRemote` com `ConfigError`; ela não desativa a política. No modo `message`, o transcript permite conferir o destino informado. No modo `digest`, essa conferência não é possível: o cliente depende do contexto informado pelo helper, e `allowedHosts` sozinho não comprova o destino real se o helper estiver comprometido.
