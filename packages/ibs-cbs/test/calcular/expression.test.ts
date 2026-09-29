import { describe, expect, test } from 'bun:test';
import { loadDataset } from '@sinete/ibs-cbs-dados';
import { BUNDLED_DATASET } from '@sinete/ibs-cbs-dados/bundled';
import {
  checkExpression,
  dec,
  EXPRESSION_VARIABLES,
  ExpressionError,
  evaluate,
  INTERNAL_SCALE,
} from '../../src/calcular/index.ts';

describe('avaliador de expressões', () => {
  test('variável sozinha devolve o valor sem arredondar', () => {
    const v = dec('0.123456789012');
    expect(evaluate('aliquota', { aliquota: v })).toBe(v);
    expect(evaluate(' tributoCalculado ', { tributoCalculado: v })).toBe(v);
    expect(evaluate('baseCalculo', {}).toString()).toBe('0');
  });

  test('o resto sai com 8 casas HALF_EVEN', () => {
    expect(INTERNAL_SCALE).toBe(8);
    expect(evaluate('0', {}).toString()).toBe('0.00000000');
    expect(evaluate('1.00', {}).toString()).toBe('1.00000000');
    expect(evaluate('2.08/100', {}).toString()).toBe('0.02080000');
    expect(
      evaluate('baseCalculo*aliquotaEfetiva', {
        baseCalculo: dec('0.125'),
        aliquotaEfetiva: dec('0.0000001'),
      }).toString(),
    ).toBe('0.00000001');
    // 0.000000125 -> empate na 8a casa: fica no par (0.00000012); 0.000000135 sobe (0.00000014)
    expect(
      evaluate('baseCalculo*aliquotaEfetiva', {
        baseCalculo: dec('0.125'),
        aliquotaEfetiva: dec('0.000001'),
      }).toString(),
    ).toBe('0.00000012');
    expect(
      evaluate('baseCalculo*aliquotaEfetiva', {
        baseCalculo: dec('0.135'),
        aliquotaEfetiva: dec('0.000001'),
      }).toString(),
    ).toBe('0.00000014');
  });

  test('precedência, parênteses e menos unário', () => {
    const vars = { aliquota: dec('0.009'), percentualReducao: dec('0.6'), pRedutorCompraGov: dec('0') };
    expect(evaluate('aliquota*(1-percentualReducao)*(1-pRedutorCompraGov/100)', vars).toString()).toBe('0.00360000');
    expect(evaluate('1+2*3', {}).toString()).toBe('7.00000000');
    expect(evaluate('(1+2)*3', {}).toString()).toBe('9.00000000');
    expect(evaluate('-aliquota+1', vars).toString()).toBe('0.99100000');
    expect(evaluate('+aliquota', vars).toString()).toBe('0.00900000');
    expect(evaluate('10-2-3', {}).toString()).toBe('5.00000000');
    expect(evaluate('100/8/5', {}).toString()).toBe('2.50000000');
    expect(
      evaluate('(baseCalculoInformada-impostoSeletivoInformado+impostoSeletivoCalculado)*(1-100/100)', {
        baseCalculoInformada: dec('10'),
      }).toString(),
    ).toBe('0.00000000');
  });

  test('identificador desconhecido e sintaxe inválida são erro, nunca zero', () => {
    expect(() => evaluate('aliquota*desconto', { aliquota: dec('1') })).toThrow(ExpressionError);
    expect(() => evaluate('aliquota*', {})).toThrow(ExpressionError);
    expect(() => evaluate('(aliquota', {})).toThrow(ExpressionError);
    expect(() => evaluate('aliquota)', {})).toThrow(ExpressionError);
    expect(() => evaluate('aliquota % 2', {})).toThrow(ExpressionError);
    expect(() => evaluate('*2', {})).toThrow(ExpressionError);
    expect(() => evaluate('1/0', {})).toThrow(ExpressionError);
    try {
      evaluate('x+1', {});
    } catch (e) {
      expect((e as ExpressionError).code).toBe('ibscbs_expressao_invalida');
      expect((e as ExpressionError).expression).toBe('x+1');
    }
  });

  test('checkExpression lista as variáveis e valida', () => {
    expect(checkExpression('baseCalculo*aliquotaEfetiva')).toEqual(['baseCalculo', 'aliquotaEfetiva']);
    expect(checkExpression('0')).toEqual([]);
    expect(() => checkExpression('foo*2')).toThrow(ExpressionError);
    expect(EXPRESSION_VARIABLES).toContain('pRedutorCompraGov');
  });

  test('todas as expressões do dataset embarcado estão na gramática', () => {
    const ds = loadDataset(BUNDLED_DATASET);
    let count = 0;
    for (const t of ds.tables.treatments) {
      for (const e of Object.values(t.expr)) {
        if (e === null) continue;
        checkExpression(e);
        count++;
      }
    }
    expect(count).toBeGreaterThan(100);
  });
});
