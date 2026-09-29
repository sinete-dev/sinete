/**
 * Canonical XML 1.0 inclusivo, sem comentários (`http://www.w3.org/TR/2001/REC-xml-c14n-20010315`), do subconjunto
 * "elemento e descendentes", o único usado pelos DF-e (Reference para um `Id`).
 *
 * Escrito a partir da spec W3C (seções 2.3 e 2.4). Como o subconjunto é um document subset, o elemento ápice recebe
 * todos os namespaces em escopo e os atributos `xml:*` herdados dos ancestrais; é por isso que um `xmlns:xsi`
 * acrescentado no envelope depois da assinatura invalida o digest (ADR 0003).
 */

import type { XmlAttribute, XmlElement } from './parser.ts';
import { inScopeNamespaces, XML_NS } from './parser.ts';

const TEXT_ESC = /[&<>\r]/;
const ATTR_ESC = /[&<"\t\n\r]/;

/** Escape de nó de texto do C14N: `&`, `<`, `>` e CR. */
export function escapeC14nText(s: string): string {
  if (!TEXT_ESC.test(s)) return s;
  return s.replace(/[&<>\r]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&#xD;'));
}

/** Escape de valor de atributo do C14N: `&`, `<`, `"`, TAB, LF e CR. */
export function escapeC14nAttribute(s: string): string {
  if (!ATTR_ESC.test(s)) return s;
  return s.replace(/[&<"\t\n\r]/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '"'
          ? '&quot;'
          : c === '\t'
            ? '&#x9;'
            : c === '\n'
              ? '&#xA;'
              : '&#xD;',
  );
}

function cmp(a: string, b: string): number {
  // Ordem por unidades UTF-16. Nomes e URIs de DF-e são ASCII, onde ela coincide com a ordem por code point da spec.
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface C14nOptions {
  /** Elementos omitidos com toda a subárvore (é o transform `enveloped-signature`). */
  readonly exclude?: ReadonlySet<XmlElement>;
}

/** C14N 1.0 inclusivo, sem comentários, do elemento `apex` e seus descendentes. */
export function c14n(apex: XmlElement, options: C14nOptions = {}): string {
  const exclude = options.exclude;
  const out: string[] = [];

  // Atributos xml:* herdados dos ancestrais entram no ápice (C14N 1.0, 2.4), a menos que o ápice os redeclare.
  const inheritedXml: XmlAttribute[] = [];
  const have = new Set<string>();
  for (const a of apex.attributes) if (a.ns === XML_NS) have.add(a.local);
  for (let e = apex.parent; e; e = e.parent) {
    for (const a of e.attributes) {
      if (a.ns === XML_NS && !have.has(a.local)) {
        have.add(a.local);
        inheritedXml.push(a);
      }
    }
  }
  const parentScope = apex.parent ? inScopeNamespaces(apex.parent) : new Map<string, string>();

  const render = (
    el: XmlElement,
    scope: Map<string, string>,
    rendered: Map<string, string>,
    extra: readonly XmlAttribute[],
  ): void => {
    let myScope = scope;
    if (el.namespaces.size > 0) {
      myScope = new Map(scope);
      for (const [p, u] of el.namespaces) myScope.set(p, u);
    }
    const nsOut: [string, string][] = [];
    const myRendered = new Map(rendered);
    for (const [p, u] of myScope) {
      if (p === 'xml') continue;
      // `xmlns=""` só aparece quando desfaz um default já emitido por um ancestral no subconjunto.
      const prev = rendered.get(p) ?? (p === '' ? '' : undefined);
      if (u !== prev) {
        nsOut.push([p, u]);
        myRendered.set(p, u);
      }
    }
    nsOut.sort((a, b) => cmp(a[0], b[0]));
    const attrs = extra.length > 0 ? [...el.attributes, ...extra] : [...el.attributes];
    attrs.sort((x, y) => cmp(x.ns, y.ns) || cmp(x.local, y.local));
    out.push('<', el.name);
    for (const [p, u] of nsOut) out.push(p ? ` xmlns:${p}="` : ' xmlns="', escapeC14nAttribute(u), '"');
    for (const a of attrs) out.push(' ', a.name, '="', escapeC14nAttribute(a.value), '"');
    out.push('>');
    for (const ch of el.children) {
      if (ch.type === 'text') out.push(escapeC14nText(ch.value));
      else if (ch.type === 'element') {
        if (!exclude?.has(ch)) render(ch, myScope, myRendered, []);
      } else out.push('<?', ch.target, ch.data ? ` ${ch.data}` : '', '?>');
    }
    out.push('</', el.name, '>');
  };
  render(apex, parentScope, new Map(), inheritedXml);
  return out.join('');
}
