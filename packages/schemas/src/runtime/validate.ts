/**
 * Validador estrito guiado pelos mesmos descritores: modelo de conteúdo (ordem, ocorrência, choice), atributos,
 * facetas dos tipos simples, espaço léxico dos tipos embutidos usados pelos DF-e, `xs:unique` e unicidade de `ID`.
 * Trabalha sobre a árvore parseada, então confere exatamente o que a SEFAZ vai receber.
 *
 * O critério de aceitação é concordar com o `xmllint --schema` (libxml2) no veredito de cada documento; a checagem
 * sobre o corpus local fica em `tools/xsd-codegen/src/corpus/`. As mensagens nunca trazem o valor do campo (o
 * documento tem dado pessoal), só a regra e o caminho.
 */

import type { Ocorrencia } from '@sinete/core';
import { ErroDeValidacao } from '@sinete/core';
import type { AtributoXml, DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { elementosFilhos, lerXml } from '@sinete/core/xml';
import type { ComplexType, ElementParticle, Particle, RootElement, SimpleType } from './desc.ts';
import { isComplexType, isElementParticle, isWildcard, maxOccurs, minOccurs } from './desc.ts';
import { compileXsdRegex } from './regex.ts';

/** Códigos das ocorrências do validador. */
export type ValidationCode =
  | 'raiz_inesperada'
  | 'modelo_de_conteudo'
  | 'elemento_desconhecido'
  | 'elemento_em_tipo_simples'
  | 'texto_em_elemento'
  | 'atributo_obrigatorio'
  | 'atributo_desconhecido'
  | 'atributo_fixo'
  | 'enumeracao'
  | 'padrao'
  | 'tamanho'
  | 'tamanho_minimo'
  | 'tamanho_maximo'
  | 'digitos_totais'
  | 'digitos_fracionarios'
  | 'valor_minimo'
  | 'valor_maximo'
  | 'tipo_base'
  | 'unico'
  | 'id_duplicado';

export interface SchemaIssue extends Ocorrencia {
  readonly code: ValidationCode;
}

const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const reCache = new WeakMap<SimpleType, RegExp[][]>();

function regexes(t: SimpleType): RegExp[][] {
  let r = reCache.get(t);
  if (!r) {
    r = (t.p ?? []).map((step) => step.map((s) => compileXsdRegex(s)));
    reCache.set(t, r);
  }
  return r;
}

/** Tipos embutidos cujo whiteSpace é `preserve`; todo o resto é `collapse` (XSD Part 2, 4.3.6). */
const PRESERVE = new Set(['string', 'anySimpleType', 'anyType']);

function normalize(t: SimpleType, v: string): string {
  const ws = t.ws ?? (PRESERVE.has(t.b) ? 'p' : t.b === 'normalizedString' ? 'r' : 'c');
  if (ws === 'p') return v;
  const r = v.replace(/[\t\n\r]/g, ' ');
  // Só o espaço U+0020: trim() do JS também tiraria NBSP e outros espaços Unicode, que o collapse do XSD preserva.
  return ws === 'r' ? r : r.replace(/ {2,}/g, ' ').replace(/^ | $/g, '');
}

const NCNAME = /^[A-Za-z_À-ÖØ-öø-˿Ͱ-ͽͿ-῿][\w.\-·À-ÖØ-öø-ͽͿ-῿]*$/;
const TZ = '(?:Z|[+-](?:(?:0\\d|1[0-3]):[0-5]\\d|14:00))?';
const DATE = '-?(?:[1-9]\\d{4,}|\\d{4})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])';
// 24:00:00 (fração só de zeros) é o fim do dia, permitido pelo XSD 1.0 e aceito pelo libxml2.
const TIME = '(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?|24:00:00(?:\\.0+)?)';
const LEXICAL: Readonly<Record<string, RegExp>> = {
  decimal: /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/,
  integer: /^[+-]?\d+$/,
  nonNegativeInteger: /^\+?\d+$|^-0+$/,
  positiveInteger: /^\+?0*[1-9]\d*$/,
  int: /^[+-]?\d+$/,
  long: /^[+-]?\d+$/,
  short: /^[+-]?\d+$/,
  byte: /^[+-]?\d+$/,
  unsignedInt: /^\+?\d+$/,
  unsignedLong: /^\+?\d+$/,
  unsignedShort: /^\+?\d+$/,
  unsignedByte: /^\+?\d+$/,
  date: new RegExp(`^${DATE}${TZ}$`),
  dateTime: new RegExp(`^${DATE}T${TIME}${TZ}$`),
  time: new RegExp(`^${TIME}${TZ}$`),
  gYearMonth: new RegExp(`^-?(?:[1-9]\\d{4,}|\\d{4})-(?:0[1-9]|1[0-2])${TZ}$`),
  gYear: new RegExp(`^-?(?:[1-9]\\d{4,}|\\d{4})${TZ}$`),
  hexBinary: /^(?:[0-9A-Fa-f]{2})*$/,
  // XSD Part 2, 3.2.16: o último quantum com um '=' termina em B16 e com '==' em B04 (bits de padding zerados).
  base64Binary:
    /^(?:(?:[A-Za-z0-9+/] ?){4})*(?:(?:[A-Za-z0-9+/] ?){3}[A-Za-z0-9+/]|(?:[A-Za-z0-9+/] ?){2}[AEIMQUYcgkosw048] ?=|[A-Za-z0-9+/] ?[AQgw] ?= ?=)?$/,
  ID: NCNAME,
  NCName: NCNAME,
  token: /^(?:[^\t\n\r ]+(?: [^\t\n\r ]+)*)?$/,
};

/** O léxico confere mês e dia separados; aqui entra o calendário (dia 31 em mês de 30, 29/02 fora de ano bissexto). */
function validCalendarDay(v: string): boolean {
  const m = /^(-?\d+)-(\d{2})-(\d{2})/.exec(v);
  if (!m) return false;
  if (/^-?0+$/.test(m[1] ?? '')) return false;
  const year = BigInt(m[1] ?? '0');
  const month = Number(m[2]);
  const day = Number(m[3]);
  const leap = year % 4n === 0n && (year % 100n !== 0n || year % 400n === 0n);
  const days = month === 2 ? (leap ? 29 : 28) : month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
  return day <= days;
}

const INTEGER_RANGES: Readonly<Record<string, readonly [bigint, bigint]>> = {
  int: [-2147483648n, 2147483647n],
  short: [-32768n, 32767n],
  byte: [-128n, 127n],
  unsignedInt: [0n, 4294967295n],
  unsignedShort: [0n, 65535n],
  unsignedByte: [0n, 255n],
  long: [-9223372036854775808n, 9223372036854775807n],
  unsignedLong: [0n, 18446744073709551615n],
};

function b64Octets(v: string): number {
  const s = v.replace(/[ \t\n\r]/g, '');
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  return (s.length / 4) * 3 - pad;
}

/** Compara dois decimais lexicais válidos sem passar por `number` (sem perda de precisão). */
export function compareDecimal(a: string, b: string): number {
  const parse = (s: string): [number, string, string] => {
    let sign = 1;
    let x = s;
    if (x[0] === '+' || x[0] === '-') {
      sign = x[0] === '-' ? -1 : 1;
      x = x.slice(1);
    }
    const [i = '', f = ''] = x.split('.');
    const int = i.replace(/^0+/, '');
    const frac = f.replace(/0+$/, '');
    if (int === '' && frac === '') sign = 1;
    return [sign, int, frac];
  };
  const [sa, ia, fa] = parse(a);
  const [sb, ib, fb] = parse(b);
  if (sa !== sb) return sa - sb;
  let c = ia.length - ib.length || (ia < ib ? -1 : ia > ib ? 1 : 0);
  if (c === 0) {
    const n = Math.max(fa.length, fb.length);
    const pa = fa.padEnd(n, '0');
    const pb = fb.padEnd(n, '0');
    c = pa < pb ? -1 : pa > pb ? 1 : 0;
  }
  return sa * c;
}

const NUMERIC = new Set([
  'decimal',
  'integer',
  'nonNegativeInteger',
  'positiveInteger',
  ...Object.keys(INTEGER_RANGES),
]);

/** Confere um valor simples contra o tipo. Empilha as ocorrências em `out`. */
export function checkSimple(t: SimpleType, raw: string, path: string, out: SchemaIssue[]): void {
  const v = normalize(t, raw);
  const name = t.nm ? ` (${t.nm})` : '';
  const lex = Object.hasOwn(LEXICAL, t.b) ? LEXICAL[t.b] : undefined;
  if (lex && !lex.test(v)) {
    out.push({ caminho: path, code: 'tipo_base', mensagem: `valor fora do espaço léxico de xs:${t.b}${name}` });
    return;
  }
  if ((t.b === 'date' || t.b === 'dateTime') && !validCalendarDay(v)) {
    out.push({ caminho: path, code: 'tipo_base', mensagem: `dia inexistente no calendário em xs:${t.b}${name}` });
    return;
  }
  if ((t.b === 'gYear' || t.b === 'gYearMonth') && /^-?0+(?:-|Z|\+|$)/.test(v)) {
    out.push({ caminho: path, code: 'tipo_base', mensagem: `ano 0000 não existe em xs:${t.b}${name}` });
    return;
  }
  const range = Object.hasOwn(INTEGER_RANGES, t.b) ? INTEGER_RANGES[t.b] : undefined;
  if (range && (BigInt(v) < range[0] || BigInt(v) > range[1])) {
    out.push({ caminho: path, code: 'tipo_base', mensagem: `valor fora do intervalo de xs:${t.b}${name}` });
  }
  if (t.e && !t.e.includes(v))
    out.push({ caminho: path, code: 'enumeracao', mensagem: `valor fora da enumeração${name}` });
  // Facetas de tamanho contam caracteres em string, mas octetos em base64Binary e hexBinary (XSD Part 2, 4.3.1).
  if (t.l !== undefined || t.mn !== undefined || t.mx !== undefined) {
    const len = t.b === 'base64Binary' ? b64Octets(v) : t.b === 'hexBinary' ? v.length / 2 : [...v].length;
    if (t.l !== undefined && len !== t.l)
      out.push({ caminho: path, code: 'tamanho', mensagem: `tamanho deve ser ${t.l}${name}` });
    if (t.mn !== undefined && len < t.mn) {
      out.push({ caminho: path, code: 'tamanho_minimo', mensagem: `tamanho mínimo ${t.mn}${name}` });
    }
    if (t.mx !== undefined && len > t.mx) {
      out.push({ caminho: path, code: 'tamanho_maximo', mensagem: `tamanho máximo ${t.mx}${name}` });
    }
  }
  for (const step of regexes(t)) {
    if (!step.some((re) => re.test(v))) {
      out.push({ caminho: path, code: 'padrao', mensagem: `valor não casa com o pattern${name}` });
      break;
    }
  }
  if (CALENDAR.has(t.b)) checkCalendarRange(t, v, path, name, out);
  if (NUMERIC.has(t.b)) {
    const [int = '', frac = ''] = v.replace(/^[+-]/, '').split('.');
    const fracDigits = frac.replace(/0+$/, '').length;
    const intDigits = int.replace(/^0+/, '').length;
    if (t.td !== undefined && intDigits + fracDigits > t.td) {
      out.push({ caminho: path, code: 'digitos_totais', mensagem: `mais de ${t.td} dígitos${name}` });
    }
    if (t.fd !== undefined && fracDigits > t.fd) {
      out.push({ caminho: path, code: 'digitos_fracionarios', mensagem: `mais de ${t.fd} casas decimais${name}` });
    }
    if (t.mi !== undefined && compareDecimal(v, t.mi) < 0) {
      out.push({ caminho: path, code: 'valor_minimo', mensagem: `valor abaixo de ${t.mi}${name}` });
    }
    if (t.ma !== undefined && compareDecimal(v, t.ma) > 0) {
      out.push({ caminho: path, code: 'valor_maximo', mensagem: `valor acima de ${t.ma}${name}` });
    }
    if (t.me !== undefined && compareDecimal(v, t.me) <= 0) {
      out.push({ caminho: path, code: 'valor_minimo', mensagem: `valor deve ser maior que ${t.me}${name}` });
    }
    if (t.mxe !== undefined && compareDecimal(v, t.mxe) >= 0) {
      out.push({ caminho: path, code: 'valor_maximo', mensagem: `valor deve ser menor que ${t.mxe}${name}` });
    }
  }
}

const CALENDAR = new Set(['date', 'dateTime', 'time', 'gYearMonth', 'gYear']);

/** Instante como (segundos inteiros, fração), com o fuso em minutos ou `null` quando o valor não tem fuso. */
type Instant = { readonly s: bigint; readonly f: string; readonly tz: number | null };

function daysFromCivil(y: bigint, m: number, d: number): bigint {
  const yy = m <= 2 ? y - 1n : y;
  const era = (yy >= 0n ? yy : yy - 399n) / 400n;
  const yoe = yy - era * 400n;
  const doy = BigInt(Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1);
  const doe = yoe * 365n + yoe / 4n - yoe / 100n + doy;
  return era * 146097n + doe - 719468n;
}

/** Ponto inicial do valor na linha do tempo (gYearMonth é o dia 1, time é num dia fixo), como no XSD Part 2, D.3. */
function instantOf(b: string, v: string): Instant | null {
  const tzRe = '(Z|[+-]\\d{2}:\\d{2})?$';
  const time = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/;
  let y = 1972n;
  let mo = 12;
  let d = 31;
  let rest = v;
  if (b !== 'time') {
    // Por tipo: em gYear o '-03' de um fuso não pode ser lido como mês.
    const m = (
      b === 'gYear' ? /^(-?\d{4,})/ : b === 'gYearMonth' ? /^(-?\d{4,})-(\d{2})/ : /^(-?\d{4,})-(\d{2})-(\d{2})/
    ).exec(v);
    if (!m) return null;
    y = BigInt(m[1] ?? '0');
    mo = m[2] ? Number(m[2]) : 1;
    d = m[3] ? Number(m[3]) : 1;
    rest = v.slice(m[0].length);
    if (rest.startsWith('T')) rest = rest.slice(1);
  }
  let h = 0;
  let mi = 0;
  let sec = 0;
  let f = '';
  if (b === 'time' || b === 'dateTime') {
    const t = time.exec(rest);
    if (!t) return null;
    h = Number(t[1]);
    mi = Number(t[2]);
    sec = Number(t[3]);
    f = (t[4] ?? '').replace(/0+$/, '');
    rest = rest.slice(t[0].length);
  }
  const z = new RegExp(`^${tzRe}`).exec(rest);
  if (!z) return null;
  const tz =
    z[1] === undefined
      ? null
      : z[1] === 'Z'
        ? 0
        : (z[1][0] === '-' ? -1 : 1) * (Number(z[1].slice(1, 3)) * 60 + Number(z[1].slice(4, 6)));
  const s = daysFromCivil(y, mo, d) * 86400n + BigInt(h * 3600 + mi * 60 + sec - (tz ?? 0) * 60);
  return { s, f, tz };
}

function cmpInstant(a: Instant, b: Instant, shiftB = 0n): number {
  const bs = b.s + shiftB;
  if (a.s !== bs) return a.s < bs ? -1 : 1;
  const n = Math.max(a.f.length, b.f.length);
  const x = a.f.padEnd(n, '0');
  const y = b.f.padEnd(n, '0');
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Ordem parcial do XSD: com fuso nos dois (ou em nenhum) a comparação é direta; com fuso em só um, o outro vale por
 * qualquer fuso de -14:00 a +14:00, e se o resultado muda nesse intervalo a comparação é indeterminada (`NaN`).
 */
export function compareCalendar(b: string, x: string, y: string): number {
  const a = instantOf(b, x);
  const c = instantOf(b, y);
  if (!a || !c) return Number.NaN;
  if ((a.tz === null) === (c.tz === null)) return cmpInstant(a, c);
  const w = 14n * 3600n;
  const sign = c.tz === null ? 1n : -1n;
  const lo = cmpInstant(a, c, -w * sign);
  const hi = cmpInstant(a, c, w * sign);
  return lo === hi ? lo : Number.NaN;
}

function checkCalendarRange(t: SimpleType, v: string, path: string, name: string, out: SchemaIssue[]): void {
  // Comparação indeterminada (NaN) reprova a faceta: o valor não está provadamente dentro do intervalo.
  const ok = (bound: string | undefined, pass: (c: number) => boolean): boolean => {
    if (bound === undefined) return true;
    const c = compareCalendar(t.b, v, bound);
    return !Number.isNaN(c) && pass(c);
  };
  if (!ok(t.mi, (c) => c >= 0))
    out.push({ caminho: path, code: 'valor_minimo', mensagem: `valor antes de ${t.mi}${name}` });
  if (!ok(t.ma, (c) => c <= 0))
    out.push({ caminho: path, code: 'valor_maximo', mensagem: `valor depois de ${t.ma}${name}` });
  if (!ok(t.me, (c) => c > 0))
    out.push({ caminho: path, code: 'valor_minimo', mensagem: `valor deve ser depois de ${t.me}${name}` });
  if (!ok(t.mxe, (c) => c < 0)) {
    out.push({ caminho: path, code: 'valor_maximo', mensagem: `valor deve ser antes de ${t.mxe}${name}` });
  }
}

function elementMatches(p: Particle, k: ElementoXml | undefined, ownerNs: string): boolean {
  if (!k) return false;
  if (isWildcard(p)) return true;
  return isElementParticle(p) && k.local === p.e && k.ns === (p.ns ?? ownerNs);
}

/** Posições finais alcançáveis casando a partícula `p` a partir de `pos` (conjuntos de posições, sem backtracking). */
function match(p: Particle, kids: readonly ElementoXml[], pos: number, ownerNs: string): Set<number> {
  const min = minOccurs(p);
  const max = maxOccurs(p);
  let cur = new Set([pos]);
  const seen = new Set([pos]);
  const res = new Set<number>();
  if (min === 0) res.add(pos);
  for (let rep = 1; rep <= max && cur.size > 0; rep++) {
    const next = new Set<number>();
    for (const s of cur) {
      if (isWildcard(p) || isElementParticle(p)) {
        if (elementMatches(p, kids[s], ownerNs)) next.add(s + 1);
      } else if (p.g === 's') {
        let ps = new Set([s]);
        for (const i of p.i) {
          const nx = new Set<number>();
          for (const q of ps) for (const r of match(i, kids, q, ownerNs)) nx.add(r);
          ps = nx;
          if (ps.size === 0) break;
        }
        for (const q of ps) next.add(q);
      } else {
        for (const i of p.i) for (const r of match(i, kids, s, ownerNs)) next.add(r);
      }
    }
    if (rep >= min) for (const q of next) res.add(q);
    // Só expande posições novas: termina mesmo com grupo unbounded que casa vazio.
    for (const q of [...next]) {
      if (seen.has(q) && rep > min) next.delete(q);
      else seen.add(q);
    }
    cur = next;
  }
  return res;
}

interface Ctx {
  readonly out: SchemaIssue[];
  readonly ids: Map<string, string>;
}

const declsCache = new WeakMap<ComplexType, Map<string, ElementParticle>>();

function declsOf(ct: ComplexType): Map<string, ElementParticle> {
  let m = declsCache.get(ct);
  if (!m) {
    const d = new Map<string, ElementParticle>();
    const collect = (p: Particle): void => {
      if (isElementParticle(p)) d.set(p.e, p);
      else if (!isWildcard(p)) for (const i of p.i) collect(i);
    };
    if (ct.c) collect(ct.c);
    m = d;
    declsCache.set(ct, m);
  }
  return m;
}

function hasWildcard(p: Particle | undefined): boolean {
  if (p === undefined || isElementParticle(p)) return false;
  return isWildcard(p) || p.i.some(hasWildcard);
}

function textOnly(el: ElementoXml): string {
  let s = '';
  for (const c of el.filhos) if (c.tipo === 'texto') s += c.valor;
  return s;
}

function checkAttributes(ct: ComplexType, el: ElementoXml, path: string, ctx: Ctx): void {
  for (const a of ct.a ?? []) {
    const v = el.atributos.find((x) => x.local === a.a && x.ns === '');
    const ap = `${path}/@${a.a}`;
    if (!v) {
      if (a.r) ctx.out.push({ caminho: ap, code: 'atributo_obrigatorio', mensagem: 'atributo obrigatório ausente' });
      continue;
    }
    // fixed, ID e unique comparam no espaço de valores, depois do whiteSpace do tipo (`" x "` e `"x"` são o mesmo ID).
    const nv = normalize(a.t, v.valor);
    if (a.f !== undefined && nv !== normalize(a.t, a.f)) {
      ctx.out.push({ caminho: ap, code: 'atributo_fixo', mensagem: `atributo deve valer ${a.f}` });
    }
    checkSimple(a.t, v.valor, ap, ctx.out);
    if (a.t.b === 'ID') {
      const prev = ctx.ids.get(nv);
      if (prev !== undefined)
        ctx.out.push({ caminho: ap, code: 'id_duplicado', mensagem: `ID repetido (primeiro em ${prev})` });
      else ctx.ids.set(nv, ap);
    }
  }
  for (const x of el.atributos) {
    if (x.ns === '' && (ct.a ?? []).some((a) => a.a === x.local)) continue;
    if (ct.aa) continue;
    if (isSchemaLocation(x)) continue;
    ctx.out.push({ caminho: `${path}/@${x.nome}`, code: 'atributo_desconhecido', mensagem: 'atributo fora do schema' });
  }
}

function isSchemaLocation(x: AtributoXml): boolean {
  return x.ns === XSI && (x.local === 'schemaLocation' || x.local === 'noNamespaceSchemaLocation');
}

/** Elemento de tipo simples não declara atributos: qualquer um fora de `xsi:*SchemaLocation` é ocorrência. */
function checkNoAttributes(el: ElementoXml, path: string, ctx: Ctx): void {
  for (const x of el.atributos) {
    if (isSchemaLocation(x)) continue;
    ctx.out.push({ caminho: `${path}/@${x.nome}`, code: 'atributo_desconhecido', mensagem: 'atributo fora do schema' });
  }
}

function checkUnique(
  attrs: readonly string[],
  el: ElementoXml,
  t: ComplexType | SimpleType,
  path: string,
  ctx: Ctx,
): void {
  const kids = elementosFilhos(el);
  const kidDecls = isComplexType(t) ? declsOf(t) : undefined;
  for (const attr of attrs) {
    const seen = new Set<string>();
    for (const k of kids) {
      const a = k.atributos.find((x) => x.local === attr && x.ns === '');
      if (!a) continue;
      const kt = kidDecls?.get(k.local)?.t;
      const at = kt && isComplexType(kt) ? kt.a?.find((d) => d.a === attr)?.t : undefined;
      const value = at ? normalize(at, a.valor) : a.valor;
      if (seen.has(value)) {
        ctx.out.push({
          caminho: `${path}/${k.local}/@${attr}`,
          code: 'unico',
          mensagem: `@${attr} repetido entre os filhos`,
        });
      }
      seen.add(value);
    }
  }
}

function validateElement(ct: ComplexType, el: ElementoXml, path: string, ctx: Ctx): void {
  checkAttributes(ct, el, path, ctx);
  if (ct.tx) {
    for (const c of el.filhos) {
      if (c.tipo === 'elemento') {
        ctx.out.push({ caminho: path, code: 'elemento_em_tipo_simples', mensagem: 'elemento em conteúdo simples' });
        break;
      }
    }
    checkSimple(ct.tx, textOnly(el), path, ctx.out);
    return;
  }
  const kids = elementosFilhos(el);
  for (const c of el.filhos) {
    if (c.tipo === 'texto' && !/^[ \t\n\r]*$/.test(c.valor)) {
      ctx.out.push({ caminho: path, code: 'texto_em_elemento', mensagem: 'texto em elemento só de elementos' });
      break;
    }
  }
  const ends = ct.c ? match(ct.c, kids, 0, ct.ns) : new Set([0]);
  const decls = declsOf(ct);
  if (!ends.has(kids.length)) {
    const unknown = hasWildcard(ct.c) ? undefined : kids.find((k) => !decls.has(k.local));
    ctx.out.push(
      unknown
        ? { caminho: `${path}/${unknown.local}`, code: 'elemento_desconhecido', mensagem: 'elemento fora do schema' }
        : {
            caminho: path,
            code: 'modelo_de_conteudo',
            mensagem: `filhos fora da ordem, faltando ou sobrando em ${ct.id}`,
          },
    );
  }
  const counts = new Map<string, number>();
  for (const k of kids) counts.set(k.local, (counts.get(k.local) ?? 0) + 1);
  const index = new Map<string, number>();
  for (const k of kids) {
    const decl = decls.get(k.local);
    if (!decl) continue;
    const t = decl.t;
    const n = (index.get(k.local) ?? 0) + 1;
    index.set(k.local, n);
    const kp = (counts.get(k.local) ?? 0) > 1 ? `${path}/${k.local}[${n}]` : `${path}/${k.local}`;
    if (decl.u) checkUnique(decl.u, k, decl.t, kp, ctx);
    if (isComplexType(t)) validateElement(t, k, kp, ctx);
    else {
      checkNoAttributes(k, kp, ctx);
      if (elementosFilhos(k).length > 0) {
        ctx.out.push({ caminho: kp, code: 'elemento_em_tipo_simples', mensagem: 'elemento em tipo simples' });
      }
      checkSimple(t, textOnly(k), kp, ctx.out);
    }
  }
}

/** Valida o elemento `el` como o tipo `ct`. Lista vazia = válido. */
export function validate(ct: ComplexType, el: ElementoXml): SchemaIssue[] {
  const ctx: Ctx = { out: [], ids: new Map() };
  validateElement(ct, el, `/${el.local}`, ctx);
  return ctx.out;
}

/** Valida um documento (string ou já parseado) pela raiz esperada. Lança `ErroXml` se o XML for malformado. */
export function validateRoot<T>(root: RootElement<T>, xml: string | DocumentoXml): SchemaIssue[] {
  const doc = typeof xml === 'string' ? lerXml(xml) : xml;
  if (doc.raiz.local !== root.name || doc.raiz.ns !== root.ns) {
    return [
      { caminho: `/${doc.raiz.local}`, code: 'raiz_inesperada', mensagem: `raiz esperada {${root.ns}}${root.name}` },
    ];
  }
  return validate(root.type as ComplexType, doc.raiz);
}

/** Como `validateRoot`, mas lança `ErroDeValidacao` (`validacao_falhou`) com todas as ocorrências. */
export function assertValid<T>(root: RootElement<T>, xml: string | DocumentoXml): void {
  const issues = validateRoot(root, xml);
  if (issues.length > 0) {
    throw new ErroDeValidacao(`${root.name}: ${issues.length} ocorrência(s) de schema`, issues);
  }
}
