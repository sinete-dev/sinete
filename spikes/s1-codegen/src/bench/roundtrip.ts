// Round-trip over the local corpus. Prints AGGREGATES ONLY (counts, schema paths); never document content.
// Usage: bun src/bench/roundtrip.ts [--out results/x.json]   |   node src/bench/roundtrip.ts
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { parseXml, findFirst, textOf, type XElement } from "../runtime/xml.ts";
import { c14n } from "../runtime/c14n.ts";
import { decode, type Issue } from "../runtime/decode.ts";
import { serialize } from "../runtime/serialize.ts";
import { validateTree } from "../runtime/validate.ts";
import type { CT } from "../runtime/desc.ts";
import * as pl010f from "../../generated/PL_010f_v1.04/nfe.ts";
import * as pl010e from "../../generated/PL_010e_v1.02/nfe.ts";
import * as pl009q from "../../generated/PL_009q_NT2025_001_v1.00/nfe.ts";

const NFE_NS = "http://www.portalfiscal.inf.br/nfe";
const PLS: [string, { TNFe: CT; TNFe_infNFe: CT }][] = [["PL_010f", pl010f], ["PL_010e", pl010e], ["PL_009q", pl009q]];
const base = process.env.HOME + "/.local/state/sinete/corpus/";
const g = globalThis as any;
const runtime = g.Bun ? "bun " + g.Bun.version : g.Deno ? "deno " + g.Deno.version.deno : "node " + process.version;

const inc = (m: Record<string, number>, k: string, n = 1) => (m[k] = (m[k] ?? 0) + n);

/** element path (schema names only) at a character offset of a serialized string */
function pathAt(s: string, off: number): string {
  const stack: string[] = [];
  const re = /<(\/?)([A-Za-z0-9_:]+)[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) && m.index <= off) {
    if (m[1]) stack.pop();
    else if (!m[3]) stack.push(m[2]);
  }
  return "/" + stack.join("/");
}

function lexicalCauses(raw: string, el: XElement): string[] {
  const c: string[] = [];
  const firstTag = raw.slice(0, raw.indexOf(">") + 1);
  if (/^<infNFe[^>]*versao=[^>]*Id=/.test(firstTag)) c.push("attr-order(infNFe versao antes de Id)");
  if (/^<infNFe[^>]*xmlns/.test(firstTag)) c.push("xmlns-declarado-no-infNFe");
  if (/\/>/.test(raw)) c.push("tag-autofechada(<x/>)");
  if (/>[ \t\r\n]+</.test(raw)) c.push("whitespace-entre-tags");
  if (/\r/.test(raw)) c.push("CR-literal");
  if (/'/.test(raw.replace(/>[^<]*</g, "><"))) c.push("aspas-simples-em-atributo");
  if (/>[^<]*>/.test(raw.slice(1))) c.push("'>'-literal-em-texto(C14N escreve &gt;)");
  if (/&(apos|quot);|&#/.test(raw)) c.push("entidade-nao-canonica(&apos;/&quot;/&#)");
  if (el.attrs.length && /[\t\n]/.test(raw.slice(0, 200))) c.push("whitespace-em-atributo");
  return c.length ? c : ["outro-lexical"];
}

interface Rec { dir: string; pl: string; exact: boolean; c14nEq: boolean; digestOk: boolean | null; origDigestOk: boolean | null; causes: string[]; issues: Issue[]; vIssues: string[] }

function processOne(dir: string, src: string): Rec {
  const root = parseXml(src);
  const nfe = findFirst(root, "NFe")!;
  const inf = findFirst(nfe, "infNFe")!;
  const dv = findFirst(nfe, "DigestValue");
  const origCanon = c14n(inf, null);
  const sha = (s: string) => createHash("sha1").update(s, "utf8").digest("base64");
  const origDigestOk = dv ? sha(origCanon) === textOf(dv).trim() : null;

  // choose the first PL (newest first) that decodes without unknown elements/attributes
  let chosen = PLS[0], issues: Issue[] = [], obj: any;
  for (const pl of PLS) {
    const is: Issue[] = [];
    const o = decode(pl[1].TNFe, nfe, is);
    if (pl === PLS[0] || !issues.some((i) => i.code.startsWith("unknown"))) { /* keep */ }
    if (!is.some((i) => i.code.startsWith("unknown"))) { chosen = pl; issues = is; obj = o; break; }
    if (pl === PLS[0]) { chosen = pl; issues = is; obj = o; }
  }
  const ours = serialize(chosen[1].TNFe_infNFe, "infNFe", obj.infNFe, NFE_NS);
  const raw = src.slice(inf.start, inf.end);
  const exact = ours === raw;
  const oursCanon = ours.replace(/^<infNFe/, `<infNFe xmlns="${NFE_NS}"`);
  // self-check: our output must already be canonical
  const reparsed = parseXml(oursCanon);
  if (c14n(reparsed, null) !== oursCanon) throw new Error("serializer output is not canonical");
  const c14nEq = oursCanon === origCanon;
  const digestOk = dv ? sha(oursCanon) === textOf(dv).trim() : null;
  const causes: string[] = [];
  if (!exact) {
    if (c14nEq) causes.push(...lexicalCauses(raw, inf).map((c) => "lexical:" + c));
    else {
      let k = 0;
      while (k < oursCanon.length && oursCanon[k] === origCanon[k]) k++;
      const unknown = issues.filter((i) => i.code.startsWith("unknown"));
      if (unknown.length) causes.push(...[...new Set(unknown.map((i) => `semantic:${i.code} ${i.path.replace(/^\/NFe/, "")}`))]);
      else if (issues.some((i) => i.code === "whitespace-dropped")) causes.push("semantic:whitespace-significativo-no-digest");
      else causes.push(`semantic:primeira-divergencia ${pathAt(origCanon, k)}`);
    }
  }
  const vIssues = validateTree(chosen[1].TNFe, nfe).map((v) => `${v.rule} ${v.path.replace(/^\/NFe/, "")}`);
  return { dir, pl: chosen[0], exact, c14nEq, digestOk, origDigestOk, causes, issues, vIssues };
}

const summary: any = { runtime, date: new Date().toISOString().slice(0, 10), dirs: {} };
const allSrc: string[] = [];
for (const dir of ["nfe-proprias", "nfe-importadas"]) {
  const s: any = { total: 0, exact: 0, c14nEq: 0, digestOk: 0, withDigest: 0, origDigestOk: 0, pl: {}, causes: {}, decodeIssues: {}, validation: { valid: 0, rules: {} }, errors: {} };
  for (const f of readdirSync(base + dir)) {
    const src = readFileSync(base + dir + "/" + f, "utf8");
    allSrc.push(src);
    s.total++;
    let r: Rec;
    try { r = processOne(dir, src); } catch (e) { inc(s.errors, String(e).slice(0, 80)); continue; }
    inc(s.pl, r.pl);
    if (r.exact) s.exact++;
    if (r.c14nEq) s.c14nEq++;
    if (r.digestOk !== null) { s.withDigest++; if (r.digestOk) s.digestOk++; if (r.origDigestOk) s.origDigestOk++; }
    for (const c of new Set(r.causes)) inc(s.causes, c);
    for (const k of new Set(r.issues.map((i) => `${i.code} ${i.path.replace(/^\/NFe/, "")}`))) inc(s.decodeIssues, k);
    if (!r.vIssues.length) s.validation.valid++;
    for (const k of new Set(r.vIssues)) inc(s.validation.rules, k);
  }
  summary.dirs[dir] = s;
}

// ---- timing: parse (tokenize + decode) and serialize, per note, with the newest PL ----
{
  const pl = pl010f;
  const docs = allSrc.map((src) => { const r = parseXml(src); return findFirst(r, "NFe")!; });
  const objs = docs.map((n) => decode(pl.TNFe as CT, n) as any);
  const bytes = allSrc.reduce((a, s) => a + s.length, 0);
  const time = (fn: () => void, reps: number) => { fn(); const t = performance.now(); for (let r = 0; r < reps; r++) fn(); return (performance.now() - t) / reps; };
  const tTok = time(() => { for (const s of allSrc) parseXml(s); }, 5);
  const tParse = time(() => { for (const s of allSrc) decode(pl.TNFe as CT, findFirst(parseXml(s), "NFe")!); }, 5);
  const tSer = time(() => { for (const o of objs) serialize(pl.TNFe as CT, "NFe", o, ""); }, 5);
  const tVal = time(() => { for (const n of docs) validateTree(pl.TNFe as CT, n); }, 3);
  const tC14n = time(() => { for (const n of docs) c14n(findFirst(n, "infNFe")!, null); }, 3);
  const n = allSrc.length;
  summary.timing = {
    notes: n, avgBytes: Math.round(bytes / n),
    usPerNote: { tokenize: +(tTok / n * 1000).toFixed(1), parseToObject: +(tParse / n * 1000).toFixed(1), serialize: +(tSer / n * 1000).toFixed(1), validate: +(tVal / n * 1000).toFixed(1), c14nInfNFe: +(tC14n / n * 1000).toFixed(1) },
  };
}

const outIdx = process.argv.indexOf("--out");
const json = JSON.stringify(summary, null, 1);
if (outIdx > 0) { mkdirSync(dirname(process.argv[outIdx + 1]), { recursive: true }); writeFileSync(process.argv[outIdx + 1], json + "\n"); }
console.log(json);
