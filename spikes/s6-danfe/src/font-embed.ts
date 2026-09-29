// Custo de embutir fonte TTF com subset (pdf-lib + fontkit) em vez das fontes padrão.
import { PDFDocument } from "pdf-lib"; import fontkit from "@pdf-lib/fontkit"; import { readFileSync } from "node:fs";
import { danfe } from "./layout/danfe.ts";
const reg = readFileSync("node_modules/dejavu-fonts-ttf/ttf/DejaVuSerif.ttf"), bold = readFileSync("node_modules/dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf");
const K = 72 / 25.4;
async function render(xml: string, subset: boolean) {
  const doc = danfe(xml); const pdf = await PDFDocument.create({ updateMetadata: false }); pdf.registerFontkit(fontkit);
  const R = await pdf.embedFont(reg, { subset }), B = await pdf.embedFont(bold, { subset });
  for (const p of doc.pages) { const pg = pdf.addPage([p.w * K, p.h * K]); for (const op of p.ops) if (op.t === "text") pg.drawText(op.s, { x: op.x * K, y: (p.h - op.y) * K, size: op.size, font: op.font.endsWith("Bold") ? B : R }); }
  return pdf.save();
}
const xml = readFileSync("fixtures/caracteres.xml", "utf8");
for (const subset of [true, false]) {
  await render(xml, subset); const t = performance.now(); let out!: Uint8Array; for (let i = 0; i < 10; i++) out = await render(xml, subset);
  const again = await render(xml, subset); const det = out.length === again.length && out.every((v, i) => v === again[i]);
  console.log(`DejaVuSerif subset=${subset}: ${((performance.now() - t) / 10).toFixed(1)} ms, ${(out.length / 1024).toFixed(1)} KB, determinístico=${det}`);
}
console.log(`TTF regular+bold brutos: ${((reg.length + bold.length) / 1024).toFixed(0)} KB`);
