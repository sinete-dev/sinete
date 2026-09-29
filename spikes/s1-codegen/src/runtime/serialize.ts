// Descriptor-driven serializer. Emits elements in XSD order and in C14N-compatible lexical form:
// no XML declaration, no whitespace, attributes sorted, start/end tag pairs, C14N escaping.
// The output of serialize() for an element is therefore already its own canonical form except for the
// namespace declaration inherited by the signed subtree (added by the C14N step of XMLDSig).
import { type CT, type P, type ST, isCT, isE, maxOf } from "./desc.ts";

type Obj = Record<string, unknown>;

export class SerializeError extends Error {}

function escText(s: string): string {
  return /[&<>\r]/.test(s) ? s.replace(/[&<>\r]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&#xD;")) : s;
}
function escAttr(s: string): string {
  return /[&<"\t\n\r]/.test(s)
    ? s.replace(/[&<"\t\n\r]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === '"' ? "&quot;" : c === "\t" ? "&#x9;" : c === "\n" ? "&#xA;" : "&#xD;"))
    : s;
}

const sortedAttrs = new WeakMap<CT, CT["a"]>();
function attrsOf(ct: CT) {
  let a = sortedAttrs.get(ct);
  if (!a) {
    a = [...(ct.a ?? [])].sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : 0));
    sortedAttrs.set(ct, a);
  }
  return a;
}

function has(p: P, o: Obj): boolean {
  if (isE(p)) return o[p.e] !== undefined;
  for (const i of p.i) if (has(i, o)) return true;
  return false;
}

function groupCount(p: P, o: Obj): number {
  if (isE(p)) {
    const v = o[p.e];
    return v === undefined ? 0 : Array.isArray(v) ? v.length : 1;
  }
  let m = 0;
  for (const i of p.i) m = Math.max(m, groupCount(i, o));
  return m;
}

export function serialize<T>(ct: CT<T>, name: string, value: T, inScopeNs = ""): string {
  const out: string[] = [];
  element(ct as CT, name, value as unknown, ct.ns, inScopeNs, out);
  return out.join("");
}

function element(t: CT | ST, name: string, v: unknown, ns: string, inScopeNs: string, out: string[]) {
  let open = "<" + name;
  if (ns !== inScopeNs) open += ` xmlns="${escAttr(ns)}"`;
  if (!isCT(t)) {
    if (typeof v !== "string") throw new SerializeError(`${name}: expected string, got ${typeof v}`);
    out.push(open, ">", escText(v), "</", name, ">");
    return;
  }
  const o = v as Obj;
  for (const a of attrsOf(t)!) {
    const av = o[a.a] ?? a.f;
    if (av === undefined) continue;
    open += ` ${a.a}="${escAttr(av as string)}"`;
  }
  out.push(open, ">");
  if (t.tx) out.push(escText(o.$text as string));
  if (t.c) particle(t.c, o, ns, out, -1);
  out.push("</", name, ">");
}

function particle(p: P, o: Obj, ns: string, out: string[], gi: number) {
  if (isE(p)) {
    const v = o[p.e];
    if (v === undefined) return;
    const ens = p.ns ?? ns;
    if (Array.isArray(v)) {
      if (gi >= 0) {
        if (v[gi] !== undefined) element(p.t, p.e, v[gi], ens, ns, out);
      } else for (const x of v) element(p.t, p.e, x, ens, ns, out);
    } else element(p.t, p.e, v, ens, ns, out);
    return;
  }
  if (p.g === "s") {
    if (maxOf(p) > 1) {
      // repeating sequence: member arrays are zipped by index (e.g. TProtNFe.infProt cMsg/xMsg)
      const n = groupCount(p, o);
      for (let k = 0; k < n; k++) for (const i of p.i) particle(i, o, ns, out, k);
    } else for (const i of p.i) particle(i, o, ns, out, gi);
    return;
  }
  // choice: first branch with data wins (exclusivity is the validator's job)
  for (const i of p.i) {
    if (has(i, o)) {
      particle(i, o, ns, out, gi);
      return;
    }
  }
}
