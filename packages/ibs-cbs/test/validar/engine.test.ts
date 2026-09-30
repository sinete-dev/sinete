/**
 * Segundo oráculo do motor: cada caso gravado da Calculadora (`packages/ibs-cbs/test/calcular/fixtures/oracle-cases.json`)
 * passa pelo `@sinete/ibs-cbs/calcular` e o resultado pelas regras da NT. O motor não pode gerar documento que a NT
 * rejeite, salvo nas regras que dependem de dados que o `Roc` não carrega (identificação da nota, data de emissão,
 * vínculos entre itens) ou das alíquotas simuladas, listadas abaixo com o motivo.
 */
import { describe, expect, test } from 'bun:test';
import { contextoDeTempo, relogioFixo } from '@sinete/core';
import { loadDataset } from '@sinete/ibs-cbs-dados';
import { BUNDLED_DATASET } from '@sinete/ibs-cbs-dados/bundled';
import { officialRates } from '../../src/aliquotas/index.ts';
import type { ClassifiedOperation } from '../../src/calcular/index.ts';
import { calculateAt } from '../../src/calcular/index.ts';
import { documentFromRoc, RULES, validate } from '../../src/validar/index.ts';
import fixture from '../calcular/fixtures/oracle-cases.json' with { type: 'json' };

const dataset = loadDataset(BUNDLED_DATASET);
const rates = officialRates();

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
  op: ClassifiedOperation;
  engine: Record<string, string> | { error: string };
}

describe('motor x regras da NT nos casos gravados', () => {
  // A NT 2025.002 é da NF-e e da NFC-e: os casos de outros modelos ficam de fora.
  const cases = (fixture.cases as unknown as FixtureCase[]).filter(
    (c) => !('error' in c.engine) && (c.op.modelo === 55 || c.op.modelo === 65),
  );

  test('as exceções citam regras que existem', () => {
    const ids = new Set(RULES.map((r) => r.id));
    for (const id of [...Object.keys(OUT_OF_SCOPE), ...GOV_2027]) expect(ids.has(id)).toBe(true);
    expect(cases.length).toBeGreaterThan(50);
  });

  for (const c of cases) {
    test(c.id, () => {
      const roc = calculateAt(c.op, { dataset, rates, date: c.date });
      const modelo = c.op.modelo as 55 | 65;
      const doc = documentFromRoc(roc, {
        modelo,
        crt: 3,
        finNFe: 1,
        items: c.op.items.map((i) => ({ nItem: i.n, vProd: i.base })),
      });
      const t = relogioFixo(`${c.date}T12:00:00-03:00`);
      const report = validate(doc, {
        dataset,
        time: contextoDeTempo({ emissao: t }),
        ambiente: 'producao',
        ignoreActivation: true,
      });
      const gov2027 = c.op.governmentPurchase !== undefined && c.date >= '2027-01-01';
      const unexpected = report.violations.filter(
        (v) => !(v.rule in OUT_OF_SCOPE) && !(gov2027 && GOV_2027.has(v.rule)),
      );
      expect(unexpected).toEqual([]);
    });
  }

  // Casos fora da amostra do oráculo que já geraram documento inconsistente: alíquota informada de 4 casas com redução
  // e diferimento redistribuído na compra governamental.
  const synthetic: [string, ClassifiedOperation, string?][] = [
    [
      'alíquota informada de 4 casas com redução',
      {
        modelo: 55,
        place: { uf: 'SP', cMun: '3550308' },
        items: [
          {
            n: 1,
            cst: '200',
            cClassTrib: '200034',
            base: '1000000.00',
            informedRates: { CBS: '8.1234', IBSUF: '0.0537', IBSMun: '0.0461', reason: 'teste' },
          },
        ],
      },
    ],
    [
      'diferimento de 50% em compra da União',
      {
        modelo: 55,
        place: { uf: 'SP', cMun: '3550308' },
        governmentPurchase: { tpEnteGov: 1 },
        items: [
          {
            n: 1,
            cst: '510',
            cClassTrib: '510001',
            base: '1000.00',
            informedRates: { CBS: '8.8', IBSUF: '0.05', IBSMun: '0.05', reason: 'teste' },
            deferral: { CBS: '50', IBSUF: '50', IBSMun: '50' },
          },
        ],
      },
    ],
    [
      'diferimento e devolução da CBS no mesmo item',
      {
        modelo: 55,
        place: { uf: 'SP', cMun: '3550308' },
        items: [
          {
            n: 1,
            cst: '510',
            cClassTrib: '510001',
            base: '1.12',
            deferral: { CBS: '33.33', IBSUF: '0', IBSMun: '0' },
            taxRefund: { pDevTrib: '33.33' },
          },
        ],
      },
      '2026-10-10',
    ],
    [
      'resíduo do arredondamento na compra do Estado em 2029',
      {
        modelo: 55,
        place: { uf: 'SP', cMun: '3550308' },
        governmentPurchase: { tpEnteGov: 2 },
        items: [
          {
            n: 1,
            cst: '000',
            cClassTrib: '000001',
            base: '1000000.00',
            informedRates: { CBS: '9.2535', IBSUF: '1', IBSMun: '1', reason: 'teste' },
          },
        ],
      },
      '2029-01-01',
    ],
    ...(['000001', '510001', '550001'] as const).map((code, i): [string, ClassifiedOperation, string] => [
      `transferência da CBS em compra do ${i === 1 ? 'Município' : 'Estado'} em 2029 (${code})`,
      {
        modelo: 55,
        place: { uf: 'SP', cMun: '3550308' },
        governmentPurchase: { tpEnteGov: i === 1 ? 4 : 2 },
        items: [
          {
            n: 1,
            cst: code.slice(0, 3),
            cClassTrib: code,
            base: '1000000.00',
            informedRates: { CBS: '8.1234', IBSUF: '0.0537', IBSMun: '0.0461', reason: 'teste' },
            ...(code === '510001' ? { deferral: { CBS: '50', IBSUF: '50', IBSMun: '50' } } : {}),
            ...(code === '550001' ? { regular: { cst: '000', cClassTrib: '000001' } } : {}),
          },
        ],
      },
      '2029-03-01',
    ]),
  ];
  for (const [name, op, date = '2027-03-01'] of synthetic) {
    test(name, () => {
      const roc = calculateAt(op, { dataset, rates, date });
      const doc = documentFromRoc(roc, { modelo: 55, crt: 3, finNFe: 1 });
      const t = relogioFixo(`${date}T12:00:00-03:00`);
      const report = validate(doc, {
        dataset,
        time: contextoDeTempo({ emissao: t }),
        ambiente: 'producao',
        ignoreActivation: true,
      });
      const gov = op.governmentPurchase !== undefined;
      const unexpected = report.violations.filter((v) => !(v.rule in OUT_OF_SCOPE) && !(gov && GOV_2027.has(v.rule)));
      expect(unexpected).toEqual([]);
    });
  }

  test('crédito presumido em bem móvel usado passa pela UB120-20', () => {
    const credit = { cCredPres: 4, vBCCredPres: '100.00', ibs: { pCredPres: '0.05' }, cbs: { pCredPres: '1' } };
    const op: ClassifiedOperation = {
      modelo: 55,
      place: { uf: 'SP', cMun: '3550308' },
      items: [
        {
          n: 1,
          cst: '000',
          cClassTrib: '000001',
          base: '100.00',
          informedRates: { CBS: '8.8', IBSUF: '0.05', IBSMun: '0.05', reason: 'teste' },
          presumedCredit: { ...credit, usedMovableGood: true },
        },
      ],
    };
    const roc = calculateAt(op, { dataset, rates, date: '2027-03-01' });
    const doc = documentFromRoc(roc, {
      modelo: 55,
      crt: 3,
      finNFe: 1,
      items: [{ nItem: 1, vProd: '100.00', usedMovableGood: true }],
    });
    const time = contextoDeTempo({ emissao: relogioFixo('2027-03-01T12:00:00-03:00') });
    const report = validate(doc, { dataset, time, ambiente: 'producao', ignoreActivation: true });
    expect(report.violations.filter((v) => !(v.rule in OUT_OF_SCOPE))).toEqual([]);
  });

  test('só as regras pedidas são avaliadas', () => {
    const roc = calculateAt(
      {
        modelo: 55,
        place: { uf: 'RS', cMun: '4314902' },
        items: [{ n: 1, cst: '000', cClassTrib: '000001', base: '1' }],
      },
      { dataset, rates, date: '2026-10-10' },
    );
    const doc = documentFromRoc(roc, { modelo: 55, crt: 3, finNFe: 1 });
    const one = RULES.filter((r) => r.id === 'UB35-10');
    const report = validate(doc, {
      dataset,
      time: contextoDeTempo({ emissao: relogioFixo('2026-10-10T12:00:00-03:00') }),
      ambiente: 'homologacao',
      rules: one,
    });
    expect(report.evaluated).toEqual(['UB35-10']);
    expect(report.violations).toEqual([]);
  });
});
