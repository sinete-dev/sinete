// XSD (subset used by DF-e schemas) -> IR. Written from XML Schema 1.0 Part 1/2.
// Anything outside the supported subset is collected in `unsupported` instead of being ignored.
import { readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { parseXml, childElements, type XElement } from "../runtime/xml.ts";
import type { AttrIR, ComplexIR, Facets, ParticleIR, SchemaIR, SimpleIR, TypeRef } from "./ir.ts";

const XS = "http://www.w3.org/2001/XMLSchema";

interface SchemaDoc { file: string; tns: string; root: XElement; qualified: boolean }

function nsScope(el: XElement): Map<string, string> {
  const chain: XElement[] = [];
  for (let e: XElement | null = el; e; e = e.parent) chain.push(e);
  const m = new Map<string, string>();
  for (let k = chain.length - 1; k >= 0; k--) for (const [p, u] of chain[k].nsDecls) m.set(p, u);
  return m;
}

function qn(el: XElement, value: string): string {
  const i = value.indexOf(":");
  const prefix = i === -1 ? "" : value.slice(0, i);
  const local = i === -1 ? value : value.slice(i + 1);
  const ns = nsScope(el).get(prefix);
  if (ns === undefined) throw new Error(`unresolved prefix in ${value}`);
  return `{${ns}}${local}`;
}

const attr = (el: XElement, n: string) => el.attrs.find((a) => a.local === n && a.ns === "")?.value;
const xsKids = (el: XElement, local?: string) => childElements(el).filter((c) => c.ns === XS && (!local || c.local === local));

function docOf(el: XElement): string | undefined {
  const ann = xsKids(el, "annotation")[0];
  if (!ann) return undefined;
  const d = xsKids(ann, "documentation").map((x) => x.children.filter((c) => typeof c === "string").join("")).join("\n").trim();
  return d || undefined;
}

export function loadSchemas(entry: string): SchemaDoc[] {
  const seen = new Map<string, SchemaDoc>();
  const visit = (file: string, includerTns?: string) => {
    if (seen.has(file)) return;
    const root = parseXml(readFileSync(file, "utf8"));
    let tns = attr(root, "targetNamespace");
    if (tns === undefined && includerTns) {
      // chameleon include (XSD 1.0 Part 1, 4.2.1): no targetNamespace, takes the includer's.
      // Unqualified QNames inside it must then resolve to that namespace.
      tns = includerTns;
      if (!root.nsDecls.some(([p]) => p === "")) root.nsDecls.push(["", tns]);
    }
    const doc: SchemaDoc = { file, tns: tns ?? "", root, qualified: attr(root, "elementFormDefault") === "qualified" };
    seen.set(file, doc);
    for (const inc of xsKids(root, "include")) {
      const loc = attr(inc, "schemaLocation");
      if (loc) visit(join(dirname(file), loc), doc.tns);
    }
    for (const inc of xsKids(root, "import")) {
      const loc = attr(inc, "schemaLocation");
      if (loc) visit(join(dirname(file), loc));
    }
  };
  visit(entry);
  return [...seen.values()];
}

export interface BuildOptions {
  /** extra schema files whose global elements can be bound into xs:any slots */
  extraEntries?: string[];
  /**
   * xs:any bindings: owner type id -> global element names that may appear there (as a choice).
   * DF-e uses xs:any for pluggable content validated by a separate schema (MDF-e infModal,
   * event detEvento, distDFe docZip). The binding is data, reviewed like the XSD itself.
   */
  anyBindings?: Record<string, string[]>;
}

export function buildIR(pl: string, entry: string, roots: { element?: string; type?: string; as?: string }[], opts: BuildOptions = {}): SchemaIR {
  const docs = loadSchemas(entry);
  for (const e of opts.extraEntries ?? []) for (const d of loadSchemas(e)) if (!docs.some((x) => x.file === d.file)) docs.push(d);
  const globals = { simple: new Map<string, XElement>(), complex: new Map<string, XElement>(), element: new Map<string, XElement>() };
  const docOfEl = new Map<XElement, SchemaDoc>();
  for (const d of docs) {
    for (const c of childElements(d.root)) {
      docOfEl.set(c, d);
      const name = attr(c, "name");
      if (!name || c.ns !== XS) continue;
      const key = `{${d.tns}}${name}`;
      if (c.local === "simpleType") globals.simple.set(key, c);
      else if (c.local === "complexType") globals.complex.set(key, c);
      else if (c.local === "element") globals.element.set(key, c);
    }
  }
  const ownerDoc = (el: XElement): SchemaDoc => {
    let e: XElement | null = el;
    while (e && !docOfEl.has(e)) e = e.parent;
    if (!e) throw new Error("orphan");
    return docOfEl.get(e)!;
  };

  const unsupported = new Set<string>();
  const ir: SchemaIR = { pl, root: { name: "", ns: "", type: "" }, namespaces: {}, complex: {}, simple: {}, unsupported: [] };
  const simpleCache = new Map<string, SimpleIR>();

  const builtinSimple = (local: string): SimpleIR => ({ kind: "simple", builtin: local, chain: [], facets: {} });

  const resolveSimpleByQName = (q: string): SimpleIR => {
    if (q.startsWith(`{${XS}}`)) return builtinSimple(q.slice(XS.length + 2));
    const cached = simpleCache.get(q);
    if (cached) return cached;
    const el = globals.simple.get(q);
    if (!el) throw new Error(`simple type not found ${q}`);
    const s = simpleFromEl(el, attr(el, "name"));
    simpleCache.set(q, s);
    ir.simple[attr(el, "name")!] = s;
    return s;
  };

  const simpleFromEl = (el: XElement, name?: string): SimpleIR => {
    const r = xsKids(el, "restriction")[0];
    if (!r) {
      unsupported.add(`simpleType without restriction (${xsKids(el).map((k) => k.local).join(",")}) at ${name ?? "anonymous"}`);
      return { kind: "simple", name, builtin: "string", chain: [], facets: {}, doc: docOf(el) };
    }
    const baseQ = attr(r, "base");
    const base: SimpleIR = baseQ ? resolveSimpleByQName(qn(r, baseQ)) : simpleFromEl(xsKids(r, "simpleType")[0]);
    const f: Facets = { ...base.facets, patterns: base.facets.patterns ? [...base.facets.patterns] : undefined };
    delete f.enumeration; // enumeration is replaced, not inherited, when the derived step declares one
    if (base.facets.enumeration) f.enumeration = base.facets.enumeration;
    const step: string[] = [];
    const enums: string[] = [];
    for (const k of xsKids(r)) {
      const v = attr(k, "value")!;
      switch (k.local) {
        case "pattern": step.push(v); break;
        case "enumeration": enums.push(v); break;
        case "length": case "minLength": case "maxLength": case "totalDigits": case "fractionDigits":
          f[k.local] = Number(v); break;
        case "minInclusive": case "maxInclusive": f[k.local] = v; break;
        case "whiteSpace": f.whiteSpace = v as Facets["whiteSpace"]; break;
        case "annotation": case "simpleType": break;
        default: unsupported.add(`facet ${k.local}`);
      }
    }
    if (step.length) (f.patterns ??= []).push(step);
    if (enums.length) f.enumeration = enums;
    if (!f.patterns) delete f.patterns;
    return {
      kind: "simple", name, builtin: base.builtin,
      chain: base.name ? [base.name, ...base.chain] : base.chain,
      facets: f, doc: docOf(el),
    };
  };

  const complexDone = new Set<string>();

  const typeRefOfElement = (el: XElement, path: string): TypeRef => {
    const t = attr(el, "type");
    if (t) {
      const q = qn(el, t);
      if (globals.complex.has(q)) { complexFromEl(globals.complex.get(q)!, attr(globals.complex.get(q)!, "name")!, false); return { ref: attr(globals.complex.get(q)!, "name")! }; }
      return resolveSimpleByQName(q);
    }
    const ct = xsKids(el, "complexType")[0];
    if (ct) { complexFromEl(ct, path, true); return { ref: path }; }
    const st = xsKids(el, "simpleType")[0];
    if (st) return simpleFromEl(st);
    unsupported.add(`element without type at ${path}`);
    return builtinSimple("anyType");
  };

  const occurs = (el: XElement) => {
    const min = Number(attr(el, "minOccurs") ?? "1");
    const mx = attr(el, "maxOccurs") ?? "1";
    return { min, max: mx === "unbounded" ? Infinity : Number(mx) };
  };

  const particle = (el: XElement, ownerId: string): ParticleIR | null => {
    const { min, max } = occurs(el);
    switch (el.local) {
      case "element": {
        const ref = attr(el, "ref");
        if (ref) {
          const q = qn(el, ref);
          const g = globals.element.get(q);
          if (!g) throw new Error(`element ref not found ${q}`);
          const d = ownerDoc(g);
          const nm = attr(g, "name")!;
          return { k: "el", name: nm, ns: d.tns, type: typeRefOfElement(g, nm), min, max, doc: docOf(el) ?? docOf(g) };
        }
        const d = ownerDoc(el);
        if (!d.qualified) unsupported.add(`unqualified local element in ${basename(d.file)}`);
        const nm = attr(el, "name")!;
        const u = xsKids(el, "unique");
        const t = typeRefOfElement(el, `${ownerId}.${nm}`);
        if (u.length && "ref" in t) {
          const c = ir.complex[t.ref];
          c.unique = u.map((x) => ({ name: attr(x, "name")!, selector: attr(xsKids(x, "selector")[0], "xpath")!, field: attr(xsKids(x, "field")[0], "xpath")! }));
        }
        return { k: "el", name: nm, ns: d.tns, type: t, min, max, doc: docOf(el) };
      }
      case "sequence":
      case "choice": {
        const items: ParticleIR[] = [];
        for (const k of xsKids(el)) {
          if (k.local === "annotation") continue;
          const p = particle(k, ownerId);
          if (p) items.push(p);
        }
        return { k: el.local === "sequence" ? "seq" : "choice", min, max, items };
      }
      case "annotation": return null;
      case "any": {
        const bound = opts.anyBindings?.[ownerId];
        if (!bound) { unsupported.add(`particle any in ${ownerId}`); return null; }
        const items: ParticleIR[] = bound.map((nm) => {
          const [key, g] = [...globals.element].find(([k]) => k.endsWith(`}${nm}`)) ?? [];
          if (!g || !key) throw new Error(`any binding ${nm} not found`);
          return { k: "el", name: nm, ns: key.slice(1, key.indexOf("}")), type: typeRefOfElement(g, nm), min: 1, max: 1, doc: docOf(g) };
        });
        return { k: "choice", min, max, items };
      }
      default:
        unsupported.add(`particle ${el.local} in ${ownerId}`);
        return null;
    }
  };

  const attrFromEl = (a: XElement, ownerId: string): AttrIR => {
    const t = attr(a, "type");
    const st = xsKids(a, "simpleType")[0];
    const type = t ? resolveSimpleByQName(qn(a, t)) : st ? simpleFromEl(st) : builtinSimple("anySimpleType");
    return { name: attr(a, "name") ?? `?${ownerId}`, type, required: attr(a, "use") === "required", fixed: attr(a, "fixed"), doc: docOf(a) };
  };

  function complexFromEl(el: XElement, id: string, anonymous: boolean) {
    if (complexDone.has(id)) return;
    complexDone.add(id);
    const d = ownerDoc(el);
    const c: ComplexIR = { kind: "complex", id, anonymous, ns: d.tns, attrs: [], doc: docOf(el) ?? (anonymous && el.parent ? docOf(el.parent) : undefined) };
    ir.complex[id] = c;
    for (const k of xsKids(el)) {
      switch (k.local) {
        case "annotation": break;
        case "sequence": case "choice": c.content = particle(k, id) ?? undefined; break;
        case "attribute": c.attrs.push(attrFromEl(k, id)); break;
        case "simpleContent": {
          const ext = xsKids(k, "extension")[0];
          if (!ext) { unsupported.add(`simpleContent/restriction at ${id}`); break; }
          c.text = resolveSimpleByQName(qn(ext, attr(ext, "base")!));
          for (const a of xsKids(ext, "attribute")) c.attrs.push(attrFromEl(a, id));
          break;
        }
        default: unsupported.add(`complexType child ${k.local} at ${id}`);
      }
    }
  }

  for (const r of roots) {
    if (r.element) {
      const [key, g] = [...globals.element].find(([k]) => k.endsWith(`}${r.element}`))!;
      const tr = typeRefOfElement(g, r.element);
      if (!("ref" in tr)) throw new Error("root must be complex");
      if (!ir.root.name) ir.root = { name: r.element, ns: key.slice(1, key.indexOf("}")), type: tr.ref };
    } else if (r.type) {
      const [, g] = [...globals.complex].find(([k]) => k.endsWith(`}${r.type}`))!;
      complexFromEl(g, r.type, false);
    }
  }
  for (const d of docs) for (const [p, u] of d.root.nsDecls) if (u !== XS) ir.namespaces[u] = p;
  ir.unsupported = [...unsupported];
  return ir;
}
