import { describe, expect, test } from 'bun:test';
import { Decimal, dec, dePercentual, dinheiro, paraPercentual, percentual, sum } from '../../src/calcular/index.ts';

describe('Decimal: leitura e texto', () => {
  test('lê e devolve com a escala original', () => {
    expect(dec('123.450').toString()).toBe('123.450');
    expect(dec('-0.5').toString()).toBe('-0.5');
    expect(dec('+7').toString()).toBe('7');
    expect(dec('0.001').toString()).toBe('0.001');
    expect(dec('-0.001').toString()).toBe('-0.001');
    expect(JSON.stringify({ v: dec('1.10') })).toBe('{"v":"1.10"}');
  });

  test('recusa formatos ambíguos', () => {
    for (const bad of ['1e3', '1,5', ' 1', '.5', '5.', '', 'abc']) {
      expect(() => dec(bad)).toThrow(SyntaxError);
      expect(Decimal.isDecimalText(bad)).toBe(false);
    }
    expect(() => Decimal.parse(1 as unknown as string)).toThrow(SyntaxError);
    expect(Decimal.isDecimalText('10.25')).toBe(true);
  });

  test('of valida a escala', () => {
    expect(Decimal.of(12345n, 2).toString()).toBe('123.45');
    expect(() => Decimal.of(1n, -1)).toThrow(RangeError);
    expect(() => Decimal.of(1n, 1.5)).toThrow(RangeError);
  });
});

describe('Decimal: aritmética exata', () => {
  test('soma, subtração e multiplicação sem perda', () => {
    expect(dec('0.1').add(dec('0.2')).toString()).toBe('0.3');
    expect(dec('1').sub(dec('0.001')).toString()).toBe('0.999');
    expect(dec('1234.55').mul(dec('0.009')).toString()).toBe('11.11095');
    expect(dec('-2.5').mul(dec('4')).toString()).toBe('-10.0');
    expect(sum([dec('0.01'), dec('0.02'), dec('0.03')]).toString()).toBe('0.06');
    expect(sum([]).toString()).toBe('0');
  });

  test('divisão com 34 dígitos significativos e HALF_EVEN (DECIMAL128)', () => {
    expect(dec('1').div(dec('3')).toString()).toBe('0.3333333333333333333333333333333333');
    expect(dec('2').div(dec('3')).toString()).toBe('0.6666666666666666666666666666666667');
    expect(dec('10').div(dec('4')).toString()).toBe('2.5');
    expect(dec('100').div(dec('0.5')).toString()).toBe('200');
    expect(dec('-1').div(dec('8')).toString()).toBe('-0.125');
    expect(dec('0').div(dec('7')).toString()).toBe('0');
    expect(dec('1').div(dec('3'), 5).toString()).toBe('0.33333');
    expect(dec('2').div(dec('3'), 5, 'DOWN').toString()).toBe('0.66666');
    expect(dec('1').div(dec('8'), 2, 'HALF_UP').toString()).toBe('0.13');
    expect(dec('1').div(dec('8'), 2, 'HALF_EVEN').toString()).toBe('0.12');
    expect(dec('3').div(dec('8'), 2, 'HALF_EVEN').toString()).toBe('0.38');
    expect(dec('123456789').div(dec('0.001'), 3).toString()).toBe('123000000000');
    expect(() => dec('1').div(dec('0'))).toThrow(RangeError);
  });

  test('divisão com resto no empate: sobe quando há resto depois do meio', () => {
    // 0.1250000...1 arredondado para 2 dígitos vai para 0.13, não para o par 0.12
    expect(dec('1000000001').div(dec('8000000000'), 2).toString()).toBe('0.13');
  });
});

describe('Decimal: arredondamento', () => {
  test('HALF_EVEN arredonda o empate para o par', () => {
    expect(dec('0.125').setScale(2).toString()).toBe('0.12');
    expect(dec('0.135').setScale(2).toString()).toBe('0.14');
    expect(dec('0.1251').setScale(2).toString()).toBe('0.13');
    expect(dec('-0.125').setScale(2).toString()).toBe('-0.12');
    expect(dec('-0.135').setScale(2).toString()).toBe('-0.14');
    expect(dec('2.5').setScale(0).toString()).toBe('2');
    expect(dec('3.5').setScale(0).toString()).toBe('4');
  });

  test('HALF_UP e DOWN', () => {
    expect(dec('0.125').setScale(2, 'HALF_UP').toString()).toBe('0.13');
    expect(dec('-0.125').setScale(2, 'HALF_UP').toString()).toBe('-0.13');
    expect(dec('0.129').setScale(2, 'DOWN').toString()).toBe('0.12');
    expect(dec('-0.129').setScale(2, 'DOWN').toString()).toBe('-0.12');
  });

  test('setScale para mais casas completa com zeros', () => {
    expect(dec('1.5').setScale(4).toString()).toBe('1.5000');
    expect(dec('1.5').setScale(1)).toEqual(dec('1.5'));
    expect(() => dec('1').setScale(-1)).toThrow(RangeError);
    expect(dec('1.005').toFixed(2)).toBe('1.00');
    expect(dec('1.015').toFixed(2)).toBe('1.02');
  });

  test('dígitos significativos', () => {
    expect(dec('123.456').roundSignificant(4).toString()).toBe('123.5');
    expect(dec('0.0012345').roundSignificant(3).toString()).toBe('0.00123');
    expect(dec('12.5').roundSignificant(10)).toEqual(dec('12.5'));
    expect(() => dec('123456').roundSignificant(3)).toThrow(RangeError);
  });

  test('stripZeros, movePointRight, neg, comparações', () => {
    expect(dec('1.2300').stripZeros().toString()).toBe('1.23');
    expect(dec('100').stripZeros().toString()).toBe('100');
    expect(dec('0.009').movePointRight(2).toString()).toBe('0.9');
    expect(dec('0.9').movePointRight(2).toString()).toBe('90');
    expect(dec('1.5').neg().toString()).toBe('-1.5');
    expect(dec('1.50').cmp(dec('1.5'))).toBe(0);
    expect(dec('1.49').cmp(dec('1.5'))).toBe(-1);
    expect(dec('2').cmp(dec('1.999'))).toBe(1);
    expect(dec('1.50').eq(dec('1.5'))).toBe(true);
    expect(dec('0.000').isZero()).toBe(true);
    expect(dec('-0.01').isNegative()).toBe(true);
  });
});

describe('formatação como na Calculadora', () => {
  test('valor com 2 casas HALF_EVEN', () => {
    expect(dinheiro(dec('11.11095'))).toBe('11.11');
    expect(dinheiro(dec('0.005'))).toBe('0.00');
    expect(dinheiro(dec('0.015'))).toBe('0.02');
    expect(dinheiro(dec('7'))).toBe('7.00');
  });

  test('percentual de 2 a 4 casas', () => {
    expect(percentual(dec('0.9'))).toBe('0.90');
    expect(percentual(dec('0.36000000'))).toBe('0.36');
    expect(percentual(dec('0.12345'))).toBe('0.1234');
    expect(percentual(dec('0.12355'))).toBe('0.1236');
    expect(percentual(dec('60'))).toBe('60.00');
    expect(percentual(dec('0'))).toBe('0.00');
    expect(percentual(dec('0.105'))).toBe('0.105');
  });

  test('fração e percentual', () => {
    expect(dePercentual(dec('0.9')).toString()).toBe('0.00900000');
    expect(dePercentual(dec('60')).toString()).toBe('0.60000000');
    expect(dePercentual(dec('0.123456789')).toString()).toBe('0.00123457');
    expect(paraPercentual(dec('0.00900000')).toString()).toBe('0.900000');
  });
});
