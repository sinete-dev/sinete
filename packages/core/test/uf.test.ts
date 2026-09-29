import { describe, expect, test } from 'bun:test';
import table from '../src/data/ufs.json' with { type: 'json' };
import { isCUf, isUf, UF_TABLE, UFS, ufByCUf, ufBySigla } from '../src/index.ts';

// Enumerações do leiaute, copiadas de tiposBasico_v4.00.xsd do PL_010f_v1.04 (TCodUfIBGE e TUf sem EX).
const XSD_CUF = '11 12 13 14 15 16 17 21 22 23 24 25 26 27 28 29 31 32 33 35 41 42 43 50 51 52 53'.split(' ');
const XSD_UF = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');

describe('tabela de UFs', () => {
  test('tem exatamente as 27 UFs do leiaute', () => {
    expect(UFS).toHaveLength(27);
    expect(UFS.map((u): string => u.cUF)).toEqual(XSD_CUF);
    expect(UFS.map((u): string => u.sigla).sort()).toEqual(XSD_UF);
  });

  test('cada entrada tem nome e região válidos', () => {
    for (const u of UFS) {
      expect(u.nome.length).toBeGreaterThan(3);
      expect(['N', 'NE', 'SE', 'S', 'CO']).toContain(u.regiao);
      // a região é o primeiro dígito do código IBGE
      expect({ '1': 'N', '2': 'NE', '3': 'SE', '4': 'S', '5': 'CO' }[u.cUF[0] as '1']).toBe(u.regiao);
    }
  });

  test('metadados versionados com fonte', () => {
    expect(UF_TABLE.schemaVersion).toBe(1);
    expect(UF_TABLE.version).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(UF_TABLE.sources.length).toBeGreaterThan(0);
    for (const s of UF_TABLE.sources) {
      expect(s.url).toStartWith('https://');
      expect(s.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(Object.keys(table).sort()).toEqual(['notes', 'schemaVersion', 'sources', 'ufs', 'version']);
  });
});

describe('consultas', () => {
  test('por sigla e por cUF', () => {
    expect(ufBySigla('MT')).toEqual({ sigla: 'MT', cUF: '51', nome: 'Mato Grosso', regiao: 'CO' });
    expect(ufByCUf('35')?.sigla).toBe('SP');
    expect(ufBySigla('EX')).toBeUndefined();
    expect(ufBySigla('sp')).toBeUndefined();
    expect(ufByCUf('91')).toBeUndefined();
    expect(ufByCUf('35 ')).toBeUndefined();
  });

  test('guardas', () => {
    expect(isUf('DF')).toBe(true);
    expect(isUf('EX')).toBe(false);
    expect(isUf(35)).toBe(false);
    expect(isCUf('53')).toBe(true);
    expect(isCUf('34')).toBe(false);
    expect(isCUf(53)).toBe(false);
  });
});
