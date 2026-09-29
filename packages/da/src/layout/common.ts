/** Peças compartilhadas pelos layouts: montagem do `Doc`, logotipo, códigos de barras, QR e marcas d'água. */

import { code128Chave, modules, QUIET_MODULES } from '../barcode/code128.ts';
import { qrMatrix } from '../barcode/qr.ts';
import type { Doc, DocImage, FitStats, FontName, Page } from '../model.ts';
import type { Canvas } from '../render/canvas.ts';
import { loadImage } from '../render/image.ts';
import { widthMm } from '../render/text.ts';

/** Opções comuns a todos os documentos auxiliares. */
export interface CommonOptions {
  /** Logotipo do emitente em PNG ou JPEG (MOC 7.0, Anexo II, 3.1.3: opcional). */
  readonly logo?: Uint8Array;
}

/** Junta páginas, imagens e contadores de encaixe num `Doc`. */
export class DocBuilder {
  private readonly images: Record<string, DocImage> = {};
  private readonly pages: Page[] = [];
  private stats: FitStats = { reduzidos: 0, quebrados: 0, cortados: 0 };
  readonly logo: { readonly ref: string; readonly img: DocImage } | undefined;

  constructor(options: CommonOptions) {
    if (options.logo) {
      const img = loadImage(options.logo);
      this.images.logo = img;
      this.logo = { ref: 'logo', img };
    }
  }

  /** Acrescenta uma página; `background` (marcas d'água) vai antes, atrás do conteúdo. */
  page(w: number, h: number, c: Canvas, background?: Canvas): void {
    this.pages.push({ w, h, ops: background ? [...background.ops, ...c.ops] : c.ops });
    const s = c.stats;
    this.stats = {
      reduzidos: this.stats.reduzidos + s.reduzidos,
      quebrados: this.stats.quebrados + s.quebrados,
      cortados: this.stats.cortados + s.cortados,
    };
  }

  build(title: string): Doc {
    return { title, pages: this.pages, images: this.images, stats: this.stats };
  }
}

/**
 * Desenha o logotipo encaixado no retângulo, sem distorcer, centralizado na vertical. Na horizontal, centralizado
 * (`'c'`) ou encostado à esquerda (`'l'`), para quem põe texto logo depois: a largura devolvida é então a ocupada a
 * partir de `x`.
 */
export function drawLogo(
  c: Canvas,
  b: DocBuilder,
  x: number,
  y: number,
  w: number,
  h: number,
  align: 'c' | 'l' = 'c',
): number {
  if (!b.logo) return 0;
  const { img, ref } = b.logo;
  const s = Math.min(w / img.width, h / img.height);
  const lw = img.width * s;
  const lh = img.height * s;
  c.image(ref, align === 'l' ? x : x + (w - lw) / 2, y + (h - lh) / 2, lw, lh);
  return lw;
}

/**
 * Módulo mínimo do código de barras: 0,2 mm, e o suficiente para que barras e zonas de silêncio somem 6 cm. O MOC 7.0
 * (Anexo II, cap. 2) chega aos 0,2 mm dividindo os 6 cm pelas 297 posições da chave numérica, zonas de silêncio
 * incluídas; 297 x 0,2 dá 59,4 mm, então a chave numérica fica com 0,202 mm. O híbrido C/A é mais longo e fica nos
 * 0,2 mm.
 */
export function moduloMinimo(widths: readonly number[]): number {
  return Math.max(0.2, 60 / (modules(widths) + 2 * QUIET_MODULES));
}

/**
 * CODE-128 da chave (C, ou o híbrido C/A com CNPJ alfanumérico) centralizado na área, com a zona de silêncio de 10
 * módulos de cada lado dentro dela. O módulo fica entre o mínimo (`moduloMinimo`) e `maxModule`. Devolve o módulo usado.
 */
export function barcode(
  c: Canvas,
  digits: string,
  x: number,
  y: number,
  w: number,
  h: number,
  maxModule = 0.3,
): number {
  const widths = code128Chave(digits);
  const total = modules(widths);
  const module = Math.max(moduloMinimo(widths), Math.min(maxModule, w / (total + 2 * QUIET_MODULES)));
  c.bars({ x: x + (w - total * module) / 2, y, h, module, widths });
  return module;
}

/**
 * Barras na vertical (papel estreito; MOC 7.0, Anexo II, 3.11.2 permite qualquer sentido), no módulo mínimo. Devolve
 * o comprimento ocupado, zonas de silêncio incluídas.
 */
export function barcodeVertical(c: Canvas, digits: string, x: number, y: number, len: number): number {
  const widths = code128Chave(digits);
  const module = moduloMinimo(widths);
  c.bars({ x, y: y + QUIET_MODULES * module, h: len, module, widths, vertical: true });
  return (modules(widths) + 2 * QUIET_MODULES) * module;
}

/**
 * QR Code num quadrado de lado `size`, com a zona de silêncio dentro. A norma fixa o total das duas margens: no mínimo
 * de 25 mm, "22mm de conteúdo para 3mm de margem segura" (22 + 3 = 25, ou 1,5 mm de cada lado); acima disso, 10% do
 * lado, 5% de cada lado (NT 2026.003, 3.4; MOC MDF-e 3.00a, Anexo II, 2.3). Nunca menos de 1,5 mm por lado.
 */
export function qrcode(c: Canvas, text: string, x: number, y: number, size: number): void {
  const matrix = qrMatrix(text, { ecc: 'M' });
  const quiet = Math.max(1.5, size * 0.05);
  c.qr({ x: x + quiet, y: y + quiet, size: size - 2 * quiet, modules: matrix });
}

/**
 * Marca d'água em diagonal, atrás do conteúdo (MOC 7.0, Anexo II, 3.10.1: sem prejudicar a legibilidade). As linhas
 * ficam centradas na página, a primeira maior.
 */
export function watermark(
  c: Canvas,
  pageW: number,
  pageH: number,
  lines: readonly string[],
  gray = 0.82,
  font: FontName = c.bold,
): void {
  const angle = (Math.atan2(pageH, pageW) * 180) / Math.PI;
  const diag = Math.hypot(pageW, pageH);
  const rad = (angle * Math.PI) / 180;
  const main = lines[0] ?? '';
  const mainSize = Math.min(90, (diag * 0.62) / Math.max(1, widthMm(main, font, 1)));
  const sizes = lines.map((_, i) =>
    i === 0 ? mainSize : Math.min(mainSize * 0.3, (diag * 0.6) / Math.max(1, widthMm(lines[i] ?? '', font, 1))),
  );
  const gap = 4;
  const heights = sizes.map((s) => s * 0.3528 * 0.8);
  const total = heights.reduce((a, b) => a + b, 0) + gap * (lines.length - 1);
  // Distância ao longo da normal da diagonal, do centro da página até a base de cada linha.
  let off = -total / 2;
  const marks = lines.map((s, i) => {
    off += heights[i] ?? 0;
    const size = sizes[i] ?? mainSize;
    const w = widthMm(s, font, size);
    const at = off;
    off += gap;
    // Centro da linha: centro da página deslocado ao longo da normal; início: recua metade da largura na direção.
    const cx = pageW / 2 + Math.sin(rad) * at;
    const cy = pageH / 2 + Math.cos(rad) * at;
    return { s, size, x: cx - (Math.cos(rad) * w) / 2, y: cy + (Math.sin(rad) * w) / 2 };
  });
  for (const m of marks) c.raw(m.s, m.x, m.y, font, m.size, gray, angle);
}
