import { describe, expect, test } from 'bun:test';
import { indicadoresCfop, TABELA_CFOP } from '../src/index.ts';

describe('tabela de CFOP (IT 2023.002)', () => {
  test('indicadores de devolução, retorno e remessa', () => {
    for (const c of ['5202', '6202', '1202', '2202']) expect(indicadoresCfop(c)?.indDevol, c).toBe(true);
    for (const c of ['5102', '6102']) expect(indicadoresCfop(c)?.indDevol, c).toBe(false);
    expect(indicadoresCfop('6915')).toMatchObject({ indRemes: true, indRetor: false });
    expect(indicadoresCfop('6916')).toMatchObject({ indRetor: true, indRemes: false });
    expect(indicadoresCfop('5.202')?.cfop).toBe('5202');
  });

  test('CFOP fora da tabela devolve undefined', () => {
    expect(indicadoresCfop('6998')).toBeUndefined();
    expect(indicadoresCfop('abc')).toBeUndefined();
  });

  test('vigência e fonte', () => {
    expect(indicadoresCfop('1101')).toMatchObject({ inicioVigencia: '2006-01-01', indNFe: true });
    expect(indicadoresCfop('1101')?.fimVigencia).toBeUndefined();
    expect(TABELA_CFOP.fontes[0]?.url).toStartWith('https://www.nfe.fazenda.gov.br/');
    expect(TABELA_CFOP.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
