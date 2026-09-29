// Renderiza o corpus local e imprime só agregados (nada de nome de arquivo ou conteúdo).
import { readdirSync, readFileSync } from "node:fs";
import { danfe } from "./layout/danfe.ts";
import { toPdfRaw } from "./backends/pdf-raw.ts";
import { toHtml } from "./backends/svg.ts";
const base = `${globalThis.process?.env?.HOME ?? Deno.env.get("HOME")}/.local/state/sinete/corpus`;
const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
for (const dir of ["nfe-proprias", "nfe-importadas"]) {
  const files = readdirSync(`${base}/${dir}`).filter((f) => f.endsWith(".xml")).sort();
  const tLayout: number[] = [], tPdf: number[] = [], tHtml: number[] = [], pages: number[] = [], sizes: number[] = [], htmlSizes: number[] = [];
  let crashes = 0, nondet = 0, docsShrunk = 0, docsClipped = 0, clippedTotal = 0; const pageHist: Record<number, number> = {}; const errs: Record<string, number> = {};
  for (const f of files) {
    const xml = readFileSync(`${base}/${dir}/${f}`, "utf8");
    try {
      let t = performance.now(); const doc = danfe(xml); tLayout.push(performance.now() - t);
      t = performance.now(); const pdf = toPdfRaw(doc); tPdf.push(performance.now() - t);
      t = performance.now(); const html = toHtml(doc); tHtml.push(performance.now() - t);
      if (!eq(pdf, toPdfRaw(danfe(xml)))) nondet++;
      pages.push(doc.pages.length); sizes.push(pdf.length); htmlSizes.push(html.length);
      pageHist[doc.pages.length] = (pageHist[doc.pages.length] ?? 0) + 1;
      if (doc.stats!.shrunk) docsShrunk++; if (doc.stats!.clipped) { docsClipped++; clippedTotal += doc.stats!.clipped; }
    } catch (e) { crashes++; const m = String((e as Error).message).slice(0, 60); errs[m] = (errs[m] ?? 0) + 1; }
  }
  const s = (a: number[], d = 2) => `p50=${pct(a, .5).toFixed(d)} p95=${pct(a, .95).toFixed(d)} max=${Math.max(...a).toFixed(d)}`;
  console.log(`${dir}: ${files.length} docs, crashes=${crashes}`, errs);
  console.log(`  layout ms ${s(tLayout)} | pdf ms ${s(tPdf)} | html ms ${s(tHtml)}`);
  console.log(`  total ms/doc média ${( (tLayout.reduce((a, b) => a + b, 0) + tPdf.reduce((a, b) => a + b, 0)) / tLayout.length).toFixed(2)}`);
  console.log(`  folhas`, pageHist, `| pdf KB ${s(sizes.map((x) => x / 1024), 1)} | html KB ${s(htmlSizes.map((x) => x / 1024), 1)}`);
  console.log(`  docs com fonte reduzida=${docsShrunk} docs com texto cortado=${docsClipped} (cortes=${clippedTotal}) não determinísticos=${nondet}`);
}
