import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseXml, findFirst, textOf } from "../runtime/xml.ts";
import { c14n } from "../runtime/c14n.ts";
const base = process.env.HOME + "/.local/state/sinete/corpus/";
for (const d of ["nfe-proprias", "nfe-importadas"]) {
  const c: Record<string, number> = {};
  for (const f of readdirSync(base + d)) {
    const src = readFileSync(base + d + "/" + f, "utf8");
    let k: string;
    try {
      const root = parseXml(src);
      const nfe = findFirst(root, "NFe")!, inf = findFirst(nfe, "infNFe")!, dv = findFirst(nfe, "DigestValue");
      const h = createHash("sha1").update(c14n(inf, null), "utf8").digest("base64");
      k = !dv ? "no-digest" : h === textOf(dv).trim() ? "ok" : "mismatch";
    } catch (e) { k = "parse-error:" + String(e).slice(0, 60); }
    c[k] = (c[k] ?? 0) + 1;
  }
  console.log(d, c);
}
