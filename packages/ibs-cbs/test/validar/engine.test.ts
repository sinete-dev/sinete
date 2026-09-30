/**
 * Segundo oráculo do motor: cada caso gravado da Calculadora (`packages/ibs-cbs/test/calcular/fixtures/oracle-cases.json`)
 * passa pelo `@sinete/ibs-cbs/calcular` e o resultado pelas regras da NT. O motor não pode gerar documento que a NT
 * rejeite, salvo nas regras que dependem de dados que o `Roc` não carrega (identificação da nota, data de emissão,
 * vínculos entre itens) ou das alíquotas simuladas, listadas abaixo com o motivo.
 */
import { describe, expect, test } from 'bun:test';
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import { carregarDataset } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO } from '@sinete/ibs-cbs-dados/bundled';
import { aliquotasOficiais } from '../../src/aliquotas/index.ts';
import type { OperacaoClassificada } from '../../src/calcular/index.ts';
import { calcularEm } from '../../src/calcular/index.ts';
import { documentoDoRoc, REGRAS, validar } from '../../src/validar/index.ts';
import fixture from '../calcular/fixtures/oracle-cases.json' with { type: 'json' };

const dataset = carregarDataset(DATASET_EMBARCADO);
const rates = aliquotasOficiais();

/** Regras que o `Roc` sozinho não tem como satisfazer, e o motivo. */
const OUT_OF_SCOPE: Readonly<Record<string, string>> = {
  'UB14-60': 'tipo de nota de débito e crédito vem da identificação da NF-e, não da classificação',
  'UB14-70': 'idem',
  'UB14-80': 'idem',
  'UB106-30': 'finalidade da nota',
  'UB106-31': 'tipo de nota de débito',
  'UB131-40': 'tipo de nota de crédito',
  'UB131-50': 'tipo de nota de crédito',
  'UB132-10': 'o gerador sorteia a competência sem olhar a data de emissão',
  'UB133-10': 'vínculo entre itens do documento, não do cálculo de cada item',
  'UB120-10':
    'o motor não restringe grupos por modelo além do vínculo cClassTrib x DF-e; a RV veda crédito presumido na NFC-e',
  'UB18-10': 'alíquotas simuladas a partir de 2027 diferem das da lei, de propósito',
  'UB37-10': 'idem',
  'UB56-10': 'idem',
};

/** Compra governamental a partir de 2027: a fórmula de pAliqEfet da NT não tem o art. 473 (nota da regra). */
const GOV_2027 = new Set(['UB28-10', 'UB47-10', 'UB66-10']);

interface FixtureCase {
  id: string;
  date: string;
  op: OperacaoClassificada;
  engine: Record<string, string> | { error: string };
}

describe('motor x regras da NT nos casos gravados', () => {
  // A NT 2025.002 é da NF-e e da NFC-e: os casos de outros modelos ficam de fora.
  const cases = (fixture.cases as unknown as FixtureCase[]).filter(
    (c) => !('error' in c.engine) && (c.op.modelo === 55 || c.op.modelo === 65),
  );

  test('as exceções citam regras que existem', () => {
    const ids = new Set(REGRAS.map((r) => r.id));
    for (const id of [...Object.keys(OUT_OF_SCOPE), ...GOV_2027]) expect(ids.has(id)).toBe(true);
    expect(cases.length).toBeGreaterThan(50);
  });

  for (const c of cases) {
    test(c.id, () => {
      const roc = calcularEm(c.op, { dataset, aliquotas: rates, data: c.date });
      const modelo = c.op.modelo as 55 | 65;
      const doc = documentoDoRoc(roc, {
        modelo,
        crt: 3,
        finNFe: 1,
        itens: c.op.itens.map((i) => ({ nItem: i.n, vProd: i.base })),
      });
      const t = relogioFixo(`${c.date}T12:00:00-03:00`);
      const report = validar(doc, {
        dataset,
        tempo: contextoDeTempo({ emissao: t }),
        ambiente: 'producao',
        ignorarAtivacao: true,
      });
      const gov2027 = c.op.compraGovernamental !== undefined && c.date >= '2027-01-01';
      const unexpected = report.violacoes.filter(
        (v) => !(v.regra in OUT_OF_SCOPE) && !(gov2027 && GOV_2027.has(v.regra)),
      );
      expect(unexpected).toEqual([]);
    });
  }

  // Casos fora da amostra do oráculo que já geraram documento inconsistente: alíquota informada de 4 casas com redução
  // e diferimento redistribuído na compra governamental.
  const synthetic: [string, OperacaoClassificada, string?][] = [
    [
      'alíquota informada de 4 casas com redução',
      {
        modelo: 55,
        local: { uf: 'SP', cMun: '3550308' },
        itens: [
          {
            n: 1,
            cst: '200',
            cClassTrib: '200034',
            base: '1000000.00',
            aliquotasInformadas: { CBS: '8.1234', IBSUF: '0.0537', IBSMun: '0.0461', motivo: 'teste' },
          },
        ],
      },
    ],
    [
      'diferimento de 50% em compra da União',
      {
        modelo: 55,
        local: { uf: 'SP', cMun: '3550308' },
        compraGovernamental: { tpEnteGov: 1 },
        itens: [
          {
            n: 1,
            cst: '510',
            cClassTrib: '510001',
            base: '1000.00',
            aliquotasInformadas: { CBS: '8.8', IBSUF: '0.05', IBSMun: '0.05', motivo: 'teste' },
            diferimento: { CBS: '50', IBSUF: '50', IBSMun: '50' },
          },
        ],
      },
    ],
    [
      'diferimento e devolução da CBS no mesmo item',
      {
        modelo: 55,
        local: { uf: 'SP', cMun: '3550308' },
        itens: [
          {
            n: 1,
            cst: '510',
            cClassTrib: '510001',
            base: '1.12',
            diferimento: { CBS: '33.33', IBSUF: '0', IBSMun: '0' },
            devolucaoDeTributo: { pDevTrib: '33.33' },
          },
        ],
      },
      '2026-10-10',
    ],
    [
      'resíduo do arredondamento na compra do Estado em 2029',
      {
        modelo: 55,
        local: { uf: 'SP', cMun: '3550308' },
        compraGovernamental: { tpEnteGov: 2 },
        itens: [
          {
            n: 1,
            cst: '000',
            cClassTrib: '000001',
            base: '1000000.00',
            aliquotasInformadas: { CBS: '9.2535', IBSUF: '1', IBSMun: '1', motivo: 'teste' },
          },
        ],
      },
      '2029-01-01',
    ],
    ...(['000001', '510001', '550001'] as const).map((code, i): [string, OperacaoClassificada, string] => [
      `transferência da CBS em compra do ${i === 1 ? 'Município' : 'Estado'} em 2029 (${code})`,
      {
        modelo: 55,
        local: { uf: 'SP', cMun: '3550308' },
        compraGovernamental: { tpEnteGov: i === 1 ? 4 : 2 },
        itens: [
          {
            n: 1,
            cst: code.slice(0, 3),
            cClassTrib: code,
            base: '1000000.00',
            aliquotasInformadas: { CBS: '8.1234', IBSUF: '0.0537', IBSMun: '0.0461', motivo: 'teste' },
            ...(code === '510001' ? { diferimento: { CBS: '50', IBSUF: '50', IBSMun: '50' } } : {}),
            ...(code === '550001' ? { regular: { cst: '000', cClassTrib: '000001' } } : {}),
          },
        ],
      },
      '2029-03-01',
    ]),
  ];
  for (const [name, op, date = '2027-03-01'] of synthetic) {
    test(name, () => {
      const roc = calcularEm(op, { dataset, aliquotas: rates, data: date });
      const doc = documentoDoRoc(roc, { modelo: 55, crt: 3, finNFe: 1 });
      const t = relogioFixo(`${date}T12:00:00-03:00`);
      const report = validar(doc, {
        dataset,
        tempo: contextoDeTempo({ emissao: t }),
        ambiente: 'producao',
        ignorarAtivacao: true,
      });
      const gov = op.compraGovernamental !== undefined;
      const unexpected = report.violacoes.filter((v) => !(v.regra in OUT_OF_SCOPE) && !(gov && GOV_2027.has(v.regra)));
      expect(unexpected).toEqual([]);
    });
  }

  test('crédito presumido em bem móvel usado passa pela UB120-20', () => {
    const credit = { cCredPres: 4, vBCCredPres: '100.00', ibs: { pCredPres: '0.05' }, cbs: { pCredPres: '1' } };
    const op: OperacaoClassificada = {
      modelo: 55,
      local: { uf: 'SP', cMun: '3550308' },
      itens: [
        {
          n: 1,
          cst: '000',
          cClassTrib: '000001',
          base: '100.00',
          aliquotasInformadas: { CBS: '8.8', IBSUF: '0.05', IBSMun: '0.05', motivo: 'teste' },
          creditoPresumido: { ...credit, bemMovelUsado: true },
        },
      ],
    };
    const roc = calcularEm(op, { dataset, aliquotas: rates, data: '2027-03-01' });
    const doc = documentoDoRoc(roc, {
      modelo: 55,
      crt: 3,
      finNFe: 1,
      itens: [{ nItem: 1, vProd: '100.00', bemMovelUsado: true }],
    });
    const time = contextoDeTempo({ emissao: relogioFixo('2027-03-01T12:00:00-03:00') });
    const report = validar(doc, { dataset, tempo: time, ambiente: 'producao', ignorarAtivacao: true });
    expect(report.violacoes.filter((v) => !(v.regra in OUT_OF_SCOPE))).toEqual([]);
  });

  test('só as regras pedidas são avaliadas', () => {
    const roc = calcularEm(
      {
        modelo: 55,
        local: { uf: 'RS', cMun: '4314902' },
        itens: [{ n: 1, cst: '000', cClassTrib: '000001', base: '1' }],
      },
      { dataset, aliquotas: rates, data: '2026-10-10' },
    );
    const doc = documentoDoRoc(roc, { modelo: 55, crt: 3, finNFe: 1 });
    const one = REGRAS.filter((r) => r.id === 'UB35-10');
    const report = validar(doc, {
      dataset,
      tempo: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }),
      ambiente: 'homologacao',
      regras: one,
    });
    expect(report.avaliadas).toEqual(['UB35-10']);
    expect(report.violacoes).toEqual([]);
  });
});
