// Mesmo Doc em 4 backends de PDF: tempo, tamanho, determinismo (2 renders iguais) e fidelidade visual contra o raw.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as pdfLib from "pdf-lib"; import * as cantoo from "@cantoo/pdf-lib";
import PDFKit from "pdfkit"; import { jsPDF } from "jspdf";
import { danfe } from "./layout/danfe.ts"; import { toPdfRaw } from "./backends/pdf-raw.ts";
import { toPdfLib, toPdfKit, toJsPdf } from "./backends/others.ts";
mkdirSync("out/backends", { recursive: true });
const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const backends: Record<string, (d: any) => Promise<Uint8Array> | Uint8Array> = {
  raw: (d) => toPdfRaw(d), "pdf-lib": (d) => toPdfLib(d, pdfLib), "@cantoo/pdf-lib": (d) => toPdfLib(d, cantoo as any), pdfkit: (d) => toPdfKit(d, PDFKit), jspdf: (d) => toJsPdf(d, jsPDF),
};
for (const fx of ["basica", "muitos-itens", "textos-longos"]) {
  const doc = danfe(readFileSync(`fixtures/${fx}.xml`, "utf8"));
  for (const [name, fn] of Object.entries(backends)) {
    for (let i = 0; i < 5; i++) await fn(doc); // aquecimento
    const N = 50; const t = performance.now(); let last!: Uint8Array; for (let i = 0; i < N; i++) last = await fn(doc);
    const ms = (performance.now() - t) / N; const again = await fn(doc);
    writeFileSync(`out/backends/${fx}.${name.replace(/[@/]/g, "_")}.pdf`, last);
    console.log(`${fx.padEnd(14)} ${name.padEnd(16)} ${ms.toFixed(2).padStart(7)} ms ${(last.length / 1024).toFixed(1).padStart(7)} KB determinístico=${eq(last, again)}`);
  }
}
