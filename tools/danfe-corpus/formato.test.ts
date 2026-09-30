import { expect, test } from 'bun:test';
import { formatoDe, marcaDe } from './formato.ts';

test('formato vem da lista fechada; nenhum pedaço do título (chave, CNPJ) passa', () => {
  const numerica = '35260911222333000181550010000012341123456787';
  const alfa = '35260912ABC34501DE35550010000012341123456788';
  expect(formatoDe(`DANFE ${numerica}`)).toBe('DANFE');
  expect(formatoDe(`DANFE ${alfa}`)).toBe('DANFE');
  expect(formatoDe(`DANFE Simplificado ${alfa}`)).toBe('DANFE Simplificado');
  expect(formatoDe(`DANFE Simplificado Tipo 2 ${alfa}`)).toBe('DANFE Simplificado Tipo 2');
  expect(formatoDe(`DANFE NFC-e ${alfa}`)).toBe('DANFE NFC-e');
  expect(formatoDe(`DACCE ${alfa}`)).toBe('DACCE');
  expect(formatoDe(`DAMDFE ${alfa}`)).toBe('DAMDFE');
  expect(formatoDe(`DANFEX ${alfa}`)).toBe('outro');
  expect(formatoDe(alfa)).toBe('outro');
});

test('marca vem da lista fechada, pela primeira linha girada; o protocolo não passa', () => {
  const doc = (...linhas: string[]) => ({
    paginas: [
      { ops: [{ t: 'texto', s: 'CHAVE', rotacao: 0 }, ...linhas.map((s) => ({ t: 'texto', s, rotacao: 54.7 }))] },
    ],
  });
  expect(marcaDe(doc())).toBe('nenhuma');
  expect(marcaDe(doc('DENEGADA', 'USO DENEGADO', 'PROTOCOLO 135260000000001'))).toBe('denegada');
  expect(marcaDe(doc('SEM VALOR FISCAL', 'AMBIENTE DE HOMOLOGAÇÃO'))).toBe('sem-valor-fiscal');
  expect(marcaDe(doc('EMITIDA EM CONTINGÊNCIA'))).toBe('contingencia');
  expect(marcaDe(doc('EMISSÃO EM CONTINGÊNCIA'))).toBe('contingencia');
  expect(marcaDe(doc('CANCELADO', 'PROTOCOLO 9'))).toBe('cancelada');
  expect(marcaDe(doc('PROTOCOLO 135260000000001'))).toBe('outra');
  expect(marcaDe({ paginas: [{ ops: [{ t: 'texto', s: 'CANHOTO', rotacao: 90 }] }] })).toBe('nenhuma');
});
