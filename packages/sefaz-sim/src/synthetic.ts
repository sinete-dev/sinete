/**
 * Certificados sintéticos para testar contra o simulador, gerados na hora com WebCrypto (nada vai para o repo).
 *
 * Um e-CNPJ ou e-CPF sintético tem o leiaute de extensões que o simulador e o `@sinete/cert` leem: `otherName`
 * 2.16.76.1.3.3 (CNPJ) ou 2.16.76.1.3.1 (titular do e-CPF, leiaute posicional com o CPF nas posições 9 a 19), do
 * DOC-ICP-04 item 7.1.2.3; KeyUsage com assinatura digital e não recusa e ExtKeyUsage `clientAuth` (MOC 7.0 Anexo I,
 * regras A01 e E01). A AC sintética assina os certificados de cliente e o do servidor HTTPS do simulador (SAN com IP e
 * DNS). Nenhum deles é ICP-Brasil: servem só para o simulador e para laboratório.
 *
 * X.509 v3 montado a partir da RFC 5280 (seção 4.1), com RSA-2048 e sha256WithRSAEncryption.
 */

import type { AssinadorDeDados, HashDaAssinatura, Relogio } from '@sinete/core';
import { ErroDeConfiguracao } from '@sinete/core';
import { codificarBase64 } from '@sinete/core/xml';
import { utcParts } from './time.ts';

const subtle: SubtleCrypto = globalThis.crypto.subtle;
const te: TextEncoder = new TextEncoder();

function lengthBytes(n: number): number[] {
  if (n < 0x80) return [n];
  const out: number[] = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) out.unshift(v & 0xff);
  return [0x80 | out.length, ...out];
}

function tlv(tag: number, ...parts: readonly (Uint8Array | readonly number[])[]): Uint8Array<ArrayBuffer> {
  const body = parts.flatMap((p) => [...p]);
  return Uint8Array.from([tag, ...lengthBytes(body.length), ...body]);
}

const seq = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => tlv(0x30, ...parts);

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

function name(commonName: string): Uint8Array {
  const rdn = (type: string, value: Uint8Array): Uint8Array => tlv(0x31, seq(oid(type), value));
  return seq(
    rdn('2.5.4.6', tlv(0x13, [...te.encode('BR')])),
    rdn('2.5.4.10', tlv(0x0c, [...te.encode('sinete-sim')])),
    rdn('2.5.4.3', tlv(0x0c, [...te.encode(commonName)])),
  );
}

/** UTCTime até 2049 e GeneralizedTime a partir de 2050 (RFC 5280, 4.1.2.5). */
function time(ms: number): Uint8Array {
  const p = utcParts(ms);
  const two = (n: number): string => String(n).padStart(2, '0');
  const rest = `${two(p.month)}${two(p.day)}${two(p.hour)}${two(p.minute)}${two(p.second)}Z`;
  return p.year < 2050
    ? tlv(0x17, [...te.encode(`${two(p.year % 100)}${rest}`)])
    : tlv(0x18, [...te.encode(`${p.year}${rest}`)]);
}

function extension(id: string, critical: boolean, value: Uint8Array): Uint8Array {
  return critical ? seq(oid(id), tlv(0x01, [0xff]), tlv(0x04, value)) : seq(oid(id), tlv(0x04, value));
}

function ipv4Bytes(ip: string): number[] {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    throw new ErroDeConfiguracao(`IP inválido para o SAN: ${ip}`);
  }
  return parts;
}

/** IPv6 em 16 bytes, com `::` expandido (sem IPv4 embutido nem zona). */
function ipv6Bytes(ip: string): number[] {
  const halves = ip.split('::');
  const groups = (s: string): string[] => (s === '' ? [] : s.split(':'));
  const head = groups(halves[0] ?? '');
  const tail = groups(halves[1] ?? '');
  const zeros = 8 - head.length - tail.length;
  // `::` vale um ou mais grupos zerados (RFC 4291, 2.2); sem `::`, são exatamente oito grupos.
  if (halves.length > 2 || (halves.length === 1 && zeros !== 0) || (halves.length === 2 && zeros < 1)) {
    throw new ErroDeConfiguracao(`IP inválido para o SAN: ${ip}`);
  }
  const all = [...head, ...Array.from({ length: halves.length === 2 ? zeros : 0 }, () => '0'), ...tail];
  if (all.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) throw new ErroDeConfiguracao(`IP inválido para o SAN: ${ip}`);
  return all.flatMap((g) => {
    const v = Number.parseInt(g, 16);
    return [v >> 8, v & 0xff];
  });
}

/** Nome do SAN: IPv4 e IPv6 como iPAddress, o resto como dNSName. */
function sanName(host: string): Uint8Array {
  if (host.includes(':')) return tlv(0x87, ipv6Bytes(host));
  return /^[0-9.]+$/.test(host) ? tlv(0x87, ipv4Bytes(host)) : tlv(0x82, [...te.encode(host)]);
}

/** Papel do certificado, que decide as extensões. */
export type SyntheticRole = 'ac' | 'titular' | 'servidor';

export interface SyntheticCertificateOptions {
  /** Relógio da emissão: a validade começa um dia antes de `clock.now()`. */
  readonly clock: Relogio;
  readonly role: SyntheticRole;
  /** CN do titular. Padrão: `SINETE SIM:<documento>` ou `sinete-sim AC`. */
  readonly commonName?: string;
  /** CNPJ do e-CNPJ (numérico ou alfanumérico, sem máscara). */
  readonly cnpj?: string;
  /** CPF do e-CPF, sem máscara. */
  readonly cpf?: string;
  /** Dias de validade a partir de `clock.now()`. Padrão: 365. Negativo gera um certificado já vencido. */
  readonly validDays?: number;
  /** AC que assina. Sem ela, o certificado é autoassinado. */
  readonly issuer?: SyntheticCertificate;
  /** Nomes do servidor (papel `servidor`): IPs (v4 e v6) e DNS do SAN. Padrão: `127.0.0.1`, `::1` e `localhost`. */
  readonly hosts?: readonly string[];
  /** Omite o `otherName` com o documento (para testar as regras 282 e 292). */
  readonly omitDocumentExtension?: boolean;
}

/** Certificado com a chave, pronto para o TLS (PEM), para assinar XML (`DataSigner`) e para assinar outros. */
export interface SyntheticCertificate {
  readonly der: Uint8Array;
  readonly pem: string;
  /** Chave privada PKCS#8 em PEM. */
  readonly keyPem: string;
  /** `DataSigner` do `@sinete/core` (RSASSA-PKCS1-v1_5), para o `signXml` do `@sinete/core/xml`. */
  readonly signer: AssinadorDeDados;
  /** Identidade `pem` do `@sinete/transport` (certificado seguido da AC, quando houver). */
  readonly tlsIdentity: { readonly kind: 'pem'; readonly certChain: string; readonly key: string };
  readonly commonName: string;
  /** Uso interno: assina o TBSCertificate dos certificados emitidos por esta AC. */
  readonly signTbs: (tbs: Uint8Array<ArrayBuffer>) => Promise<Uint8Array>;
}

function toPem(label: string, der: Uint8Array): string {
  const b64 = codificarBase64(der).replace(/.{64}/g, '$&\n');
  return `-----BEGIN ${label}-----\n${b64.trimEnd()}\n-----END ${label}-----\n`;
}

const SHA256_RSA = (): Uint8Array => seq(oid('1.2.840.113549.1.1.11'), tlv(0x05, []));

function extensions(options: SyntheticCertificateOptions): Uint8Array[] {
  const out: Uint8Array[] = [];
  if (options.role === 'ac') {
    out.push(extension('2.5.29.19', true, seq(tlv(0x01, [0xff]))));
    // keyCertSign (bit 5) e cRLSign (bit 6): 00000110, um bit sem uso.
    out.push(extension('2.5.29.15', true, tlv(0x03, [0x01, 0x06])));
    return out;
  }
  out.push(extension('2.5.29.19', true, seq()));
  if (options.role === 'servidor') {
    out.push(extension('2.5.29.15', true, tlv(0x03, [0x05, 0xa0])));
    out.push(extension('2.5.29.37', false, seq(oid('1.3.6.1.5.5.7.3.1'))));
    const names = (options.hosts ?? ['127.0.0.1', '::1', 'localhost']).map(sanName);
    out.push(extension('2.5.29.17', false, seq(...names)));
    return out;
  }
  // digitalSignature, nonRepudiation e keyEncipherment (bits 0 a 2): 11100000, cinco bits sem uso.
  out.push(extension('2.5.29.15', true, tlv(0x03, [0x05, 0xe0])));
  out.push(extension('2.5.29.37', false, seq(oid('1.3.6.1.5.5.7.3.2'), oid('1.3.6.1.5.5.7.3.4'))));
  if (options.omitDocumentExtension !== true) {
    const otherName = (id: string, value: string): Uint8Array =>
      tlv(0xa0, oid(id), tlv(0xa0, tlv(0x04, [...te.encode(value)])));
    const names: Uint8Array[] = [];
    if (options.cnpj !== undefined) names.push(otherName('2.16.76.1.3.3', options.cnpj));
    // e-CPF: nascimento (8), CPF (11), NIS (11), RG (15) e órgão expedidor (10); campo sem valor vai com zeros.
    if (options.cpf !== undefined) {
      names.push(otherName('2.16.76.1.3.1', `01011980${options.cpf}${'0'.repeat(36)}`));
    }
    if (names.length > 0) out.push(extension('2.5.29.17', false, seq(...names)));
  }
  return out;
}

/** Gera um certificado sintético com chave RSA-2048 nova. */
export async function syntheticCertificate(options: SyntheticCertificateOptions): Promise<SyntheticCertificate> {
  if (options.role === 'titular' && options.cnpj === undefined && options.cpf === undefined) {
    throw new ErroDeConfiguracao('certificado de titular precisa de cnpj ou cpf');
  }
  const pair = (await subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
  const doc = options.cnpj ?? options.cpf;
  const commonName =
    options.commonName ?? (options.role === 'titular' ? `SINETE SIM:${doc}` : `sinete-sim ${options.role}`);
  const now = options.clock.agora().getTime();
  const serial = globalThis.crypto.getRandomValues(new Uint8Array(12));
  serial[0] = ((serial[0] ?? 0) & 0x7f) | 0x01;
  const tbs = seq(
    tlv(0xa0, tlv(0x02, [2])),
    tlv(0x02, serial),
    SHA256_RSA(),
    name(options.issuer?.commonName ?? commonName),
    seq(time(now - 86_400_000), time(now + (options.validDays ?? 365) * 86_400_000)),
    name(commonName),
    spki,
    tlv(0xa3, seq(...extensions(options))),
  );
  const importFor = (hash: HashDaAssinatura): Promise<CryptoKey> =>
    subtle.importKey('pkcs8', pkcs8, { name: 'RSASSA-PKCS1-v1_5', hash }, false, ['sign']);
  const sha256Key = await importFor('SHA-256');
  const signTbs = async (data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> =>
    new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5', sha256Key, data));
  const signature = await (options.issuer?.signTbs ?? signTbs)(tbs);
  const der = seq(tbs, SHA256_RSA(), tlv(0x03, [0, ...signature]));
  const pem = toPem('CERTIFICATE', der);
  const keyPem = toPem('PRIVATE KEY', pkcs8);
  const keys = new Map<HashDaAssinatura, Promise<CryptoKey>>();
  const signer: AssinadorDeDados = {
    tipo: 'dados',
    certificadoDer: async (): Promise<Uint8Array> => der,
    async assinar(data: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array> {
      let key = keys.get(hash);
      if (key === undefined) {
        key = importFor(hash);
        keys.set(hash, key);
      }
      return new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5', await key, data as Uint8Array<ArrayBuffer>));
    },
  };
  return {
    der,
    pem,
    keyPem,
    signer,
    tlsIdentity: { kind: 'pem', certChain: pem + (options.issuer?.pem ?? ''), key: keyPem },
    commonName,
    signTbs,
  };
}
