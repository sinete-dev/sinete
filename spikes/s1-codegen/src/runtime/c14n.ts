// Canonical XML 1.0 (inclusive, without comments) of an element subtree.
// Written from https://www.w3.org/TR/2001/REC-xml-c14n-20010315 (sections 2.3 and 2.4).
// Used here as the comparison oracle and for DigestValue checks; the real one belongs to @sinete/xml (S3).
import type { XElement } from "./xml.ts";

function escText(s: string): string {
  return s.replace(/[&<>\r]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&#xD;"));
}
function escAttr(s: string): string {
  return s.replace(/[&<"\t\n\r]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === '"' ? "&quot;" : c === "\t" ? "&#x9;" : c === "\n" ? "&#xA;" : "&#xD;");
}

/** in-scope namespace declarations of `el`, looking at ancestors up to (and including) `contextRoot` */
function inScope(el: XElement, contextRoot: XElement | null): Map<string, string> {
  const chain: XElement[] = [];
  for (let e: XElement | null = el; e; e = e.parent) {
    chain.push(e);
    if (e === contextRoot) break;
  }
  const m = new Map<string, string>();
  for (let k = chain.length - 1; k >= 0; k--) for (const [p, u] of chain[k].nsDecls) m.set(p, u);
  return m;
}

export function c14n(el: XElement, contextRoot: XElement | null = null): string {
  const out: string[] = [];
  const apexScope = inScope(el, contextRoot);
  const walk = (e: XElement, rendered: Map<string, string>, scope: Map<string, string>) => {
    const myScope = new Map(scope);
    for (const [p, u] of e.nsDecls) myScope.set(p, u);
    const nsOut: [string, string][] = [];
    for (const [p, u] of myScope) {
      if (p === "xml") continue;
      const prev = rendered.get(p);
      if (p === "" && u === "" && (prev === undefined || prev === "")) continue;
      if (prev !== u) nsOut.push([p, u]);
    }
    nsOut.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const nextRendered = new Map(rendered);
    for (const [p, u] of nsOut) nextRendered.set(p, u);
    const attrs = [...e.attrs].sort((a, b) => (a.ns === b.ns ? (a.local < b.local ? -1 : a.local > b.local ? 1 : 0) : a.ns < b.ns ? -1 : 1));
    let s = "<" + e.qname;
    for (const [p, u] of nsOut) s += (p ? ` xmlns:${p}="` : ` xmlns="`) + escAttr(u) + '"';
    for (const a of attrs) s += ` ${a.qname}="${escAttr(a.value)}"`;
    out.push(s + ">");
    for (const c of e.children) {
      if (typeof c === "string") out.push(escText(c));
      else walk(c, nextRendered, myScope);
    }
    out.push(`</${e.qname}>`);
  };
  // the apex renders every in-scope namespace; seed "rendered" empty and scope with ancestors
  const parentScope = new Map(apexScope);
  for (const [p] of el.nsDecls) parentScope.delete(p);
  for (const [p, u] of el.nsDecls) parentScope.set(p, u);
  walk(el, new Map(), parentScope);
  return out.join("");
}
