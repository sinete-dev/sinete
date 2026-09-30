# `assinatura_documento_recusada`: o helper recusou assinar o documento

O `assinadorDeDocumentos` de uma identidade PKCS#11, interface de acesso ao token criptográfico, pediu ao helper `sinete-signer` a assinatura de um XML e o helper recusou. O helper só usa a chave do token para documentos fiscais cujo emitente ou autor seja compatível com o titular do certificado, conforme as regras abaixo. O erro é um `ErroSigner` (`@sinete/transport`), derivado de `ErroSinete`, com `code: 'assinatura_documento_recusada'`. Decida pelo `code`, usando `ehErroSinete(e, 'assinatura_documento_recusada')` de `@sinete/core`, nunca pela mensagem.

## Causa

O helper confere o `SignedInfo`, elemento que descreve o conteúdo e os algoritmos da assinatura XMLDSig, o padrão de assinatura digital de XML. Ele deve estar canonicalizado, isto é, representado em uma forma padronizada de XML. O perfil aceito exige C14N 1.0 para canonicalização, assinatura RSA-SHA1 ou RSA-SHA256 e uma única referência local a um `Id`, o identificador do elemento assinado. Essa referência deve ter as transformações `enveloped-signature`, que exclui a própria assinatura do conteúdo calculado, e C14N 1.0, nessa ordem. O resumo criptográfico da referência deve usar SHA-1 ou SHA-256, e o parâmetro `hash` do pedido deve corresponder ao algoritmo da assinatura.

O `Id` precisa ter o formato de um dos documentos fiscais eletrônicos aceitos: NF-e (Nota Fiscal Eletrônica), NFC-e (Nota Fiscal de Consumidor Eletrônica), MDF-e (Manifesto Eletrônico de Documentos Fiscais), CT-e (Conhecimento de Transporte Eletrônico), evento, inutilização de numeração, DPS (Declaração de Prestação de Serviços) ou pedido de registro de evento da NFS-e Nacional (Nota Fiscal de Serviço Eletrônica). Por padrão, o helper confere o CNPJ ou CPF presente nesse identificador contra o titular do certificado.

Para NF-e, NFC-e, MDF-e, CT-e, eventos desses documentos e inutilização, o helper também aceita CNPJs com a mesma base, os oito primeiros caracteres, permitindo que o certificado da matriz assine documentos da filial. Para DPS e eventos da NFS-e Nacional, exige correspondência completa. O CPF exige correspondência completa, com o preenchimento à esquerda usado no identificador. Se o helper não conseguir identificar o CNPJ ou CPF do titular no certificado, também recusa a assinatura.

Quando o pedido inclui o elemento referenciado canonicalizado, o helper confere seu resumo criptográfico contra o `DigestValue` do `SignedInfo`. Nos elementos de evento reconhecidos, confere também o `Id` e o autor informado no XML. Isso permite assinar um evento cuja chave de acesso pertence a outro emitente, como a manifestação do destinatário, em que o destinatário declara sua posição sobre a nota recebida. Sem esse elemento, vale apenas a conferência pelo identificador, e o evento é recusado se o emitente da chave não for compatível com o titular do certificado.

## Correção

Assine com o certificado do emitente ou do autor do evento, observando as regras de correspondência acima. Confira também o formato do `Id`, o perfil do `SignedInfo` e a correspondência entre o parâmetro `hash` e o algoritmo da assinatura.

Para evento feito como destinatário, envie também o elemento referenciado canonicalizado, pois a chave de acesso identifica quem emitiu a nota. O `assinadorDeDocumentos` já encaminha esse elemento ao helper quando recebe `ContextoDaAssinatura` no terceiro argumento de `assinar`, usando `contexto.referenciado`. O fluxo de assinatura XML de `@sinete/core/xml` fornece esse contexto quando o elemento referenciado está disponível. Se você chama `assinadorDeDocumentos.assinar` diretamente ou usa um adaptador, preserve esse contexto para que o helper possa conferir o autor, o `Id` e o resumo criptográfico do elemento.

## Armadilha

Não contorne assinando o hash em outro lugar com a mesma chave: a recusa existe para o token não virar um assinador cego de qualquer coisa que chegue pelo canal.
