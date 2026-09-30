# `pfx_senha_incorreta`: a senha não abriu o PFX

O leitor não conseguiu verificar o MAC, código de autenticação que protege a integridade do arquivo, ou decifrar o conteúdo com a senha informada. O PFX é um arquivo no formato PKCS#12 que pode conter o certificado e sua chave privada. O erro é uma instância de `CertError` (`@sinete/cert`), que herda de `ErroSinete`, com `code: 'pfx_senha_incorreta'`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'pfx_senha_incorreta')` de `@sinete/core`, nunca pela mensagem.

## Causa

A senha pode estar errada ou conter espaços ou quebras de linha acrescentados ao ser lida de uma variável de ambiente ou de um arquivo. O leitor padrão tenta primeiro a senha como foi recebida, com a codificação UTF-16 usada pelo PKCS#12. Se ocorrer `pfx_senha_incorreta` e a senha contiver caracteres fora de ASCII, como letras acentuadas, ele tenta uma variante legada que interpreta cada byte UTF-8 como um caractere.

## Correção

Confira a senha e remova espaços e quebras de linha das pontas somente se tiverem sido acrescentados por engano. Esses caracteres podem fazer parte da senha original. Leia a senha do ambiente ou de um cofre de segredos, nunca de argumento de linha de comando nem do código. Confira o arquivo com `npx sinete doctor --pfx arquivo.pfx`. O comando lê a senha da variável `SINETE_PFX_SENHA` ou, se ela não estiver definida, solicita a senha no terminal sem exibi-la. Quando consegue abrir o PFX, mostra titular, emissor e validade; nunca imprime a chave privada nem a senha.

## Armadilha

Os detalhes do erro nunca trazem a senha nem o PFX; não os coloque você no log ao tratar o erro. Várias tentativas com senhas diferentes não bloqueiam a leitura do PFX no sinete, mas o cofre de onde a senha vem pode ter limite de acesso.
