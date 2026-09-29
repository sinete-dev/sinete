/**
 * Serializer guiado pelos descritores: emite os elementos na ordem do XSD e na forma canônica, a mesma do C14N 1.0
 * (sem declaração XML, sem whitespace entre tags, atributos em ordem, tag de abertura e fechamento sempre, escapes do
 * C14N). A string de um elemento já é o C14N dele, exceto pelo `xmlns` herdado que o C14N acrescenta no ápice do
 * subconjunto assinado. É essa string que o `@sinete/core/xml` assina sem reparsear (ADR 0002, decisão 3).
 *
 * Valores simples são strings lexicais: o serializer não converte número nem data. Exclusividade de `choice`,
 * facetas e ocorrências são do validador, não daqui.
 */

import { escapeC14nAttribute, escapeC14nText } from '@sinete/core/xml';
import { SerializeError } from '../errors.ts';
import type { AttributeDecl, ComplexType, Particle, RootElement, SimpleType } from './desc.ts';
import { isComplexType, isElementParticle, isWildcard, maxOccurs } from './desc.ts';

type Obj = Readonly<Record<string, unknown>>;

const sortedAttrs = new WeakMap<ComplexType, readonly AttributeDecl[]>();

function attrsOf(ct: ComplexType): readonly AttributeDecl[] {
  let a = sortedAttrs.get(ct);
  if (!a) {
    a = [...(ct.a ?? [])].sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : 0));
    sortedAttrs.set(ct, a);
  }
  return a;
}

function memberNames(p: Particle, acc: string[]): string[] {
  if (isWildcard(p)) acc.push('$any');
  else if (isElementParticle(p)) acc.push(p.e);
  else for (const i of p.i) memberNames(i, acc);
  return acc;
}

function presentNames(p: Particle, o: Obj, acc: string[]): string[] {
  for (const n of memberNames(p, [])) if (o[n] !== undefined) acc.push(n);
  return acc;
}

function groupCount(p: Particle, o: Obj): number {
  if (isWildcard(p)) return Array.isArray(o.$any) ? o.$any.length : 0;
  if (isElementParticle(p)) {
    const v = o[p.e];
    return v === undefined ? 0 : Array.isArray(v) ? v.length : 1;
  }
  let m = 0;
  for (const i of p.i) m = Math.max(m, groupCount(i, o));
  return m;
}

/**
 * Serializa `value` como o elemento `name` do tipo `ct`. `inheritedNs` é o namespace default já em escopo onde a
 * string vai ser inserida (vazio para documento novo, que então recebe `xmlns`).
 */
export function serialize<T>(ct: ComplexType<T>, name: string, value: T, inheritedNs = ''): string {
  const out: string[] = [];
  element(ct as ComplexType, name, value, ct.ns, inheritedNs, out, `/${name}`);
  return out.join('');
}

/** Serializa um documento a partir do elemento raiz, com o `xmlns` do namespace dele. */
export function serializeRoot<T>(root: RootElement<T>, value: T): string {
  const out: string[] = [];
  element(root.type as ComplexType, root.name, value, root.ns, '', out, `/${root.name}`);
  return out.join('');
}

function text(v: unknown, path: string): string {
  if (typeof v !== 'string') throw new SerializeError(path, `esperado string, veio ${typeof v}`);
  return v;
}

function element(
  t: ComplexType | SimpleType,
  name: string,
  v: unknown,
  ns: string,
  inScopeNs: string,
  out: string[],
  path: string,
): void {
  let open = `<${name}`;
  if (ns !== inScopeNs) open += ` xmlns="${escapeC14nAttribute(ns)}"`;
  if (!isComplexType(t)) {
    out.push(open, '>', escapeC14nText(text(v, path)), '</', name, '>');
    return;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new SerializeError(path, `esperado objeto do tipo ${t.id}`);
  }
  const o = v as Obj;
  const attrs: [string, string][] = [];
  for (const a of attrsOf(t)) {
    const av = o[a.a] ?? a.f;
    if (av !== undefined) attrs.push([a.a, text(av, `${path}/@${a.a}`)]);
  }
  if (t.aa && o.$attrs !== undefined) {
    for (const [k, av] of Object.entries(o.$attrs as Obj)) attrs.push([k, text(av, `${path}/@${k}`)]);
    attrs.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  }
  for (const [k, av] of attrs) open += ` ${k}="${escapeC14nAttribute(av)}"`;
  out.push(open, '>');
  if (t.tx) out.push(escapeC14nText(text(o.$text, `${path}/text()`)));
  if (t.c) particle(t.c, o, ns, out, -1, path);
  out.push('</', name, '>');
}

function particle(p: Particle, o: Obj, ns: string, out: string[], gi: number, path: string): void {
  if (isWildcard(p)) {
    const raw = o.$any;
    if (raw === undefined) return;
    if (!Array.isArray(raw)) throw new SerializeError(`${path}/$any`, 'esperado array de XML bruto');
    const items = gi >= 0 ? (raw[gi] === undefined ? [] : [raw[gi]]) : raw;
    for (const x of items) out.push(text(x, `${path}/$any`));
    return;
  }
  if (isElementParticle(p)) {
    const v = o[p.e];
    if (v === undefined) return;
    const ens = p.ns ?? ns;
    const ep = `${path}/${p.e}`;
    if (Array.isArray(v)) {
      if (gi >= 0) {
        if (v[gi] !== undefined) element(p.t, p.e, v[gi], ens, ns, out, ep);
      } else for (const x of v) element(p.t, p.e, x, ens, ns, out, ep);
    } else element(p.t, p.e, v, ens, ns, out, ep);
    return;
  }
  if (p.g === 's') {
    if (maxOccurs(p) > 1) {
      // Sequência repetível: os arrays dos membros são zipados por índice (ex.: infProt cMsg/xMsg).
      const n = groupCount(p, o);
      for (let k = 0; k < n; k++) for (const i of p.i) particle(i, o, ns, out, k, path);
    } else for (const i of p.i) particle(i, o, ns, out, gi, path);
    return;
  }
  // choice: vence o primeiro ramo que declara todos os membros presentes. Ramos podem compartilhar membros (IPI
  // aparece nos dois ramos do imposto), então ter um membro presente não basta para escolher o ramo.
  const present = p.i.flatMap((i) => presentNames(i, o, []));
  if (present.length === 0) return;
  for (const i of p.i) {
    const own = memberNames(i, []);
    if (present.every((n) => own.includes(n))) {
      particle(i, o, ns, out, gi, path);
      return;
    }
  }
  throw new SerializeError(path, `choice com membros de ramos exclusivos: ${[...new Set(present)].join(', ')}`);
}
