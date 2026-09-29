# `pfx_sem_certificado_da_chave`: nenhum certificado do PFX é da chave

O arquivo PFX contém uma chave privada RSA, mas nenhum certificado do titular, também chamado de certificado de fim de cadeia, corresponde a uma chave privada RSA presente nele. A função `openPfx`, de `@sinete/cert`, lança um `CertError`, que herda de `SineteError`, com `code: 'pfx_sem_certificado_da_chave'`. Trate o erro pelo `code`, usando `isSineteError(e, 'pfx_sem_certificado_da_chave')`, de `@sinete/core`, nunca pela mensagem.

## Causa

O arquivo foi montado juntando a chave de um certificado com o certificado de outro, por exemplo, durante uma renovação feita à mão. Outra possibilidade é que ele contenha a chave privada, mas os únicos certificados presentes sejam os da cadeia da autoridade certificadora (AC), sem o certificado do titular.

## Correção

Exporte o PFX de novo da origem que contém o certificado do titular e a chave privada correspondente, como o navegador ou o repositório do sistema onde o certificado A1 foi instalado, ou peça o arquivo à AC.

## Armadilha

Um PFX que contém o certificado antigo correspondente à mesma chave também passa pela verificação de correspondência. Entre os certificados de fim de cadeia que correspondem a uma chave privada RSA do PFX, o sinete escolhe aquele cuja data de vencimento é mais distante. Em caso de empate, escolhe o que tem a data de início de validade mais recente. Isso não garante que o certificado escolhido esteja válido: por padrão, `openPfx` recusa certificados vencidos ou que ainda não começaram a valer. Confira a validade com `sinete doctor --pfx arquivo.pfx`.
