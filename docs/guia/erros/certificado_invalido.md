# `certificado_invalido`: o certificado ou a chave não é um DER válido

O conteúdo não pôde ser lido como DER, a codificação binária usada para certificados X.509 e chaves privadas PKCS#8, ou contém uma estrutura de certificado incompleta. Base64 inválido também pode gerar esse erro. Ele é lançado por `ErroCertificado` (`@sinete/cert`), que estende `ErroSinete` com `code: 'certificado_invalido'`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'certificado_invalido')` de `@sinete/core`, nunca pela mensagem.

## Causa

O certificado passado ao `montarCadeia` ou ao `criarAssinadorA1`, inclusive um certificado de uma cadeia informada, está corrompido ou não está em DER. Isso acontece, por exemplo, quando o texto PEM, que contém o certificado em base64 entre delimitadores, é passado diretamente como bytes. Um atributo incompleto no DN, o nome que identifica o titular ou o emissor do certificado, também pode causar o erro.

No `criarAssinadorA1`, a falha ao importar a chave privada como RSA PKCS#8 gera `algoritmo_nao_suportado`, não `certificado_invalido`.

## Correção

Passe os bytes DER do certificado: `await signer.certificadoDer()` ou `ks.certificado.der`, sendo `ks` o resultado de `abrirPfx`. O campo `ks.certificado` é um objeto `CertificadoX509`, aceito diretamente por `montarCadeia`, mas não pelo parâmetro de certificado de `criarAssinadorA1`.

Para converter um certificado PEM, use `dersDoPem` de `@sinete/cert`, que retorna os certificados em DER na ordem do texto. Se fizer a conversão manualmente, remova os delimitadores de início e fim e decodifique o base64. Um PFX, arquivo que reúne a chave privada e os certificados, aberto por `abrirPfx` já permite obter o certificado em DER por `ks.certificado.der` e o material em PEM por `ks.tlsPem()`.

## Armadilha

Extrair ou reconstruir o certificado presente em `KeyInfo/X509Data/X509Certificate` no XML não basta para confiar nele. O verificador do sinete confere a assinatura contra o elemento esperado; a confiança na cadeia de certificados deve ser conferida separadamente com `montarCadeia`, verificando se o resultado tem `situacao: 'confiavel'`. Essa função não consulta revogação. Ao passar a opção `relogio`, confira também `vencidos`, que lista certificados vencidos ou ainda não válidos.
