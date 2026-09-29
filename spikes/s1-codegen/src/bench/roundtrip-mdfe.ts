// MDF-e 3.00 round-trip (second document check). AGGREGATES ONLY.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parseXml, findFirst, textOf } from "../runtime/xml.ts";
import { c14n } from "../runtime/c14n.ts";
import { decode, type Issue } from "../runtime/decode.ts";
import { serialize } from "../runtime/serialize.ts";
import { validateTree } from "../runtime/validate.ts";
import type { CT } from "../runtime/desc.ts";
import * as m from "../../generated/PL_MDFe_300b_NT012025_1.05/mdfe.ts";

const here = new URL("../..", import.meta.url).pathname;
const NS = "http://www.portalfiscal.inf.br/mdfe";
const dir = process.env.HOME + "/.local/state/sinete/corpus/mdfe/";
const inc = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);
const s = { mdfeProc: 0, exact: 0, c14nEq: 0, digestOk: 0, origDigestOk: 0, causes: {} as Record<string, number>, decodeIssues: {} as Record<string, number>, oursValid: 0, xmllintValid: 0, agree: 0, modal: {} as Record<string, number>, oursRules: {} as Record<string, number> };
for (const f of readdirSync(dir)) {
  const src = readFileSync(dir + f, "utf8");
  const root = parseXml(src);
  if (root.local !== "mdfeProc") continue;
  s.mdfeProc++;
  const doc = findFirst(root, "MDFe")!, inf = findFirst(doc, "infMDFe")!, dv = findFirst(doc, "DigestValue");
  const sha = (x: string) => createHash("sha1").update(x, "utf8").digest("base64");
  const origCanon = c14n(inf, null);
  if (dv && sha(origCanon) === textOf(dv).trim()) s.origDigestOk++;
  const issues: Issue[] = [];
  const obj = decode(m.mdfeProc as CT, root, issues) as any;
  for (const k of new Set(issues.map((i) => `${i.code} ${i.path}`))) inc(s.decodeIssues, k);
  inc(s.modal, Object.keys(obj.MDFe.infMDFe.infModal).filter((k) => k !== "versaoModal").join(","));
  const ours = serialize(m.TMDFe_infMDFe as CT, "infMDFe", obj.MDFe.infMDFe, NS);
  const raw = src.slice(inf.start, inf.end);
  if (ours === raw) s.exact++;
  else inc(s.causes, /^<infMDFe[^>]*versao=[^>]*Id=/.test(raw) ? "lexical:attr-order" : /\/>/.test(raw) ? "lexical:self-closing" : "outro");
  const oc = ours.replace(/^<infMDFe/, `<infMDFe xmlns="${NS}"`);
  if (oc === origCanon) s.c14nEq++;
  if (dv && sha(oc) === textOf(dv).trim()) s.digestOk++;
  const v = validateTree(m.mdfeProc as CT, root);
  if (!v.length) s.oursValid++;
  for (const k of new Set(v.map((x) => `${x.rule} ${x.path}`))) inc(s.oursRules, k);
  const x = spawnSync("xmllint", ["--noout", "--schema", `${here}xsd/PL_MDFe_300b_NT012025_1.05/procMDFe_v3.00.xsd`, "-"], { input: src, encoding: "utf8" });
  if (x.status === 0) s.xmllintValid++;
  if ((x.status === 0) === (v.length === 0)) s.agree++;
}
writeFileSync(here + "results/roundtrip-mdfe.json", JSON.stringify(s, null, 1) + "\n");
console.log(JSON.stringify(s, null, 1));
