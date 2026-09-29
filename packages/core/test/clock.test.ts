import { describe, expect, test } from 'bun:test';
import {
  fixedClock,
  formatDateTimeOffset,
  isSineteError,
  manualClock,
  systemClock,
  timeContext,
} from '../src/index.ts';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return isSineteError(e) ? e.code : 'outro';
  }
  return undefined;
}

describe('systemClock', () => {
  test('acompanha o relógio do sistema', () => {
    const before = Date.now();
    const t = systemClock.now().getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });
});

describe('fixedClock', () => {
  test('aceita ISO com fuso, epoch e Date, e devolve cópias independentes', () => {
    const iso = fixedClock('2026-09-25T09:00:00-03:00');
    const a = iso.now();
    a.setUTCFullYear(2000);
    expect(iso.now().toISOString()).toBe('2026-09-25T12:00:00.000Z');
    expect(fixedClock(0).now().toISOString()).toBe('1970-01-01T00:00:00.000Z');
    const d = new Date('2026-01-01T00:00:00Z');
    const fromDate = fixedClock(d);
    d.setUTCFullYear(1999);
    expect(fromDate.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  test('recusa instante sem fuso ou inválido com ConfigError', () => {
    expect(codeOf(() => fixedClock('2026-09-25T12:00:00'))).toBe('config_invalida');
    expect(codeOf(() => fixedClock('2026-09-25'))).toBe('config_invalida');
    expect(codeOf(() => fixedClock('xyzZ'))).toBe('config_invalida');
    expect(codeOf(() => fixedClock(Number.NaN))).toBe('config_invalida');
    expect(codeOf(() => fixedClock(new Date(Number.NaN)))).toBe('config_invalida');
  });
});

describe('manualClock', () => {
  test('set e advance', () => {
    const c = manualClock('2026-09-25T12:00:00Z');
    c.advance(1500);
    expect(c.now().toISOString()).toBe('2026-09-25T12:00:01.500Z');
    c.set('2027-01-01T00:00:00Z');
    expect(c.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
    c.advance(-1000);
    expect(c.now().toISOString()).toBe('2026-12-31T23:59:59.000Z');
    expect(codeOf(() => c.advance(Number.POSITIVE_INFINITY))).toBe('config_invalida');
  });
});

describe('timeContext', () => {
  test('sem fato gerador explícito, usa o relógio da emissão', () => {
    const emissao = fixedClock('2026-09-25T12:00:00Z');
    const ctx = timeContext({ emissao });
    expect(ctx.fatoGerador).toBe(emissao);
  });

  test('fato gerador anterior à emissão fica separado', () => {
    const ctx = timeContext({
      emissao: fixedClock('2027-01-02T10:00:00-03:00'),
      fatoGerador: fixedClock('2026-12-31T23:00:00-03:00'),
    });
    expect(ctx.emissao.now().getUTCFullYear()).toBe(2027);
    expect(ctx.fatoGerador.now().toISOString()).toBe('2027-01-01T02:00:00.000Z');
  });
});

describe('formatDateTimeOffset', () => {
  const t = new Date('2027-01-01T02:30:05.999Z');
  test('formata no fuso pedido, virando o dia quando precisa', () => {
    expect(formatDateTimeOffset(t, -180)).toBe('2026-12-31T23:30:05-03:00');
    expect(formatDateTimeOffset(t, -240)).toBe('2026-12-31T22:30:05-04:00');
    expect(formatDateTimeOffset(t, -300)).toBe('2026-12-31T21:30:05-05:00');
    expect(formatDateTimeOffset(t, 0)).toBe('2027-01-01T02:30:05+00:00');
    expect(formatDateTimeOffset(t, 330)).toBe('2027-01-01T08:00:05+05:30');
  });

  test('não depende do fuso da máquina', () => {
    expect(formatDateTimeOffset(new Date(0), -180)).toBe('1969-12-31T21:00:00-03:00');
  });

  test('recusa deslocamento ou data inválidos', () => {
    expect(codeOf(() => formatDateTimeOffset(t, 1.5))).toBe('config_invalida');
    expect(codeOf(() => formatDateTimeOffset(t, -721))).toBe('config_invalida');
    expect(codeOf(() => formatDateTimeOffset(t, 841))).toBe('config_invalida');
    expect(codeOf(() => formatDateTimeOffset(new Date(Number.NaN), 0))).toBe('config_invalida');
  });
});
