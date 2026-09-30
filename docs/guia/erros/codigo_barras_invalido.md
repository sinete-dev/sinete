# `codigo_barras_invalido`: o conteúdo não cabe no código de barras

O conteúdo do código de barras ou do QR Code não pode ser codificado. O erro é uma instância de `DanfeError` (`@sinete/da`), que estende `ErroSinete`, com `code: 'codigo_barras_invalido'`. Identifique o erro pelo `code`, usando `ehErroSinete(e, 'codigo_barras_invalido')` de `@sinete/core`, nunca pela mensagem.

## Causa

Chave de acesso vazia ou com caractere fora de 0-9 e A-Z. A chave com CNPJ alfanumérico usa o CODE-128 híbrido, formato de código de barras que combina os subconjuntos C e A, conforme a Nota Técnica (NT) 2025.001.

Ao usar `code128C`, o erro também ocorre se o conteúdo estiver vazio, contiver caracteres que não sejam dígitos ou tiver uma quantidade ímpar de dígitos. Para QR Code, ocorre quando o conteúdo excede a capacidade máxima suportada, até a versão 40, considerando o nível de correção de erros utilizado.

## Correção

Confira a chave de acesso no atributo `Id` de `infNFe` ou de `infMDFe` no XML fornecido. A biblioteca remove o prefixo `NFe` ou `MDFe` antes de codificar a chave. Um caractere inválido pode indicar um problema na geração ou uma alteração do XML; esse erro, por si só, não comprova que o documento foi alterado após a autorização. A leitura de NF-e também aceita o XML `NFe` ainda sem protocolo de autorização.

Se o erro ocorrer ao chamar `code128C` diretamente, forneça uma sequência não vazia, composta apenas por dígitos e com comprimento par. Para uma chave de acesso que possa conter letras maiúsculas, use `code128Chave`.

Para QR Code, confira o campo `infNFeSupl/qrCode` da Nota Fiscal de Consumidor Eletrônica (NFC-e) ou `infMDFeSupl/qrCodMDFe` do Manifesto Eletrônico de Documentos Fiscais (MDF-e). O conteúdo é lido do XML fornecido; verifique se o endereço e os parâmetros de consulta foram gerados corretamente.

## Armadilha

Não corte o conteúdo do QR Code para caber: ele precisa levar o endereço e os parâmetros completos da consulta.
