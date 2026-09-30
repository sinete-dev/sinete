# `pfx_invalido`: o arquivo não é um PFX legível

O arquivo passado como PFX não é um PKCS#12, formato que armazena certificados e chaves privadas, que o leitor consiga abrir. O erro é uma instância de `ErroCertificado` (`@sinete/cert`), que estende `ErroSinete`, com `code: 'pfx_invalido'`. Trate o erro pelo `code`, usando `ehErroSinete(e, 'pfx_invalido')` de `@sinete/core`, nunca pela mensagem.

## Causa

O arquivo está truncado, é de outro formato (um `.cer` ou `.pem` só com o certificado, sem a chave), ou foi guardado em base64 e passado sem decodificar. O leitor padrão tolera bytes extras depois da estrutura DER, a codificação binária do conteúdo do PFX, como pode ocorrer em arquivos guardados em cofres de certificados. Um arquivo cortado, porém, não é aceito.

## Correção

Passe os bytes do arquivo original (`await readFile('empresa.pfx')`, com `readFile` de `node:fs/promises`, ou o base64 decodificado para `Uint8Array`). Confira o arquivo com `npx sinete doctor --pfx arquivo.pfx`, que abre o PFX, mostra titular, emissor e validade e nunca imprime chave nem senha. A senha é lida da variável de ambiente `SINETE_PFX_SENHA` ou, se ela não estiver definida, solicitada no terminal sem exibir o que você digita.

## Armadilha

Ler o arquivo como texto (`readFile(caminho, 'utf8')`) corrompe o binário: passe sempre o PFX como bytes. Um PFX legível de outro titular não causa este erro apenas por pertencer a outra pessoa ou empresa. Depois de abrir o arquivo com `abrirPfx` de `@sinete/cert`, confira `identity.cnpj` ou `identity.cpf` no objeto retornado. Esses campos podem ser `undefined` quando o documento não é identificado no certificado.
