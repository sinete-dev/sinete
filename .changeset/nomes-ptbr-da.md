---
'@sinete/da': minor
'sinete': minor
---

Nomes da API pública em português (ADR 0015, fase 3). Sem aliases: quem usa a 0.1.x troca os nomes ao atualizar.

Mudanças de comportamento:

- O `name` do `ErroDa` passa a ser `'ErroDa'`.
- `detalhes` dos erros: `ecc` → `nivelDeCorrecao` (QR Code grande demais) e `use` → `usar` (DANFE NFC-e de um modelo 55).

Nomes exportados:

| Antigo | Novo |
|---|---|
| `DanfeError` | `ErroDa` |
| `DanfeErrorCode` | `CodigoErroDa` |
| `QrEcc` | `NivelCorrecaoQr` |
| `QrOptions` | `QrOpcoes` |
| `qrMatrix` | `matrizQr` |
| `BobinaOptions` | `BobinaOpcoes` |
| `CommonOptions` | `DaOpcoes` |
| `DacceOptions` | `DacceOpcoes` |
| `DamdfeOptions` | `DamdfeOpcoes` |
| `DanfeA4Options` | `DanfeA4Opcoes` |
| `DanfseOptions` | `DanfseOpcoes` |
| `SimplificadoOptions` | `SimplificadoOpcoes` |
| `DanfceOptions` | `DanfceOpcoes` |
| `DanfeOptions` | `DanfeOpcoes` |
| `BarsOp` | `OpBarras` |
| `Doc` | `Documento` |
| `DocImage` | `ImagemDoDocumento` |
| `FitStats` | `EstatisticasDeEncaixe` |
| `FontName` | `NomeDaFonte` |
| `ImageOp` | `OpImagem` |
| `LineOp` | `OpLinha` |
| `Page` | `Pagina` |
| `QrOp` | `OpQr` |
| `RectOp` | `OpRetangulo` |
| `TextOp` | `OpTexto` |
| `toHtml` | `gerarHtml` |
| `toSvg` | `gerarSvg` |
| `PdfOptions` | `PdfOpcoes` |
| `toPdf` | `gerarPdf` |

Membros e parâmetros com nome:

| Tipo | Antigo | Novo |
|---|---|---|
| `ErroDa` | `constructor.options` | `constructor.opcoes` |
| `code128C` | `digits` | `digitos` |
| `QrOpcoes` | `ecc` | `nivelDeCorrecao` |
| `QrOpcoes` | `mask` | `mascara` |
| `matrizQr` | `text` | `texto` |
| `matrizQr`, `gerarPdf`, `danfe`, `danfce`, `damdfe` e mais 2 | `options` | `opcoes` |
| `OpBarras` | `module` | `modulo` |
| `OpBarras` | `widths` | `larguras` |
| `Documento` | `title` | `titulo` |
| `Documento` | `pages` | `paginas` |
| `Documento` | `images` | `imagens` |
| `Documento` | `stats` | `estatisticas` |
| `ImagemDoDocumento` | `format` | `formato` |
| `ImagemDoDocumento` | `width` | `largura` |
| `ImagemDoDocumento` | `height` | `altura` |
| `OpImagem` | `ref` | `imagem` |
| `OpLinha`, `OpRetangulo` | `dash` | `tracejado` |
| `OpLinha`, `OpTexto` | `gray` | `cinza` |
| `OpQr`, `OpTexto` | `size` | `tamanho` |
| `OpQr` | `modules` | `modulos` |
| `OpRetangulo` | `stroke` | `contorno` |
| `OpRetangulo` | `fill` | `preenchimento` |
| `OpTexto` | `font` | `fonte` |
| `OpTexto` | `rot` | `rotacao` |
| `gerarHtml`, `gerarSvg`, `gerarPdf` | `doc` | `documento` |
| `gerarSvg` | `page` | `pagina` |
| `PdfOpcoes` | `compress` | `comprimir` |
| `PdfOpcoes` | `info` | `informacoes` |

Valores de união literal e textos:

| Tipo | Antigo | Novo |
|---|---|---|
| `OpBarras` | `'bars'` | `'barras'` |
| `OpImagem` | `'image'` | `'imagem'` |
| `OpLinha` | `'line'` | `'linha'` |
| `OpRetangulo` | `'rect'` | `'retangulo'` |
| `OpTexto` | `'text'` | `'texto'` |
