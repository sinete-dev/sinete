/**
 * `@sinete/da`: documentos auxiliares dos DF-e a partir do XML autorizado (ADR 0006). A raiz tem o que é comum a todos
 * (renderizadores, modelo do documento, códigos de barras e erros); cada documento está no próprio subpath, para que
 * quem importa um não leve ao bundle o layout dos outros: `@sinete/da/nfe` (DANFE), `@sinete/da/nfce` (DANFE NFC-e),
 * `@sinete/da/mdfe` (DAMDFE) e `@sinete/da/cce` (DACCE).
 *
 * O layout é uma função pura do XML para um `Doc` (páginas de operações em mm); `toPdf` e `toHtml`/`toSvg` só
 * desenham. A mesma entrada gera os mesmos bytes em Node, Bun, Deno e no browser: sem data de criação, sem fonte
 * embutida, sem dependência nativa.
 */

export { code128C, code128Chave } from './barcode/code128.ts';
export type { QrEcc, QrOptions } from './barcode/qr.ts';
export { qrMatrix } from './barcode/qr.ts';
export type { DanfeErrorCode } from './errors.ts';
export { DanfeError } from './errors.ts';
export type { CommonOptions } from './layout/common.ts';
export type {
  BarsOp,
  Doc,
  DocImage,
  FitStats,
  FontName,
  ImageOp,
  LineOp,
  Op,
  Page,
  QrOp,
  RectOp,
  TextOp,
} from './model.ts';
export { toHtml, toSvg } from './render/html.ts';
export type { PdfOptions } from './render/pdf.ts';
export { toPdf } from './render/pdf.ts';
