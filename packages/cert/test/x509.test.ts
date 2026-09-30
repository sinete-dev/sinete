import { describe, expect, test } from 'bun:test';
import { X509Certificate } from 'node:crypto';
import { relogioFixo } from '@sinete/core';
import {
  abrirPfx,
  certificadosIcpBrasil,
  impressaoDigitalSha256,
  lerCertificado,
  pemDoCertificado,
} from '../src/index.ts';
import { fixture, SENHA } from './helpers.ts';

const clock = relogioFixo('2026-09-25T12:00:00Z');

describe('lerCertificado contra o X509Certificate do runtime', () => {
  const certs = certificadosIcpBrasil().map((c) => c.der);

  test.each(certs.map((der, i) => [i, der] as const))('certificado %i do bundle', async (_i, der) => {
    const ours = lerCertificado(der);
    const ref = new X509Certificate(der);
    const strip = (s: string): string => s.toLowerCase().replace(/^0+(?=.)/, '');
    expect(strip(ours.serialNumber)).toBe(strip(ref.serialNumber));
    expect(ours.subject.texto).toBe(ref.subject.replace(/\n/g, ', '));
    expect(ours.issuer.texto).toBe(ref.issuer.replace(/\n/g, ', '));
    expect(ours.notBefore).toBe(Date.parse(ref.validFrom));
    expect(ours.notAfter).toBe(Date.parse(ref.validTo));
    expect(ours.isCA).toBe(ref.ca);
    expect(await impressaoDigitalSha256(ours)).toBe(ref.fingerprint256);
    expect(ours.chavePublica.algoritmo).toBe('RSA');
    if (ours.chavePublica.algoritmo === 'RSA') expect(ours.chavePublica.bits).toBe(4096);
    expect(pemDoCertificado(ours)).toBe(ref.toString());
  });

  test('folha sintética: SAN, usos, AIA e identificadores de chave', async () => {
    const ks = await abrirPfx(fixture('ecnpj-3des-cadeia.pfx'), { senha: SENHA, relogio: clock });
    const c = ks.certificado;
    const ref = new X509Certificate(c.der);
    expect(c.version).toBe(3);
    expect(c.isCA).toBe(false);
    expect(c.selfIssued).toBe(false);
    expect(c.keyUsage).toEqual(['digitalSignature', 'nonRepudiation', 'keyEncipherment']);
    expect(c.extKeyUsage).toEqual(['clientAuth', 'emailProtection']);
    expect(c.subjectAltNames.otherNames.map((o) => o.oid)).toEqual([
      '2.16.76.1.3.4',
      '2.16.76.1.3.2',
      '2.16.76.1.3.3',
      '2.16.76.1.3.7',
    ]);
    expect(c.subjectAltNames.emails).toEqual(['teste@sintetico.invalid']);
    expect(c.urlsOcsp).toEqual(['http://ocsp.ac-sintetica.invalid']);
    expect(c.urlsCaIssuers).toEqual(['http://ac-sintetica.invalid/ac.p7b']);
    expect(c.subjectKeyId).toMatch(/^[0-9a-f]{40}$/);
    expect(c.authorityKeyId).toBe(ks.certificadosExtras.find((x) => !x.selfIssued)?.subjectKeyId);
    expect(c.signatureAlgorithm).toBe('1.2.840.113549.1.1.11');
    expect(c.subject.commonName).toBe('EMPRESA SINTETICA DE TESTE LTDA:11222333000181');
    expect(c.notAfterIso).toBe('2027-01-01T00:00:00Z');
    expect(ref.checkIssued(new X509Certificate(ks.certificadosExtras[0]?.der ?? new Uint8Array()))).toBe(true);
  });

  test('SAN com iPAddress: IPv4 e IPv6 na forma curta da RFC 5952', () => {
    // Autoassinado e descartável, gerado com o OpenSSL só para este teste (chave jogada fora).
    const pem = [
      '-----BEGIN CERTIFICATE-----',
      'MIIB8jCCAZigAwIBAgIUYDkyu6xxlKsqlNGYawjDpeJG+EowCgYIKoZIzj0EAwIw',
      'GTEXMBUGA1UEAwwOaXAtc2FuLmludmFsaWQwHhcNMjYwOTI4MTQyODAyWhcNMzYw',
      'OTI1MTQyODAyWjAZMRcwFQYDVQQDDA5pcC1zYW4uaW52YWxpZDBZMBMGByqGSM49',
      'AgEGCCqGSM49AwEHA0IABPSPISeOUb7VUwZJDXXi2UBHKiFHLDHt5ekL9r5HS8wk',
      'X4CpADfSW80chW26mc6R4fRBo6hTtV1gewfhOnRri2yjgb0wgbowHQYDVR0OBBYE',
      'FKMoe4ywEs5U9Hwgf2t1JHn34a9KMB8GA1UdIwQYMBaAFKMoe4ywEs5U9Hwgf2t1',
      'JHn34a9KMA8GA1UdEwEB/wQFMAMBAf8wZwYDVR0RBGAwXoIOaXAtc2FuLmludmFs',
      'aWSHBH8AAAGHEAAAAAAAAAAAAAAAAAAAAAGHECABDbgAAAAAAAEAAAAAAAGHECAB',
      'DbgAAAABAAEAAQABAAGHEP6AAAAAAAABAAAAAAAAAAAwCgYIKoZIzj0EAwIDSAAw',
      'RQIgQX0iyJ+e8+m6xg2iQKrcjVAZ0J4ngnxM+AzY8poPnqcCIQCEwjY0OPaO4YW9',
      '8w9y7+nGceVHboB/Ocfa54/JFpHcPQ==',
      '-----END CERTIFICATE-----',
    ].join('\n');
    const c = lerCertificado(new Uint8Array(new X509Certificate(pem).raw));
    expect(c.subjectAltNames.nomesDns).toEqual(['ip-san.invalid']);
    expect(c.subjectAltNames.enderecosIp).toEqual([
      '127.0.0.1',
      '::1',
      '2001:db8::1:0:0:1',
      '2001:db8:0:1:1:1:1:1',
      'fe80:0:0:1::',
    ]);
  });

  test('lixo não é certificado', () => {
    expect(() => lerCertificado(Uint8Array.of(0x30, 0x03, 0x02, 0x01, 0x00))).toThrow(
      expect.objectContaining({ code: 'certificado_invalido' }),
    );
    expect(() => lerCertificado(new TextEncoder().encode('não é DER'))).toThrow(
      expect.objectContaining({ code: 'certificado_invalido' }),
    );
  });
});
