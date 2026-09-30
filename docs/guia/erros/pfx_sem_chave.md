# `pfx_sem_chave`: o PFX não tem chave privada

O arquivo PKCS#12 (`.pfx` ou `.p12`, formato que pode reunir certificados e chaves privadas) foi aberto, mas não contém nenhuma chave privada. A função `abrirPfx` de `@sinete/cert` lança um `ErroCertificado`, que é um `ErroSinete` com `code: 'pfx_sem_chave'`. Trate o erro pelo `code`, usando `ehErroSinete(e, 'pfx_sem_chave')` de `@sinete/core`, nunca pela mensagem.

## Causa

O arquivo foi exportado sem a chave privada e contém apenas o certificado público. Isso pode acontecer mesmo quando o certificado é do tipo A1, cuja chave fica em software.

## Correção

Exporte de novo incluindo a chave privada (no Windows, "Sim, exportar a chave privada"). Se você não tiver a chave, procure a autoridade certificadora (AC) para obter orientação sobre a recuperação ou reemissão do A1.

Um certificado A3, em token, cartão ou nuvem de um prestador de serviço de confiança (PSC), mantém a chave privada não exportável e não fornece um PFX com essa chave. O sinete já aceita A3 nos emissores por meio do helper `sinete-signer`, em `helpers/signer-tls`, distribuído pelo pacote npm `@sinete/signer`. A integração usa o cliente `@sinete/transport/signer`, com PKCS#11 para acessar o token ou cartão, ou assinatura remota para o A3 em nuvem. Veja [como usar certificado A3](../como-fazer/certificado-a3.md).

## Armadilha

Um arquivo `.cer` ou `.p7b` enviado pela AC contém certificados públicos, sem a chave privada necessária para assinar. Ele pode conter o certificado público de um A1, mas não basta para usá-lo no sinete. Para abrir um A1 com `abrirPfx`, use um `.pfx` ou `.p12` protegido por senha que contenha o certificado e sua chave privada. A extensão e a senha, sozinhas, não garantem que a chave esteja no arquivo.
