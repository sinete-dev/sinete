# `campo_ausente`: falta um grupo obrigatório para o documento auxiliar

O XML tem a raiz esperada, mas falta um grupo ou campo necessário para gerar o documento auxiliar, a representação do documento fiscal para impressão. O erro é uma instância de `DanfeError` (`@sinete/da`), que estende `ErroSinete`, com `code: 'campo_ausente'`. Identifique-o pelo `code`, usando `ehErroSinete(e, 'campo_ausente')` de `@sinete/core`, nunca pela mensagem.

## Causa

Entre as causas estão:

- NF-e (Nota Fiscal Eletrônica) ou NFC-e (Nota Fiscal de Consumidor Eletrônica) sem `infNFe`, o grupo de informações da nota, ou sem seus grupos `ide` (identificação), `emit` (emitente) ou `total/ICMSTot` (totais).
- MDF-e (Manifesto Eletrônico de Documentos Fiscais) sem `infMDFe`, o grupo de informações do manifesto.
- NFS-e Nacional (Nota Fiscal de Serviço Eletrônica do padrão nacional) sem `infNFSe`, o grupo de informações da nota.
- NFC-e ou DANFE (Documento Auxiliar da Nota Fiscal Eletrônica) Simplificado Tipo 2 sem `infNFeSupl/qrCode` ou com esse campo vazio. O QR Code é obrigatório nesses formatos.

A ausência de outros grupos obrigatórios também pode gerar esse erro durante a preparação dos dados para o documento auxiliar.

## Correção

Use o XML completo e assinado enviado à SEFAZ (Secretaria da Fazenda), incluindo o protocolo de autorização quando disponível. Para a NFS-e Nacional, use o XML autorizado com raiz `NFSe`. Na NFC-e, preserve o grupo `infNFeSupl`, que contém o QR Code e integra o XML final retornado por `signNfe`.

## Armadilha

Um XML resumido, como o `resNFe` retornado pelo serviço de Distribuição DF-e (Documentos Fiscais Eletrônicos), não contém os grupos da nota. Se passado diretamente ao gerador, ele causa `documento_inesperado`, pois sua raiz não é aceita. Para imprimir uma nota recebida, obtenha o XML completo com raiz `nfeProc`, que reúne a nota e o protocolo de autorização.
