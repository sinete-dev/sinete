/**
 * Leitor DER mínimo (ITU-T X.690) para certificados X.509 e chaves PKCS#8. Só leitura, sem dependências, igual em
 * todas as runtimes. Escopo estreito de propósito: comprimento definido (DER), tags de um byte (baixas), que é tudo o
 * que aparece em X.509 e PKCS#8.
 */

import { ErroCertificado } from './errors.ts';

/** Um TLV DER: `start` e `end` delimitam o conteúdo; `headerStart` o TLV inteiro. */
export interface Tlv {
  /** Byte da tag inteiro (classe, construído e número). */
  readonly tag: number;
  readonly constructed: boolean;
  readonly headerStart: number;
  readonly start: number;
  readonly end: number;
}

export const TAG = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  PRINTABLE_STRING: 0x13,
  T61_STRING: 0x14,
  IA5_STRING: 0x16,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  BMP_STRING: 0x1e,
  SEQUENCE: 0x30,
  SET: 0x31,
} as const;

function fail(msg: string): never {
  throw new ErroCertificado('certificado_invalido', `DER inválido: ${msg}`);
}

/** Lê o TLV que começa em `offset`, sem passar de `limit`. */
export function readTlv(buf: Uint8Array, offset: number, limit: number = buf.length): Tlv {
  if (offset + 2 > limit) fail('TLV truncado');
  const tag = buf[offset] as number;
  if ((tag & 0x1f) === 0x1f) fail('tag de vários bytes');
  let len = buf[offset + 1] as number;
  let p = offset + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) fail('comprimento indefinido ou grande demais');
    if (p + n > limit) fail('comprimento truncado');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + (buf[p + i] as number);
    p += n;
  }
  if (p + len > limit) fail('conteúdo além do fim');
  return { tag, constructed: (tag & 0x20) !== 0, headerStart: offset, start: p, end: p + len };
}

/** Filhos de um TLV construído. */
export function children(buf: Uint8Array, node: Tlv): Tlv[] {
  const out: Tlv[] = [];
  let p = node.start;
  while (p < node.end) {
    const c = readTlv(buf, p, node.end);
    out.push(c);
    p = c.end;
  }
  return out;
}

/** Filho obrigatório na posição `i`, com a tag esperada (se dada). */
export function child(buf: Uint8Array, node: Tlv, i: number, tag?: number): Tlv {
  const c = children(buf, node)[i];
  if (!c) fail(`filho ${i} ausente`);
  if (tag !== undefined && c.tag !== tag)
    fail(`filho ${i} com tag 0x${c.tag.toString(16)}, esperado 0x${tag.toString(16)}`);
  return c;
}

export function expectTag(node: Tlv, tag: number, what: string): Tlv {
  if (node.tag !== tag) fail(`${what}: tag 0x${node.tag.toString(16)}, esperado 0x${tag.toString(16)}`);
  return node;
}

/** Bytes do TLV inteiro (cabeçalho + conteúdo). */
export function tlvBytes(buf: Uint8Array, node: Tlv): Uint8Array {
  return buf.subarray(node.headerStart, node.end);
}

/** Bytes só do conteúdo. */
export function contentBytes(buf: Uint8Array, node: Tlv): Uint8Array {
  return buf.subarray(node.start, node.end);
}

export function decodeOid(buf: Uint8Array, node: Tlv): string {
  expectTag(node, TAG.OID, 'OID');
  const parts: number[] = [];
  let v = 0;
  for (let i = node.start; i < node.end; i++) {
    const b = buf[i] as number;
    v = v * 128 + (b & 0x7f);
    if (!(b & 0x80)) {
      if (parts.length === 0) {
        const first = v < 80 ? Math.floor(v / 40) : 2;
        parts.push(first, v - first * 40);
      } else parts.push(v);
      v = 0;
    }
  }
  return parts.join('.');
}

export function toHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

/** Inteiro positivo em hexadecimal minúsculo, sem o zero de sinal à esquerda. */
export function integerHex(buf: Uint8Array, node: Tlv): string {
  expectTag(node, TAG.INTEGER, 'INTEGER');
  let b = contentBytes(buf, node);
  while (b.length > 1 && b[0] === 0) b = b.subarray(1);
  return toHex(b);
}

const latin1 = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

/** Texto de um tipo string do ASN.1 (UTF8, Printable, IA5, T61, BMP) ou de um OCTET STRING com texto. */
export function decodeString(buf: Uint8Array, node: Tlv): string {
  const bytes = contentBytes(buf, node);
  switch (node.tag) {
    case TAG.UTF8_STRING:
    case TAG.OCTET_STRING:
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    case TAG.BMP_STRING: {
      let s = '';
      for (let i = 0; i + 1 < bytes.length; i += 2)
        s += String.fromCharCode(((bytes[i] as number) << 8) | (bytes[i + 1] as number));
      return s;
    }
    case TAG.PRINTABLE_STRING:
    case TAG.IA5_STRING:
    case TAG.T61_STRING:
      return latin1(bytes);
    default:
      fail(`tipo de string não suportado: 0x${node.tag.toString(16)}`);
  }
}

/** Dias desde 1970-01-01 para uma data civil proleptica (algoritmo days_from_civil, H. Hinnant). */
function daysFromCivil(y: number, m: number, d: number): number {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Instante de um UTCTime ou GeneralizedTime (sempre em UTC, com `Z`), em milissegundos desde a época. */
export function decodeTime(buf: Uint8Array, node: Tlv): number {
  const s = latin1(contentBytes(buf, node));
  const m =
    node.tag === TAG.UTC_TIME
      ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s)
      : node.tag === TAG.GENERALIZED_TIME
        ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s)
        : null;
  if (!m) fail(`data inválida: ${JSON.stringify(s)}`);
  let year = Number(m[1]);
  // RFC 5280, 4.1.2.5.1: UTCTime com ano >= 50 é 19xx, senão 20xx.
  if (node.tag === TAG.UTC_TIME) year += year >= 50 ? 1900 : 2000;
  const days = daysFromCivil(year, Number(m[2]), Number(m[3]));
  return ((days * 24 + Number(m[4])) * 60 + Number(m[5])) * 60_000 + Number(m[6]) * 1000;
}

/** ISO 8601 em UTC (`2026-01-01T00:00:00Z`) de um instante em milissegundos, sem usar o global `Date`. */
export function isoFromEpoch(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  let rem = ms - days * 86_400_000;
  // civil_from_days (H. Hinnant)
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  const hh = Math.floor(rem / 3_600_000);
  rem -= hh * 3_600_000;
  const mi = Math.floor(rem / 60_000);
  const ss = Math.floor((rem - mi * 60_000) / 1000);
  const p = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${p(y, 4)}-${p(m)}-${p(d)}T${p(hh)}:${p(mi)}:${p(ss)}Z`;
}

/** Codifica um comprimento DER. */
export function encodeLength(len: number): Uint8Array {
  if (len < 0x80) return Uint8Array.of(len);
  const bytes: number[] = [];
  for (let v = len; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

/** Monta um TLV DER a partir de tag e conteúdo. */
export function encodeTlv(tag: number, content: Uint8Array): Uint8Array {
  const len = encodeLength(content.length);
  const out = new Uint8Array(1 + len.length + content.length);
  out[0] = tag;
  out.set(len, 1);
  out.set(content, 1 + len.length);
  return out;
}

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
