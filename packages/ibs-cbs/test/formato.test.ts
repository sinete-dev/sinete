/**
 * O motor recusa dados de outro formato. O `@sinete/nfe` e o `@sinete/ibs-cbs` aceitam qualquer `@sinete/ibs-cbs-dados`
 * a partir de `2026.9.2` (a versão é de calendário), então um pacote de dados mais novo, com outro `versaoDoFormato`,
 * pode chegar a este código; o leitor do pacote de dados aceitaria o formato dele, e quem confere é o motor, pelo
 * formato que ele mesmo sabe ler.
 */
import { describe, expect, test } from 'bun:test';
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import type { DatasetIbsCbs } from '@sinete/ibs-cbs-dados';
import { carregarDataset, ErroDadosIbsCbs } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO } from '@sinete/ibs-cbs-dados/embarcado';
import { aliquotasOficiais } from '../src/aliquotas/index.ts';
import { calcular, calcularEm } from '../src/calcular/index.ts';
import { determinar, restringir } from '../src/determinar/index.ts';
import { FORMATO_DOS_DADOS_DO_MOTOR } from '../src/formato.ts';
import { documentoDoRoc, validar } from '../src/validar/index.ts';

const dataset = carregarDataset(DATASET_EMBARCADO);
const outroFormato: DatasetIbsCbs = {
  ...dataset,
  manifesto: { ...dataset.manifesto, versaoDoFormato: dataset.manifesto.versaoDoFormato + 1 },
  em: (d) => dataset.em(d),
};
const tempo = contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') });
const op = {
  modelo: 55,
  local: { uf: 'RS', cMun: '4314902' },
  itens: [{ n: 1, cst: '000', cClassTrib: '000001', base: '100.00' }],
} as const;

function codigo(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    if (e instanceof ErroDadosIbsCbs) return e.code;
    throw e;
  }
  throw new Error('não lançou');
}

describe('formato dos dados conferido pelo motor', () => {
  test('o formato que o motor lê é o do dataset embarcado desta versão', () => {
    expect(dataset.manifesto.versaoDoFormato).toBe(FORMATO_DOS_DADOS_DO_MOTOR);
  });

  test('calcular, validar, restringir e determinar recusam outro versaoDoFormato', async () => {
    const aliquotas = aliquotasOficiais();
    const esperado = 'ibscbs_dados_versao_incompativel';
    expect(codigo(() => calcularEm(op, { dataset: outroFormato, aliquotas, data: '2026-10-10' }))).toBe(esperado);
    expect(codigo(() => calcular(op, { dataset: outroFormato, aliquotas, tempo }))).toBe(esperado);
    const roc = calcularEm(op, { dataset, aliquotas, data: '2026-10-10' });
    const doc = documentoDoRoc(roc, { modelo: 55, crt: 3, finNFe: 1, itens: [{ nItem: 1, vProd: '100.00' }] });
    expect(codigo(() => validar(doc, { dataset: outroFormato, tempo, ambiente: 'producao' }))).toBe(esperado);
    const fatos = { modelo: 55, tipo: 'venda', itens: [{ n: 1 }] } as const;
    expect(codigo(() => restringir(fatos, { dataset: outroFormato, tempo }))).toBe(esperado);
    const erro = await determinar(fatos, { dataset: outroFormato, tempo }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDadosIbsCbs);
    expect((erro as ErroDadosIbsCbs).code).toBe(esperado);
  });
});
