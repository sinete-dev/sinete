import { gzipSync } from "node:zlib";
for (const e of ["layout-only", "raw", "pdflib", "pdfkit", "jspdf"]) {
  const r = await Bun.build({ entrypoints: [`src/entries/${e}.ts`], target: "browser", minify: true, format: "esm", outdir: `out/bundle/${e}`, throw: false });
  if (!r.success) { console.log(e.padEnd(12), "FALHOU:", r.logs.slice(0, 2).map((l) => String(l.message).slice(0, 90)).join(" | ")); continue; }
  const b = await Bun.file(r.outputs[0].path).bytes();
  console.log(e.padEnd(12), `${(b.length / 1024).toFixed(1)} KB min, ${(gzipSync(b).length / 1024).toFixed(1)} KB gzip`);
}
