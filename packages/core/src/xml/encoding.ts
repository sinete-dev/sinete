/**
 * Base64 e o mínimo de DER necessário para achar a chave pública de um certificado X.509, sem Buffer nem node:crypto.
 */

/** Decodifica base64 ignorando whitespace (o `X509Certificate` e o `SignatureValue` costumam vir quebrados). */
export function base64Decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/[ \t\r\n]+/g, ''));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/** Codifica em base64 numa linha só, sem quebra (forma usada pela SEFAZ). */
export function base64Encode(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

interface DerItem {
  readonly tag: number;
  readonly start: number;
  readonly content: number;
  readonly end: number;
}

function derRead(b: Uint8Array, off: number): DerItem {
  const tag = b[off];
  let len = b[off + 1];
  if (tag === undefined || len === undefined) throw new RangeError('DER truncado');
  let hdr = 2;
  if (len & 0x80) {
    const nb = len & 0x7f;
    if (nb === 0 || nb > 4) throw new RangeError('comprimento DER não suportado');
    len = 0;
    for (let k = 0; k < nb; k++) {
      const byte = b[off + 2 + k];
      if (byte === undefined) throw new RangeError('DER truncado');
      len = len * 256 + byte;
    }
    hdr += nb;
  }
  const end = off + hdr + len;
  if (end > b.length) throw new RangeError('DER truncado');
  return { tag, start: off, content: off + hdr, end };
}

/** Extrai o `SubjectPublicKeyInfo` (DER) de um certificado X.509 em DER (RFC 5280, 4.1). */
export function spkiFromCertificate(der: Uint8Array): Uint8Array<ArrayBuffer> {
  const cert = derRead(der, 0);
  if (cert.tag !== 0x30) throw new RangeError('certificado não começa com SEQUENCE');
  const tbs = derRead(der, cert.content);
  if (tbs.tag !== 0x30) throw new RangeError('tbsCertificate não é SEQUENCE');
  let f = derRead(der, tbs.content);
  if (f.tag === 0xa0) f = derRead(der, f.end); // [0] version
  // serialNumber, signature, issuer, validity, subject
  for (let k = 0; k < 5; k++) f = derRead(der, f.end);
  if (f.tag !== 0x30) throw new RangeError('subjectPublicKeyInfo não é SEQUENCE');
  return new Uint8Array(der.subarray(f.start, f.end));
}
