import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { danfe } from "./layout/danfe.ts";
import { toPdfRaw } from "./backends/pdf-raw.ts";
import { toHtml } from "./backends/svg.ts";
mkdirSync("out", { recursive: true });
for (const name of process.argv.slice(2)) {
  const doc = danfe(readFileSync(`fixtures/${name}.xml`, "utf8"));
  writeFileSync(`out/${name}.pdf`, toPdfRaw(doc)); writeFileSync(`out/${name}.html`, toHtml(doc));
  console.log(name, doc.stats);
}
