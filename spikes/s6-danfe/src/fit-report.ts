import { readdirSync, readFileSync } from "node:fs";
import { danfe } from "./layout/danfe.ts"; import { Canvas } from "./kit.ts";
const base = `${process.env.HOME}/.local/state/sinete/corpus`;
for (const dir of ["nfe-proprias", "nfe-importadas"]) {
  const c: Record<string, number> = {};
  for (const f of readdirSync(`${base}/${dir}`)) { Canvas.log = []; danfe(readFileSync(`${base}/${dir}/${f}`, "utf8")); for (const k of new Set(Canvas.log)) c[k] = (c[k] ?? 0) + 1; }
  console.log(dir, Object.entries(c).sort((a, b) => b[1] - a[1]));
}
