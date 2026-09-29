// Minimal non-validating XML 1.0 parser with namespaces and source offsets.
// Written from the XML 1.0 (5th ed.) and Namespaces in XML 1.0 specs. No DTD support
// (DF-e documents never carry one, and rejecting DOCTYPE closes the XXE door).

export interface XAttr {
  /** qualified name as written */
  qname: string;
  local: string;
  prefix: string;
  ns: string;
  value: string;
}

export interface XElement {
  qname: string;
  local: string;
  prefix: string;
  ns: string;
  attrs: XAttr[];
  /** namespace declarations written on this element: prefix ('' = default) -> uri */
  nsDecls: [string, string][];
  children: XNode[];
  /** offset of '<' of the start tag */
  start: number;
  /** offset just past the '>' of the end tag (or of the empty-element tag) */
  end: number;
  selfClosing: boolean;
  parent: XElement | null;
}

export type XNode = XElement | string;

const XML_NS = "http://www.w3.org/XML/1998/namespace";

export class XmlError extends Error {}

function decodeEntities(s: string, attr: boolean): string {
  // end-of-line handling happens on the raw text before entity expansion (XML 1.0 2.11)
  if (s.indexOf("\r") !== -1) s = s.replace(/\r\n?/g, "\n");
  if (attr && /[\t\n]/.test(s)) s = s.replace(/[\t\n]/g, " ");
  if (s.indexOf("&") === -1) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g, (_m, e: string) => {
    switch (e) {
      case "lt": return "<";
      case "gt": return ">";
      case "amp": return "&";
      case "quot": return '"';
      case "apos": return "'";
    }
    const cp = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return String.fromCodePoint(cp);
  });
}

function splitQName(q: string): [string, string] {
  const i = q.indexOf(":");
  return i === -1 ? ["", q] : [q.slice(0, i), q.slice(i + 1)];
}

export function parseXml(src: string): XElement {
  let i = 0;
  const n = src.length;
  if (src.charCodeAt(0) === 0xfeff) i = 1;
  let root: XElement | null = null;
  let cur: XElement | null = null;
  // namespace scope: stack of maps
  const scopes: Map<string, string>[] = [new Map([["xml", XML_NS], ["", ""]])];
  const lookup = (prefix: string): string => {
    for (let k = scopes.length - 1; k >= 0; k--) {
      const v = scopes[k].get(prefix);
      if (v !== undefined) return v;
    }
    if (prefix === "") return "";
    throw new XmlError(`undeclared prefix ${prefix}`);
  };

  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt === -1) {
      const rest = src.slice(i);
      if (cur) throw new XmlError("unexpected EOF");
      if (rest.trim()) throw new XmlError("text after root");
      break;
    }
    if (lt > i) {
      const raw = src.slice(i, lt);
      if (cur) cur.children.push(decodeEntities(raw, false));
      else if (raw.trim()) throw new XmlError("text outside root");
    }
    i = lt;
    const c1 = src.charCodeAt(i + 1);
    if (c1 === 63 /* ? */) {
      const e = src.indexOf("?>", i);
      if (e === -1) throw new XmlError("unterminated PI");
      i = e + 2;
      continue;
    }
    if (c1 === 33 /* ! */) {
      if (src.startsWith("<!--", i)) {
        const e = src.indexOf("-->", i);
        if (e === -1) throw new XmlError("unterminated comment");
        i = e + 3;
        continue;
      }
      if (src.startsWith("<![CDATA[", i)) {
        const e = src.indexOf("]]>", i);
        if (e === -1 || !cur) throw new XmlError("bad CDATA");
        let t = src.slice(i + 9, e);
        if (t.indexOf("\r") !== -1) t = t.replace(/\r\n?/g, "\n");
        cur.children.push(t);
        i = e + 3;
        continue;
      }
      throw new XmlError("DOCTYPE not supported");
    }
    if (c1 === 47 /* / */) {
      const e = src.indexOf(">", i);
      const qn = src.slice(i + 2, e).trim();
      if (!cur || qn !== cur.qname) throw new XmlError(`mismatched end tag ${qn}`);
      cur.end = e + 1;
      scopes.pop();
      cur = cur.parent;
      i = e + 1;
      continue;
    }
    // start tag
    let j = i + 1;
    while (j < n) {
      const c = src.charCodeAt(j);
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 62 || c === 47) break;
      j++;
    }
    const qname = src.slice(i + 1, j);
    const rawAttrs: [string, string][] = [];
    let selfClosing = false;
    for (;;) {
      while (j < n) {
        const c = src.charCodeAt(j);
        if (c === 32 || c === 9 || c === 10 || c === 13) j++;
        else break;
      }
      const c = src.charCodeAt(j);
      if (c === 62) { j++; break; }
      if (c === 47 && src.charCodeAt(j + 1) === 62) { selfClosing = true; j += 2; break; }
      const eq = src.indexOf("=", j);
      if (eq === -1) throw new XmlError("bad attribute");
      const an = src.slice(j, eq).trim();
      let q = eq + 1;
      while (src.charCodeAt(q) === 32) q++;
      const quote = src[q];
      if (quote !== '"' && quote !== "'") throw new XmlError("unquoted attribute");
      const qe = src.indexOf(quote, q + 1);
      rawAttrs.push([an, decodeEntities(src.slice(q + 1, qe), true)]);
      j = qe + 1;
    }
    const scope = new Map<string, string>();
    const nsDecls: [string, string][] = [];
    for (const [an, av] of rawAttrs) {
      if (an === "xmlns") { scope.set("", av); nsDecls.push(["", av]); }
      else if (an.startsWith("xmlns:")) { scope.set(an.slice(6), av); nsDecls.push([an.slice(6), av]); }
    }
    scopes.push(scope);
    const [prefix, local] = splitQName(qname);
    const el: XElement = {
      qname, local, prefix, ns: lookup(prefix), attrs: [], nsDecls, children: [],
      start: lt, end: -1, selfClosing, parent: cur,
    };
    for (const [an, av] of rawAttrs) {
      if (an === "xmlns" || an.startsWith("xmlns:")) continue;
      const [ap, al] = splitQName(an);
      el.attrs.push({ qname: an, local: al, prefix: ap, ns: ap ? lookup(ap) : "", value: av });
    }
    if (cur) cur.children.push(el);
    else if (root) throw new XmlError("multiple roots");
    else root = el;
    if (selfClosing) {
      el.end = j;
      scopes.pop();
    } else {
      cur = el;
    }
    i = j;
  }
  if (!root || cur) throw new XmlError("incomplete document");
  return root;
}

export function childElements(el: XElement): XElement[] {
  const out: XElement[] = [];
  for (const c of el.children) if (typeof c !== "string") out.push(c);
  return out;
}

export function findFirst(el: XElement, local: string): XElement | null {
  if (el.local === local) return el;
  for (const c of el.children) {
    if (typeof c === "string") continue;
    const r = findFirst(c, local);
    if (r) return r;
  }
  return null;
}

export function textOf(el: XElement): string {
  let s = "";
  for (const c of el.children) if (typeof c === "string") s += c;
  return s;
}
