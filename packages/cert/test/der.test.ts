import { describe, expect, test } from 'bun:test';
import { decodeTime, encodeLength, encodeTlv, isoFromEpoch, readTlv, TAG } from '../src/der.ts';
import { CertError } from '../src/errors.ts';
import { base64ToBytes, bytesToBase64, derToPem, pemToDers } from '../src/pem.ts';

const ascii = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('datas sem o global Date', () => {
  test('isoFromEpoch confere com Date em instantes variados', () => {
    for (const ms of [0, 951_782_400_000, 1_790_000_000_000, 2_145_916_800_000, 4_102_444_799_000, -86_400_000]) {
      expect(isoFromEpoch(ms)).toBe(new Date(ms).toISOString().replace('.000', ''));
    }
  });

  test('UTCTime usa a janela 1950-2049 da RFC 5280', () => {
    const utc = (s: string): number =>
      decodeTime(encodeTlv(TAG.UTC_TIME, ascii(s)), readTlv(encodeTlv(TAG.UTC_TIME, ascii(s)), 0));
    expect(isoFromEpoch(utc('491231235959Z'))).toBe('2049-12-31T23:59:59Z');
    expect(isoFromEpoch(utc('500101000000Z'))).toBe('1950-01-01T00:00:00Z');
  });

  test('GeneralizedTime', () => {
    const der = encodeTlv(TAG.GENERALIZED_TIME, ascii('20370101120000Z'));
    expect(isoFromEpoch(decodeTime(der, readTlv(der, 0)))).toBe('2037-01-01T12:00:00Z');
  });

  test('data sem Z é recusada', () => {
    const der = encodeTlv(TAG.UTC_TIME, ascii('2601010000'));
    expect(() => decodeTime(der, readTlv(der, 0))).toThrow(CertError);
  });
});

describe('TLV', () => {
  test('comprimento longo', () => {
    expect([...encodeLength(0x7f)]).toEqual([0x7f]);
    expect([...encodeLength(0x80)]).toEqual([0x81, 0x80]);
    expect([...encodeLength(0x1234)]).toEqual([0x82, 0x12, 0x34]);
    const content = new Uint8Array(300);
    const t = readTlv(encodeTlv(TAG.OCTET_STRING, content), 0);
    expect(t.end - t.start).toBe(300);
  });

  test('DER truncado ou com tag longa vira certificado_invalido', () => {
    for (const bad of [
      Uint8Array.of(0x30),
      Uint8Array.of(0x30, 0x05, 0x00),
      Uint8Array.of(0x1f, 0x01, 0x00),
      Uint8Array.of(0x30, 0x80),
    ]) {
      expect(() => readTlv(bad, 0)).toThrow(expect.objectContaining({ code: 'certificado_invalido' }));
    }
  });
});

describe('PEM e base64', () => {
  test('ida e volta', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(1000));
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    const pem = derToPem(bytes, 'CERTIFICATE');
    expect(pem.split('\n')[1]).toHaveLength(64);
    expect(pemToDers(pem + pem)).toEqual([bytes, bytes]);
  });

  test('base64 inválido', () => {
    expect(() => base64ToBytes('@@@')).toThrow(CertError);
  });
});
