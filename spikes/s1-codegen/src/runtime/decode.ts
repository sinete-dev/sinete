// Descriptor-driven decoder: parsed XML tree -> typed plain object. Values stay as the exact lexical
// strings of the document (decimals included), so nothing is lost to number formatting.
import { type CT, type E, type P, type ST, isCT, isE, maxOf } from "./desc.ts";
import type { XElement } from "./xml.ts";

export interface Issue {
  /** path without indices, e.g. /NFe/infNFe/det/prod/NCM (schema names only, no values) */
  path: string;
  code: "unknown-element" | "unknown-attribute" | "whitespace-dropped" | "unexpected-text" | "element-in-simple" | "namespace";
}

interface ElInfo { p: E; arr: boolean }
const maps = new WeakMap<CT, Map<string, ElInfo>>();
function elMap(ct: CT): Map<string, ElInfo> {
  let m = maps.get(ct);
  if (m) return m;
  m = new Map();
  const walk = (p: P, rep: boolean) => {
    if (isE(p)) {
      const prev = m!.get(p.e);
      if (prev && prev.p.t !== p.t) throw new Error(`${ct.id}: element ${p.e} declared twice with different types`);
      m!.set(p.e, { p, arr: rep || maxOf(p) > 1 || !!prev?.arr });
    } else for (const i of p.i) walk(i, rep || maxOf(p) > 1);
  };
  if (ct.c) walk(ct.c, false);
  maps.set(ct, m);
  return m;
}

export function decode<T>(ct: CT<T>, el: XElement, issues: Issue[] = [], path = "/" + el.local): T {
  return decodeCT(ct as CT, el, issues, path) as T;
}

function decodeCT(ct: CT, el: XElement, issues: Issue[], path: string): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (ct.a || el.attrs.length) {
    for (const a of el.attrs) {
      if (ct.a?.some((d) => d.a === a.local) && a.ns === "") o[a.local] = a.value;
      else issues.push({ path: `${path}/@${a.qname}`, code: "unknown-attribute" });
    }
  }
  if (ct.tx) {
    let s = "";
    for (const c of el.children) {
      if (typeof c === "string") s += c;
      else issues.push({ path: `${path}/${c.local}`, code: "element-in-simple" });
    }
    o.$text = s;
    return o;
  }
  const m = elMap(ct);
  for (const c of el.children) {
    if (typeof c === "string") {
      issues.push({ path, code: /^[ \t\n\r]*$/.test(c) ? "whitespace-dropped" : "unexpected-text" });
      continue;
    }
    const info = m.get(c.local);
    const cp = `${path}/${c.local}`;
    if (!info) {
      issues.push({ path: cp, code: "unknown-element" });
      continue;
    }
    if (c.ns !== (info.p.ns ?? ct.ns)) issues.push({ path: cp, code: "namespace" });
    const v = isCT(info.p.t) ? decodeCT(info.p.t, c, issues, cp) : decodeSimple(info.p.t, c, issues, cp);
    if (info.arr) {
      const arr = (o[c.local] as unknown[] | undefined) ?? (o[c.local] = []);
      (arr as unknown[]).push(v);
    } else o[c.local] = v;
  }
  return o;
}

function decodeSimple(_t: ST, el: XElement, issues: Issue[], path: string): string {
  if (el.children.length === 1 && typeof el.children[0] === "string") return el.children[0];
  let s = "";
  for (const c of el.children) {
    if (typeof c === "string") s += c;
    else issues.push({ path: `${path}/${c.local}`, code: "element-in-simple" });
  }
  return s;
}
