# `xml_malformado`: o XML não é bem formado

O parser estrito do `@sinete/core/xml` recusou o XML. A propriedade `posicao` indica a posição em que o problema foi detectado, em unidades UTF-16 da string, com contagem a partir de zero. O erro lançado é um `ErroXml`, exportado por `@sinete/core/xml`, que estende `ErroSinete` com `code: 'xml_malformado'`. Para identificar o erro, use `ehErroSinete(e, 'xml_malformado')`, de `@sinete/core`, nunca a mensagem.

## Causa

O texto viola as regras de XML 1.0 com namespaces, que associam nomes de elementos e atributos a um espaço de nomes, ou usa um recurso que o parser recusa de propósito. Entre as causas estão: `&` sem escape, entidade desconhecida, `<` dentro de atributo, `]]>` em texto comum, atributo duplicado, prefixo não declarado e caractere fora do conjunto permitido pela regra `Char` do XML 1.0. O parser também recusa aninhamento acima de 256 níveis e qualquer DTD, uma definição de tipo de documento introduzida por `DOCTYPE`. A recusa de DTD impede a expansão de entidades nela definidas e ataques por entidades externas (XXE).

## Correção

Se o XML veio de fora, por importação ou de outro emissor, confira a causa indicada pelo erro antes de concluir que ele está corrompido: DTD e profundidade acima do limite também provocam a recusa. Se a cópia de um documento autorizado contém um problema de formação, como `&` sem escape, investigue se alguma etapa de transporte ou armazenamento alterou o texto e busque a cópia original. Se o XML é seu, consulte o `offset` e corrija o código que gerou o texto.

## Armadilha

Outra biblioteca pode aceitar esse mesmo texto. Aqui, a recusa é intencional: um documento malformado não tem uma representação padronizada confiável, chamada forma canônica, para calcular ou verificar a assinatura. O parser também impõe as restrições de DTD e profundidade descritas acima. Não tente "limpar" um XML assinado com substituições apenas para fazê-lo passar pelo parser: elas podem alterar o conteúdo assinado e invalidar a assinatura.
