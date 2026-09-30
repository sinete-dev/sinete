import { describe, expect, test } from 'bun:test';
import { AMBIENTES, ambienteDoTpAmb, ErroDeValidacao, ehAmbiente, tpAmbDoAmbiente } from '../src/index.ts';

describe('Ambiente', () => {
  test('ida e volta com tpAmb', () => {
    expect(AMBIENTES.map(tpAmbDoAmbiente)).toEqual(['1', '2']);
    for (const a of AMBIENTES) expect(ambienteDoTpAmb(tpAmbDoAmbiente(a))).toBe(a);
  });

  test('tpAmb desconhecido vira ErroDeValidacao com ocorrência', () => {
    for (const bad of ['0', '3', '', ' 1', 'producao']) {
      let caught: unknown;
      try {
        ambienteDoTpAmb(bad);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ErroDeValidacao);
      expect((caught as ErroDeValidacao).ocorrencias[0]?.code).toBe('tpamb_invalido');
    }
  });

  test('ehAmbiente', () => {
    expect(ehAmbiente('producao')).toBe(true);
    expect(ehAmbiente('homologacao')).toBe(true);
    expect(ehAmbiente('1')).toBe(false);
    expect(ehAmbiente(undefined)).toBe(false);
  });
});
