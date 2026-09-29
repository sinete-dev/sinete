// HTML com uma <svg> por página, em mm. Cada texto leva textLength com a largura calculada pelas métricas AFM,
// então a posição não depende da fonte que o navegador escolher (Times New Roman, Liberation Serif, Tinos...).
import type { Doc, Op, Page } from "../model.ts";
const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FAM: Record<string, string> = {
  "Times-Roman": "ft", "Times-Bold": "ft b", Helvetica: "fh", "Helvetica-Bold": "fh b", Courier: "fc",
};
function op2svg(op: Op): string {
  switch (op.t) {
    case "rect": return `<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" fill="${op.fill !== undefined ? `rgb(${Math.round(op.fill * 255)},${Math.round(op.fill * 255)},${Math.round(op.fill * 255)})` : "none"}"${op.stroke ? ` stroke="#000" stroke-width="${n(op.stroke)}"` : ""}/>`;
    case "line": return `<line x1="${n(op.x1)}" y1="${n(op.y1)}" x2="${n(op.x2)}" y2="${n(op.y2)}" stroke="#000" stroke-width="${n(op.w)}"${op.dash ? ` stroke-dasharray="${n(op.dash)}"` : ""}/>`;
    case "text": {
      const fill = op.gray !== undefined ? ` fill="rgb(${Math.round(op.gray * 255)},${Math.round(op.gray * 255)},${Math.round(op.gray * 255)})"` : "";
      const tr = op.rot ? ` transform="rotate(${-op.rot} ${n(op.x)} ${n(op.y)})"` : "";
      return `<text class="${FAM[op.font]}" x="${n(op.x)}" y="${n(op.y)}" font-size="${n(op.size * 25.4 / 72)}" textLength="${n(op.w)}" lengthAdjust="spacingAndGlyphs"${fill}${tr}>${esc(op.s)}</text>`;
    }
    case "bars": { let x = op.x; let d = ""; op.widths.forEach((w, i) => { if (i % 2 === 0) d += `M${n(x)} ${n(op.y)}h${n(w * op.module)}v${n(op.h)}h${n(-w * op.module)}z`; x += w * op.module; }); return `<path d="${d}"/>`; }
    case "qr": { const m = op.size / op.modules.length; let d = ""; op.modules.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${n(op.x + c * m)} ${n(op.y + r * m)}h${n(m)}v${n(m)}h${n(-m)}z`; })); return `<path d="${d}" shape-rendering="crispEdges"/>`; }
  }
}
export const pageSvg = (p: Page) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${p.w}mm" height="${p.h}mm">${p.ops.map(op2svg).join("")}</svg>`;
export function toHtml(doc: Doc): string {
  const p0 = doc.pages[0];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>
@page{size:${p0.w}mm ${p0.h}mm;margin:0}html,body{margin:0;background:#888}
.pg{display:block;margin:8mm auto;background:#fff;box-shadow:0 1px 4px #0006;max-width:100%;height:auto}
@media print{html,body{background:#fff}.pg{margin:0;box-shadow:none;break-after:page}}
.ft{font-family:"Times New Roman",Tinos,"Liberation Serif",Times,serif}.fh{font-family:Arial,Arimo,"Liberation Sans",Helvetica,sans-serif}.fc{font-family:"Courier New",Cousine,"Liberation Mono",monospace}.b{font-weight:bold}
</style></head><body>${doc.pages.map((p) => pageSvg(p).replace("<svg ", '<svg class="pg" ')).join("\n")}</body></html>`;
}
