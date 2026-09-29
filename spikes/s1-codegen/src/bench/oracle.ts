// Agreement between our descriptor validator and libxml2 (xmllint) on the corpus, per PL.
// AGGREGATES ONLY. xmllint messages are reduced to (element local name, error kind); quoted values are dropped.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseXml } from "../runtime/xml.ts";
import { validateTree } from "../runtime/validate.ts";
import type { CT } from "../runtime/desc.ts";
import * as pl010f from "../../generated/PL_010f_v1.04/nfe.ts";
import * as pl009q from "../../generated/PL_009q_NT2025_001_v1.00/nfe.ts";

const here = new URL("../..", import.meta.url).pathname;
const base = process.env.HOME + "/.local/state/sinete/corpus/";
const PLS: [string, CT][] = [["PL_010f_v1.04", pl010f.TNfeProc as CT], ["PL_009q_NT2025_001_v1.00", pl009q.TNfeProc as CT]];
const inc = (m: Record<string, number>, k: string) => (m[k] = (m[k] ?? 0) + 1);

function xmllint(pl: string, src: string): { valid: boolean; kinds: string[] } {
  const r = spawnSync("xmllint", ["--noout", "--schema", `${here}oracle/${pl}/procNFe_v4.00.xsd`, "-"], { input: src, encoding: "utf8" });
  const kinds: string[] = [];
  for (const line of r.stderr.split("\n")) {
    const m = /Element '(?:\{[^}]*\})?([^']+)'(?:, attribute '([^']+)')?: (.*)/.exec(line);
    if (!m) continue;
    const msg = m[3];
    const kind = /\[facet '(\w+)'\]/.exec(msg)?.[1] ?? (/not expected/.test(msg) ? "content-model" : /Missing child/.test(msg) ? "content-model(missing)" : /is not a valid value/.test(msg) ? "type" : /attribute .* is required|The attribute '.*' is required/.test(msg) ? "required-attribute" : /not allowed/.test(msg) ? "not-allowed" : "other");
    kinds.push(`${kind} ${m[1]}${m[2] ? "/@" + m[2] : ""}`);
  }
  return { valid: r.status === 0, kinds };
}

const result: Record<string, unknown> = {};
for (const [pl, ct] of PLS) {
  const s = { docs: 0, bothValid: 0, bothInvalid: 0, onlyXmllintInvalid: 0, onlyOursInvalid: 0, disagreeKinds: {} as Record<string, number>, xmllintKinds: {} as Record<string, number>, oursKinds: {} as Record<string, number> };
  for (const dir of ["nfe-proprias", "nfe-importadas"]) {
    for (const f of readdirSync(base + dir)) {
      const src = readFileSync(base + dir + "/" + f, "utf8");
      s.docs++;
      const ours = validateTree(ct, parseXml(src));
      const x = xmllint(pl, src);
      const oursValid = ours.length === 0;
      for (const k of new Set(x.kinds)) inc(s.xmllintKinds, k);
      for (const k of new Set(ours.map((o) => `${o.rule} ${o.path.split("/").pop()}`))) inc(s.oursKinds, k);
      if (oursValid && x.valid) s.bothValid++;
      else if (!oursValid && !x.valid) s.bothInvalid++;
      else if (x.valid) { s.onlyOursInvalid++; for (const o of ours) inc(s.disagreeKinds, `ours-only: ${o.rule} ${o.path.replace(/^\/nfeProc\/NFe/, "")}`); }
      else { s.onlyXmllintInvalid++; for (const k of x.kinds) inc(s.disagreeKinds, `xmllint-only: ${k}`); }
    }
  }
  result[pl] = s;
}
writeFileSync(here + "results/oracle-xmllint.json", JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify(result, null, 1));
