// Primitivas de layout sobre o modelo: caixa com rótulo, texto ajustado, parágrafo com quebra.
import { type FontName, type Op, PT } from "./model.ts";
import { ascentMm, toWinAnsi, widthMm, wrap } from "./text.ts";
export interface Fit { shrunk: number; clipped: number }
export class Canvas {
  ops: Op[] = [];
  fit: Fit = { shrunk: 0, clipped: 0 };
  static log?: string[];
  constructor(public serif = true) {}
  get R(): FontName { return this.serif ? "Times-Roman" : "Helvetica"; }
  get B(): FontName { return this.serif ? "Times-Bold" : "Helvetica-Bold"; }
  rect(x: number, y: number, w: number, h: number, stroke = 0.15, fill?: number) { this.ops.push({ t: "rect", x, y, w, h, stroke, fill }); }
  line(x1: number, y1: number, x2: number, y2: number, w = 0.15, dash?: number) { this.ops.push({ t: "line", x1, y1, x2, y2, w, dash }); }
  // uma linha de texto; align l/c/r dentro de [x, x+w]; reduz a fonte até minSize e, se ainda não couber, corta com reticências
  text(s: string, x: number, yBase: number, w: number, o: { font?: FontName; size: number; minSize?: number; align?: "l" | "c" | "r"; gray?: number; tag?: string }) {
    const font = o.font ?? this.R; let size = o.size; let str = toWinAnsi(s);
    const min = o.minSize ?? size;
    while (widthMm(str, font, size) > w && size > min) size = Math.max(min, size - 0.25);
    if (size < o.size) { this.fit.shrunk++; Canvas.log?.push(`reduz:${o.tag ?? "?"}`); }
    if (widthMm(str, font, size) > w) { this.fit.clipped++; Canvas.log?.push(`corte:${o.tag ?? "?"}`); while (str && widthMm(str + "...", font, size) > w) str = str.slice(0, -1); str += "..."; }
    const tw = widthMm(str, font, size);
    const dx = o.align === "r" ? w - tw : o.align === "c" ? (w - tw) / 2 : 0;
    if (str) this.ops.push({ t: "text", x: x + dx, y: yBase, s: str, font, size, w: tw, gray: o.gray });
    return size;
  }
  // campo do DANFE: retângulo, rótulo em caixa alta no topo e valor
  field(x: number, y: number, w: number, h: number, label: string, value: string, o: { size?: number; minSize?: number; align?: "l" | "c" | "r"; bold?: boolean; labelSize?: number } = {}) {
    this.rect(x, y, w, h);
    const ls = o.labelSize ?? 5.5;
    this.text(label.toUpperCase(), x + 0.6, y + 0.5 + ascentMm(this.R, ls), w - 1.2, { size: ls, minSize: 4.5 });
    const size = o.size ?? 8;
    if (!value) return;
    const font = o.bold ? this.B : this.R, min = o.minSize ?? 6, str = toWinAnsi(value);
    // não cabe numa linha nem no tamanho mínimo: duas linhas no tamanho mínimo do MOC (6 pt) antes de cortar
    if (widthMm(str, font, min) > w - 1.2 && h >= 7) {
      const ls = wrap(str, font, 6, w - 1.2);
      this.fit.shrunk++; Canvas.log?.push(`2linhas:${label}`);
      this.text(ls[0], x + 0.6, y + h - 3.4, w - 1.2, { font, size: 6, align: o.align ?? "l", tag: label });
      this.text(ls.length > 2 ? `${ls[1]} ${ls.slice(2).join(" ")}` : (ls[1] ?? ""), x + 0.6, y + h - 1.0, w - 1.2, { font, size: 6, align: o.align ?? "l", tag: label });
      return;
    }
    this.text(value, x + 0.6, y + h - 1.2, w - 1.2, { font, size, minSize: min, align: o.align ?? "l", tag: label });
  }
  // parágrafo; devolve as linhas que não couberam (para continuar em outra folha)
  para(lines: string[], x: number, y: number, h: number, font: FontName, size: number, lead = 1.15): string[] {
    const lh = size * PT * lead; let yy = y + ascentMm(font, size); let i = 0;
    for (; i < lines.length && yy <= y + h; i++, yy += lh) this.ops.push({ t: "text", x, y: yy, s: lines[i], font, size, w: widthMm(lines[i], font, size) });
    return lines.slice(i);
  }
  title(s: string, x: number, y: number, size = 6) { this.text(s, x, y + 3, 150, { font: this.B, size }); }
  wrap(s: string, font: FontName, size: number, w: number) { return wrap(s, font, size, w); }
}
