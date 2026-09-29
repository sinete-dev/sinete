import { describe, expect, test } from 'bun:test';
import type { GovValues } from '../../src/calcular/index.ts';
import { dec, enteOf, REDISTRIBUTION_FROM, redistribute } from '../../src/calcular/index.ts';

const values: GovValues = {
  CBS: { pAliq: dec('8.8'), vTrib: dec('88') },
  IBSUF: { pAliq: dec('0.05'), vTrib: dec('0.5') },
  IBSMun: { pAliq: dec('0.05'), vTrib: dec('0.5') },
};
const show = (v: GovValues) =>
  Object.fromEntries(
    Object.entries(v).map(([k, x]) => [k, [x.pAliq.stripZeros().toString(), x.vTrib.stripZeros().toString()]]),
  );

describe('redistribuição do art. 473', () => {
  test('entes equivalentes', () => {
    expect([1, 2, 3, 4, 5, 6].map((t) => enteOf(t as 1))).toEqual([
      'uniao',
      'estado',
      'estado',
      'municipio',
      'municipio',
      'municipio',
    ]);
    expect(REDISTRIBUTION_FROM).toBe('2027-01-01');
  });

  test('antes de 2027 nada muda', () => {
    expect(redistribute(values, 1, '2026-12-31', dec('0'))).toBe(values);
  });

  test('União fica com tudo', () => {
    expect(show(redistribute(values, 1, '2027-01-01', dec('0')))).toEqual({
      CBS: ['8.9', '89'],
      IBSUF: ['0', '0'],
      IBSMun: ['0', '0'],
    });
  });

  test('Estado recebe o IBS municipal e a parte transferida da CBS', () => {
    expect(show(redistribute(values, 2, '2030-01-01', dec('0.1')))).toEqual({
      CBS: ['7.92', '79.2'],
      IBSUF: ['0.98', '9.8'],
      IBSMun: ['0', '0'],
    });
  });

  test('Município recebe o IBS estadual e a parte transferida da CBS', () => {
    expect(show(redistribute(values, 4, '2033-01-01', dec('1')))).toEqual({
      CBS: ['0', '0'],
      IBSUF: ['0', '0'],
      IBSMun: ['8.9', '89'],
    });
  });
});
