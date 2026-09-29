/**
 * Decoder tolerante guiado pelos descritores: árvore do `@sinete/core/xml` para objeto tipado. Os valores ficam na forma
 * lexical exata do documento (decimais inclusive), então nada se perde em formatação.
 *
 * Tolerante de propósito (ADR 0002, decisão 4): documento recebido de terceiros não aborta. Elemento ou atributo
 * desconhecido, whitespace entre tags, texto solto e namespace errado viram ocorrências com o caminho, e o resto do
 * documento é lido. A validação estrita é do `validate`. Nunca reserialize um documento recebido: guarde a string
 * original, que é a que a assinatura cobre.
 */

import type { ValidationIssue } from '@sinete/core';
import type { XmlDocument, XmlElement } from '@sinete/core/xml';
import { descendants, escapeC14nAttribute, inScopeNamespaces } from '@sinete/core/xml';
import type { ComplexType, ElementParticle, Particle, RootElement } from './desc.ts';
import { isComplexType, isElementParticle, isWildcard, maxOccurs } from './desc.ts';

/** Códigos das ocorrências do decoder. */
export type DecodeIssueCode =
  | 'elemento_desconhecido'
  | 'atributo_desconhecido'
  | 'whitespace_descartado'
  | 'texto_inesperado'
  | 'elemento_em_tipo_simples'
  | 'namespace_divergente'
  | 'raiz_inesperada';

export interface DecodeIssue extends ValidationIssue {
  readonly code: DecodeIssueCode;
}

export interface Decoded<T> {
  readonly value: T;
  readonly issues: readonly DecodeIssue[];
}

interface ElInfo {
  readonly p: ElementParticle;
  readonly arr: boolean;
}

interface CtInfo {
  readonly els: Map<string, ElInfo>;
  readonly wildcard: boolean;
  readonly attrs: Set<string>;
}

const infos = new WeakMap<ComplexType, CtInfo>();

function infoOf(ct: ComplexType): CtInfo {
  let m = infos.get(ct);
  if (m) return m;
  const els = new Map<string, ElInfo>();
  let wildcard = false;
  const walk = (p: Particle, rep: boolean): void => {
    if (isWildcard(p)) wildcard = true;
    else if (isElementParticle(p)) {
      // Nome repetido com o mesmo tipo em ramos diferentes (IPI no choice do imposto) é uma propriedade só.
      const prev = els.get(p.e);
      els.set(p.e, { p, arr: rep || maxOccurs(p) > 1 || (prev?.arr ?? false) });
    } else for (const i of p.i) walk(i, rep || maxOccurs(p) > 1);
  };
  if (ct.c) walk(ct.c, false);
  m = { els, wildcard, attrs: new Set((ct.a ?? []).map((a) => a.a)) };
  infos.set(ct, m);
  return m;
}

/** Decodifica o elemento `el` como o tipo `ct`. Nunca lança por causa do conteúdo. */
export function decode<T>(ct: ComplexType<T>, el: XmlElement, source?: string): Decoded<T> {
  const issues: DecodeIssue[] = [];
  const value = decodeCT(ct as ComplexType, el, issues, `/${el.local}`, source) as T;
  return { value, issues };
}

/** Decodifica um documento parseado pela raiz esperada. Raiz com outro nome ou namespace vira ocorrência. */
export function decodeRoot<T>(root: RootElement<T>, doc: XmlDocument): Decoded<T> {
  const issues: DecodeIssue[] = [];
  if (doc.root.local !== root.name || doc.root.ns !== root.ns) {
    issues.push({
      path: `/${doc.root.local}`,
      code: 'raiz_inesperada',
      message: `raiz esperada {${root.ns}}${root.name}`,
    });
  }
  const value = decodeCT(root.type as ComplexType, doc.root, issues, `/${doc.root.local}`, doc.source) as T;
  return { value, issues };
}

function pushTo(o: Record<string, unknown>, key: string, v: unknown): void {
  const cur = o[key];
  if (Array.isArray(cur)) cur.push(v);
  else o[key] = [v];
}

/**
 * Fragmento de `xs:any` completo em namespaces: o trecho da fonte perde as declarações feitas nos ancestrais, então
 * as que ele usa entram na tag de abertura dele. O default só entra quando difere do namespace do pai, que é o default
 * em que o serializer vai inserir o trecho. Sem prefixo herdado e com o default do pai, o trecho sai intacto.
 */
function wildcardFragment(source: string, c: XmlElement, parent: XmlElement): string {
  const raw = source.slice(c.start, c.end);
  const outer = inScopeNamespaces(parent);
  const need = new Map<string, string>();
  const declaredInside = (e: XmlElement, prefix: string): boolean => {
    for (let x: XmlElement | null = e; x && x !== parent; x = x.parent) if (x.namespaces.has(prefix)) return true;
    return false;
  };
  const use = (e: XmlElement, prefix: string): void => {
    if (prefix === 'xml' || need.has(prefix) || declaredInside(e, prefix)) return;
    const uri = outer.get(prefix) ?? '';
    if (prefix === '' && uri === parent.ns) return;
    need.set(prefix, uri);
  };
  for (const e of descendants(c)) {
    use(e, e.prefix);
    for (const a of e.attributes) if (a.prefix !== '') use(e, a.prefix);
  }
  if (need.size === 0) return raw;
  const decls = [...need]
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    .map(([p, u]) => ` ${p === '' ? 'xmlns' : `xmlns:${p}`}="${escapeC14nAttribute(u)}"`)
    .join('');
  const at = 1 + c.name.length;
  return raw.slice(0, at) + decls + raw.slice(at);
}

function pushAttr(o: Record<string, unknown>, name: string, value: string): void {
  const cur = (o.$attrs as Record<string, string> | undefined) ?? {};
  // defineProperty porque o nome vem do documento: `__proto__` como atributo não pode virar troca de protótipo.
  Object.defineProperty(cur, name, { value, enumerable: true, writable: true, configurable: true });
  o.$attrs = cur;
}

function decodeCT(
  ct: ComplexType,
  el: XmlElement,
  issues: DecodeIssue[],
  path: string,
  source: string | undefined,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  const info = infoOf(ct);
  for (const a of el.attributes) {
    if (a.ns === '' && info.attrs.has(a.local)) o[a.local] = a.value;
    else if (ct.aa) {
      pushAttr(o, a.name, a.value);
      // Atributo com prefixo leva a declaração junto, senão o serializer emitiria um prefixo não declarado.
      if (a.prefix !== '' && a.prefix !== 'xml') pushAttr(o, `xmlns:${a.prefix}`, a.ns);
    } else
      issues.push({ path: `${path}/@${a.name}`, code: 'atributo_desconhecido', message: 'atributo fora do schema' });
  }
  if (ct.tx) {
    let s = '';
    for (const c of el.children) {
      if (c.type === 'text') s += c.value;
      else if (c.type === 'element') {
        issues.push({
          path: `${path}/${c.local}`,
          code: 'elemento_em_tipo_simples',
          message: 'elemento em conteúdo simples',
        });
      }
    }
    o.$text = s;
    return o;
  }
  for (const c of el.children) {
    if (c.type === 'pi') continue;
    if (c.type === 'text') {
      const ws = /^[ \t\n\r]*$/.test(c.value);
      issues.push(
        ws
          ? { path, code: 'whitespace_descartado', message: 'whitespace entre elementos descartado' }
          : { path, code: 'texto_inesperado', message: 'texto em elemento só de elementos' },
      );
      continue;
    }
    const ei = info.els.get(c.local);
    const cp = `${path}/${c.local}`;
    if (!ei) {
      if (info.wildcard && source !== undefined) {
        pushTo(o, '$any', wildcardFragment(source, c, el));
      } else {
        issues.push({ path: cp, code: 'elemento_desconhecido', message: 'elemento fora do schema' });
      }
      continue;
    }
    if (c.ns !== (ei.p.ns ?? ct.ns)) {
      issues.push({ path: cp, code: 'namespace_divergente', message: `namespace esperado ${ei.p.ns ?? ct.ns}` });
    }
    const v = isComplexType(ei.p.t) ? decodeCT(ei.p.t, c, issues, cp, source) : decodeSimple(c, issues, cp);
    if (ei.arr) pushTo(o, c.local, v);
    else o[c.local] = v;
  }
  return o;
}

function decodeSimple(el: XmlElement, issues: DecodeIssue[], path: string): string {
  for (const a of el.attributes) {
    issues.push({ path: `${path}/@${a.name}`, code: 'atributo_desconhecido', message: 'atributo fora do schema' });
  }
  const first = el.children[0];
  if (el.children.length === 1 && first?.type === 'text') return first.value;
  let s = '';
  for (const c of el.children) {
    if (c.type === 'text') s += c.value;
    else if (c.type === 'element') {
      issues.push({
        path: `${path}/${c.local}`,
        code: 'elemento_em_tipo_simples',
        message: 'elemento em tipo simples',
      });
    }
  }
  return s;
}
