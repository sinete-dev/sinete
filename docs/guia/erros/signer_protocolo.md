# `signer_protocolo`: o helper respondeu fora do contrato

O helper `sinete-signer`, processo auxiliar de assinatura e conexão TLS, fala outra versão do protocolo ou respondeu fora do contrato esperado pelo cliente `@sinete/transport/signer`. O erro também ocorre diante de método desconhecido, parâmetro inválido ou identidade não aberta ou repetida. Uma identidade associa um certificado à forma de usar sua chave naquela conexão.

O erro é uma instância de `SignerError` (`@sinete/transport`), que estende `SineteError` e tem `code: 'signer_protocolo'`. Decida pelo `code`, com `isSineteError(e, 'signer_protocolo')` de `@sinete/core`, nunca pela mensagem. Quando o cliente converte um erro recebido do helper, `details.code` traz o código original, como `unknown_method`, `unknown_identity`, `identity_exists`, `bad_request`, `protocol_version` ou `forbidden`. A verificação local de identidade remota repetida também preenche `details.code` com `identity_exists`. Outras verificações locais, como a de versão do protocolo, podem lançar esse erro sem `details.code`.

## Causa

O cliente e o binário usam versões incompatíveis do protocolo: a chamada inicial `hello` foi recusada, devolveu outro `protocol` ou a resposta veio com outro valor no campo `v`, que identifica a versão da mensagem. O erro também ocorre se a resposta a `identity.open` vier sem a cadeia de certificados.

Outras causas são um método desconhecido, parâmetros inválidos, uma operação não permitida para o tipo de identidade, uma identidade fechada ou nunca aberta naquela conexão, ou a tentativa de abrir novamente um `id` ainda em uso. Cada conexão com o helper tem as próprias identidades.

## Correção

Use um binário compatível com a versão do protocolo do cliente. A compatibilidade é verificada pelo protocolo, não pela igualdade entre as versões dos pacotes.

Abra cada identidade uma vez por conexão e guarde o objeto `SignerIdentity` retornado após aguardar `openRemote` ou `openPkcs11`. Para fornecer outro PIN, a senha de acesso ao token, ou usar outro token, aguarde o `close()` da identidade e abra uma nova com os parâmetros atualizados. Fechar e reabrir a identidade não altera a senha gravada no token.

Se o código original for `bad_request`, consulte a mensagem do helper para identificar o parâmetro inválido. Para `unknown_method` ou `forbidden`, confira se o método existe e se é permitido para aquele tipo de identidade. Por exemplo, `dfe.sign`, usado para assinar documentos fiscais eletrônicos, exige uma chave controlada pelo helper por meio de PKCS#11, a interface de acesso ao token. No modo `remote`, a assinatura do documento cabe a quem controla a chave.

## Armadilha

Não tente adivinhar o `id` de uma identidade aberta por outro processo. O helper mantém as identidades separadas por conexão, inclusive quando atende por socket Unix, um canal local de comunicação entre processos. Uma conexão não enxerga nem usa a identidade aberta por outra.
