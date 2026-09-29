// Parser mínimo que preserva offsets da string original + C14N 1.0 inclusivo
// (http://www.w3.org/TR/2001/REC-xml-c14n-20010315), sem comentários.
// Implementado a partir da spec W3C (C14N 1.0 e XML 1.0 2.11 / 3.3.3).
// Código de spike: descartável.

export const XMLNS_XML = 'http://www.w3.org/XML/1998/namespace';

export interface Attr {
  name: string; // qname como na fonte
  prefix: string;
  local: string;
  value: string; // valor normalizado (XML 1.0 3.3.3) e decodificado
}

export interface Element {
  type: 'el';
  name: string;
  prefix: string;
  local: string;
  attrs: Attr[]; // atributos comuns (sem xmlns)
  nsDecls: Map<string, string>; // prefixo ('' = default) -> URI
  children: Node[];
  parent: Element | null;
  start: number; // offset do '<' da tag de abertura
  openEnd: number; // offset logo após o '>' da tag de abertura
  end: number; // offset logo após o '>' da tag de fechamento (ou da self-closing)
  selfClosing: boolean;
}
export interface Text { type: 'text'; value: string }
export interface PI { type: 'pi'; target: string; data: string }
export type Node = Element | Text | PI;

export class XmlError extends Error {}

const ENT: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decode(raw: string, pos: number): string {
  if (raw.indexOf('&') < 0) return raw;
  return raw.replace(/&([^;&\s]*);?/g, (m, name: string) => {
    if (!m.endsWith(';')) throw new XmlError(`'&' solto perto do offset ${pos}`);
    if (name[0] === '#') {
      const cp = name[1] === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (!Number.isFinite(cp)) throw new XmlError(`referência de caractere inválida perto do offset ${pos}`);
      return String.fromCodePoint(cp);
    }
    const v = ENT[name];
    if (v === undefined) throw new XmlError(`entidade não suportada &${name}; perto do offset ${pos}`);
    return v;
  });
}

// XML 1.0 2.11: CRLF e CR soltos viram LF antes de qualquer outra coisa.
const normEol = (s: string) => (s.indexOf('\r') < 0 ? s : s.replace(/\r\n?/g, '\n'));

function splitQName(q: string): [string, string] {
  const i = q.indexOf(':');
  return i < 0 ? ['', q] : [q.slice(0, i), q.slice(i + 1)];
}

export interface Document {
  source: string;
  root: Element;
  ids: Map<string, Element[]>; // valor do atributo Id -> elementos
}

export function parse(source: string): Document {
  let i = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = source.length;
  let root: Element | null = null;
  let cur: Element | null = null;
  const ids = new Map<string, Element[]>();

  const pushText = (value: string) => {
    if (!cur) {
      if (/\S/.test(value)) throw new XmlError('texto fora do elemento raiz');
      return;
    }
    const last = cur.children[cur.children.length - 1];
    if (last && last.type === 'text') last.value += value;
    else cur.children.push({ type: 'text', value });
  };

  while (i < n) {
    const lt = source.indexOf('<', i);
    if (lt < 0) {
      pushText(decode(normEol(source.slice(i)), i));
      break;
    }
    if (lt > i) pushText(decode(normEol(source.slice(i, lt)), i));
    const c1 = source[lt + 1];
    if (c1 === '?') {
      const e = source.indexOf('?>', lt + 2);
      if (e < 0) throw new XmlError('PI não fechada');
      const body = source.slice(lt + 2, e);
      const m = /^([^\s?]+)\s*([\s\S]*)$/.exec(body)!;
      if (m[1].toLowerCase() !== 'xml' && cur) cur.children.push({ type: 'pi', target: m[1], data: normEol(m[2]) });
      i = e + 2;
    } else if (source.startsWith('<!--', lt)) {
      const e = source.indexOf('-->', lt + 4);
      if (e < 0) throw new XmlError('comentário não fechado');
      i = e + 3; // C14N sem comentários: descarta
    } else if (source.startsWith('<![CDATA[', lt)) {
      const e = source.indexOf(']]>', lt + 9);
      if (e < 0) throw new XmlError('CDATA não fechado');
      pushText(normEol(source.slice(lt + 9, e)));
      i = e + 3;
    } else if (c1 === '!') {
      throw new XmlError('DOCTYPE/declaração não suportada');
    } else if (c1 === '/') {
      const e = source.indexOf('>', lt + 2);
      const name = source.slice(lt + 2, e).trim();
      if (!cur || cur.name !== name) throw new XmlError(`tag de fechamento inesperada </${name}> no offset ${lt}`);
      cur.end = e + 1;
      cur = cur.parent;
      i = e + 1;
    } else {
      // tag de abertura: acha o '>' fora de aspas
      let j = lt + 1;
      let q = '';
      for (; j < n; j++) {
        const ch = source[j];
        if (q) { if (ch === q) q = ''; }
        else if (ch === '"' || ch === "'") q = ch;
        else if (ch === '>') break;
      }
      if (j >= n) throw new XmlError('tag não fechada');
      const selfClosing = source[j - 1] === '/';
      const body = source.slice(lt + 1, selfClosing ? j - 1 : j);
      const nm = /^[^\s/>]+/.exec(body);
      if (!nm) throw new XmlError(`nome de elemento inválido no offset ${lt}`);
      const name = nm[0];
      const [prefix, local] = splitQName(name);
      const el: Element = {
        type: 'el', name, prefix, local, attrs: [], nsDecls: new Map(), children: [], parent: cur,
        start: lt, openEnd: j + 1, end: -1, selfClosing,
      };
      const re = /\s*([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
      re.lastIndex = name.length;
      const seen = new Set<string>();
      for (;;) {
        const at = re.lastIndex;
        const m = re.exec(body);
        if (!m) {
          if (body.slice(at).trim() !== '') throw new XmlError(`atributo malformado no offset ${lt + 1 + at}`);
          break;
        }
        const aname = m[1];
        if (seen.has(aname)) throw new XmlError(`atributo duplicado ${aname}`);
        seen.add(aname);
        // 3.3.3: fim de linha normalizado, whitespace literal vira espaço, depois decodifica
        const raw = m[2] ?? m[3];
        const value = decode(normEol(raw).replace(/[\t\n]/g, ' '), lt);
        if (aname === 'xmlns') el.nsDecls.set('', value);
        else if (aname.startsWith('xmlns:')) el.nsDecls.set(aname.slice(6), value);
        else {
          const [ap, al] = splitQName(aname);
          el.attrs.push({ name: aname, prefix: ap, local: al, value });
          if (aname === 'Id') {
            const arr = ids.get(value);
            if (arr) arr.push(el); else ids.set(value, [el]);
          }
        }
      }
      if (cur) cur.children.push(el);
      else if (root) throw new XmlError('mais de um elemento raiz');
      else root = el;
      if (selfClosing) el.end = j + 1;
      else cur = el;
      i = j + 1;
    }
  }
  if (!root) throw new XmlError('documento sem elemento raiz');
  if (cur) throw new XmlError(`elemento <${cur.name}> não fechado`);
  return { source, root, ids };
}

/** Namespaces em escopo num elemento (inclui ancestrais; o mais próximo vence). */
export function inScopeNs(el: Element): Map<string, string> {
  const chain: Element[] = [];
  for (let e: Element | null = el; e; e = e.parent) chain.push(e);
  const m = new Map<string, string>();
  for (let k = chain.length - 1; k >= 0; k--) for (const [p, u] of chain[k].nsDecls) m.set(p, u);
  return m;
}

export function nsUri(el: Element, prefix: string): string | undefined {
  if (prefix === 'xml') return XMLNS_XML;
  for (let e: Element | null = el; e; e = e.parent) {
    const u = e.nsDecls.get(prefix);
    if (u !== undefined) return u;
  }
  return prefix === '' ? '' : undefined;
}

const escText = (s: string) =>
  s.replace(/[&<>\r]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&#xD;'));
const escAttr = (s: string) =>
  s.replace(/[&<"\t\n\r]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '"' ? '&quot;' : c === '\t' ? '&#x9;' : c === '\n' ? '&#xA;' : '&#xD;');

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * C14N 1.0 inclusivo do subconjunto "apex e descendentes", menos os elementos em `exclude`
 * (transform enveloped-signature). Namespaces e atributos xml:* herdados dos ancestrais
 * entram no apex, como manda a spec para document subsets.
 */
export function c14n(apex: Element, exclude: Set<Element> = new Set()): string {
  const out: string[] = [];
  // atributos xml:* herdados (C14N 1.0 §2.4)
  const inheritedXml: Attr[] = [];
  {
    const have = new Set(apex.attrs.filter((a) => a.prefix === 'xml').map((a) => a.local));
    for (let e = apex.parent; e; e = e.parent)
      for (const a of e.attrs)
        if (a.prefix === 'xml' && !have.has(a.local)) { have.add(a.local); inheritedXml.push(a); }
  }
  const parentScope = apex.parent ? inScopeNs(apex.parent) : new Map<string, string>();

  const render = (el: Element, scope: Map<string, string>, rendered: Map<string, string>, extra: Attr[]) => {
    let myScope = scope;
    if (el.nsDecls.size) {
      myScope = new Map(scope);
      for (const [p, u] of el.nsDecls) myScope.set(p, u);
    }
    const ns: [string, string][] = [];
    const myRendered = new Map(rendered);
    for (const [p, u] of myScope) {
      if (p === 'xml') continue;
      if (p === '') {
        const pr = rendered.get('') ?? '';
        if (u !== pr) { ns.push(['', u]); myRendered.set('', u); }
      } else if (rendered.get(p) !== u) { ns.push([p, u]); myRendered.set(p, u); }
    }
    ns.sort((a, b) => cmp(a[0], b[0]));
    const attrs = (extra.length ? [...el.attrs, ...extra] : el.attrs).map((a) => {
      const uri = a.prefix === '' ? '' : a.prefix === 'xml' ? XMLNS_XML : myScope.get(a.prefix);
      if (uri === undefined) throw new XmlError(`prefixo não declarado: ${a.name}`);
      return { a, uri };
    });
    attrs.sort((x, y) => cmp(x.uri, y.uri) || cmp(x.a.local, y.a.local));
    out.push('<', el.name);
    for (const [p, u] of ns) out.push(p ? ` xmlns:${p}="` : ' xmlns="', escAttr(u), '"');
    for (const { a } of attrs) out.push(' ', a.name, '="', escAttr(a.value), '"');
    out.push('>');
    for (const ch of el.children) {
      if (ch.type === 'text') out.push(escText(ch.value));
      else if (ch.type === 'el') { if (!exclude.has(ch)) render(ch, myScope, myRendered, []); }
      else out.push('<?', ch.target, ch.data ? ' ' + ch.data : '', '?>');
    }
    out.push('</', el.name, '>');
  };
  render(apex, parentScope, new Map(), inheritedXml);
  return out.join('');
}

export function* walk(el: Element): Generator<Element> {
  yield el;
  for (const c of el.children) if (c.type === 'el') yield* walk(c);
}

export function childEl(el: Element, local: string, uri?: string): Element | undefined {
  for (const c of el.children)
    if (c.type === 'el' && c.local === local && (uri === undefined || nsUri(c, c.prefix) === uri)) return c;
}
export function childEls(el: Element, local: string): Element[] {
  return el.children.filter((c): c is Element => c.type === 'el' && c.local === local);
}
export function textOf(el: Element): string {
  let s = '';
  for (const c of el.children) if (c.type === 'text') s += c.value; else if (c.type === 'el') s += textOf(c);
  return s;
}
export const attr = (el: Element, name: string) => el.attrs.find((a) => a.name === name)?.value;
