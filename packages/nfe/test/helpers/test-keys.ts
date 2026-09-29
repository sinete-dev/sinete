/**
 * Chave e certificado sintéticos gerados em tempo de teste, só com WebCrypto. Nada disso é commitado: cada execução
 * gera um par RSA-2048 novo e um certificado autoassinado mínimo (CN "sinete teste sintetico") para o KeyInfo.
 */
import type { DataSigner } from '@sinete/core';

const subtle = globalThis.crypto.subtle;

function len(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) out.unshift(v & 0xff);
  return [0x80 | out.length, ...out];
}

function tlv(tag: number, ...parts: (Uint8Array | number[])[]): Uint8Array<ArrayBuffer> {
  const body = parts.flatMap((p) => [...p]);
  return Uint8Array.from([tag, ...len(body.length), ...body]);
}

const seq = (...p: Uint8Array[]): Uint8Array<ArrayBuffer> => tlv(0x30, ...p);

function oid(dotted: string): Uint8Array {
  const [a = 0, b = 0, ...rest] = dotted.split('.').map(Number);
  const bytes = [40 * a + b];
  for (const v of rest) {
    const chunk: number[] = [];
    let x = v;
    do {
      chunk.unshift(x & 0x7f);
      x = Math.floor(x / 128);
    } while (x > 0);
    for (let k = 0; k < chunk.length - 1; k++) chunk[k] = (chunk[k] ?? 0) | 0x80;
    bytes.push(...chunk);
  }
  return tlv(0x06, bytes);
}

function name(cn: string): Uint8Array {
  return seq(tlv(0x31, seq(oid('2.5.4.3'), tlv(0x0c, [...new TextEncoder().encode(cn)]))));
}

export interface TestKeys {
  readonly certificateDer: Uint8Array;
  readonly pkcs8: Uint8Array;
  readonly dataSigner: DataSigner;
}

/** Gera um par RSA-2048 e um certificado X.509 v3 autoassinado mínimo, válido de 2026 a 2036. */
export async function generateTestKeys(cn = 'sinete teste sintetico'): Promise<TestKeys> {
  const pair = (await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-1' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
  const sha256WithRsa = seq(oid('1.2.840.113549.1.1.11'), tlv(0x05, []));
  const tbs = seq(
    tlv(0xa0, tlv(0x02, [2])),
    tlv(0x02, [0x01, 0x23, 0x45]),
    sha256WithRsa,
    name(cn),
    seq(
      tlv(0x17, [...new TextEncoder().encode('260101000000Z')]),
      tlv(0x17, [...new TextEncoder().encode('360101000000Z')]),
    ),
    name(cn),
    spki,
  );
  const certKey = await subtle.importKey('pkcs8', pkcs8, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5', certKey, tbs));
  const certificateDer = seq(tbs, sha256WithRsa, tlv(0x03, [0, ...sig]));

  const signKey = await subtle.importKey('pkcs8', pkcs8, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' }, false, ['sign']);
  const dataSigner: DataSigner = {
    kind: 'data',
    certificateDer: async () => certificateDer,
    sign: async (data, hash) => {
      if (hash !== 'SHA-1') throw new Error(`hash inesperado ${hash}`);
      return new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5', signKey, data as Uint8Array<ArrayBuffer>));
    },
  };

  return { certificateDer, pkcs8, dataSigner };
}
