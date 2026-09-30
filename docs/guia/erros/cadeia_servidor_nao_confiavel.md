# `cadeia_servidor_nao_confiavel`: o certificado do servidor não fecha numa raiz confiável

O transporte não conseguiu validar a cadeia de certificados do servidor com o conjunto de confiança configurado. Por padrão, esse conjunto reúne as raízes confiáveis da runtime e os certificados da ICP-Brasil (Infraestrutura de Chaves Públicas Brasileira) incluídos no sinete. A falha gera um `TransportError` (`@sinete/transport`), que herda de `ErroSinete`, com `code: 'cadeia_servidor_nao_confiavel'`. Trate o erro pelo `code`, usando `ehErroSinete(e, 'cadeia_servidor_nao_confiavel')` de `@sinete/core`, nunca pela mensagem.

## Causa

O servidor da SEFAZ (Secretaria da Fazenda) pode ter trocado de autoridade certificadora (AC), e o conjunto de certificados ICP-Brasil da versão instalada de `@sinete/cert` pode estar desatualizado. Outra possibilidade é um proxy corporativo interceptar a conexão TLS, o protocolo que protege a comunicação, usando uma AC ausente do conjunto de confiança do transporte. O código também abrange falhas como certificado do servidor expirado ou cadeia incompleta.

## Correção

Atualize os pacotes `@sinete/*`: o conjunto de certificados ICP-Brasil é distribuído e versionado no `@sinete/cert`. Com proxy corporativo, passe os certificados da AC dele em formato PEM, como uma lista de strings em `additionalCa` do transporte. No emissor, configure essa opção ao criar o transporte na função passada à opção `transporte`. No comando `doctor`, use `--ca <arquivo.pem>`. Se o certificado do servidor estiver expirado ou a cadeia enviada estiver incompleta, a configuração precisa ser corrigida pelo responsável pelo servidor.

## Armadilha

Nunca desligue a verificação do certificado do servidor com `rejectUnauthorized: false`: o transporte do sinete não oferece essa opção. Sem essa verificação, um intermediário poderia se passar pelo servidor e receber o documento assinado e o certificado de cliente.
