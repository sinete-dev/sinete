import { WIDTHS, WINANSI_EXTRA, ASCENT } from "./metrics-data.ts";
import { PT, type FontName } from "./model.ts";
// Converte para o repertório WinAnsi (CP1252) das fontes padrão do PDF. Fora dele: remove diacrítico; senão '?'.
export function toWinAnsi(s: string): string {
  let out = "";
  for (const ch of s.replace(/[\r\n\t]+/g, " ")) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WINANSI_EXTRA[cp] !== undefined) { out += ch; continue; }
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    out += base && [...base].every((c) => c.codePointAt(0)! < 0x100) ? base : "?";
  }
  return out;
}
export const code = (ch: string) => { const cp = ch.codePointAt(0)!; return cp < 0x100 ? cp : (WINANSI_EXTRA[cp] ?? 63); };
export function widthMm(s: string, font: FontName, size: number): number {
  const w = WIDTHS[font]; let u = 0;
  for (const ch of s) u += w[code(ch)] || 500;
  return (u / 1000) * size * PT;
}
export const ascentMm = (font: FontName, size: number) => (ASCENT[font] / 1000) * size * PT;
// quebra por palavra; palavra maior que a linha é cortada por caractere
export function wrap(s: string, font: FontName, size: number, maxW: number): string[] {
  const words = toWinAnsi(s).split(" ").filter(Boolean); const lines: string[] = []; let cur = "";
  const push = (w: string) => {
    if (widthMm(w, font, size) <= maxW) return w;
    let part = "";
    for (const ch of w) { if (widthMm(part + ch, font, size) > maxW && part) { lines.push(part); part = ""; } part += ch; }
    return part;
  };
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (widthMm(cand, font, size) <= maxW) { cur = cand; continue; }
    if (cur) lines.push(cur);
    cur = push(w);
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
