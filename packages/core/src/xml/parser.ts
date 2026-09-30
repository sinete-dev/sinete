/**
 * Parser XML 1.0 com namespaces, estrito e sem DOM, que guarda os offsets de cada nó na string original.
 *
 * Escrito a partir de XML 1.0 (5ª edição) e Namespaces in XML 1.0 (3ª edição). Os offsets permitem inserir texto por
 * splice (a assinatura entra depois do elemento assinado sem reserializar nada) e apontar a posição de um erro.
 *
 * Estrito de propósito (ADR 0003): recusa `&` sem escape, entidade desconhecida, referência a caractere proibido,
 * `<` em valor de atributo, `]]>` em texto, atributo duplicado, prefixo não declarado, tag trocada, mais de uma raiz,
 * caractere fora da produção `Char` e qualquer DTD (sem DOCTYPE não existe entidade externa nem expansão de entidade).
 * Comentários são descartados (o C14N usado pelos DF-e é o sem comentários); instruções de processamento dentro da
 * raiz são mantidas, porque o C14N as inclui.
 */

import { ErroXml } from './errors.ts';

/** Namespace fixo do prefixo `xml` (Namespaces in XML 1.0, seção 3). */
export const XML_NS = 'http://www.w3.org/XML/1998/namespace';
/** Namespace reservado das declarações `xmlns`. */
export const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';

export interface AtributoXml {
  /** Nome qualificado como escrito na fonte (`Id`, `xsi:nil`). */
  readonly nome: string;
  readonly prefixo: string;
  readonly local: string;
  /** URI do namespace; vazio para atributo sem prefixo. */
  readonly ns: string;
  /** Valor normalizado (XML 1.0 3.3.3) e com as referências resolvidas. */
  readonly valor: string;
}

export interface ElementoXml {
  readonly tipo: 'elemento';
  /** Nome qualificado como escrito na fonte. */
  readonly nome: string;
  readonly prefixo: string;
  readonly local: string;
  /** URI do namespace do elemento; vazio quando não há namespace. */
  readonly ns: string;
  /** Atributos comuns, na ordem da fonte (sem as declarações `xmlns`). */
  readonly atributos: readonly AtributoXml[];
  /** Declarações de namespace feitas neste elemento, na ordem da fonte: prefixo (`''` = default) para URI. */
  readonly namespaces: ReadonlyMap<string, string>;
  readonly filhos: readonly NoXml[];
  readonly pai: ElementoXml | null;
  /** Offset do `<` da tag de abertura. */
  readonly inicio: number;
  /** Offset logo depois do `>` da tag de abertura. */
  readonly fimDaAbertura: number;
  /** Offset do `<` da tag de fechamento; igual a `fim` quando a tag é autofechada. */
  readonly fimDoConteudo: number;
  /** Offset logo depois do `>` da tag de fechamento (ou da tag autofechada). */
  readonly fim: number;
  readonly autoFechado: boolean;
}

/** Texto (inclusive CDATA) já com fim de linha normalizado e referências resolvidas. Trechos vizinhos são unidos. */
export interface TextoXml {
  readonly tipo: 'texto';
  readonly valor: string;
  readonly inicio: number;
  readonly fim: number;
}

/** Instrução de processamento dentro do elemento raiz. */
export interface InstrucaoDeProcessamentoXml {
  readonly tipo: 'instrucao';
  readonly alvo: string;
  readonly dados: string;
  readonly inicio: number;
  readonly fim: number;
}

export type NoXml = ElementoXml | TextoXml | InstrucaoDeProcessamentoXml;

export interface DocumentoXml {
  /** A string recebida, sem nenhuma alteração. Os offsets dos nós apontam para ela. */
  readonly texto: string;
  readonly raiz: ElementoXml;
  /** Valor do atributo `Id` (sem prefixo) para os elementos que o declaram. Mais de um elemento indica Id duplicado. */
  readonly ids: ReadonlyMap<string, readonly ElementoXml[]>;
}

type MutableElement = {
  -readonly [K in keyof ElementoXml]: ElementoXml[K];
} & { atributos: AtributoXml[]; filhos: NoXml[]; namespaces: Map<string, string> };

type MutableText = { -readonly [K in keyof TextoXml]: TextoXml[K] };

// NameStartChar do XML 1.0 (5ª edição) sem o ':', que o Namespaces in XML reserva para separar prefixo e nome local.
const NCNAME_START =
  'A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}';
const NAME_START = `:${NCNAME_START}`;
const NAME_CHAR = `${NAME_START}\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040`;
const NAME_RE = new RegExp(`[${NAME_START}][${NAME_CHAR}]*`, 'uy');
const NCNAME_START_RE = new RegExp(`^[${NCNAME_START}]`, 'u');
const REF_RE = /&(?:#x([0-9A-Fa-f]+)|#([0-9]+)|([A-Za-z_][A-Za-z0-9._-]*));/y;
const XML_DECL =
  /^<\?xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(["'])1\.[0-9]+\1(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(["'])[A-Za-z][A-Za-z0-9._-]*\2)?(?:[ \t\r\n]+standalone[ \t\r\n]*=[ \t\r\n]*(["'])(?:yes|no)\3)?[ \t\r\n]*\?>/;
/**
 * Profundidade máxima de elementos, a mesma do libxml2 sem XML_PARSE_HUGE. DF-e não passa de uns 12 níveis; o limite
 * existe para que C14N, verificação e o decoder, que percorrem a árvore por recursão, nunca estourem a pilha com
 * documento hostil (falham aqui com `ErroXml`, que o verificador devolve como falha).
 */
const MAX_DEPTH = 256;
const PREDEFINED: Readonly<Record<string, string>> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function isWs(c: number): boolean {
  return c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d;
}

function isXmlChar(cp: number): boolean {
  return (
    cp === 0x09 ||
    cp === 0x0a ||
    cp === 0x0d ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

/** Offset do primeiro code unit fora da produção `Char` do XML 1.0 (controles, U+FFFE, U+FFFF, surrogate solto), ou -1. */
function invalidCharAt(s: string): number {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x20 && c < 0xd800) continue;
    if (c === 0x09 || c === 0x0a || c === 0x0d) continue;
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return i;
    }
    if (c >= 0xe000 && c <= 0xfffd) continue;
    return i;
  }
  return -1;
}

/** Fim de linha do XML 1.0 (2.11): CRLF e CR solto viram LF antes de qualquer outra coisa. */
function normalizeEol(s: string): string {
  return s.indexOf('\r') === -1 ? s : s.replace(/\r\n?/g, '\n');
}

/** Resolve referências a caracteres e às cinco entidades predefinidas. Qualquer outro `&` é erro. */
function decodeReferences(raw: string, offset: number): string {
  let amp = raw.indexOf('&');
  if (amp === -1) return raw;
  let out = '';
  let last = 0;
  while (amp !== -1) {
    REF_RE.lastIndex = amp;
    const m = REF_RE.exec(raw);
    if (!m) throw new ErroXml("'&' sem escape ou referência malformada", offset + amp);
    let value: string;
    if (m[3] !== undefined) {
      const v = Object.hasOwn(PREDEFINED, m[3]) ? PREDEFINED[m[3]] : undefined;
      if (v === undefined) throw new ErroXml(`entidade não suportada &${m[3]};`, offset + amp);
      value = v;
    } else {
      const cp = m[1] !== undefined ? Number.parseInt(m[1], 16) : Number.parseInt(m[2] ?? '', 10);
      if (!isXmlChar(cp)) throw new ErroXml(`referência a caractere proibido pelo XML 1.0 (${m[0]})`, offset + amp);
      value = String.fromCodePoint(cp);
    }
    out += raw.slice(last, amp) + value;
    last = REF_RE.lastIndex;
    amp = raw.indexOf('&', last);
  }
  return out + raw.slice(last);
}

function splitQName(q: string, offset: number): [string, string] {
  const i = q.indexOf(':');
  if (i === -1) return ['', q];
  // Prefixo e nome local são NCName: o local também precisa começar por NameStartChar (`p:1` não é nome).
  if (i === 0 || q.indexOf(':', i + 1) !== -1 || !NCNAME_START_RE.test(q.slice(i + 1))) {
    throw new ErroXml(`nome qualificado inválido: ${q}`, offset);
  }
  return [q.slice(0, i), q.slice(i + 1)];
}

/**
 * Lê `texto` como XML 1.0 bem formado com namespaces. A string não é alterada e fica em `documento.texto`.
 * Lança `ErroXml` (`xml_malformado`) com o offset do problema.
 */
export function lerXml(texto: string): DocumentoXml {
  const bad = invalidCharAt(texto);
  if (bad !== -1) throw new ErroXml('caractere proibido pelo XML 1.0', bad);

  const n = texto.length;
  let i = texto.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (texto.startsWith('<?xml', i) && isWs(texto.charCodeAt(i + 5))) {
    const decl = XML_DECL.exec(texto.slice(i));
    if (!decl) throw new ErroXml('declaração XML malformada', i);
    i += decl[0].length;
  }

  let root: MutableElement | null = null;
  let cur: MutableElement | null = null;
  let rootClosed = false;
  const ids = new Map<string, ElementoXml[]>();
  const scopes: Map<string, string>[] = [
    new Map([
      ['xml', XML_NS],
      ['', ''],
    ]),
  ];

  const lookup = (prefix: string, offset: number): string => {
    for (let k = scopes.length - 1; k >= 0; k--) {
      const v = scopes[k]?.get(prefix);
      if (v !== undefined) return v;
    }
    throw new ErroXml(`prefixo de namespace não declarado: ${prefix}`, offset);
  };

  const pushText = (value: string, start: number, end: number): void => {
    if (!cur) return;
    const last = cur.filhos[cur.filhos.length - 1];
    if (last && last.tipo === 'texto') {
      const t = last as MutableText;
      t.valor += value;
      t.fim = end;
    } else {
      cur.filhos.push({ tipo: 'texto', valor: value, inicio: start, fim: end });
    }
  };

  const readName = (at: number): string => {
    NAME_RE.lastIndex = at;
    const m = NAME_RE.exec(texto);
    if (!m) throw new ErroXml('nome XML inválido', at);
    return m[0];
  };

  while (i < n) {
    const lt = texto.indexOf('<', i);
    const textEnd = lt === -1 ? n : lt;
    if (textEnd > i) {
      const raw = texto.slice(i, textEnd);
      if (cur) {
        const cdataEnd = raw.indexOf(']]>');
        if (cdataEnd !== -1) throw new ErroXml("']]>' não pode aparecer em texto", i + cdataEnd);
        pushText(decodeReferences(normalizeEol(raw), i), i, textEnd);
      } else {
        for (let k = i; k < textEnd; k++) {
          if (!isWs(texto.charCodeAt(k))) throw new ErroXml('texto fora do elemento raiz', k);
        }
      }
    }
    if (lt === -1) break;
    const c1 = texto.charCodeAt(lt + 1);

    if (c1 === 0x3f /* ? */) {
      const e = texto.indexOf('?>', lt + 2);
      if (e === -1) throw new ErroXml('instrução de processamento sem fechamento', lt);
      const target = readName(lt + 2);
      if (target.toLowerCase() === 'xml') throw new ErroXml('declaração XML fora do início do documento', lt);
      if (target.includes(':')) throw new ErroXml(`alvo de instrução com ':' : ${target}`, lt);
      const after = lt + 2 + target.length;
      if (after < e && !isWs(texto.charCodeAt(after)))
        throw new ErroXml('instrução de processamento malformada', after);
      let d = after;
      while (d < e && isWs(texto.charCodeAt(d))) d++;
      if (cur)
        cur.filhos.push({
          tipo: 'instrucao',
          alvo: target,
          dados: normalizeEol(texto.slice(d, e)),
          inicio: lt,
          fim: e + 2,
        });
      i = e + 2;
      continue;
    }

    if (c1 === 0x21 /* ! */) {
      if (texto.startsWith('<!--', lt)) {
        const e = texto.indexOf('--', lt + 4);
        if (e === -1 || texto.charCodeAt(e + 2) !== 0x3e) {
          throw new ErroXml("comentário sem fechamento ou com '--' no meio", e === -1 ? lt : e);
        }
        i = e + 3;
        continue;
      }
      if (texto.startsWith('<![CDATA[', lt)) {
        if (!cur) throw new ErroXml('CDATA fora do elemento raiz', lt);
        const e = texto.indexOf(']]>', lt + 9);
        if (e === -1) throw new ErroXml('CDATA sem fechamento', lt);
        pushText(normalizeEol(texto.slice(lt + 9, e)), lt, e + 3);
        i = e + 3;
        continue;
      }
      if (texto.startsWith('<!DOCTYPE', lt)) throw new ErroXml('DTD (DOCTYPE) não é suportado', lt);
      throw new ErroXml('declaração de marcação não suportada', lt);
    }

    if (c1 === 0x2f /* / */) {
      const e = texto.indexOf('>', lt + 2);
      if (e === -1) throw new ErroXml('tag de fechamento sem >', lt);
      const name = readName(lt + 2);
      for (let k = lt + 2 + name.length; k < e; k++) {
        if (!isWs(texto.charCodeAt(k))) throw new ErroXml('tag de fechamento malformada', k);
      }
      if (!cur || cur.nome !== name) {
        throw new ErroXml(`tag de fechamento </${name}> não corresponde à aberta`, lt);
      }
      cur.fimDoConteudo = lt;
      cur.fim = e + 1;
      scopes.pop();
      if (cur.pai === null) rootClosed = true;
      cur = cur.pai as MutableElement | null;
      i = e + 1;
      continue;
    }

    // tag de abertura
    if (rootClosed || (root && !cur)) throw new ErroXml('mais de um elemento raiz', lt);
    // scopes tem a base mais um por elemento aberto: este seria o de profundidade scopes.length.
    if (scopes.length > MAX_DEPTH) throw new ErroXml(`aninhamento acima de ${MAX_DEPTH} níveis`, lt);
    const name = readName(lt + 1);
    let j = lt + 1 + name.length;
    const raws: [string, string, number][] = [];
    let selfClosing = false;
    for (;;) {
      const wsStart = j;
      while (j < n && isWs(texto.charCodeAt(j))) j++;
      if (j >= n) throw new ErroXml('tag de abertura sem >', lt);
      const c = texto.charCodeAt(j);
      if (c === 0x3e /* > */) {
        j++;
        break;
      }
      if (c === 0x2f /* / */) {
        if (texto.charCodeAt(j + 1) !== 0x3e) throw new ErroXml("'/' solto na tag", j);
        selfClosing = true;
        j += 2;
        break;
      }
      if (j === wsStart) throw new ErroXml('falta espaço antes do atributo', j);
      const attrAt = j;
      const an = readName(j);
      j += an.length;
      while (j < n && isWs(texto.charCodeAt(j))) j++;
      if (texto.charCodeAt(j) !== 0x3d /* = */) throw new ErroXml(`atributo ${an} sem '='`, j);
      j++;
      while (j < n && isWs(texto.charCodeAt(j))) j++;
      const q = texto[j];
      if (q !== '"' && q !== "'") throw new ErroXml(`valor do atributo ${an} sem aspas`, j);
      const qe = texto.indexOf(q, j + 1);
      if (qe === -1) throw new ErroXml(`valor do atributo ${an} sem aspas de fechamento`, j);
      const raw = texto.slice(j + 1, qe);
      const ltIn = raw.indexOf('<');
      if (ltIn !== -1) throw new ErroXml(`'<' no valor do atributo ${an}`, j + 1 + ltIn);
      // XML 1.0 3.3.3: fim de linha normalizado, whitespace literal vira espaço, depois as referências.
      const value = decodeReferences(normalizeEol(raw).replace(/[\t\n]/g, ' '), j + 1);
      for (const r of raws) if (r[0] === an) throw new ErroXml(`atributo duplicado: ${an}`, attrAt);
      raws.push([an, value, attrAt]);
      j = qe + 1;
    }

    const declared = new Map<string, string>();
    for (const [an, av, at] of raws) {
      if (an === 'xmlns') {
        if (av === XML_NS || av === XMLNS_NS) throw new ErroXml('namespace reservado como default', at);
        declared.set('', av);
      } else if (an.startsWith('xmlns:')) {
        const p = an.slice(6);
        splitQName(`x:${p}`, at);
        if (p === 'xmlns') throw new ErroXml('o prefixo xmlns não pode ser declarado', at);
        if (p === 'xml' ? av !== XML_NS : av === XML_NS || av === XMLNS_NS) {
          throw new ErroXml(`declaração inválida do prefixo ${p}`, at);
        }
        if (av === '') throw new ErroXml(`prefixo ${p} não pode ser associado a namespace vazio`, at);
        declared.set(p, av);
      }
    }
    scopes.push(declared);
    const [prefix, local] = splitQName(name, lt + 1);
    if (prefix === 'xmlns') throw new ErroXml('elemento com prefixo xmlns', lt);
    const el: MutableElement = {
      tipo: 'elemento',
      nome: name,
      prefixo: prefix,
      local,
      ns: lookup(prefix, lt + 1),
      atributos: [],
      namespaces: declared,
      filhos: [],
      pai: cur,
      inicio: lt,
      fimDaAbertura: j,
      fimDoConteudo: j,
      fim: j,
      autoFechado: selfClosing,
    };
    const expanded = new Set<string>();
    for (const [an, av, at] of raws) {
      if (an === 'xmlns' || an.startsWith('xmlns:')) continue;
      const [ap, al] = splitQName(an, at);
      const ans = ap === '' ? '' : lookup(ap, at);
      const key = `{${ans}}${al}`;
      if (expanded.has(key)) throw new ErroXml(`atributo duplicado por namespace: ${an}`, at);
      expanded.add(key);
      el.atributos.push({ nome: an, prefixo: ap, local: al, ns: ans, valor: av });
      if (an === 'Id') {
        const list = ids.get(av);
        if (list) list.push(el);
        else ids.set(av, [el]);
      }
    }
    if (cur) cur.filhos.push(el);
    else root = el;
    if (selfClosing) {
      scopes.pop();
      if (!cur) rootClosed = true;
    } else {
      cur = el;
    }
    i = j;
  }

  if (!root) throw new ErroXml('documento sem elemento raiz', n);
  if (cur) throw new ErroXml(`elemento <${cur.nome}> não fechado`, cur.inicio);
  return { texto, raiz: root, ids };
}

/** Filhos que são elementos, na ordem do documento. */
export function elementosFilhos(el: ElementoXml): ElementoXml[] {
  const out: ElementoXml[] = [];
  for (const c of el.filhos) if (c.tipo === 'elemento') out.push(c);
  return out;
}

/** Primeiro filho direto com o nome local (e o namespace, quando informado). */
export function primeiroFilho(el: ElementoXml, local: string, ns?: string): ElementoXml | undefined {
  for (const c of el.filhos) {
    if (c.tipo === 'elemento' && c.local === local && (ns === undefined || c.ns === ns)) return c;
  }
  return undefined;
}

/** O elemento e todos os descendentes, em ordem de documento. */
export function* descendentes(el: ElementoXml): Generator<ElementoXml, void, undefined> {
  yield el;
  for (const c of el.filhos) if (c.tipo === 'elemento') yield* descendentes(c);
}

/** Texto direto do elemento (só os nós de texto filhos, sem descer nos elementos). */
export function textoDe(el: ElementoXml): string {
  let s = '';
  for (const c of el.filhos) if (c.tipo === 'texto') s += c.valor;
  return s;
}

/** Valor do atributo sem namespace com o nome local dado. */
export function atributoDe(el: ElementoXml, local: string): string | undefined {
  for (const a of el.atributos) if (a.local === local && a.ns === '') return a.valor;
  return undefined;
}

/** Namespaces em escopo no elemento, incluindo os declarados nos ancestrais (o mais próximo vence). */
export function namespacesEmEscopo(el: ElementoXml): Map<string, string> {
  const chain: ElementoXml[] = [];
  for (let e: ElementoXml | null = el; e; e = e.pai) chain.push(e);
  const m = new Map<string, string>();
  for (let k = chain.length - 1; k >= 0; k--) {
    for (const [p, u] of chain[k]?.namespaces ?? []) m.set(p, u);
  }
  return m;
}
