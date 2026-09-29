import { describe, expect, test } from 'bun:test';
import { ConfigError } from '@sinete/core';
import { Decimal, dec, sum } from '../src/index.ts';

/** PRNG determinístico (mulberry32): as propriedades rodam sempre com os mesmos casos, sem dependência externa. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDecimal(r: () => number): Decimal {
  const digits = 1 + Math.floor(r() * 18);
  let coef = 0n;
  for (let i = 0; i < digits; i++) coef = coef * 10n + BigInt(Math.floor(r() * 10));
  if (r() < 0.3) coef = -coef;
  return Decimal.fromParts(coef, Math.floor(r() * 8));
}

/** Arredondamento de referência, por texto: independente do `roundCoef`. */
function referencia(d: Decimal, casas: number, modo: 'HALF_UP' | 'HALF_EVEN' | 'DOWN'): string {
  const neg = d.coef < 0n;
  const abs = (neg ? -d.coef : d.coef).toString().padStart(d.scale + 1, '0');
  const int = abs.slice(0, abs.length - d.scale);
  const frac = abs.slice(abs.length - d.scale).padEnd(casas + 1, '0');
  const mantidos = BigInt(int + frac.slice(0, casas));
  const resto = frac.slice(casas);
  const primeiro = Number(resto[0]);
  const depois = /[1-9]/.test(resto.slice(1));
  let q = mantidos;
  if (modo !== 'DOWN') {
    if (primeiro > 5 || (primeiro === 5 && depois)) q += 1n;
    else if (primeiro === 5 && (modo === 'HALF_UP' || q % 2n === 1n)) q += 1n;
  }
  const r = Decimal.fromParts(neg ? -q : q, casas);
  return r.toFixed(casas);
}

const CASOS = 2000;

describe('Decimal: propriedades', () => {
  test('soma e subtração são exatas e inversas', () => {
    const r = prng(1);
    for (let i = 0; i < CASOS; i++) {
      const a = randomDecimal(r);
      const b = randomDecimal(r);
      expect(a.plus(b).minus(b).eq(a)).toBe(true);
      expect(a.plus(b).eq(b.plus(a))).toBe(true);
      expect(a.minus(a).isZero()).toBe(true);
    }
  });

  test('multiplicação é comutativa, associativa e distributiva', () => {
    const r = prng(2);
    for (let i = 0; i < CASOS; i++) {
      const a = randomDecimal(r);
      const b = randomDecimal(r);
      const c = randomDecimal(r);
      expect(a.times(b).eq(b.times(a))).toBe(true);
      expect(
        a
          .times(b)
          .times(c)
          .eq(a.times(b.times(c))),
      ).toBe(true);
      expect(a.times(b.plus(c)).eq(a.times(b).plus(a.times(c)))).toBe(true);
    }
  });

  test('arredondamento confere com a referência por texto nos três modos', () => {
    const r = prng(3);
    for (let i = 0; i < CASOS; i++) {
      const a = randomDecimal(r);
      const casas = Math.floor(r() * 5);
      for (const modo of ['HALF_UP', 'HALF_EVEN', 'DOWN'] as const) {
        expect(a.toFixed(casas, modo)).toBe(referencia(a, casas, modo));
      }
    }
  });

  test('arredondar é idempotente e o erro fica em meia unidade da última casa', () => {
    const r = prng(4);
    for (let i = 0; i < CASOS; i++) {
      const a = randomDecimal(r);
      const casas = Math.floor(r() * 4);
      const x = a.round(casas, 'HALF_EVEN');
      expect(x.round(casas, 'HALF_EVEN').eq(x)).toBe(true);
      const erro = x.minus(a).abs();
      expect(erro.compare(Decimal.fromParts(5n, casas + 1)) <= 0).toBe(true);
    }
  });

  test('divisão arredondada: q × d fica a menos de uma unidade da última casa do dividendo', () => {
    const r = prng(5);
    for (let i = 0; i < CASOS; i++) {
      const a = randomDecimal(r);
      let b = randomDecimal(r);
      if (b.isZero()) b = Decimal.ONE;
      const casas = Math.floor(r() * 6);
      const q = a.dividedBy(b, casas, 'HALF_UP');
      // |q - a/b| <= 0,5 × 10^-casas, então |q × b - a| <= 0,5 × 10^-casas × |b|
      const limite = b.abs().times(Decimal.fromParts(5n, casas + 1));
      expect(q.times(b).minus(a).abs().compare(limite) <= 0).toBe(true);
    }
  });

  test('toString e of fazem a volta', () => {
    const r = prng(6);
    for (let i = 0; i < CASOS; i++) {
      const a = randomDecimal(r);
      expect(Decimal.of(a.toString()).eq(a)).toBe(true);
      expect(JSON.stringify({ a })).toBe(`{"a":"${a.toString()}"}`);
    }
  });
});

describe('Decimal: casos', () => {
  test('entrada', () => {
    expect(dec('12.34').toString()).toBe('12.34');
    expect(dec('-.5').toString()).toBe('-0.5');
    expect(dec('1e3').toString()).toBe('1000');
    expect(dec('1.5E-3').toString()).toBe('0.0015');
    expect(dec(0.1).toString()).toBe('0.1');
    expect(dec(10n).toString()).toBe('10');
    expect(dec(dec('2')).toString()).toBe('2');
    expect(Decimal.tryOf('1,5')).toBeUndefined();
    expect(Decimal.tryOf('1e999')).toBeUndefined();
    expect(Decimal.tryOf(`0.${'1'.repeat(70)}`)).toBeUndefined();
    expect(Decimal.tryOf(Number.NaN)).toBeUndefined();
    expect(Decimal.tryOf({} as unknown as string)).toBeUndefined();
    expect(() => dec('abc')).toThrow(ConfigError);
    expect(() => Decimal.fromParts(1n, -1)).toThrow(ConfigError);
  });

  test('empates: HALF_UP afasta do zero, HALF_EVEN vai ao par', () => {
    expect(dec('0.125').toFixed(2, 'HALF_UP')).toBe('0.13');
    expect(dec('0.125').toFixed(2, 'HALF_EVEN')).toBe('0.12');
    expect(dec('0.135').toFixed(2, 'HALF_EVEN')).toBe('0.14');
    expect(dec('-0.125').toFixed(2, 'HALF_UP')).toBe('-0.13');
    expect(dec('0.129').toFixed(2, 'DOWN')).toBe('0.12');
    expect(dec('1').toFixed(0)).toBe('1');
  });

  test('divisão com casa de guarda e resto', () => {
    expect(dec('1').dividedBy('3', 2, 'HALF_UP').toString()).toBe('0.33');
    expect(dec('2').dividedBy('3', 2, 'DOWN').toString()).toBe('0.66');
    // 0,125000...1 não é empate: resto além da casa de guarda arredonda para cima mesmo no HALF_EVEN
    expect(dec('0.1250001').dividedBy('1', 2, 'HALF_EVEN').toString()).toBe('0.13');
    expect(dec('1000').dividedBy('0.001', 0, 'HALF_UP').toString()).toBe('1000000');
    expect(dec('12.345678').dividedBy('2', 1, 'HALF_UP').toString()).toBe('6.2');
    expect(() => dec('1').dividedBy('0', 2, 'HALF_UP')).toThrow(ConfigError);
  });

  test('percentual, comparação e utilidades', () => {
    expect(dec('15').percent('18').toString()).toBe('2.7');
    expect(dec('1').lt('2')).toBe(true);
    expect(dec('2').gt('1')).toBe(true);
    expect(dec('1.0').eq('1')).toBe(true);
    expect(dec('-3').abs().toString()).toBe('3');
    expect(dec('3').negate().isNegative()).toBe(true);
    expect(dec('1.2300').significantScale()).toBe(2);
    expect(dec('1.5').round(3, 'HALF_UP').toFixed(3)).toBe('1.500');
    expect(() => dec('1').round(-1, 'HALF_UP')).toThrow(ConfigError);
    expect(sum([dec('1.1'), dec('2.2')]).toString()).toBe('3.3');
    expect(sum([]).isZero()).toBe(true);
  });

  test('produto com escala acima do limite é arredondado para caber', () => {
    const a = Decimal.fromParts(1n, 40);
    expect(a.times(a).scale).toBe(64);
    expect(a.times(a).isZero()).toBe(true);
  });
});
