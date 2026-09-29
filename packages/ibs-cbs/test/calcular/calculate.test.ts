import { describe, expect, test } from 'bun:test';
import { fixedClock, timeContext } from '@sinete/core';
import { loadDataset } from '@sinete/ibs-cbs-dados';
import { BUNDLED_DATASET } from '@sinete/ibs-cbs-dados/bundled';
import { officialRates, RateUnknownError, withOverrides } from '../../src/aliquotas/index.ts';
import type { ClassifiedItem, ClassifiedOperation, Roc } from '../../src/calcular/index.ts';
import {
  ClassificationError,
  calculate,
  calculateAt,
  Decimal,
  UnsupportedRegimeError,
} from '../../src/calcular/index.ts';

const dataset = loadDataset(BUNDLED_DATASET);
const rates = officialRates();
const place = { uf: 'RS', cMun: '4314902' };
const op = (items: ClassifiedItem[], extra: Partial<ClassifiedOperation> = {}): ClassifiedOperation => ({
  modelo: 55,
  place,
  items,
  ...extra,
});
const at = (o: ClassifiedOperation, date = '2026-09-25'): Roc => calculateAt(o, { dataset, rates, date });
const simulate = (cbs: string) => ({ CBS: cbs, IBSUF: '0.05', IBSMun: '0.05', reason: 'teste de simulação' });

function classificationError(fn: () => unknown): ClassificationError {
  try {
    fn();
  } catch (e) {
    if (e instanceof ClassificationError) return e;
    throw e;
  }
  throw new Error('não lançou');
}

describe('tributação integral e reduções (2026)', () => {
  test('000001: CBS 0,9% e IBS UF 0,1% sobre a base', () => {
    const roc = at(op([{ n: 1, cst: '000', cClassTrib: '000001', base: '1000.00' }]));
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    expect(g).toEqual({
      vBC: '1000.00',
      gIBSUF: { pIBSUF: '0.10', vIBSUF: '1.00' },
      gIBSMun: { pIBSMun: '0.00', vIBSMun: '0.00' },
      vIBS: '1.00',
      gCBS: { pCBS: '0.90', vCBS: '9.00' },
    });
    expect(roc.items[0]?.rates.map((r) => [r.tributo, r.value, r.status, r.origin])).toEqual([
      ['CBS', '0.9', 'official', 'provider-nominal'],
      ['IBSUF', '0.1', 'official', 'provider-nominal'],
      ['IBSMun', '0', 'official', 'provider-nominal'],
    ]);
    expect(roc.simulated).toBe(false);
    expect(roc.asOf).toBe('2026-09-25');
    expect(roc.contentVersion).toBe(dataset.contentVersion);
    expect(roc.total.IBSCBSTot.gCBS.vCBS).toBe('9.00');
    expect(roc.trace.length).toBeGreaterThan(0);
  });

  test('HALF_EVEN nos centavos: 0,9% de 1234,55 = 11,11095 -> 11,11; 0,1% de 5,00 = 0,005 -> 0,00', () => {
    const roc = at(
      op([
        { n: 1, cst: '000', cClassTrib: '000001', base: '1234.55' },
        { n: 2, cst: '000', cClassTrib: '000001', base: '5.00' },
        { n: 3, cst: '000', cClassTrib: '000001', base: '15.00' },
      ]),
    );
    expect(roc.items[0]?.IBSCBS.gIBSCBS?.gCBS.vCBS).toBe('11.11');
    expect(roc.items[1]?.IBSCBS.gIBSCBS?.gIBSUF.vIBSUF).toBe('0.00');
    // 0,1% de 15,00 = 0,015 -> 0,02 (empate, o par é 2)
    expect(roc.items[2]?.IBSCBS.gIBSCBS?.gIBSUF.vIBSUF).toBe('0.02');
    // Totais somam os valores de 2 casas (W41-10): 1,23 + 0,00 + 0,02
    expect(roc.total.IBSCBSTot.gIBS.gIBSUF.vIBSUF).toBe('1.25');
    expect(roc.total.IBSCBSTot.vBCIBSCBS).toBe('1254.55');
  });

  test('200034 (redução de 60%): gRed com pAliqEfet', () => {
    const roc = at(op([{ n: 1, cst: '200', cClassTrib: '200034', base: '1000.00' }]));
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    expect(g?.gCBS).toEqual({ pCBS: '0.90', gRed: { pRedAliq: '60.00', pAliqEfet: '0.36' }, vCBS: '3.60' });
    expect(g?.gIBSUF).toEqual({ pIBSUF: '0.10', gRed: { pRedAliq: '60.00', pAliqEfet: '0.04' }, vIBSUF: '0.40' });
  });

  test('222001 (redução de base de 50%): vBC é metade da base informada', () => {
    const roc = at(op([{ n: 1, cst: '222', cClassTrib: '222001', base: '4.83' }], { modelo: 63 }));
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    // 2,415 -> 2,42 na saída; CBS 0,9% de 2,415 = 0,021735 -> 0,02
    expect(g?.vBC).toBe('2.42');
    expect(g?.gCBS.vCBS).toBe('0.02');
  });

  test('221001 (alíquota fixa do dataset): 3,285% de CBS', () => {
    const roc = at(op([{ n: 1, cst: '221', cClassTrib: '221001', base: '1000.00' }], { modelo: 91 }));
    const r = roc.items[0];
    expect(r?.IBSCBS.gIBSCBS?.gCBS).toEqual({ pCBS: '3.285', vCBS: '32.85' });
    expect(r?.rates.find((x) => x.tributo === 'CBS')?.origin).toBe('dataset-fixed');
  });

  test('011001 (uniforme nacional de referência, com redução)', () => {
    const roc = at(op([{ n: 1, cst: '011', cClassTrib: '011001', base: '200.00' }], { modelo: 94 }));
    const r = roc.items[0];
    expect(r?.rates.every((x) => x.origin === 'provider-reference')).toBe(true);
    expect(r?.IBSCBS.gIBSCBS?.gCBS.gRed).toEqual({ pRedAliq: '60.00', pAliqEfet: '0.36' });
  });

  test('410: sem gIBSCBS, só CST e cClassTrib', () => {
    const roc = at(op([{ n: 1, cst: '410', cClassTrib: '410001', base: '100.00' }]));
    expect(roc.items[0]?.IBSCBS).toEqual({ CST: '410', cClassTrib: '410001' });
    expect(roc.items[0]?.rates).toEqual([]);
    expect(roc.total.IBSCBSTot.vBCIBSCBS).toBe('0.00');
  });
});

describe('diferimento, devolução e tributação regular', () => {
  test('510001: diferimento de 100% do tratamento', () => {
    const roc = at(op([{ n: 1, cst: '510', cClassTrib: '510001', base: '1000.00' }]));
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    expect(g?.gCBS).toEqual({ pCBS: '0.90', gDif: { pDif: '100.00', vDif: '9.00' }, vCBS: '0.00' });
    expect(roc.total.IBSCBSTot.gCBS.vDif).toBe('9.00');
    expect(roc.total.IBSCBSTot.gIBS.gIBSUF.vDif).toBe('1.00');
  });

  test('515001: percentual de diferimento informado por tributo', () => {
    const roc = at(
      op([
        { n: 1, cst: '515', cClassTrib: '515001', base: '1000.00', deferral: { CBS: '40', IBSUF: '100', IBSMun: '0' } },
      ]),
    );
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    // alíquota efetiva 0,36%: 3,60 de CBS, 40% diferido = 1,44, devido 2,16
    expect(g?.gCBS).toEqual({
      pCBS: '0.90',
      gDif: { pDif: '40.00', vDif: '1.44' },
      gRed: { pRedAliq: '60.00', pAliqEfet: '0.36' },
      vCBS: '2.16',
    });
    expect(g?.gIBSUF.vIBSUF).toBe('0.00');
  });

  test('devolução da CBS (gDevTrib)', () => {
    const roc = at(op([{ n: 1, cst: '000', cClassTrib: '000001', base: '1000.00', taxRefund: { pDevTrib: '20' } }]));
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    expect(g?.gCBS).toEqual({ pCBS: '0.90', gDevTrib: { pDevTrib: '20.00', vDevTrib: '1.80' }, vCBS: '7.20' });
    expect(roc.total.IBSCBSTot.gCBS.vDevTrib).toBe('1.80');
  });

  test('550001 com tributação regular 000001: grupo principal zerado e gTribRegular', () => {
    const roc = at(
      op([{ n: 1, cst: '550', cClassTrib: '550001', base: '999.99', regular: { cst: '000', cClassTrib: '000001' } }]),
    );
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    expect(g?.gCBS).toEqual({ pCBS: '0.00', vCBS: '0.00' });
    expect(g?.gTribRegular).toEqual({
      CSTReg: '000',
      cClassTribReg: '000001',
      pAliqEfetRegIBSUF: '0.10',
      vTribRegIBSUF: '1.00',
      pAliqEfetRegIBSMun: '0.00',
      vTribRegIBSMun: '0.00',
      pAliqEfetRegCBS: '0.90',
      vTribRegCBS: '9.00',
    });
  });

  test('tributação regular com redução aplica pRed na alíquota efetiva regular', () => {
    const roc = at(
      op([{ n: 1, cst: '550', cClassTrib: '550001', base: '100.00', regular: { cst: '200', cClassTrib: '200034' } }]),
    );
    expect(roc.items[0]?.IBSCBS.gIBSCBS?.gTribRegular?.pAliqEfetRegCBS).toBe('0.36');
    expect(roc.items[0]?.IBSCBS.gIBSCBS?.gTribRegular?.vTribRegCBS).toBe('0.36');
    expect(roc.items[0]?.IBSCBS.gIBSCBS?.gCBS.gRed).toBeUndefined();
  });

  test('200024 com tributação regular: gRed com o pRedAliq da tabela e alíquota efetiva zero (UB26-20, UB27-10)', () => {
    const item = {
      n: 1,
      cst: '200',
      cClassTrib: '200024',
      base: '100.00',
      regular: { cst: '000', cClassTrib: '000001' },
    };
    const g = at(op([item])).items[0]?.IBSCBS.gIBSCBS;
    expect(g?.gCBS).toEqual({ pCBS: '0.00', gRed: { pRedAliq: '100.00', pAliqEfet: '0.00' }, vCBS: '0.00' });
    expect(g?.gTribRegular?.vTribRegCBS).toBe('0.90');
    const gov = at(op([item], { governmentPurchase: { tpEnteGov: 1 } })).items[0]?.IBSCBS.gIBSCBS;
    expect(gov?.gIBSUF.gRed).toEqual({ pRedAliq: '100.00', pAliqEfet: '0.00' });
  });
});

describe('compras governamentais', () => {
  test('2026: cada ente com o seu, gRed com pRedAliq 0 mesmo sem gRed na CST', () => {
    const roc = at(
      op([{ n: 1, cst: '000', cClassTrib: '000001', base: '1000.00' }], {
        governmentPurchase: { tpEnteGov: 2, tpOperGov: 1 },
      }),
    );
    expect(roc.oper).toEqual({ gCompraGov: { tpEnteGov: 2, pRedutor: '0.00', tpOperGov: 1 } });
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    expect(g?.gCBS).toEqual({ pCBS: '0.90', gRed: { pRedAliq: '0.00', pAliqEfet: '0.90' }, vCBS: '9.00' });
    expect(g?.gTribCompraGov).toEqual({
      pAliqIBSUF: '0.10',
      vTribIBSUF: '1.00',
      pAliqIBSMun: '0.00',
      vTribIBSMun: '0.00',
      pAliqCBS: '0.90',
      vTribCBS: '9.00',
    });
  });

  const gov2027 = (tpEnteGov: 1 | 2 | 3 | 4 | 5 | 6) =>
    at(
      op([{ n: 1, cst: '000', cClassTrib: '000001', base: '1000.00', informedRates: simulate('8.8') }], {
        governmentPurchase: { tpEnteGov },
      }),
      '2027-03-10',
    ).items[0]?.IBSCBS.gIBSCBS;

  test('2027, União: CBS fica com tudo e o IBS zera (art. 473)', () => {
    const g = gov2027(1);
    expect(g?.gCBS).toEqual({ pCBS: '8.80', gRed: { pRedAliq: '0.00', pAliqEfet: '8.90' }, vCBS: '89.00' });
    expect(g?.gIBSUF).toEqual({ pIBSUF: '0.05', gRed: { pRedAliq: '0.00', pAliqEfet: '0.00' }, vIBSUF: '0.00' });
    expect(g?.gTribCompraGov?.vTribCBS).toBe('88.00');
  });

  test('2027, Estado e DF: IBS UF recebe o IBS municipal (transferência da CBS é 0 até 2028)', () => {
    for (const tp of [2, 3] as const) {
      const g = gov2027(tp);
      expect(g?.gIBSUF.gRed?.pAliqEfet).toBe('0.10');
      expect(g?.gIBSUF.vIBSUF).toBe('1.00');
      expect(g?.gIBSMun.vIBSMun).toBe('0.00');
      expect(g?.gCBS.vCBS).toBe('88.00');
    }
  });

  test('2027, Município, consórcio e CGIBS: IBS municipal recebe o estadual', () => {
    for (const tp of [4, 5, 6] as const) {
      const g = gov2027(tp);
      expect(g?.gIBSMun.gRed?.pAliqEfet).toBe('0.10');
      expect(g?.gIBSMun.vIBSMun).toBe('1.00');
      expect(g?.gIBSUF.vIBSUF).toBe('0.00');
    }
  });

  test('compra governamental com tributação regular: principal zerado, regular com o valor efetivo', () => {
    const g = at(
      op([{ n: 1, cst: '550', cClassTrib: '550001', base: '1000.00', regular: { cst: '000', cClassTrib: '000001' } }], {
        governmentPurchase: { tpEnteGov: 1 },
      }),
    ).items[0]?.IBSCBS.gIBSCBS;
    expect(g?.gCBS).toEqual({ pCBS: '0.00', gRed: { pRedAliq: '0.00', pAliqEfet: '0.00' }, vCBS: '0.00' });
    expect(g?.gTribRegular?.vTribRegCBS).toBe('9.00');
    expect(g?.gTribCompraGov?.vTribCBS).toBe('0.00');
  });
});

describe('alíquotas desconhecidas e simulação', () => {
  test('2027 sem alíquota da CBS: RateUnknownError, nunca zero', () => {
    expect(() => at(op([{ n: 1, cst: '000', cClassTrib: '000001', base: '1.00' }]), '2027-01-01')).toThrow(
      RateUnknownError,
    );
  });

  test('2027 com alíquota informada: calcula e marca simulado, com motivo', () => {
    const roc = at(
      op([{ n: 1, cst: '000', cClassTrib: '000001', base: '1000.00', informedRates: simulate('8.8') }]),
      '2027-01-01',
    );
    expect(roc.simulated).toBe(true);
    expect(roc.items[0]?.IBSCBS.gIBSCBS?.gCBS.vCBS).toBe('88.00');
    expect(roc.items[0]?.rates[0]).toMatchObject({
      status: 'user-provided',
      origin: 'informed',
      reason: 'teste de simulação',
    });
  });

  test('2027 com provedor sobreposto (withOverrides): IBS oficial, CBS informada', () => {
    const provider = withOverrides(rates, [{ tributo: 'CBS', value: '8.8', reason: 'estimativa' }]);
    const roc = calculateAt(op([{ n: 1, cst: '000', cClassTrib: '000001', base: '100.00' }]), {
      dataset,
      rates: provider,
      date: '2028-02-01',
    });
    expect(roc.items[0]?.rates.map((r) => r.status)).toEqual(['user-provided', 'official', 'official']);
    expect(roc.items[0]?.IBSCBS.gIBSCBS?.vIBS).toBe('0.10');
    expect(roc.ratesId).toContain('informada');
  });

  test('alíquota fixa sem valor no dataset (2027): pede alíquota informada', () => {
    expect(() =>
      at(op([{ n: 1, cst: '221', cClassTrib: '221001', base: '1.00' }], { modelo: 91 }), '2027-05-05'),
    ).toThrow(RateUnknownError);
  });

  test('alíquota informada prevalece sobre expressão fixa do tratamento', () => {
    const roc = at(
      op([{ n: 1, cst: '221', cClassTrib: '221001', base: '1000.00', informedRates: simulate('3') }], { modelo: 91 }),
      '2027-05-05',
    );
    expect(roc.items[0]?.IBSCBS.gIBSCBS?.gCBS.vCBS).toBe('30.00');
  });
});

describe('grupos informados', () => {
  test('800001: transferência de crédito', () => {
    const roc = at(
      op([{ n: 1, cst: '800', cClassTrib: '800001', base: '0.00', creditTransfer: { vIBS: '10', vCBS: '90.5' } }]),
    );
    expect(roc.items[0]?.IBSCBS).toEqual({
      CST: '800',
      cClassTrib: '800001',
      gTransfCred: { vIBS: '10.00', vCBS: '90.50' },
    });
  });

  test('811001: ajuste de competência', () => {
    const roc = at(
      op([
        {
          n: 1,
          cst: '811',
          cClassTrib: '811001',
          base: '0.00',
          competenceAdjustment: { competApur: '2026-08', vIBS: '1', vCBS: '2' },
        },
      ]),
    );
    expect(roc.items[0]?.IBSCBS.gAjusteCompet).toEqual({ competApur: '2026-08', vIBS: '1.00', vCBS: '2.00' });
  });

  test('810001: crédito presumido do IBS na ZFM', () => {
    const roc = at(
      op([
        {
          n: 1,
          cst: '810',
          cClassTrib: '810001',
          base: '0.00',
          zfmCredit: { competApur: '2026-08', tpCredPresIBSZFM: 2, vCredPresIBSZFM: '123.4' },
        },
      ]),
    );
    expect(roc.items[0]?.IBSCBS.gCredPresIBSZFM).toEqual({
      competApur: '2026-08',
      tpCredPresIBSZFM: 2,
      vCredPresIBSZFM: '123.40',
    });
  });

  test('estorno de crédito exigido pelo cClassTrib e somado no total', () => {
    const roc = at(
      op([
        {
          n: 1,
          cst: '410',
          cClassTrib: '410026',
          base: '1.00',
          creditReversal: { vIBSEstCred: '1.5', vCBSEstCred: '2' },
        },
        {
          n: 2,
          cst: '410',
          cClassTrib: '410026',
          base: '1.00',
          creditReversal: { vIBSEstCred: '1', vCBSEstCred: '0' },
        },
      ]),
    );
    expect(roc.total.IBSCBSTot.gEstornoCred).toEqual({ vIBSEstCred: '2.50', vCBSEstCred: '2.00' });
  });

  test('crédito presumido da operação abatido do vIBS quando indDeduzCredPres', () => {
    const allowed = dataset.tables.classTrib.find(
      (c) => c.family === 'CBS_IBS' && c.groups.gCredPresOper === 'allowed',
    );
    if (!allowed) throw new Error('dataset sem cClassTrib que permita crédito presumido');
    const roc = at(
      op([
        {
          n: 1,
          cst: allowed.cst,
          cClassTrib: allowed.code,
          base: '100000.00',
          informedRates: simulate('8.8'),
          presumedCredit: { cCredPres: 11, vBCCredPres: '1000.00', ibs: { pCredPres: '5' } },
        },
      ]),
      '2027-06-01',
    );
    const it = roc.items[0]?.IBSCBS;
    expect(it?.gCredPresOper).toEqual({
      vBCCredPres: '1000.00',
      cCredPres: 11,
      gIBSCredPres: { pCredPres: '5.00', vCredPres: '50.00' },
    });
    const g = it?.gIBSCBS;
    const expected = (Number(g?.gIBSUF.vIBSUF) + Number(g?.gIBSMun.vIBSMun) - 50).toFixed(2);
    expect(g?.vIBS).toBe(expected);
    expect(roc.total.IBSCBSTot.gIBS.vCredPres).toBe('50.00');
  });

  test('crédito presumido em condição suspensiva vai em vCredPresCondSus', () => {
    const allowed = dataset.tables.classTrib.find(
      (c) => c.family === 'CBS_IBS' && c.groups.gCredPresOper === 'allowed',
    );
    if (!allowed) throw new Error('dataset sem cClassTrib que permita crédito presumido');
    const roc = at(
      op([
        {
          n: 1,
          cst: allowed.cst,
          cClassTrib: allowed.code,
          base: '10000.00',
          informedRates: simulate('8.8'),
          presumedCredit: {
            cCredPres: 4,
            vBCCredPres: '100.00',
            ibs: { pCredPres: '1' },
            cbs: { pCredPres: '2', conditional: true },
          },
        },
      ]),
      '2027-06-01',
    );
    expect(roc.items[0]?.IBSCBS.gCredPresOper?.gCBSCredPres).toEqual({ pCredPres: '2.00', vCredPresCondSus: '2.00' });
    expect(roc.total.IBSCBSTot.gCBS.vCredPresCondSus).toBe('2.00');
  });
});

describe('recusas tipadas', () => {
  const one = (item: Partial<ClassifiedItem>, date = '2026-09-25', extra: Partial<ClassifiedOperation> = {}) =>
    classificationError(() => at(op([{ n: 1, cst: '000', cClassTrib: '000001', base: '1.00', ...item }], extra), date));

  test('códigos inexistentes, fora da CST ou fora do modelo', () => {
    expect(one({ cst: '999' }).reason).toBe('cst_inexistente');
    expect(one({ cClassTrib: '999999' }).reason).toBe('cclasstrib_inexistente');
    expect(one({ cClassTrib: '200034' }).reason).toBe('cclasstrib_fora_da_cst');
    expect(one({ cst: '011', cClassTrib: '011001' }).reason).toBe('nao_habilitado_no_dfe');
    expect(one({ cst: '220', cClassTrib: '220001' }, '2026-09-25', { modelo: 77 }).reason).toBe(
      'cclasstrib_inexistente',
    );
    const e = one({ cst: '999' });
    expect(e.code).toBe('ibscbs_classificacao_invalida');
    expect(e.item).toBe(1);
    expect(e.details).toMatchObject({ reason: 'cst_inexistente', item: 1 });
  });

  test('tributação regular exigida, vedada ou inválida', () => {
    expect(one({ cst: '550', cClassTrib: '550001' }).reason).toBe('tributacao_regular_obrigatoria');
    expect(one({ regular: { cst: '000', cClassTrib: '000001' } }).reason).toBe('grupo_vedado');
    expect(one({ cst: '550', cClassTrib: '550001', regular: { cst: '550', cClassTrib: '550003' } }).reason).toBe(
      'tributacao_regular_invalida',
    );
    expect(one({ cst: '550', cClassTrib: '550001', regular: { cst: '410', cClassTrib: '410001' } }).reason).toBe(
      'tributacao_regular_invalida',
    );
  });

  test('grupos exigidos, vedados e exclusivos', () => {
    expect(one({ cst: '800', cClassTrib: '800001' }).reason).toBe('grupo_obrigatorio');
    expect(one({ creditTransfer: { vIBS: '1', vCBS: '1' } }).reason).toBe('grupo_vedado');
    expect(one({ creditReversal: { vIBSEstCred: '1', vCBSEstCred: '1' } }).reason).toBe('grupo_vedado');
    expect(one({ presumedCredit: { cCredPres: 1, vBCCredPres: '1' } }).reason).toBe('grupo_vedado');
    expect(one({ deferral: { CBS: '10' } }).reason).toBe('grupo_vedado');
    expect(one({ cst: '410', cClassTrib: '410001', taxRefund: { pDevTrib: '10' } }).reason).toBe('grupo_vedado');
    expect(
      one({
        cst: '810',
        cClassTrib: '810001',
        zfmCredit: { competApur: '2026-01', tpCredPresIBSZFM: 1, vCredPresIBSZFM: '1' },
        presumedCredit: { cCredPres: 1, vBCCredPres: '1' },
      }).reason,
    ).toMatch(/grupo_vedado|grupos_exclusivos/);
  });

  test('crédito presumido inexistente, fora de vigência e sem o grupo do tributo', () => {
    const allowed = dataset.tables.classTrib.find(
      (c) => c.family === 'CBS_IBS' && c.groups.gCredPresOper === 'allowed',
    );
    if (!allowed) throw new Error('dataset sem cClassTrib que permita crédito presumido');
    const base = { cst: allowed.cst, cClassTrib: allowed.code, informedRates: simulate('8.8') };
    expect(one({ ...base, presumedCredit: { cCredPres: 99, vBCCredPres: '1' } }, '2027-06-01').reason).toBe(
      'ccredpres_inexistente',
    );
    expect(
      one({ cst: allowed.cst, cClassTrib: allowed.code, presumedCredit: { cCredPres: 1, vBCCredPres: '1' } }).reason,
    ).toBe('ccredpres_fora_de_vigencia');
    expect(one({ ...base, presumedCredit: { cCredPres: 1, vBCCredPres: '1' } }, '2027-06-01').reason).toBe(
      'grupo_obrigatorio',
    );
    expect(
      one(
        {
          ...base,
          presumedCredit: { cCredPres: 3, vBCCredPres: '1', cbs: { pCredPres: '1' }, ibs: { pCredPres: '1' } },
        },
        '2027-06-01',
      ).reason,
    ).toBe('ccredpres_fora_de_vigencia');
    expect(
      one(
        { ...base, base: '1.00', presumedCredit: { cCredPres: 11, vBCCredPres: '1000000', ibs: { pCredPres: '100' } } },
        '2027-06-01',
      ).reason,
    ).toBe('entrada_invalida');
  });

  test('entradas inválidas', () => {
    expect(one({ base: '-1' }).reason).toBe('entrada_invalida');
    expect(one({ base: '1,00' }).reason).toBe('entrada_invalida');
    expect(one({ quantity: 'x' }).reason).toBe('entrada_invalida');
    expect(one({ informedRates: { CBS: '101', reason: 'x' } }, '2027-01-01').reason).toBe('entrada_invalida');
    expect(one({ informedRates: { CBS: '1', reason: ' ' } }, '2027-01-01').reason).toBe('entrada_invalida');
    expect(one({ taxRefund: { pDevTrib: '120' } }).reason).toBe('entrada_invalida');
    expect(
      one({ cst: '515', cClassTrib: '515001', deferral: { CBS: '100' }, taxRefund: { pDevTrib: '50' } }).reason,
    ).toBe('entrada_invalida');
    expect(
      one({ cst: '811', cClassTrib: '811001', competenceAdjustment: { competApur: '2026-13', vIBS: '1', vCBS: '1' } })
        .reason,
    ).toBe('entrada_invalida');
    expect(
      one({
        cst: '810',
        cClassTrib: '810001',
        zfmCredit: { competApur: '2026-1', tpCredPresIBSZFM: 1, vCredPresIBSZFM: '1' },
      }).reason,
    ).toBe('entrada_invalida');
    expect(
      one({
        cst: '810',
        cClassTrib: '810001',
        zfmCredit: { competApur: '2026-01', tpCredPresIBSZFM: 7 as 1, vCredPresIBSZFM: '1' },
      }).reason,
    ).toBe('entrada_invalida');
    const bad = (o: unknown) => classificationError(() => at(o as ClassifiedOperation)).reason;
    expect(bad({ modelo: 55, place, items: [] })).toBe('entrada_invalida');
    expect(bad(null)).toBe('entrada_invalida');
    expect(bad({ modelo: 'x', place, items: [{ n: 1 }] })).toBe('entrada_invalida');
    expect(bad({ modelo: 55, place: { uf: 'RS', cMun: '43' }, items: [{ n: 1 }] })).toBe('entrada_invalida');
    expect(bad({ modelo: 55, place, items: [{ n: 0 }] })).toBe('entrada_invalida');
    expect(bad({ modelo: 55, place, items: [{ n: 1 }, { n: 1 }] })).toBe('entrada_invalida');
    expect(
      bad({
        modelo: 55,
        place,
        governmentPurchase: { tpEnteGov: 9 },
        items: [{ n: 1, cst: '000', cClassTrib: '000001', base: '1' }],
      }),
    ).toBe('entrada_invalida');
  });

  test('regimes não suportados lançam UnsupportedRegimeError', () => {
    const unsupported = (item: Partial<ClassifiedItem>, date = '2026-09-25') => {
      try {
        at(op([{ n: 1, cst: '000', cClassTrib: '000001', base: '1.00', ...item }]), date);
      } catch (e) {
        if (e instanceof UnsupportedRegimeError) return e;
        throw e;
      }
      throw new Error('não lançou');
    };
    expect(unsupported({ cst: '620', cClassTrib: '620001' }).regime).toBe('monofasia');
    expect(unsupported({ monophase: {} }).regime).toBe('monofasia');
    expect(unsupported({ selectiveTax: {} }).regime).toBe('imposto-seletivo');
    const e = unsupported({ cst: '830', cClassTrib: '830001' });
    expect(e.regime).toBe('ajuste');
    expect(e.code).toBe('ibscbs_regime_nao_suportado');
    expect(e.item).toBe(1);
    expect(
      unsupported({ cst: '550', cClassTrib: '550001', regular: { cst: '620', cClassTrib: '620001' } }).regime,
    ).toBe('monofasia');
  });
});

describe('relógio de fato gerador', () => {
  test('a data dos dados vem do relógio de fato gerador no fuso do local', () => {
    const o = op([{ n: 1, cst: '000', cClassTrib: '000001', base: '100.00' }]);
    // 01/01/2027 01:30 UTC ainda é 31/12/2026 em Brasília: vale a alíquota de 2026.
    const time = timeContext({
      emissao: fixedClock('2027-01-05T10:00:00Z'),
      fatoGerador: fixedClock('2027-01-01T01:30:00Z'),
    });
    const roc = calculate(o, { dataset, rates, time });
    expect(roc.asOf).toBe('2026-12-31');
    expect(roc.items[0]?.IBSCBS.gIBSCBS?.gCBS.vCBS).toBe('0.90');
    // Em UTC já é 2027: sem alíquota da CBS.
    expect(() => calculate(o, { dataset, rates, time, utcOffsetMinutes: 0 })).toThrow(RateUnknownError);
  });

  test('itens saem em ordem de nItem', () => {
    const roc = at(
      op([
        { n: 2, cst: '000', cClassTrib: '000001', base: '1.00' },
        { n: 1, cst: '410', cClassTrib: '410001', base: '1.00' },
      ]),
    );
    expect(roc.items.map((i) => i.nItem)).toEqual([1, 2]);
  });
});

describe('precisão da alíquota emitida', () => {
  test('o valor sai da alíquota efetiva com 4 casas, a mesma do XML (UB67-10)', () => {
    const roc = at(
      op([{ n: 1, cst: '200', cClassTrib: '200034', base: '1000000.00', informedRates: simulate('8.1234') }]),
      '2027-03-01',
    );
    const g = roc.items[0]?.IBSCBS.gIBSCBS?.gCBS;
    expect(g?.gRed).toEqual({ pRedAliq: '60.00', pAliqEfet: '3.2494' });
    expect(g?.vCBS).toBe('32494.00');
  });
});

describe('compra governamental a partir de 2027 com diferimento e devolução', () => {
  const gov = { governmentPurchase: { tpEnteGov: 1 as const } };

  test('o diferimento acompanha a redistribuição do art. 473', () => {
    const roc = at(
      op(
        [
          {
            n: 1,
            cst: '510',
            cClassTrib: '510001',
            base: '1000.00',
            informedRates: simulate('8.8'),
            deferral: { CBS: '50', IBSUF: '50', IBSMun: '50' },
          },
        ],
        gov,
      ),
      '2027-03-01',
    );
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    expect(g?.gIBSUF.gDif).toEqual({ pDif: '50.00', vDif: '0.00' });
    expect(g?.gIBSUF.vIBSUF).toBe('0.00');
    expect(g?.gCBS.gDif).toEqual({ pDif: '50.00', vDif: '44.50' });
    expect(g?.gCBS.gRed?.pAliqEfet).toBe('8.90');
    expect(g?.gCBS.vCBS).toBe('44.50');
    expect(roc.total.IBSCBSTot.gCBS.vDif).toBe('44.50');
    expect(roc.total.IBSCBSTot.gIBS.gIBSUF.vDif).toBe('0.00');
  });

  test('percentuais de diferimento diferentes e devolução não têm regra publicada', () => {
    const deferral = classificationError(() =>
      at(
        op(
          [
            {
              n: 1,
              cst: '515',
              cClassTrib: '515001',
              base: '1000.00',
              informedRates: simulate('8.8'),
              deferral: { CBS: '40', IBSUF: '100', IBSMun: '0' },
            },
          ],
          gov,
        ),
        '2027-03-01',
      ),
    );
    expect(deferral.reason).toBe('entrada_invalida');
    const refund = classificationError(() =>
      at(
        op(
          [
            {
              n: 1,
              cst: '000',
              cClassTrib: '000001',
              base: '1000.00',
              informedRates: simulate('8.8'),
              taxRefund: { pDevTrib: '20' },
            },
          ],
          gov,
        ),
        '2027-03-01',
      ),
    );
    expect(refund.reason).toBe('entrada_invalida');
    // Em 2026 não há redistribuição: devolução com compra governamental segue calculando.
    const g2026 = at(
      op([{ n: 1, cst: '000', cClassTrib: '000001', base: '1000.00', taxRefund: { pDevTrib: '20' } }], gov),
    ).items[0]?.IBSCBS.gIBSCBS?.gCBS;
    expect(g2026?.gDevTrib).toEqual({ pDevTrib: '20.00', vDevTrib: '1.80' });
  });
});

describe('compra governamental com transferência da CBS (a partir de 2029)', () => {
  test('a alíquota redistribuída sai com 4 casas e o valor acompanha', () => {
    const roc = at(
      op(
        [
          {
            n: 1,
            cst: '000',
            cClassTrib: '000001',
            base: '1000000.00',
            informedRates: { CBS: '8.1234', IBSUF: '0.0537', IBSMun: '0.0461', reason: 'teste' },
          },
        ],
        { governmentPurchase: { tpEnteGov: 2 } },
      ),
      '2029-03-01',
    );
    const g = roc.items[0]?.IBSCBS.gIBSCBS;
    for (const [pct, v] of [
      [g?.gCBS.gRed?.pAliqEfet, g?.gCBS.vCBS],
      [g?.gIBSUF.gRed?.pAliqEfet, g?.gIBSUF.vIBSUF],
    ] as const) {
      expect(pct?.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
      expect(v).toBe(
        Decimal.parse(pct ?? '0')
          .mul(Decimal.parse('10000'))
          .setScale(2, 'HALF_EVEN')
          .toFixed(2),
      );
    }
  });
});

describe('arredondamento da redistribuição preserva o total', () => {
  test('soma dos entes igual à de gTribCompraGov (UB82a-20)', () => {
    const roc = at(
      op(
        [
          {
            n: 1,
            cst: '000',
            cClassTrib: '000001',
            base: '1000000.00',
            informedRates: { CBS: '9.2535', IBSUF: '1', IBSMun: '1', reason: 'teste' },
          },
        ],
        { governmentPurchase: { tpEnteGov: 2 } },
      ),
      '2029-01-01',
    );
    const it = roc.items[0]?.IBSCBS;
    const g = it?.gIBSCBS;
    const cg = it?.gIBSCBS?.gTribCompraGov;
    const ours = [g?.gCBS.vCBS, g?.gIBSUF.vIBSUF, g?.gIBSMun.vIBSMun].reduce((a, v) => a + Number(v), 0);
    const theirs = [cg?.vTribCBS, cg?.vTribIBSUF, cg?.vTribIBSMun].reduce((a, v) => a + Number(v), 0);
    expect(Math.abs(ours - theirs)).toBeLessThan(0.04);
    for (const [pct, v] of [
      [g?.gCBS.gRed?.pAliqEfet, g?.gCBS.vCBS],
      [g?.gIBSUF.gRed?.pAliqEfet, g?.gIBSUF.vIBSUF],
    ] as const) {
      expect(v).toBe(
        Decimal.parse(pct ?? '0')
          .mul(Decimal.parse('10000'))
          .toFixed(2),
      );
    }
  });
});

describe('tributação regular com diferimento ou devolução', () => {
  test('é recusada: o grupo principal sai zerado', () => {
    const e = classificationError(() =>
      at(
        op([
          {
            n: 1,
            cst: '550',
            cClassTrib: '550001',
            base: '1000.00',
            regular: { cst: '000', cClassTrib: '000001' },
            taxRefund: { pDevTrib: '10' },
          },
        ]),
      ),
    );
    expect(e.reason).toBe('entrada_invalida');
  });
});

describe('diferimento e devolução no mesmo tributo', () => {
  test('o valor fecha com as deduções como emitidas', () => {
    const g = at(
      op([
        {
          n: 1,
          cst: '510',
          cClassTrib: '510001',
          base: '1.12',
          deferral: { CBS: '33.33', IBSUF: '0', IBSMun: '0' },
          taxRefund: { pDevTrib: '33.33' },
        },
      ]),
      '2026-10-10',
    ).items[0]?.IBSCBS.gIBSCBS?.gCBS;
    expect(g?.gDif?.vDif).toBe('0.00');
    expect(g?.gDevTrib?.vDevTrib).toBe('0.00');
    expect(g?.vCBS).toBe('0.01');
  });
});

describe('crédito presumido em bem móvel usado', () => {
  test('vale com cClassTrib que veda o grupo (UB120-20, exceção)', () => {
    const credit = { cCredPres: 4, vBCCredPres: '100.00', ibs: { pCredPres: '0.05' }, cbs: { pCredPres: '1' } };
    const e = classificationError(() =>
      at(op([{ n: 1, cst: '000', cClassTrib: '000001', base: '100.00', presumedCredit: credit }]), '2027-03-01'),
    );
    expect(e.reason).toBe('grupo_vedado');
    const roc = at(
      op([
        {
          n: 1,
          cst: '000',
          cClassTrib: '000001',
          base: '100.00',
          informedRates: simulate('8.8'),
          presumedCredit: { ...credit, usedMovableGood: true },
        },
      ]),
      '2027-03-01',
    );
    expect(roc.items[0]?.IBSCBS.gCredPresOper?.cCredPres).toBe(4);
  });
});
