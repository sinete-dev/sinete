/**
 * `@sinete/da`: documentos auxiliares dos DF-e a partir do XML autorizado (ADR 0006). A raiz tem o que é comum a todos
 * (renderizadores, modelo do documento, códigos de barras e erros); cada documento está no próprio subpath, para que
 * quem importa um não leve ao bundle o layout dos outros: `@sinete/da/nfe` (DANFE), `@sinete/da/nfce` (DANFE NFC-e),
 * `@sinete/da/mdfe` (DAMDFE) e `@sinete/da/cce` (DACCE).
 *
 * O layout é uma função pura do XML para um `Documento` (páginas de operações em mm); `gerarPdf` e `gerarHtml`/`gerarSvg` só
 * desenham. A mesma entrada gera os mesmos bytes em Node, Bun, Deno e no browser: sem data de criação, sem fonte
 * embutida, sem dependência nativa.
 */

export { code128C, code128Chave } from './barcode/code128.ts';
export type { NivelCorrecaoQr, QrOpcoes } from './barcode/qr.ts';
export { matrizQr } from './barcode/qr.ts';
export type { CodigoErroDa } from './errors.ts';
export { ErroDa } from './errors.ts';
export type { DaOpcoes } from './layout/common.ts';
export type {
  Documento,
  EstatisticasDeEncaixe,
  ImagemDoDocumento,
  NomeDaFonte,
  Op,
  OpBarras,
  OpImagem,
  OpLinha,
  OpQr,
  OpRetangulo,
  OpTexto,
  Pagina,
} from './model.ts';
export { gerarHtml, gerarSvg } from './render/html.ts';
export type { PdfOpcoes } from './render/pdf.ts';
export { gerarPdf } from './render/pdf.ts';
