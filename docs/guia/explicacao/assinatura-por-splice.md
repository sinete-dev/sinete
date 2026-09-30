# Por que o sinete assina a string final e nunca mais toca nela

A assinatura digital XMLDSig dos documentos fiscais eletrônicos (DF-e) usa uma forma canônica do XML, isto é, uma representação padronizada para o cálculo criptográfico. O sinete assina com C14N 1.0 inclusivo, sem comentários, e RSA-SHA1. A `Reference` aponta para o atributo `Id` do elemento assinado, como `infNFe` nos dados da nota, `infEvento` nos eventos, `infMDFe` no manifesto de documentos fiscais ou `infDPS` na Declaração de Prestação de Serviços.

Uma alteração que mude essa forma canônica faz o resumo criptográfico, chamado digest, deixar de conferir. Isso pode acontecer ao inserir espaços no conteúdo ou acrescentar um namespace herdado. Trocar a ordem dos atributos ou as aspas que delimitam seus valores, por outro lado, não altera a forma canônica. Um `&` sem escape torna o XML malformado. Na autorização de NF-e, a divergência de assinatura corresponde à rejeição 297, “Assinatura difere do calculado”. Esta página explica como o sinete preserva o texto assinado. A decisão está registrada no ADR 0003 do sinete.

## O padrão que quebra

Bibliotecas de XMLDSig que trabalham sobre uma árvore DOM, a representação do documento em memória, podem devolver o XML reserializado. A string produzida pelo serializador pode ser diferente da original e ainda ter a mesma forma canônica. O problema aparece quando a transformação altera o conteúdo assinado ou seu contexto, por exemplo ao inserir indentação entre elementos ou acrescentar namespaces nos ancestrais. Trocar aspas ou normalizar fins de linha conforme as regras do XML não invalida, por si só, a assinatura.

O mesmo risco existe fora da biblioteca: ao guardar o XML num campo que o reformata ou ao montar o envelope `nfeProc`, que reúne a nota e o protocolo de autorização, passando o documento por um parser e um serializador.

## Como o sinete assina

1. A montagem serializa os elementos na ordem do XSD, o esquema que define a estrutura do XML, com escapes, atributos e tags no formato usado pela canonicalização. Os namespaces herdados são considerados na etapa seguinte.
2. `prepararAssinatura` localiza o elemento pelo `Id`, calcula o digest de sua forma canônica e insere o `<Signature>` por splice, uma inserção direta na string. A assinatura entra como último filho do pai do elemento, com um marcador no lugar de `SignatureValue`. O `SignedInfo`, que contém a referência, os algoritmos e o digest, é canonicalizado nesse contexto final.
3. `assinarPreparada` pede a assinatura ao `Assinador`. No modo `dados`, ele recebe os bytes do `SignedInfo` canonicalizado, como no A1 via WebCrypto. No modo `digest`, recebe apenas o `DigestInfo`, que reúne a identificação do algoritmo e o hash do `SignedInfo`, permitindo integrações com dispositivos e serviços de assinatura sem enviar o conteúdo do documento.
4. `montarAssinatura` troca o marcador pelo valor da assinatura em base64. Depois da inserção do `<Signature>`, essa é a única edição da string.

O A3 em token PKCS#11 funciona pelo helper `sinete-signer`, implementado em `helpers/signer-tls`, distribuído no npm como `@sinete/signer` e acessado pelo cliente `@sinete/transport/signer`. Nesse caso, o `documentSigner` usa o modo `dados`: envia ao helper o `SignedInfo` e, no fluxo de `assinarPreparada`, o elemento referenciado canonicalizado para validação. Portanto, esse conteúdo sai do processo da aplicação. Para A3 em nuvem de um prestador de serviços de confiança (PSC) e outras chaves não exportáveis, o helper oferece a conexão TLS com autenticação mútua; no modo `remote`, a aplicação fornece o `Assinador` dos documentos.

A saída da assinatura é a entrada com exatamente uma inserção. O XML assinado segue para o autorizador, para o `store`, responsável pela persistência, e para os documentos processados. O `nfeProc`, o `procEventoNFe`, que reúne evento e protocolo, e os envelopes do manifesto eletrônico de documentos fiscais (MDF-e) são montados por concatenação, preservando o texto do documento assinado. A declaração XML inicial, quando presente, é removida para permitir sua inclusão no envelope. O simulador e o transporte também preservam o XML assinado, sem reserializá-lo.

Na verificação, `conferirAssinatura` exige o `Id` esperado e permite informar também o nome do elemento em `elemento`. Recusa mais de um elemento com esse `Id` ou mais de uma assinatura que o referencie. Para evitar que uma assinatura válida seja usada para apresentar outro conteúdo como assinado, informe também o nome esperado e leia os dados do elemento retornado pela verificação.

## O que isso pede de quem integra

- **Guarde a string como veio.** Use um campo de texto (`text`, `TEXT`, `VARCHAR`), sem reformatação. Evite tipos XML do banco que normalizem o documento e não passe o texto armazenado por um ciclo de parser e serializador.
- **Não acrescente namespaces extras nos envelopes.** O C14N inclusivo considera os namespaces declarados nos ancestrais. Um novo `xmlns:xsi` no `nfeProc` pode alterar a forma canônica do elemento assinado e invalidar a assinatura. O namespace padrão já usado pelo documento pode ser declarado pelo envelope, como fazem os envelopes do sinete, sem introduzir um namespace novo no contexto assinado.
- **A codificação é responsabilidade de quem fornece a string.** O sinete converte a forma canônica para UTF-8 antes do cálculo criptográfico. Isso não corrige caracteres que já chegaram errados à string. No teste registrado no ADR 0003, um bundle carregado numa página sem `<meta charset="utf-8">` foi decodificado como windows-1252 e gerou outra assinatura.
- **XML de terceiros pode ter sido alterado.** Quando o digest diverge, o verificador retorna `failure: 'digest-diverge'` e informa em `signedInfoValid` se a assinatura do `SignedInfo` confere. O valor `true` indica que o resumo assinado não corresponde ao elemento recebido, o que ajuda a identificar alterações posteriores. O valor `false` indica que a assinatura do próprio `SignedInfo` também não confere; sozinho, ele não prova que a assinatura nunca foi válida.

## Parser estrito

O parser do sinete recusa XML malformado, como texto com `&` sem escape, atributo duplicado ou prefixo não declarado. Também recusa DTD, a definição de tipo de documento, e aninhamento acima de 256 níveis, mesmo que o XML seja bem formado. Essas recusas geram `ErroXml`, com o código `xml_malformado`. Quando recebe uma string, `conferirAssinatura` converte esse erro em um resultado com `motivo: 'leitura'`.

Um documento que outra biblioteca aceitaria pode ser recusado aqui, de propósito. A recusa de DTD impede o uso de entidades externas e sua expansão, e um documento malformado não tem forma canônica confiável.

## Veja também

- [Por que gravar os bytes antes do envio](bytes-antes-do-envio.md).
- Erros: [`xml_malformado`](../erros/xml_malformado.md) e [`xmldsig_falhou`](../erros/xmldsig_falhou.md).
- Referência: [`@sinete/core`](../referencia/core.md) (subpath `@sinete/core/xml`).
