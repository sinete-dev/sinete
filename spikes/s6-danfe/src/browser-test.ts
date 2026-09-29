// (1) bundle raw rodando dentro do Chromium e do WebKit: mesmo sha256 que no servidor?
// (2) abordagem (c): HTML -> page.pdf() do Chromium headless; tempo por documento e fidelidade.
import { chromium, webkit } from "playwright"; import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { danfe } from "./layout/danfe.ts"; import { toHtml } from "./backends/svg.ts";
mkdirSync("out/browser", { recursive: true });
const code = readFileSync("out/bundle/raw/raw.js", "utf8"); const xml = readFileSync("fixtures/muitos-itens.xml", "utf8");
import { toPdfRaw } from "./backends/pdf-raw.ts";
let fnvServer = 0x811c9dc5; for (const x of toPdfRaw(danfe(xml))) fnvServer = Math.imul(fnvServer ^ x, 16777619) >>> 0;
for (const [name, bt] of [["chromium", chromium]] as const) {
  const b = await bt.launch(); const p = await b.newPage();
  await p.setContent("<html><body></body></html>");
  const r = await p.evaluate(async ([code, xml]) => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" })); const m = await import(url);
    m.toPdfRaw(m.danfe(xml)); const t = performance.now(); let out; for (let i = 0; i < 20; i++) out = m.toPdfRaw(m.danfe(xml));
    let h = 0x811c9dc5; for (const x of out) h = Math.imul(h ^ x, 16777619) >>> 0;
    return { ms: (performance.now() - t) / 20, h };
  }, [code, xml]);
  console.log(`${name}: raw ok ${r.ms.toFixed(2)} ms fnv=${r.h} (servidor fnv=${fnvServer})`);
  await b.close();
}
// (c) baseline
const b = await chromium.launch(); const ctx = await b.newContext();
const fx = ["basica", "muitos-itens", "textos-longos"];
const tLaunch = performance.now(); const b2 = await chromium.launch(); const launchMs = performance.now() - tLaunch; await b2.close();
for (const f of fx) {
  const html = toHtml(danfe(readFileSync(`fixtures/${f}.xml`, "utf8")));
  const ts: number[] = []; let pdf!: Buffer;
  for (let i = 0; i < 6; i++) { const t = performance.now(); const p = await ctx.newPage(); await p.setContent(html); pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true }); await p.close(); ts.push(performance.now() - t); }
  writeFileSync(`out/browser/${f}.chromium.pdf`, pdf);
  const pdf2 = await (async () => { const p = await ctx.newPage(); await p.setContent(html); const x = await p.pdf({ preferCSSPageSize: true }); await p.close(); return x; })();
  console.log(`(c) ${f}: ${(ts.slice(1).reduce((a, c) => a + c, 0) / 5).toFixed(1)} ms/doc com browser quente, ${(pdf.length / 1024).toFixed(1)} KB, determinístico=${Buffer.compare(pdf, pdf2) === 0}`);
}
console.log(`(c) launch do Chromium: ${launchMs.toFixed(0)} ms`);
await b.close();
