# `algoritmo_nao_suportado`: a chave ou o hash não é o que os DF-e usam

O algoritmo da chave, o hash (resumo criptográfico) ou os bytes fornecidos não atendem ao que `@sinete/cert` espera: RSA com PKCS#1 v1.5 e SHA-1 ou SHA-256. O erro é um `ErroCertificado` (`@sinete/cert`), derivado de `ErroSinete`, com `code: 'algoritmo_nao_suportado'`. Trate pelo `code`, usando `ehErroSinete(e, 'algoritmo_nao_suportado')` de `@sinete/core`, nunca pela mensagem. Na assinatura dos documentos fiscais eletrônicos (DF-e), o sinete usa RSA-SHA1.

## Causa

Ao abrir um PFX (arquivo que reúne a chave privada e os certificados), `abrirPfx` não encontrou uma chave reconhecível como RSA. Se houver chave RSA, mas nenhum certificado correspondente, o código será `pfx_sem_certificado_da_chave`.

O erro também ocorre quando `criarAssinadorA1` ou `conferirBytes` recebe um certificado com chave que não é RSA, como uma chave de curva elíptica (ECDSA). Em `criarAssinadorA1`, ocorre ainda quando a chave privada não pode ser importada como RSA no formato PKCS#8.

Outra causa é passar um hash diferente de `'SHA-1'` ou `'SHA-256'` ao assinador criado por `criarAssinadorA1` ou a `codificarDigestInfo`. Esta última função também lança o erro se o resumo tiver tamanho incorreto: SHA-1 exige 20 bytes; SHA-256, 32 bytes. O hash é escolhido por quem solicita a assinatura, não pelo `Assinador`, a interface de assinatura de `@sinete/core`.

## Correção

Para usar um certificado A1, forneça um PFX com chave RSA e o certificado correspondente. Ao chamar `criarAssinadorA1` diretamente, forneça a chave privada RSA em PKCS#8 e o certificado em DER, a codificação binária esperada pela função. Se usar `codificarDigestInfo`, confira o algoritmo e o tamanho do resumo.

A1 não é a única opção: A3 em token PKCS#11, A3 em nuvem de um prestador de serviço de confiança (PSC) e chaves não exportáveis podem ser usados com o helper `sinete-signer`, distribuído no npm como `@sinete/signer`, e o cliente `@sinete/transport/signer`. O helper fornece o assinador de documentos para o token PKCS#11; no modo remoto, a assinatura do documento fica a cargo do `Assinador` integrado à chave.

A assinatura dos DF-e gerada pelo sinete usa RSA-SHA1 no perfil da Secretaria da Fazenda (SEFAZ). A verificação aceita também SHA-256, e as funções de assinatura de `@sinete/cert` suportam ambos. Isso não altera o algoritmo exigido pelo leiaute do documento.

## Armadilha

Não troque o algoritmo da assinatura do documento para "modernizar": a SEFAZ confere o padrão exigido. Para a Nota Fiscal Eletrônica (NF-e), o Manual de Orientação do Contribuinte (MOC), versão 7.0, Anexo I, prevê a rejeição 298 para assinatura fora do padrão.
