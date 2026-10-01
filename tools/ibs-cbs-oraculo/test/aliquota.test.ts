import { describe, expect, test } from 'bun:test';
import type { LinhaDeReferencia } from '../src/aliquota.ts';
import { aplicarAliquota, cbsNominalDe2027e2028, percentualDaTabela } from '../src/aliquota.ts';

const desconhecida = (inicio: string, fim: string | null): LinhaDeReferencia => ({
  tributo: 'CBS',
  vigencia: { inicio, fim },
  situacao: 'desconhecida',
  aliquota: null,
  legal: 'LC 214/2025, art. 347',
  nota: 'Aguarda a resolução do Senado Federal.',
  fontes: ['lc214-2025'],
});
const ibs: LinhaDeReferencia = {
  tributo: 'IBSUF',
  vigencia: { inicio: '2027-01-01', fim: '2028-12-31' },
  situacao: 'oficial',
  aliquota: '0.05',
  legal: 'LC 214/2025, art. 344',
  fontes: ['lc214-2025'],
};
const linhas = [desconhecida('2027-01-01', '2028-12-31'), ibs, desconhecida('2029-01-01', null)];
const nova = (inicio: string, fim: string, aliquota = '8.7') => ({
  tributo: 'CBS' as const,
  inicio,
  fim,
  aliquota,
  legal: 'resolução',
  fontes: ['resolucao-senado-x', 'lc214-2025'],
});

describe('aplicarAliquota', () => {
  test('só 2027: divide a linha, 2028 continua desconhecida com o texto original', () => {
    const r = aplicarAliquota(linhas, nova('2027-01-01', '2027-12-31'));
    expect(r.map((l) => [l.tributo, l.vigencia.inicio, l.vigencia.fim, l.situacao, l.aliquota])).toEqual([
      ['CBS', '2027-01-01', '2027-12-31', 'oficial', '8.7'],
      ['CBS', '2028-01-01', '2028-12-31', 'desconhecida', null],
      ['IBSUF', '2027-01-01', '2028-12-31', 'oficial', '0.05'],
      ['CBS', '2029-01-01', null, 'desconhecida', null],
    ]);
    expect(r[1]?.nota).toBe('Aguarda a resolução do Senado Federal.');
    expect(r[0]).not.toHaveProperty('nota');
    expect(r[0]?.fontes).toEqual(['resolucao-senado-x', 'lc214-2025']);
  });

  test('2027 e 2028: troca a linha inteira; meio de vigência e vigência aberta também dividem', () => {
    expect(aplicarAliquota(linhas, nova('2027-01-01', '2028-12-31')).filter((l) => l.tributo === 'CBS')).toHaveLength(
      2,
    );
    const meio = aplicarAliquota(linhas, nova('2027-07-01', '2027-12-31'));
    expect(meio.slice(0, 3).map((l) => [l.vigencia.inicio, l.vigencia.fim, l.situacao])).toEqual([
      ['2027-01-01', '2027-06-30', 'desconhecida'],
      ['2027-07-01', '2027-12-31', 'oficial'],
      ['2028-01-01', '2028-12-31', 'desconhecida'],
    ]);
    const aberta = aplicarAliquota(linhas, nova('2029-01-01', '2029-12-31', '9.3'));
    expect(aberta.at(-1)?.vigencia).toEqual({ inicio: '2030-01-01', fim: null });
  });

  test('recusa: vigência que não cabe numa linha, linha já oficial, datas inválidas', () => {
    expect(() => aplicarAliquota(linhas, nova('2028-06-01', '2029-06-30'))).toThrow(/cobre/);
    const oficial = aplicarAliquota(linhas, nova('2027-01-01', '2027-12-31'));
    expect(() => aplicarAliquota(oficial, nova('2027-01-01', '2027-12-31', '8.8'))).toThrow(/já é oficial/);
    expect(() => aplicarAliquota(linhas, nova('2027-12-31', '2027-01-01'))).toThrow(/vigência inválida/);
    expect(() => aplicarAliquota(linhas, nova('2027-1-1', '2027-12-31'))).toThrow(/vigência inválida/);
  });
});

test('CBS nominal = referência menos 0,1 ponto, só em 2027 e 2028; percentual no formato da tabela', () => {
  expect(cbsNominalDe2027e2028('8.8', '2027-01-01', '2027-12-31')).toBe('8.7');
  expect(cbsNominalDe2027e2028('9.10', '2027-01-01', '2028-12-31')).toBe('9');
  expect(() => cbsNominalDe2027e2028('8.8', '2029-01-01', '2029-12-31')).toThrow(/--cbs/);
  expect(() => cbsNominalDe2027e2028('0.05', '2027-01-01', '2027-12-31')).toThrow(/menor/);
  expect(percentualDaTabela('8.70')).toBe('8.7');
  expect(() => percentualDaTabela('8,7')).toThrow(/formato/);
  expect(() => percentualDaTabela('101')).toThrow(/0 a 100/);
});
