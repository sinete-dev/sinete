import { describe, expect, test } from 'bun:test';
import { ConfigError } from '@sinete/core';
import { Decimal, dec, sum } from '../src/index.ts';

describe('Decimal', () => {
  test('soma e compara sem ponto flutuante', () => {
    expect(sum([dec('0.1'), dec('0.2')]).eq('0.3')).toBe(true);
    expect(dec('4000.00').plus('250.5').toString()).toBe('4250.5');
    expect(dec('1').minus('1.01').abs().toString()).toBe('0.01');
    expect(dec('10').gt('9.999')).toBe(true);
  });

  test('toFixed completa zeros e recusa perder casas', () => {
    expect(dec('30000').toFixed(4)).toBe('30000.0000');
    expect(dec('0').toFixed(2)).toBe('0.00');
    expect(() => dec('1.234').toFixed(2)).toThrow(ConfigError);
  });

  test('aceita texto, number e bigint; recusa vírgula e expoente', () => {
    expect(Decimal.tryOf('12.34')?.toString()).toBe('12.34');
    expect(Decimal.tryOf(12.5)?.toString()).toBe('12.5');
    expect(Decimal.tryOf(12n)?.toString()).toBe('12');
    expect(Decimal.tryOf('-.5')?.toString()).toBe('-0.5');
    expect(Decimal.tryOf('12,34')).toBeUndefined();
    expect(Decimal.tryOf(1e21)).toBeUndefined();
    expect(Decimal.tryOf(Number.NaN)).toBeUndefined();
    expect(() => Decimal.of('x')).toThrow(ConfigError);
  });
});
