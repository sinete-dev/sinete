# `documento_inesperado`: o XML é de outro documento

O XML informado não tem a raiz esperada pela função que gera o documento auxiliar. O erro é um `DanfeError` (`@sinete/da`), que estende `SineteError`, com `code: 'documento_inesperado'`. Identifique-o pelo `code` (`isSineteError(e, 'documento_inesperado')`), nunca pela mensagem.

## Causa

Um MDF-e (Manifesto Eletrônico de Documentos Fiscais) passado ao `danfe`, uma NF-e (Nota Fiscal Eletrônica) ao `damdfe`, um evento no lugar da nota ou uma raiz que o leitor não reconhece. A validação considera tanto o nome da raiz quanto seu namespace XML. `details.raiz` informa o nome da raiz recebida, e `details.esperado` lista os nomes aceitos.

## Correção

Use a função e o caminho de importação correspondentes ao documento: `danfe` (`sinete/da/nfe`) para `nfeProc` ou `NFe`, `damdfe` (`sinete/da/mdfe`) para `mdfeProc` ou `MDFe`, `dacce` (`sinete/da/cce`) para o `procEventoNFe` da CC-e (Carta de Correção Eletrônica) e `danfse` (`sinete/da/nfse`) para a raiz `NFSe` da NFS-e (Nota Fiscal de Serviço Eletrônica) Nacional. Confira também se o namespace XML corresponde ao documento.

## Armadilha

O `danfe` aceita também a NFC-e (Nota Fiscal de Consumidor Eletrônica, modelo 65), que, sem a opção `formato`, sai como DANFC-e, seu documento auxiliar para impressão. Para quem imprime os dois modelos, uma chamada basta.
