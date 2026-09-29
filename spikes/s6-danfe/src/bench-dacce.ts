import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dacce } from "./layout/dacce.ts"; import { toPdfRaw } from "./backends/pdf-raw.ts";
const dir = `${process.env.HOME}/.local/state/sinete/corpus/eventos-nfe`;
const files = readdirSync(dir).filter((f) => f.endsWith("-cce.xml"));
let crashes = 0, clipped = 0; const ts: number[] = [];
mkdirSync(".local/dacce", { recursive: true });
files.forEach((f, i) => { try { const t = performance.now(); const d = dacce(readFileSync(`${dir}/${f}`, "utf8")); const pdf = toPdfRaw(d); ts.push(performance.now() - t); if (d.stats!.clipped) clipped++; if (i === 0) writeFileSync(".local/dacce/amostra.pdf", pdf); } catch { crashes++; } });
ts.sort((a, b) => a - b);
console.log(`CC-e: ${files.length} docs, crashes=${crashes}, com corte=${clipped}, ms p50=${ts[ts.length >> 1].toFixed(2)} max=${ts.at(-1)!.toFixed(2)}`);
