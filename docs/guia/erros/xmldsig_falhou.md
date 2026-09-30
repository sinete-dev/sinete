# `xmldsig_falhou`: não foi possível assinar o XML

A assinatura digital do XML, no padrão XMLDSig, não pôde ser preparada ou montada. O erro é uma instância de `ErroAssinaturaXml`, exportada por `@sinete/core/xml`, que estende `ErroSinete` e tem `code: 'xmldsig_falhou'`. O campo `detalhes.motivo` informa o motivo. Decida como tratar o erro pelo `code`, usando `ehErroSinete(e, 'xmldsig_falhou')` de `@sinete/core`, nunca pela mensagem.

## Causa

Os motivos possíveis em `detalhes.motivo` são:

- `id-ausente`: nenhum elemento tem o atributo `Id` solicitado.
- `id-duplicado`: mais de um elemento tem o mesmo `Id`. A assinatura é recusada para evitar ambiguidade sobre o elemento assinado, uma defesa contra ataques de signature wrapping, que manipulam a estrutura do XML para confundir qual conteúdo está protegido pela assinatura.
- `referencia-na-raiz`: o elemento a assinar é a raiz do documento. A implementação precisa inserir o elemento `Signature` no mesmo pai do elemento assinado.
- `marcador-no-documento`: o XML já contém o marcador interno reservado para o valor da assinatura.
- `marcador-ausente`: o modelo preparado não contém exatamente um marcador, ou o elemento `SignedInfo` da assinatura inserida não foi encontrado.
- `assinatura-vazia`: o `Assinador` devolveu zero bytes, ou `montarAssinatura` recebeu uma assinatura vazia.

A função `conferirAssinatura`, de `@sinete/core/xml`, não lança exceções por falhas no documento. Nesses casos, devolve um resultado com `ok: false` e o motivo em `motivo`.

## Correção

Assine o documento que a montagem do sinete devolveu, usando o `Id` gerado por ela. No fluxo de `montarNfe` e `assinarNfe`, a primeira função monta o documento e gera o identificador; a segunda usa esse identificador para assinar.

Se implementar um `Assinador` próprio, a interface de assinatura de `@sinete/core`, confira que ele devolve os bytes completos da assinatura RSA PKCS#1 v1.5. Isso vale para integrações com certificado A3, módulo de segurança de hardware (HSM) ou serviço em nuvem. No modo `digest`, `assinarDigestInfo` recebe o DigestInfo SHA-1 de 35 bytes, composto pelo prefixo que identifica o algoritmo e pelo hash do `SignedInfo`. Esse conteúdo já está preparado para a operação RSA PKCS#1 v1.5 e não deve passar por um novo cálculo de hash.

Para A3 em token PKCS#11, A3 em nuvem de um prestador de serviços de confiança (PSC) ou chave não exportável, o sinete oferece o helper `sinete-signer`, em `helpers/signer-tls`, distribuído pelo pacote npm `@sinete/signer`. O cliente está em `@sinete/transport/signer`.

## Armadilha

Não remova o `Id` duplicado ou a assinatura existente à mão para assinar novamente um documento de outro sistema. Uma nova assinatura cria uma nova versão do documento; se ele já foi enviado, retome o processamento com os bytes originais.
