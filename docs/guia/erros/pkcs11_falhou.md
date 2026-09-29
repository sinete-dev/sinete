# `pkcs11_falhou`: o token PKCS#11 falhou

O helper `sinete-signer` não conseguiu usar o token pela interface PKCS#11: o módulo do fabricante não carregou, o token não foi encontrado, o PIN (senha de acesso ao token) foi recusado, houve falha ao localizar o certificado ou a chave privada, ou a operação de assinatura (`C_SignInit` ou `C_Sign`) falhou. O erro também ocorre quando o binário é a versão estática, sem suporte a PKCS#11. Ele é representado por `SignerError` (`@sinete/transport`), que estende `SineteError` e tem `code: 'pkcs11_falhou'`. Trate o erro pelo `code`, usando `isSineteError(e, 'pkcs11_falhou')` de `@sinete/core`, nunca pelo texto da mensagem.

## Causa

A mensagem pode trazer um código de retorno do PKCS#11, como `CKR_PIN_INCORRECT` (PIN incorreto), `CKR_TOKEN_NOT_PRESENT` (token ausente) ou `CKR_DEVICE_REMOVED` (dispositivo removido). Também pode indicar falha ao carregar o módulo ou ao localizar o token, o certificado ou a chave privada.

O helper procura o certificado pelo rótulo (`label`) ou pelo identificador `CKA_ID` (`keyId`, em hexadecimal). Se ambos forem informados, o certificado precisa corresponder aos dois. A chave privada é procurada pelo mesmo `CKA_ID` do certificado, que associa os dois objetos no token. Se o certificado não tiver `CKA_ID`, o helper procura a chave pelo `label` informado. A busca precisa encontrar exatamente um certificado e uma chave privada; nenhum resultado ou múltiplos resultados também causam esse erro.

## Correção

Inicie a versão `-p11` do helper com `startSigner` de `@sinete/signer`, por exemplo, `startSigner({ pkcs11: true, ambientes: ['homologacao'] })`. Se informar `binary` explicitamente, ele precisa apontar para a versão com suporte a PKCS#11.

Ao chamar `openPkcs11`, passe em `module` o caminho absoluto do módulo do fabricante. Confira o rótulo do token (`token`) e o do certificado (`label`) com a ferramenta do fabricante, ou selecione o certificado por `keyId`. Se dois tokens tiverem o mesmo rótulo, informe também o número de série em `serial`. Se o token for removido durante o uso, reconecte-o, feche a identidade anterior com `close()` e abra outra com `openPkcs11`.

## Armadilha

Não repita tentativas automaticamente com o mesmo PIN: o token pode bloquear o acesso após poucas tentativas incorretas. O desbloqueio depende do dispositivo e pode exigir o PIN de administrador ou um código de desbloqueio (PUK), conforme as instruções do fabricante. Forneça o PIN pela função `pin` de `openPkcs11`; o cliente o envia ao helper apenas pelo canal de comunicação. Não o passe em variável de ambiente nem em argumento de linha de comando.
