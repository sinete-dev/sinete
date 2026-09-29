/** Base64 e PEM sem `Buffer`: `atob`/`btoa` existem em Node, Bun, Deno e no browser. */

import { CertError } from './errors.ts';

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  let bin: string;
  try {
    bin = atob(b64.replace(/\s+/g, ''));
  } catch (cause) {
    throw new CertError('certificado_invalido', 'base64 inválido', { cause });
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** PEM com linhas de 64 colunas, como o OpenSSL escreve. */
export function derToPem(der: Uint8Array, label: string): string {
  const b64 = bytesToBase64(der);
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

/** Todos os blocos PEM com o rótulo dado (padrão `CERTIFICATE`), em DER, na ordem do texto. */
export function pemToDers(pem: string, label = 'CERTIFICATE'): Uint8Array[] {
  const re = new RegExp(`-----BEGIN ${label}-----([\\s\\S]*?)-----END ${label}-----`, 'g');
  return [...pem.matchAll(re)].map((m) => base64ToBytes(m[1] ?? ''));
}
