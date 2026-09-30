/**
 * Primitivas de layout sobre o modelo: linhas, caixas, texto medido, campo com rótulo e parágrafo. Toda decisão de
 * encaixe de texto passa por `fit`, que aplica a regra do ADR 0006 (decisão 7):
 *
 * 1. uma linha no tamanho nominal;
 * 2. se não couber, reduz a fonte em passos de 0,25 pt até o mínimo (6 pt, o menor tamanho de conteúdo do MOC 7.0,
 *    Anexo II, 3.7.7 e 3.7.8);
 * 3. se nem no mínimo couber, quebra em linhas no tamanho mínimo, até onde a altura permitir;
 * 4. só então corta a última linha com reticências, e conta o corte.
 */

import type { EstatisticasDeEncaixe, NomeDaFonte, Op, OpBarras, OpQr } from '../model.ts';
import { PT } from '../model.ts';
import { ascentMm, ellipsis, shrinkToFit, toWinAnsi, widthMm, wrap } from './text.ts';

export type Align = 'l' | 'c' | 'r';

/** Tamanho mínimo de conteúdo (MOC 7.0, Anexo II, 3.7.7, 3.7.8, 3.11.3 e 3.12.3). */
export const MIN_SIZE = 6;

/** Entrelinha: altura de uma linha de texto em mm para um tamanho em pontos. */
export function lineHeight(size: number, lead = 1.15): number {
  return size * PT * lead;
}

export interface Fitted {
  readonly size: number;
  readonly lines: readonly string[];
  readonly reduzido: boolean;
  readonly quebrado: boolean;
  readonly cortado: boolean;
}

/**
 * Encaixa `s` numa área de largura `w` e no máximo `maxLines` linhas, pela regra de redução até o mínimo e depois
 * quebra. Não desenha nada.
 */
export function fit(
  s: string,
  font: NomeDaFonte,
  nominal: number,
  w: number,
  maxLines = 1,
  min: number = MIN_SIZE,
): Fitted {
  const str = toWinAnsi(s).trim();
  const low = Math.min(min, nominal);
  const size = shrinkToFit(str, font, nominal, low, w);
  if (widthMm(str, font, size) <= w) {
    return { size, lines: [str], reduzido: size < nominal, quebrado: false, cortado: false };
  }
  const lines = wrap(str, font, low, w);
  if (lines.length <= maxLines) {
    return { size: low, lines, reduzido: low < nominal, quebrado: lines.length > 1, cortado: false };
  }
  const kept = lines.slice(0, Math.max(1, maxLines));
  const lastIndex = kept.length - 1;
  kept[lastIndex] = ellipsis(`${kept[lastIndex]} ${lines.slice(kept.length).join(' ')}`, font, low, w);
  return { size: low, lines: kept, reduzido: low < nominal, quebrado: kept.length > 1, cortado: true };
}

export interface TextOptions {
  readonly font?: NomeDaFonte;
  readonly size: number;
  readonly min?: number;
  readonly align?: Align;
  readonly gray?: number;
  /** Texto fixo do leiaute (rótulo, título): encaixa igual, mas não entra nos contadores de dado reduzido. */
  readonly fixo?: boolean;
}

export interface FieldOptions {
  /** Tamanho nominal do conteúdo, em pt (MOC 3.7.9: 10 pt). */
  readonly size?: number;
  readonly bold?: boolean;
  readonly align?: Align;
  /** Tamanho do rótulo, em pt (MOC 3.7.3: mínimo 6 pt). */
  readonly labelSize?: number;
  /** Sem contorno (o quadro é desenhado por fora). */
  readonly noBorder?: boolean;
}

export class Canvas {
  readonly ops: Op[] = [];
  private reduzidos = 0;
  private quebrados = 0;
  private cortados = 0;

  readonly regular: NomeDaFonte;
  readonly bold: NomeDaFonte;

  constructor(regular: NomeDaFonte, bold: NomeDaFonte) {
    this.regular = regular;
    this.bold = bold;
  }

  get stats(): EstatisticasDeEncaixe {
    return { reduzidos: this.reduzidos, quebrados: this.quebrados, cortados: this.cortados };
  }

  /** Soma os contadores de outro encaixe (feito fora do canvas) nas estatísticas. */
  count(f: Fitted): void {
    if (f.reduzido) this.reduzidos++;
    if (f.quebrado) this.quebrados++;
    if (f.cortado) this.cortados++;
  }

  rect(x: number, y: number, w: number, h: number, stroke = 0.15, fill?: number): void {
    this.ops.push(
      fill === undefined
        ? { t: 'retangulo', x, y, w, h, contorno: stroke }
        : { t: 'retangulo', x, y, w, h, contorno: stroke, preenchimento: fill },
    );
  }

  fillRect(x: number, y: number, w: number, h: number, fill: number): void {
    this.ops.push({ t: 'retangulo', x, y, w, h, preenchimento: fill });
  }

  line(x1: number, y1: number, x2: number, y2: number, w = 0.15, dash?: number): void {
    this.ops.push(
      dash === undefined ? { t: 'linha', x1, y1, x2, y2, w } : { t: 'linha', x1, y1, x2, y2, w, tracejado: dash },
    );
  }

  bars(op: Omit<OpBarras, 't'>): void {
    this.ops.push({ t: 'barras', ...op });
  }

  qr(op: Omit<OpQr, 't'>): void {
    this.ops.push({ t: 'qr', ...op });
  }

  image(ref: string, x: number, y: number, w: number, h: number): void {
    this.ops.push({ t: 'imagem', imagem: ref, x, y, w, h });
  }

  /** Texto já encaixado, sem medir de novo; devolve a largura. */
  raw(s: string, x: number, y: number, font: NomeDaFonte, size: number, gray?: number, rot?: number): number {
    const w = widthMm(s, font, size);
    if (!s) return 0;
    this.ops.push({
      t: 'texto',
      x,
      y,
      s,
      fonte: font,
      tamanho: size,
      w,
      ...(gray === undefined ? {} : { cinza: gray }),
      ...(rot === undefined ? {} : { rotacao: rot }),
    });
    return w;
  }

  /** Texto já encaixado em cor RGB (só onde a norma pede cor). */
  rawRgb(
    s: string,
    x: number,
    y: number,
    font: NomeDaFonte,
    size: number,
    rgb: readonly [number, number, number],
  ): void {
    if (s) this.ops.push({ t: 'texto', x, y, s, fonte: font, tamanho: size, w: widthMm(s, font, size), rgb });
  }

  /** Uma linha alinhada em [x, x + w], com redução até o mínimo e reticências como último recurso. */
  text(s: string, x: number, yBase: number, w: number, o: TextOptions): number {
    const font = o.font ?? this.regular;
    const f = fit(s, font, o.size, w, 1, o.min ?? MIN_SIZE);
    if (!o.fixo) this.count(f);
    this.aligned(f.lines[0] ?? '', x, yBase, w, font, f.size, o.align ?? 'l', o.gray);
    return f.size;
  }

  aligned(
    s: string,
    x: number,
    yBase: number,
    w: number,
    font: NomeDaFonte,
    size: number,
    align: Align,
    gray?: number,
  ): void {
    const tw = widthMm(s, font, size);
    const dx = align === 'r' ? w - tw : align === 'c' ? (w - tw) / 2 : 0;
    this.raw(s, x + dx, yBase, font, size, gray);
  }

  /**
   * Texto em várias linhas numa caixa de altura `h` a partir do topo `y`: redução até o mínimo e quebra, alinhado.
   * Devolve a altura usada.
   */
  block(s: string, x: number, y: number, w: number, h: number, o: TextOptions & { lead?: number }): number {
    const font = o.font ?? this.regular;
    const lead = o.lead ?? 1.15;
    const min = o.min ?? MIN_SIZE;
    const maxLines = Math.max(1, Math.floor((h - ascentMm(font, min)) / lineHeight(min, lead)) + 1);
    const f = fit(s, font, o.size, w, maxLines, min);
    // Parágrafo fixo do leiaute quebra por natureza; só o corte conta.
    if (!o.fixo) this.count(f);
    else if (f.cortado) this.count({ ...f, reduzido: false, quebrado: false });
    let yy = y + ascentMm(font, f.size);
    for (const l of f.lines) {
      this.aligned(l, x, yy, w, font, f.size, o.align ?? 'l', o.gray);
      yy += lineHeight(f.size, lead);
    }
    return f.lines.length * lineHeight(f.size, lead);
  }

  /** Campo do formulário: contorno, rótulo (já em caixa alta; MOC 3.7.3) no topo e conteúdo encaixado na altura que sobra. */
  field(x: number, y: number, w: number, h: number, label: string, value: string, o: FieldOptions = {}): void {
    if (!o.noBorder) this.rect(x, y, w, h);
    const ls = o.labelSize ?? MIN_SIZE;
    const pad = 0.6;
    const labelFit = fit(label, this.regular, ls, w - 2 * pad, 1, Math.min(ls, 5));
    this.raw(
      labelFit.lines[0] ?? '',
      x + pad,
      y + 0.4 + ascentMm(this.regular, labelFit.size),
      this.regular,
      labelFit.size,
    );
    if (!value) return;
    const font = o.bold ? this.bold : this.regular;
    const top = y + 0.6 + ascentMm(this.regular, ls);
    const avail = y + h - 0.6 - top;
    const size = o.size ?? 10;
    const maxLines = Math.max(1, Math.floor(avail / lineHeight(MIN_SIZE)));
    const f = fit(value, font, size, w - 2 * pad, maxLines);
    this.count(f);
    const lh = lineHeight(f.size);
    // Conteúdo encostado na base do campo, como no MOC; várias linhas sobem a partir da base.
    let yy = y + h - 0.9 - (f.lines.length - 1) * lh;
    for (const l of f.lines) {
      this.aligned(l, x + pad, yy, w - 2 * pad, font, f.size, o.align ?? 'l');
      yy += lh;
    }
  }

  /** Título de bloco em negrito e caixa alta (MOC 3.7.1: mínimo 5 pt), com a base 3 mm abaixo de `y`. */
  title(s: string, x: number, y: number, w: number, size = 6): void {
    this.text(s, x, y + 3, w, { font: this.bold, size, min: 5, fixo: true });
  }

  /** Parágrafo de linhas já quebradas; devolve as que não couberam na altura (para continuar em outra folha). */
  para(
    lines: readonly string[],
    x: number,
    y: number,
    h: number,
    font: NomeDaFonte,
    size: number,
    lead = 1.15,
  ): string[] {
    const lh = lineHeight(size, lead);
    let yy = y + ascentMm(font, size);
    let i = 0;
    for (; i < lines.length && yy <= y + h; i++, yy += lh) this.raw(lines[i] ?? '', x, yy, font, size);
    return lines.slice(i);
  }
}
