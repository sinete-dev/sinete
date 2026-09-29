/**
 * XSD (o subconjunto usado pelos DF-e) para IR. Escrito a partir de XML Schema 1.0 Part 1 e Part 2.
 *
 * O que fica fora do subconjunto vai para `unsupported` em vez de ser ignorado, e o CLI aborta se a lista não estiver
 * vazia: nada do schema some em silêncio.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { XmlElement } from '@sinete/core/xml';
import { attributeOf, childElements, inScopeNamespaces, parseXml, textOf } from '@sinete/core/xml';
import type { AttrIR, ComplexIR, Facets, ParticleIR, RootIR, SchemaIR, SimpleIR, TypeRef } from './ir.ts';

const XS = 'http://www.w3.org/2001/XMLSchema';

interface SchemaDoc {
  readonly file: string;
  readonly tns: string;
  /** Include sem targetNamespace (XSD 1.0 Part 1, 4.2.1): herda o namespace de quem inclui. */
  readonly chameleon: boolean;
  readonly root: XmlElement;
  readonly qualified: boolean;
}

export interface RootSpec {
  /** Nome do elemento raiz. */
  readonly element: string;
  /**
   * Tipo complexo global, quando o elemento não é declarado nos arquivos carregados (ex.: `nfeProc` do tipo
   * `TNfeProc`, cujo `procNFe_v4.00.xsd` não vem no PL_010f).
   */
  readonly type?: string;
}

export interface BuildOptions {
  readonly subpath: string;
  readonly pl: string;
  /** Arquivos de entrada, na ordem: em nome global repetido entre pacotes, vale o primeiro carregado. */
  readonly entries: readonly string[];
  readonly roots: readonly RootSpec[];
  /**
   * Ligações de `xs:any` como dado (ADR 0002, decisão 8): id do tipo dono para os elementos globais que podem
   * aparecer ali, como um choice. Ex.: `infModal` do MDF-e para `rodo | aereo | aquav | ferrov`.
   */
  readonly anyBindings?: Readonly<Record<string, readonly string[]>>;
  /**
   * Troca o tipo de um elemento local pelo tipo de um elemento global de outro arquivo. Ex.: o `detEvento` genérico
   * do evento (`xs:any`) passa a ter o tipo do `detEvento` do `e110111_v1.00.xsd` (cancelamento), que é como a SEFAZ
   * valida em duas etapas.
   */
  readonly overrides?: Readonly<Record<string, { readonly entry: string; readonly element: string }>>;
  /**
   * Arquivo importado que o pacote oficial não redistribui (nome do arquivo para o caminho a usar). Ex.: o
   * PL_NFeDistDFe_104 importa o xmldsig-core-schema_v1.01.xsd sem trazê-lo.
   */
  readonly missingImports?: Readonly<Record<string, string>>;
  /**
   * Elementos declarados sem tipo (o XSD os faz `xs:anyType`) que o gerador aceita como texto, como dado revisado.
   * Ex.: o `tpAmb` do `TRetMDFe` no PL do MDF-e 3.00b. O validador aceita qualquer texto ali e recusa filhos, o que é
   * mais estrito que o `anyType` do XSD; fora desta lista, elemento sem tipo continua abortando a geração.
   */
  readonly untypedAsText?: readonly string[];
  /**
   * Elementos globais referenciados (`{ns}nome`) que viram wildcard (`$any`, XML bruto) em vez de tipo gerado. Ex.: o
   * `ds:Signature` da NFS-e, que importa o xmldsig completo do W3C (conteúdo misto e `xs:any` lax, fora do subconjunto);
   * a assinatura é conferida pelo verificador do `@sinete/core/xml`, não pelo schema.
   */
  readonly opaqueElements?: readonly string[];
  /** Import trocado mesmo existindo (nome do arquivo para o caminho a usar), para DTD interno que o parser recusa. */
  readonly replaceImports?: Readonly<Record<string, string>>;
  /**
   * Troca de pattern num tipo simples global: nome do tipo para o pattern oficial (`de`) e o usado (`para`). Pattern
   * oficial que não aparece no tipo, ou tipo que não é gerado, vai para `unsupported`: correção esquecida não passa
   * em silêncio quando o pacote muda.
   */
  readonly patternPatches?: Readonly<Record<string, { readonly de: string; readonly para: string }>>;
}

const xsKids = (el: XmlElement, local?: string): XmlElement[] =>
  childElements(el).filter((c) => c.ns === XS && (local === undefined || c.local === local));

const attr = (el: XmlElement, n: string): string | undefined => attributeOf(el, n);

function docOf(el: XmlElement): string | undefined {
  const ann = xsKids(el, 'annotation')[0];
  if (!ann) return undefined;
  const d = xsKids(ann, 'documentation')
    .map((x) => textOf(x))
    .join('\n')
    .trim();
  return d || undefined;
}

function loadSchemas(
  entries: readonly string[],
  missing: Readonly<Record<string, string>>,
  replace: Readonly<Record<string, string>>,
): SchemaDoc[] {
  const seen = new Map<string, SchemaDoc>();
  const visit = (wanted: string, includerTns?: string): void => {
    const base = path.basename(wanted);
    const file = replace[base] ?? (existsSync(wanted) ? wanted : (missing[base] ?? wanted));
    if (seen.has(file)) return;
    // Alguns XSD oficiais (NFS-e) começam com BOM; o parser do @sinete/core/xml não o aceita antes da declaração.
    const root = parseXml(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')).root;
    const declared = attr(root, 'targetNamespace');
    const chameleon = declared === undefined && includerTns !== undefined;
    const doc: SchemaDoc = {
      file,
      tns: declared ?? includerTns ?? '',
      chameleon,
      root,
      qualified: attr(root, 'elementFormDefault') === 'qualified',
    };
    seen.set(file, doc);
    for (const inc of xsKids(root, 'include')) {
      const loc = attr(inc, 'schemaLocation');
      if (loc) visit(path.join(path.dirname(file), loc), doc.tns);
    }
    for (const imp of xsKids(root, 'import')) {
      const loc = attr(imp, 'schemaLocation');
      if (loc) visit(path.join(path.dirname(file), loc));
    }
  };
  for (const e of entries) visit(e);
  return [...seen.values()];
}

export function buildIR(opts: BuildOptions): SchemaIR {
  const docs = loadSchemas(opts.entries, opts.missingImports ?? {}, opts.replaceImports ?? {});
  const topDoc = new Map<XmlElement, SchemaDoc>();
  const globals = {
    simple: new Map<string, XmlElement>(),
    complex: new Map<string, XmlElement>(),
    element: new Map<string, XmlElement>(),
  };
  for (const d of docs) {
    for (const c of childElements(d.root)) {
      topDoc.set(c, d);
      const name = attr(c, 'name');
      if (!name || c.ns !== XS) continue;
      const key = `{${d.tns}}${name}`;
      const bucket =
        c.local === 'simpleType'
          ? globals.simple
          : c.local === 'complexType'
            ? globals.complex
            : c.local === 'element'
              ? globals.element
              : undefined;
      // Primeiro carregado vence: tipos básicos repetidos entre pacotes vêm do pacote do envelope (o mais novo).
      if (bucket && !bucket.has(key)) bucket.set(key, c);
    }
  }
  const ownerDoc = (el: XmlElement): SchemaDoc => {
    for (let e: XmlElement | null = el; e; e = e.parent) {
      const d = topDoc.get(e);
      if (d) return d;
    }
    throw new Error('elemento de schema órfão');
  };
  const qn = (el: XmlElement, value: string): string => {
    const i = value.indexOf(':');
    const prefix = i === -1 ? '' : value.slice(0, i);
    const local = i === -1 ? value : value.slice(i + 1);
    let ns = inScopeNamespaces(el).get(prefix);
    if (ns === undefined && prefix !== '') throw new Error(`prefixo não resolvido em ${value}`);
    const d = ownerDoc(el);
    if ((ns === undefined || ns === '') && d.chameleon) ns = d.tns;
    return `{${ns ?? ''}}${local}`;
  };
  const byLocalName = (m: Map<string, XmlElement>, name: string): [string, XmlElement] | undefined =>
    [...m].find(([k]) => k.endsWith(`}${name}`));

  const unsupported = new Set<string>();
  const ir: SchemaIR = { subpath: opts.subpath, pl: opts.pl, roots: [], complex: {}, simple: {}, unsupported: [] };
  const simpleCache = new Map<string, SimpleIR>();
  const patchesUsed = new Set<string>();
  const builtin = (local: string): SimpleIR => ({ kind: 'simple', builtin: local, chain: [], facets: {} });

  const simpleByQName = (q: string): SimpleIR => {
    if (q.startsWith(`{${XS}}`)) return builtin(q.slice(XS.length + 2));
    const cached = simpleCache.get(q);
    if (cached) return cached;
    const el = globals.simple.get(q);
    if (!el) throw new Error(`tipo simples não encontrado: ${q}`);
    const name = attr(el, 'name') as string;
    const s = simpleFromEl(el, name);
    simpleCache.set(q, s);
    ir.simple[name] = s;
    return s;
  };

  const simpleFromEl = (el: XmlElement, name?: string): SimpleIR => {
    const r = xsKids(el, 'restriction')[0];
    const doc = docOf(el);
    const base0 = (): SimpleIR => {
      const out: SimpleIR = { kind: 'simple', builtin: 'string', chain: [], facets: {} };
      if (name) out.name = name;
      return out;
    };
    if (!r) {
      unsupported.add(`simpleType sem restriction (${xsKids(el).map((k) => k.local)}) em ${name ?? 'anônimo'}`);
      return base0();
    }
    const baseQ = attr(r, 'base');
    const inner = xsKids(r, 'simpleType')[0];
    const base: SimpleIR = baseQ ? simpleByQName(qn(r, baseQ)) : inner ? simpleFromEl(inner) : base0();
    const f: Facets = { ...base.facets };
    if (base.facets.patterns) f.patterns = [...base.facets.patterns];
    const step: string[] = [];
    const enums: string[] = [];
    for (const k of xsKids(r)) {
      const v = attr(k, 'value') ?? '';
      switch (k.local) {
        case 'pattern': {
          const patch = name === undefined ? undefined : opts.patternPatches?.[name];
          if (patch !== undefined && patch.de === v) {
            patchesUsed.add(name as string);
            step.push(patch.para);
          } else step.push(v);
          break;
        }
        case 'enumeration':
          enums.push(v);
          break;
        case 'length':
        case 'minLength':
        case 'maxLength':
        case 'totalDigits':
        case 'fractionDigits':
          f[k.local] = Number(v);
          break;
        case 'minInclusive':
        case 'maxInclusive':
        case 'minExclusive':
        case 'maxExclusive':
          f[k.local] = v;
          break;
        case 'whiteSpace':
          f.whiteSpace = v as NonNullable<Facets['whiteSpace']>;
          break;
        case 'annotation':
        case 'simpleType':
          break;
        default:
          unsupported.add(`faceta ${k.local}`);
      }
    }
    if (step.length > 0) f.patterns = [...(f.patterns ?? []), step];
    // Enumeração do passo derivado substitui a da base (ela é um subconjunto).
    if (enums.length > 0) f.enumeration = enums;
    const out: SimpleIR = {
      kind: 'simple',
      builtin: base.builtin,
      chain: base.name ? [base.name, ...base.chain] : base.chain,
      facets: f,
    };
    if (name) out.name = name;
    if (doc) out.doc = doc;
    return out;
  };

  const complexDone = new Set<string>();

  const typeRefOfElement = (el: XmlElement, id: string): TypeRef => {
    const t = attr(el, 'type');
    if (t) {
      const q = qn(el, t);
      const g = globals.complex.get(q);
      if (g) {
        const name = attr(g, 'name') as string;
        complexFromEl(g, name, false);
        return { ref: name };
      }
      return simpleByQName(q);
    }
    const ct = xsKids(el, 'complexType')[0];
    if (ct) {
      complexFromEl(ct, id, true);
      return { ref: id };
    }
    const st = xsKids(el, 'simpleType')[0];
    if (st) return simpleFromEl(st);
    if (!opts.untypedAsText?.includes(id)) unsupported.add(`elemento sem tipo em ${id}`);
    return builtin('anyType');
  };

  const occurs = (el: XmlElement): { min: number; max: number } => {
    const mx = attr(el, 'maxOccurs') ?? '1';
    return {
      min: Number(attr(el, 'minOccurs') ?? '1'),
      max: mx === 'unbounded' ? Number.POSITIVE_INFINITY : Number(mx),
    };
  };

  const overrideFor = (id: string): XmlElement | undefined => {
    const o = opts.overrides?.[id];
    if (!o) return undefined;
    const d = docs.find((x) => x.file === o.entry);
    const g = d && xsKids(d.root, 'element').find((e) => attr(e, 'name') === o.element);
    if (!g) throw new Error(`override ${id}: ${o.element} não encontrado em ${o.entry}`);
    return g;
  };

  const particle = (el: XmlElement, ownerId: string): ParticleIR | null => {
    const { min, max } = occurs(el);
    switch (el.local) {
      case 'element': {
        const ref = attr(el, 'ref');
        if (ref) {
          const q = qn(el, ref);
          if (opts.opaqueElements?.includes(q)) return { k: 'any', min, max };
          const g = globals.element.get(q);
          if (!g) throw new Error(`element ref não encontrado: ${q}`);
          const nm = attr(g, 'name') as string;
          const p: ParticleIR = { k: 'el', name: nm, ns: ownerDoc(g).tns, type: typeRefOfElement(g, nm), min, max };
          const doc = docOf(el) ?? docOf(g);
          if (doc) p.doc = doc;
          return p;
        }
        const d = ownerDoc(el);
        if (!d.qualified) unsupported.add(`elemento local não qualificado em ${path.basename(d.file)}`);
        const nm = attr(el, 'name') as string;
        const id = `${ownerId}.${nm}`;
        const over = overrideFor(id);
        const t = typeRefOfElement(over ?? el, id);
        const unique = xsKids(el, 'unique').map((u) => {
          const sel = attr(xsKids(u, 'selector')[0] as XmlElement, 'xpath');
          const field = attr(xsKids(u, 'field')[0] as XmlElement, 'xpath') ?? '';
          if (sel !== './*' || !field.startsWith('@')) unsupported.add(`xs:unique ${sel} ${field} em ${id}`);
          return field.slice(1);
        });
        const p: ParticleIR = { k: 'el', name: nm, ns: d.tns, type: t, min, max };
        if (unique.length > 0) p.unique = unique;
        const doc = docOf(el) ?? (over ? docOf(over) : undefined);
        if (doc) p.doc = doc;
        return p;
      }
      case 'sequence':
      case 'choice': {
        const items: ParticleIR[] = [];
        for (const k of xsKids(el)) {
          if (k.local === 'annotation') continue;
          const p = particle(k, ownerId);
          if (p) items.push(p);
        }
        return { k: el.local === 'sequence' ? 'seq' : 'choice', min, max, items };
      }
      case 'annotation':
        return null;
      case 'any': {
        const bound = opts.anyBindings?.[ownerId];
        if (bound) {
          const items: ParticleIR[] = bound.map((nm) => {
            const found = byLocalName(globals.element, nm);
            if (!found) throw new Error(`ligação de xs:any ${ownerId}: ${nm} não encontrado`);
            const [key, g] = found;
            const p: ParticleIR = {
              k: 'el',
              name: nm,
              ns: key.slice(1, key.indexOf('}')),
              type: typeRefOfElement(g, nm),
              min: 1,
              max: 1,
            };
            const doc = docOf(g);
            if (doc) p.doc = doc;
            return p;
          });
          return { k: 'choice', min, max, items };
        }
        const ns = attr(el, 'namespace');
        if (attr(el, 'processContents') !== 'skip' || (ns !== undefined && ns !== '##any')) {
          unsupported.add(`xs:any não ligado e fora de processContents=skip/##any em ${ownerId}`);
          return null;
        }
        return { k: 'any', min, max };
      }
      default:
        unsupported.add(`partícula ${el.local} em ${ownerId}`);
        return null;
    }
  };

  const attrFromEl = (a: XmlElement, ownerId: string): AttrIR => {
    const t = attr(a, 'type');
    const st = xsKids(a, 'simpleType')[0];
    const type = t ? simpleByQName(qn(a, t)) : st ? simpleFromEl(st) : builtin('anySimpleType');
    const name = attr(a, 'name');
    if (!name) unsupported.add(`atributo sem nome (ref?) em ${ownerId}`);
    const out: AttrIR = { name: name ?? '?', type, required: attr(a, 'use') === 'required' };
    const fixed = attr(a, 'fixed');
    if (fixed !== undefined) out.fixed = fixed;
    const doc = docOf(a);
    if (doc) out.doc = doc;
    return out;
  };

  function complexFromEl(el: XmlElement, id: string, anonymous: boolean): void {
    if (complexDone.has(id)) return;
    complexDone.add(id);
    const d = ownerDoc(el);
    const c: ComplexIR = { kind: 'complex', id, anonymous, ns: d.tns, attrs: [] };
    const doc = docOf(el) ?? (anonymous && el.parent ? docOf(el.parent) : undefined);
    if (doc) c.doc = doc;
    ir.complex[id] = c;
    if (attr(el, 'mixed') === 'true') unsupported.add(`conteúdo misto em ${id}`);
    for (const k of xsKids(el)) {
      switch (k.local) {
        case 'annotation':
          break;
        case 'sequence':
        case 'choice': {
          const p = particle(k, id);
          if (p) c.content = p;
          break;
        }
        case 'attribute':
          c.attrs.push(attrFromEl(k, id));
          break;
        case 'anyAttribute':
          if (attr(k, 'processContents') !== 'skip') unsupported.add(`anyAttribute sem skip em ${id}`);
          c.anyAttribute = true;
          break;
        case 'simpleContent': {
          const ext = xsKids(k, 'extension')[0];
          if (!ext) {
            unsupported.add(`simpleContent/restriction em ${id}`);
            break;
          }
          c.text = simpleByQName(qn(ext, attr(ext, 'base') as string));
          for (const a of xsKids(ext)) {
            if (a.local === 'attribute') c.attrs.push(attrFromEl(a, id));
            else if (a.local !== 'annotation') unsupported.add(`simpleContent/extension/${a.local} em ${id}`);
          }
          break;
        }
        default:
          unsupported.add(`filho ${k.local} de complexType em ${id}`);
      }
    }
  }

  for (const r of opts.roots) {
    let root: RootIR;
    if (r.type) {
      const found = byLocalName(globals.complex, r.type);
      if (!found) throw new Error(`raiz ${r.element}: tipo ${r.type} não encontrado`);
      complexFromEl(found[1], r.type, false);
      root = { name: r.element, ns: found[0].slice(1, found[0].indexOf('}')), type: r.type };
    } else {
      const found = byLocalName(globals.element, r.element);
      if (!found) throw new Error(`raiz ${r.element} não encontrada`);
      const tr = typeRefOfElement(found[1], r.element);
      if (!('ref' in tr)) throw new Error(`raiz ${r.element} precisa ser de tipo complexo`);
      root = { name: r.element, ns: found[0].slice(1, found[0].indexOf('}')), type: tr.ref };
    }
    ir.roots.push(root);
  }
  for (const [id] of Object.entries(opts.overrides ?? {})) {
    if (!ir.complex[id]) unsupported.add(`override ${id} não foi usado`);
  }
  for (const tipo of Object.keys(opts.patternPatches ?? {})) {
    if (!patchesUsed.has(tipo)) unsupported.add(`correção de pattern em ${tipo} não foi usada`);
  }
  ir.unsupported = [...unsupported];
  return ir;
}
