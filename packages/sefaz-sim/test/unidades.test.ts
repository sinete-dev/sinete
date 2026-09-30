/** Datas sem `Date`, mensagens oficiais e certificados sintéticos. */
import { describe, expect, test } from 'bun:test';
import { icpIdentity, parseCertificate } from '@sinete/cert';
import { relogioManual } from '@sinete/core';
import { isDenegacao, isResultado, motivo, motivoRejeicao, syntheticCertificate } from '../src/index.ts';
import { civilFromDays, daysFromCivil, formatInstant, parseDateTime, utcParts, yearOf } from '../src/time.ts';

describe('datas', () => {
  test('dia civil ida e volta, inclusive antes da época e em ano bissexto', () => {
    for (const [y, m, d] of [
      [1970, 1, 1],
      [2000, 2, 29],
      [1969, 12, 31],
      [2026, 9, 26],
      [2100, 3, 1],
    ] as const) {
      expect(civilFromDays(daysFromCivil(y, m, d))).toEqual({ year: y, month: m, day: d });
    }
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
  });

  test('parse e formato com fuso, Z e fração; fora do formato é undefined', () => {
    const ms = parseDateTime('2026-09-26T10:00:00-03:00') as number;
    expect(formatInstant(ms, -180)).toBe('2026-09-26T10:00:00-03:00');
    expect(formatInstant(ms, 0)).toBe('2026-09-26T13:00:00+00:00');
    expect(formatInstant(ms, 330)).toBe('2026-09-26T18:30:00+05:30');
    expect(parseDateTime('2026-09-26T13:00:00.123Z')).toBe(ms);
    expect(parseDateTime('2026-09-26T10:00:00')).toBeUndefined();
    expect(utcParts(ms)).toEqual({ year: 2026, month: 9, day: 26, hour: 13, minute: 0, second: 0 });
    expect(yearOf(parseDateTime('2027-01-01T01:00:00Z') as number, -180)).toBe(2026);
  });
});

describe('mensagens', () => {
  test('resultado da tabela 4.4.1, rejeição com prefixo e marcadores', () => {
    expect(motivo('100')).toBe('Autorizado o uso da NF-e');
    expect(isResultado('135')).toBe(true);
    expect(isResultado('204')).toBe(false);
    expect(motivo('204', { nRec: '351000000000001' })).toContain('[nRec:351000000000001]');
    expect(motivo('204')).not.toContain('[');
    expect(motivoRejeicao('108')).toStartWith('Rejeição: ');
    expect(motivo('301')).toStartWith('Uso Denegado: ');
    expect(isDenegacao('301')).toBe(true);
    expect(isDenegacao('204')).toBe(false);
    expect(() => motivo('999999')).toThrow('fora do catálogo');
    // Mensagem só Latin-1, como o TMotivo exige.
    for (const c of ['225', '539', '562', '656', '573']) expect(/^[ -ÿ]+$/.test(motivo(c))).toBe(true);
  });
});

describe('certificados sintéticos', () => {
  const clock = relogioManual('2026-09-26T10:00:00-03:00');

  test('e-CNPJ, e-CPF e servidor legíveis pelo @sinete/cert; validade em GeneralizedTime depois de 2049', async () => {
    const ac = await syntheticCertificate({ clock, role: 'ac', validDays: 30 * 365 });
    const pj = await syntheticCertificate({ clock, role: 'titular', cnpj: '11222333000181', issuer: ac });
    const pf = await syntheticCertificate({ clock, role: 'titular', cpf: '11144477735', issuer: ac, commonName: 'PF' });
    const srv = await syntheticCertificate({ clock, role: 'servidor', issuer: ac, hosts: ['10.0.0.1', 'sim.local'] });
    expect(icpIdentity(parseCertificate(pj.der)).cnpj).toBe('11222333000181');
    expect(icpIdentity(parseCertificate(pf.der)).cpf).toBe('11144477735');
    expect(pf.commonName).toBe('PF');
    expect(srv.tlsIdentity.certChain).toContain(ac.pem.trim());
    expect(parseCertificate(ac.der).notAfterIso).toStartWith('2056-');
    const sig = await pj.signer.assinar(new Uint8Array([1, 2, 3]), 'SHA-1');
    expect(sig.length).toBe(256);
    expect(await pj.signer.assinar(new Uint8Array([1]), 'SHA-1')).toHaveLength(256);
    expect(await pj.signer.certificadoDer()).toBe(pj.der);
  });

  test('erros de configuração', async () => {
    expect(syntheticCertificate({ clock, role: 'titular' })).rejects.toThrow('cnpj ou cpf');
    expect(syntheticCertificate({ clock, role: 'servidor', hosts: ['1.2.3.999'] })).rejects.toThrow('IP inválido');
    for (const ip of ['1::2::3', '1:2:3', 'g::1', '1:2:3:4:5:6:7:8:9', '1:2:3:4::5:6:7:8']) {
      expect(syntheticCertificate({ clock, role: 'servidor', hosts: [ip] })).rejects.toThrow('IP inválido');
    }
    expect(
      (await syntheticCertificate({ clock, role: 'servidor', hosts: ['fe80::1', '1:2:3:4:5:6:7:8'] })).pem,
    ).toContain('BEGIN CERTIFICATE');
  });
});
