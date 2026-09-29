# `certificado_recusado`: o servidor recebeu o certificado e recusou

O servidor recebeu o certificado de cliente e o recusou durante a negociação TLS, que estabelece a conexão segura (alertas 43 a 46, 48 e 49). O transporte lança um `TransportError` de `@sinete/transport`, que herda de `SineteError`, com `code: 'certificado_recusado'`. Trate o erro pelo `code`, usando `isSineteError(e, 'certificado_recusado')` de `@sinete/core`, nunca pela mensagem.

## Causa

Certificado vencido ou revogado, autoridade certificadora (AC) que o servidor não reconhece, ou cadeia de certificação incompleta para aquele servidor. A cadeia liga o certificado do titular a uma raiz de confiança por meio dos certificados das autoridades intermediárias.

## Correção

Para um certificado A1 em arquivo PFX, confira validade e cadeia com `npx sinete doctor --pfx arquivo.pfx --uf XX --status`, substituindo `XX` pela sigla do estado. Esse comando consulta o status do serviço de NF-e em homologação por padrão. Para verificar produção, acrescente `--ambiente producao`.

Se a cadeia estiver incompleta, forneça os certificados intermediários da AC com `--cadeia intermediarias.pem` no doctor. No código, monte a cadeia com `buildChain` de `@sinete/cert` e passe a propriedade `chain` do resultado à opção `chain` de `pemIdentity`, de `@sinete/transport`.

O doctor exige um PFX de certificado A1. Para um A3 usado pelo helper `sinete-signer`, confira a validade e a cadeia da identidade configurada no helper. No caso de token PKCS#11, a opção `chain` de `openPkcs11` recebe os certificados intermediários em DER.

## Armadilha

Repetir a chamada não muda o certificado. A mesma recusa em todos os autorizadores, os serviços que recebem os documentos para autorização, costuma indicar um problema no certificado ou na cadeia enviada. Se a recusa ocorrer em apenas um, investigue a configuração e os requisitos daquele servidor.
