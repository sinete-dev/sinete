import { describe, expect, test } from 'bun:test';
import {
  contextoDeTempo,
  ehErroSinete,
  formatarDataHoraComFuso,
  relogioDoSistema,
  relogioFixo,
  relogioManual,
} from '../src/index.ts';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return ehErroSinete(e) ? e.code : 'outro';
  }
  return undefined;
}

describe('systemClock', () => {
  test('acompanha o relógio do sistema', () => {
    const before = Date.now();
    const t = relogioDoSistema.agora().getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });
});

describe('fixedClock', () => {
  test('aceita ISO com fuso, epoch e Date, e devolve cópias independentes', () => {
    const iso = relogioFixo('2026-09-25T09:00:00-03:00');
    const a = iso.agora();
    a.setUTCFullYear(2000);
    expect(iso.agora().toISOString()).toBe('2026-09-25T12:00:00.000Z');
    expect(relogioFixo(0).agora().toISOString()).toBe('1970-01-01T00:00:00.000Z');
    const d = new Date('2026-01-01T00:00:00Z');
    const fromDate = relogioFixo(d);
    d.setUTCFullYear(1999);
    expect(fromDate.agora().toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  test('recusa instante sem fuso ou inválido com ConfigError', () => {
    expect(codeOf(() => relogioFixo('2026-09-25T12:00:00'))).toBe('config_invalida');
    expect(codeOf(() => relogioFixo('2026-09-25'))).toBe('config_invalida');
    expect(codeOf(() => relogioFixo('xyzZ'))).toBe('config_invalida');
    expect(codeOf(() => relogioFixo(Number.NaN))).toBe('config_invalida');
    expect(codeOf(() => relogioFixo(new Date(Number.NaN)))).toBe('config_invalida');
  });
});

describe('manualClock', () => {
  test('set e advance', () => {
    const c = relogioManual('2026-09-25T12:00:00Z');
    c.avancar(1500);
    expect(c.agora().toISOString()).toBe('2026-09-25T12:00:01.500Z');
    c.ajustar('2027-01-01T00:00:00Z');
    expect(c.agora().toISOString()).toBe('2027-01-01T00:00:00.000Z');
    c.avancar(-1000);
    expect(c.agora().toISOString()).toBe('2026-12-31T23:59:59.000Z');
    expect(codeOf(() => c.avancar(Number.POSITIVE_INFINITY))).toBe('config_invalida');
  });
});

describe('timeContext', () => {
  test('sem fato gerador explícito, usa o relógio da emissão', () => {
    const emissao = relogioFixo('2026-09-25T12:00:00Z');
    const ctx = contextoDeTempo({ emissao });
    expect(ctx.fatoGerador).toBe(emissao);
  });

  test('fato gerador anterior à emissão fica separado', () => {
    const ctx = contextoDeTempo({
      emissao: relogioFixo('2027-01-02T10:00:00-03:00'),
      fatoGerador: relogioFixo('2026-12-31T23:00:00-03:00'),
    });
    expect(ctx.emissao.agora().getUTCFullYear()).toBe(2027);
    expect(ctx.fatoGerador.agora().toISOString()).toBe('2027-01-01T02:00:00.000Z');
  });
});

describe('formatDateTimeOffset', () => {
  const t = new Date('2027-01-01T02:30:05.999Z');
  test('formata no fuso pedido, virando o dia quando precisa', () => {
    expect(formatarDataHoraComFuso(t, -180)).toBe('2026-12-31T23:30:05-03:00');
    expect(formatarDataHoraComFuso(t, -240)).toBe('2026-12-31T22:30:05-04:00');
    expect(formatarDataHoraComFuso(t, -300)).toBe('2026-12-31T21:30:05-05:00');
    expect(formatarDataHoraComFuso(t, 0)).toBe('2027-01-01T02:30:05+00:00');
    expect(formatarDataHoraComFuso(t, 330)).toBe('2027-01-01T08:00:05+05:30');
  });

  test('não depende do fuso da máquina', () => {
    expect(formatarDataHoraComFuso(new Date(0), -180)).toBe('1969-12-31T21:00:00-03:00');
  });

  test('recusa deslocamento ou data inválidos', () => {
    expect(codeOf(() => formatarDataHoraComFuso(t, 1.5))).toBe('config_invalida');
    expect(codeOf(() => formatarDataHoraComFuso(t, -721))).toBe('config_invalida');
    expect(codeOf(() => formatarDataHoraComFuso(t, 841))).toBe('config_invalida');
    expect(codeOf(() => formatarDataHoraComFuso(new Date(Number.NaN), 0))).toBe('config_invalida');
  });
});
