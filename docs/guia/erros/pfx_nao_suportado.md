# `pfx_nao_suportado`: o PFX usa uma cifra que o leitor não implementa

O arquivo PFX (PKCS#12, que reúne a chave privada e os certificados) usa um algoritmo que o leitor do sinete não implementa. O erro é um `ErroCertificado` de `@sinete/cert`, derivado de `ErroSinete`, com `code: 'pfx_nao_suportado'`. Identifique-o pelo `code`, nunca pela mensagem: use `ehErroSinete(e, 'pfx_nao_suportado')`, com `ehErroSinete` importado de `@sinete/core`.

## Causa

Um caso conhecido é o RC2-128, algoritmo de criptografia não suportado pelo leitor padrão. O leitor aceita PBES2 com AES, 3DES e o perfil legado que combina RC2-40 com 3DES, usado em exportações antigas de certificados A1 da ICP-Brasil, o tipo de certificado armazenado em arquivo.

## Correção

Exporte o PFX novamente com um perfil moderno. No OpenSSL 3, faça a conversão em duas etapas: primeiro extraia a chave e os certificados para PEM; depois gere o novo PFX. A opção `-export` não converte diretamente um PFX de entrada. A opção `-legacy` permite ler cifras antigas na primeira etapa; omita-a na segunda para gerar o arquivo com PBES2 e AES-256-CBC. Consulte a [documentação do comando `openssl pkcs12`](https://docs.openssl.org/3.0/man1/openssl-pkcs12/).

```sh
openssl pkcs12 -legacy -in antigo.pfx -out temporario.pem -aes256
openssl pkcs12 -export -in temporario.pem -out novo.pfx
```

O primeiro comando solicita a senha do PFX antigo e uma senha para proteger a chave privada no PEM temporário. O segundo solicita a senha desse PEM e a senha do novo PFX. Depois de confirmar que o sinete abre o novo arquivo, coloque-o no local do antigo, atualize a senha usada pela aplicação se ela mudou e remova o PEM temporário.

## Armadilha

Não tente contornar o erro passando o PFX diretamente à opção `pfx` do TLS do Node, responsável pela conexão segura. O OpenSSL 3 não carrega por padrão o suporte a cifras antigas como RC2. No fluxo de A1 do sinete, o transporte recebe a chave privada e a cadeia de certificados já extraídas, em formato PEM.
