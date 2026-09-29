// Structural validator driven by the same descriptors: content model (order, occurrence, choice),
// attributes, and simple type facets. Works on the parsed tree so the check sees exactly what the
// SEFAZ sees. XSD regexes are translated to JS (XML Schema Part 2, appendix F).
import { type CT, type P, type ST, isCT, isE, maxOf, minOf } from "./desc.ts";
import { type XElement, childElements } from "./xml.ts";

export interface VIssue { path: string; rule: string }

const reCache = new WeakMap<ST, RegExp[][]>();

/** XSD regex -> JS regex source (u flag). Implicitly anchored. Throws on constructs we did not implement. */
export function xsdRegexToJs(src: string): string {
  let out = "";
  let inClass = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      const n = src[++i];
      switch (n) {
        case "d": out += inClass ? "\\p{Nd}" : "\\p{Nd}"; break;
        case "D": out += "\\P{Nd}"; break;
        case "s": out += inClass ? " \\t\\n\\r" : "[ \\t\\n\\r]"; break;
        case "S": if (inClass) throw new Error("\\S in class"); out += "[^ \\t\\n\\r]"; break;
        case "i": case "I": case "c": case "C": case "w": case "W":
          throw new Error(`unsupported XSD escape \\${n}`);
        case "p": case "P": {
          const e = src.indexOf("}", i);
          const name = src.slice(i + 2, e);
          if (name.startsWith("Is")) throw new Error(`unsupported block escape ${name}`);
          out += `\\${n}{${name}}`;
          i = e;
          break;
        }
        default: out += "\\" + n;
      }
      continue;
    }
    if (c === "[") {
      if (inClass && src[i - 1] === "-") throw new Error("class subtraction unsupported");
      inClass++;
    } else if (c === "]") inClass--;
    else if (!inClass && (c === "^" || c === "$")) { out += "\\" + c; continue; }
    out += c;
  }
  return `^(?:${out})$`;
}

function regexes(t: ST): RegExp[][] {
  let r = reCache.get(t);
  if (!r) {
    r = (t.p ?? []).map((step) => step.map((s) => new RegExp(xsdRegexToJs(s), "u")));
    reCache.set(t, r);
  }
  return r;
}

function b64Octets(v: string): number {
  const s = v.replace(/[ \t\n\r]/g, "");
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return (s.length / 4) * 3 - pad;
}

export function checkSimple(t: ST, v: string, path: string, out: VIssue[]) {
  if (t.e && !t.e.includes(v)) out.push({ path, rule: "enumeration" });
  // length facets count characters for strings but OCTETS for base64Binary/hexBinary (XSD Part 2, 4.3.1)
  const len = t.l === undefined && t.mn === undefined && t.mx === undefined ? 0
    : t.b === "base64Binary" ? b64Octets(v)
    : t.b === "hexBinary" ? v.length / 2
    : [...v].length;
  if (t.l !== undefined && len !== t.l) out.push({ path, rule: "length" });
  if (t.mn !== undefined && len < t.mn) out.push({ path, rule: "minLength" });
  if (t.mx !== undefined && len > t.mx) out.push({ path, rule: "maxLength" });
  for (const step of regexes(t)) if (!step.some((re) => re.test(v))) { out.push({ path, rule: "pattern" }); break; }
  if (t.b === "gYearMonth" && !/^-?\d{4,}-(0[1-9]|1[0-2])(Z|[+-]\d{2}:\d{2})?$/.test(v)) out.push({ path, rule: "gYearMonth" });
  if (t.b === "base64Binary" && !/^[A-Za-z0-9+/=\s]*$/.test(v)) out.push({ path, rule: "base64Binary" });
}

/** set of end positions reachable by matching particle p on names from pos */
function match(p: P, kids: XElement[], pos: number, ownerNs: string): Set<number> {
  const min = minOf(p), max = maxOf(p);
  let cur = new Set([pos]);
  const seen = new Set([pos]);
  const res = new Set<number>();
  if (min === 0) res.add(pos);
  for (let rep = 1; rep <= max && cur.size; rep++) {
    const next = new Set<number>();
    for (const s of cur) {
      if (isE(p)) {
        const k = kids[s];
        if (k && k.local === p.e && k.ns === (p.ns ?? ownerNs)) next.add(s + 1);
      } else if (p.g === "s") {
        let ps = new Set([s]);
        for (const i of p.i) {
          const nx = new Set<number>();
          for (const q of ps) for (const r of match(i, kids, q, ownerNs)) nx.add(r);
          ps = nx;
          if (!ps.size) break;
        }
        for (const q of ps) next.add(q);
      } else {
        for (const i of p.i) for (const r of match(i, kids, s, ownerNs)) next.add(r);
      }
    }
    if (rep >= min) for (const q of next) res.add(q);
    // only expand positions not seen before (terminates for unbounded groups that can match empty)
    for (const q of [...next]) if (seen.has(q) && rep > min) next.delete(q); else seen.add(q);
    cur = next;
  }
  return res;
}

export function validateTree(ct: CT, el: XElement, out: VIssue[] = [], path = "/" + el.local): VIssue[] {
  for (const a of ct.a ?? []) {
    const v = el.attrs.find((x) => x.local === a.a && x.ns === "");
    if (!v) { if (a.r) out.push({ path: `${path}/@${a.a}`, rule: "required-attribute" }); continue; }
    if (a.f !== undefined && v.value !== a.f) out.push({ path: `${path}/@${a.a}`, rule: "fixed" });
    checkSimple(a.t, v.value, `${path}/@${a.a}`, out);
  }
  for (const x of el.attrs) if (!(ct.a ?? []).some((a) => a.a === x.local)) out.push({ path: `${path}/@${x.qname}`, rule: "unknown-attribute" });
  if (ct.tx) {
    checkSimple(ct.tx, el.children.filter((c) => typeof c === "string").join(""), path, out);
    return out;
  }
  const kids = childElements(el);
  for (const c of el.children) if (typeof c === "string" && !/^[ \t\n\r]*$/.test(c)) out.push({ path, rule: "text-in-element-only" });
  const ends = ct.c ? match(ct.c, kids, 0, ct.ns) : new Set([0]);
  if (!ends.has(kids.length)) {
    const declared = new Set<string>();
    const collectNames = (q: P) => { if (isE(q)) declared.add(q.e); else q.i.forEach(collectNames); };
    if (ct.c) collectNames(ct.c);
    const unk = kids.find((k) => !declared.has(k.local));
    out.push(unk ? { path: `${path}/${unk.local}`, rule: "unknown-element" } : { path, rule: "content-model" });
  }
  const decls = new Map<string, CT | ST>();
  const collect = (p: P) => { if (isE(p)) decls.set(p.e, p.t); else p.i.forEach(collect); };
  if (ct.c) collect(ct.c);
  for (const k of kids) {
    const t = decls.get(k.local);
    if (!t) continue;
    const kp = `${path}/${k.local}`;
    if (isCT(t)) validateTree(t, k, out, kp);
    else {
      if (childElements(k).length) out.push({ path: kp, rule: "element-in-simple" });
      checkSimple(t, k.children.filter((c) => typeof c === "string").join(""), kp, out);
    }
  }
  return out;
}

