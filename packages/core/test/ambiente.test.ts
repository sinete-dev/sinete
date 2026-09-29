import { describe, expect, test } from 'bun:test';
import { AMBIENTES, ambienteOfTpAmb, isAmbiente, tpAmbOf, ValidationError } from '../src/index.ts';

describe('Ambiente', () => {
  test('ida e volta com tpAmb', () => {
    expect(AMBIENTES.map(tpAmbOf)).toEqual(['1', '2']);
    for (const a of AMBIENTES) expect(ambienteOfTpAmb(tpAmbOf(a))).toBe(a);
  });

  test('tpAmb desconhecido vira ValidationError com ocorrência', () => {
    for (const bad of ['0', '3', '', ' 1', 'producao']) {
      let caught: unknown;
      try {
        ambienteOfTpAmb(bad);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ValidationError);
      expect((caught as ValidationError).issues[0]?.code).toBe('tpamb_invalido');
    }
  });

  test('isAmbiente', () => {
    expect(isAmbiente('producao')).toBe(true);
    expect(isAmbiente('homologacao')).toBe(true);
    expect(isAmbiente('1')).toBe(false);
    expect(isAmbiente(undefined)).toBe(false);
  });
});
