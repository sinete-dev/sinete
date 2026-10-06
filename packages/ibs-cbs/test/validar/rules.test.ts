import { describe, expect, test } from 'bun:test';
import type { ContextoDeTempo } from '@sinete/core';
import { contextoDeTempo, ErroDeConfiguracao, relogioFixo } from '@sinete/core';
import { carregarDataset } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO } from '@sinete/ibs-cbs-dados/embarcado';
import { REJEICOES } from '@sinete/rejeicoes';
import { aliquotasOficiais, comAliquotasInformadas } from '../../src/aliquotas/index.ts';
import type { IBSCBS, ItemClassificado } from '../../src/calcular/index.ts';
import { calcularEm } from '../../src/calcular/index.ts';
import type { DocumentoDasRegras, ItemDasRegras } from '../../src/validar/index.ts';
import { ativa, documentoDoRoc, NAO_IMPLEMENTADAS, REGRAS, TABELAS_NT, validar } from '../../src/validar/index.ts';

const dataset = carregarDataset(DATASET_EMBARCADO);
const rates = aliquotasOficiais();
const place = { uf: 'RS', cMun: '4314902' };

function time(emission: string, fact = emission): ContextoDeTempo {
  return contextoDeTempo({
    emissao: relogioFixo(`${emission}T12:00:00-03:00`),
    fatoGerador: relogioFixo(`${fact}T12:00:00-03:00`),
  });
}

/** Documento válido a partir do motor. */
function docOf(
  items: ItemClassificado[],
  opts: { date?: string; modelo?: 55 | 65; gov?: 1 | 2 | 4; ident?: Partial<DocumentoDasRegras> } = {},
): DocumentoDasRegras {
  const date = opts.date ?? '2026-10-10';
  const roc = calcularEm(
    {
      modelo: opts.modelo ?? 55,
      local: place,
      itens: items,
      ...(opts.gov ? { compraGovernamental: { tpEnteGov: opts.gov } } : {}),
    },
    { dataset, aliquotas: rates, data: date },
  );
  return documentoDoRoc(roc, { modelo: opts.modelo ?? 55, crt: 3, finNFe: 1, ...opts.ident });
}

function run(
  doc: DocumentoDasRegras,
  date = '2026-10-10',
  extra: Partial<Parameters<typeof validar>[1]> = {},
): string[] {
  const report = validar(doc, { dataset, tempo: time(date), ambiente: 'producao', ignorarAtivacao: true, ...extra });
  return [...new Set(report.violacoes.map((v) => v.regra))].sort();
}

/** Troca o IBSCBS do item 1. */
function patch(doc: DocumentoDasRegras, fn: (ib: IBSCBS) => IBSCBS, item = 0): DocumentoDasRegras {
  return {
    ...doc,
    itens: doc.itens.map((it, i) => (i === item && it.IBSCBS ? { ...it, IBSCBS: fn(it.IBSCBS) } : it)),
  };
}

const full: ItemClassificado = { n: 1, cst: '000', cClassTrib: '000001', base: '1000.00' };

describe('catálogo de regras', () => {
  test('ids únicos, cStat conferido no @sinete/rejeicoes e fonte citada', () => {
    const ids = REGRAS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(90);
    const byCode = new Map(REJEICOES.map((r) => [r.codigo, r]));
    for (const r of REGRAS) {
      const rej = byCode.get(r.cStat);
      expect(rej, `${r.id} cStat ${r.cStat}`).toBeDefined();
      expect(
        rej?.regras.some((x) => x.id === r.id),
        `${r.id} não está na regra do cStat ${r.cStat}`,
      ).toBe(true);
      expect(r.fonte).toBe(`NT 2025.002 v1.52, ${r.id}`);
      for (const a of r.ativacao) expect(a.homologacao <= a.producao).toBe(true);
      for (const m of r.modelos) expect(rej?.modelos).toContain(String(m) as '55');
    }
    expect(NAO_IMPLEMENTADAS.length).toBeGreaterThan(5);
    for (const n of NAO_IMPLEMENTADAS) expect(ids).not.toContain(n.id);
    expect(TABELAS_NT.fonte.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  test('implantação por ambiente, data de emissão, modelo e CRT', () => {
    const doc = docOf([full]);
    const ub12 = REGRAS.find((r) => r.id === 'UB12-10');
    const ub62 = REGRAS.find((r) => r.id === 'UB62-10');
    const ub18 = REGRAS.find((r) => r.id === 'UB18-10');
    if (!ub12 || !ub62 || !ub18) throw new Error('regras ausentes');
    expect(ativa(ub12, doc, 'producao', '2026-08-02')).toBe(false);
    expect(ativa(ub12, doc, 'producao', '2026-08-03')).toBe(true);
    expect(ativa(ub12, doc, 'homologacao', '2026-07-01')).toBe(true);
    expect(ativa(ub12, { ...doc, crt: 1 }, 'producao', '2026-12-31')).toBe(false);
    expect(ativa(ub12, { ...doc, crt: 1 }, 'producao', '2027-01-04')).toBe(true);
    expect(ativa(ub62, doc, 'producao', '2027-01-01')).toBe(false);
    expect(ativa(ub18, doc, 'producao', '2026-10-04')).toBe(false);
    expect(ativa(ub18, doc, 'producao', '2026-10-05')).toBe(true);
    const r = validar(doc, { dataset, tempo: time('2026-09-01'), ambiente: 'producao' });
    expect(r.inativas).toContain('UB18-10');
    expect(r.avaliadas).toContain('UB35-10');
    expect(r.dataDaEmissao).toBe('2026-09-01');
    expect(r.dataDoFato).toBe('2026-09-01');
  });

  test('entrada inválida é ErroDeConfiguracao', () => {
    expect(() =>
      validar(null as unknown as DocumentoDasRegras, { dataset, tempo: time('2026-10-10'), ambiente: 'producao' }),
    ).toThrow(ErroDeConfiguracao);
    expect(() => validar(docOf([full]), { dataset, tempo: time('2026-10-10'), ambiente: 'x' as 'producao' })).toThrow(
      ErroDeConfiguracao,
    );
  });
});

describe('documentos válidos passam', () => {
  test('saída do motor para casos variados em 2026', () => {
    const doc = docOf([
      full,
      { n: 2, cst: '200', cClassTrib: '200034', base: '333.33' },
      { n: 3, cst: '515', cClassTrib: '515001', base: '100.05' },
      { n: 4, cst: '550', cClassTrib: '550001', base: '10.00', regular: { cst: '000', cClassTrib: '000001' } },
      { n: 5, cst: '410', cClassTrib: '410001', base: '5.00' },
      { n: 6, cst: '000', cClassTrib: '000001', base: '100.00', devolucaoDeTributo: { pDevTrib: '20' } },
    ]);
    const r = validar(doc, { dataset, tempo: time('2026-10-10'), ambiente: 'producao' });
    expect(r.violacoes).toEqual([]);
    expect(r.avaliadas.length).toBeGreaterThan(80);
  });

  test('compra governamental em 2026 e a UB56-20 com alíquota informada em 2027', () => {
    expect(run(docOf([full], { gov: 2 }))).toEqual([]);
    const provider = comAliquotasInformadas(rates, [{ tributo: 'CBS', valor: '8.8', motivo: 'teste' }]);
    const doc2027 = docOf(
      [{ ...full, aliquotasInformadas: { CBS: '8.8', IBSUF: '0.05', IBSMun: '0.05', motivo: 'teste' } }],
      {
        date: '2027-02-02',
      },
    );
    expect(run(doc2027, '2027-02-02', { aliquotas: provider })).toEqual([]);
    expect(
      run(doc2027, '2027-02-02', {
        aliquotas: comAliquotasInformadas(rates, [{ tributo: 'CBS', valor: '9', motivo: 'x' }]),
      }),
    ).toEqual(['UB56-20']);
    expect(run(doc2027, '2027-02-02')).toEqual([]);
    // A UB56-20 é regra do ano de emissão: fato gerador em 2026 e emissão em 2027 confere a alíquota de 2027.
    const nine = comAliquotasInformadas(rates, [
      { tributo: 'CBS', valor: '9', motivo: 'x', vigencia: { inicio: '2027-01-01', fim: null } },
    ]);
    const crossing = (d: DocumentoDasRegras): string[] =>
      [
        ...new Set(
          validar(d, {
            dataset,
            tempo: time('2027-01-04', '2026-12-31'),
            ambiente: 'producao',
            ignorarAtivacao: true,
            aliquotas: nine,
          }).violacoes.map((v) => v.regra),
        ),
      ].filter((r) => r === 'UB56-20');
    expect(crossing(doc2027)).toEqual(['UB56-20']);
    const doc9 = docOf(
      [{ ...full, aliquotasInformadas: { CBS: '9', IBSUF: '0.05', IBSMun: '0.05', motivo: 'teste' } }],
      {
        date: '2027-02-02',
      },
    );
    expect(crossing(doc9)).toEqual([]);
  });

  test('crédito presumido, estorno, transferência, ajuste e ZFM na nota certa', () => {
    const allowed = dataset.tabelas.classTrib.find(
      (c) => c.familia === 'CBS_IBS' && c.grupos.gCredPresOper === 'permitido',
    );
    if (!allowed) throw new Error('dataset sem crédito presumido');
    const rates2027 = { CBS: '8.8', IBSUF: '0.05', IBSMun: '0.05', motivo: 'teste' };
    const cred = docOf(
      [
        {
          n: 1,
          cst: allowed.cst,
          cClassTrib: allowed.codigo,
          base: '10000.00',
          aliquotasInformadas: rates2027,
          creditoPresumido: { cCredPres: 11, vBCCredPres: '1000.00', ibs: { pCredPres: '0.1' } },
        },
      ],
      { date: '2027-03-03' },
    );
    expect(run(cred, '2027-03-03')).toEqual([]);
    const reversal = docOf([
      {
        n: 1,
        cst: '410',
        cClassTrib: '410026',
        base: '1.00',
        estornoDeCredito: { vIBSEstCred: '1', vCBSEstCred: '2' },
      },
    ]);
    expect(run(reversal)).toEqual([]);
    const transfer = docOf(
      [{ n: 1, cst: '800', cClassTrib: '800001', base: '0', transferenciaDeCredito: { vIBS: '1', vCBS: '2' } }],
      {
        ident: { finNFe: 6, tpNFDebito: '05' },
      },
    );
    expect(run(transfer)).toEqual([]);
    const zfm = docOf(
      [
        {
          n: 1,
          cst: '810',
          cClassTrib: '810001',
          base: '0',
          creditoZfm: { competApur: '2026-09', tpCredPresIBSZFM: 1, vCredPresIBSZFM: '10' },
        },
      ],
      { ident: { finNFe: 5, tpNFCredito: '02' } },
    );
    expect(run(zfm)).toEqual([]);
  });
});

describe('violações', () => {
  const doc = docOf([full]);

  test('UB12-10 e exceções', () => {
    const missing: DocumentoDasRegras = { ...doc, itens: [...doc.itens, { nItem: 2 }] };
    expect(run(missing)).toEqual(['UB12-10']);
    expect(run({ ...missing, itens: [...doc.itens, { nItem: 2, combustivelMonofasico: true }] })).toEqual([]);
    expect(run({ ...missing, finNFe: 4, emissaoReferenciada: '2026-12-01' })).toEqual([]);
    expect(run({ ...missing, finNFe: 4, emissaoReferenciada: '2027-01-01' })).toContain('UB12-10');
  });

  test('CST, cClassTrib e modelo', () => {
    expect(run(patch(doc, (ib) => ({ ...ib, CST: '999' })))).toContain('UB13-10');
    expect(run(patch(doc, (ib) => ({ ...ib, cClassTrib: '999999' })))).toContain('UB14-10');
    expect(run(patch(doc, (ib) => ({ ...ib, CST: '200' })))).toContain('UB14-20');
    const nfce = docOf([full], { modelo: 65 });
    expect(run(patch(nfce, (ib) => ({ ...ib, CST: '200', cClassTrib: '200045' })))).toContain('UB14-25');
    // A UB14-40 (620005 só em nota de crédito, rejeição 1057) saiu da NT 2025.002 na v1.52: não recusa mais.
    expect(run(patch(doc, (ib) => ({ ...ib, CST: '620', cClassTrib: '620005' })))).not.toContain('UB14-40');
  });

  test('presença de grupos pela CST', () => {
    const noMain = patch(doc, ({ gIBSCBS: _g, ...rest }) => rest);
    expect(run(noMain)).toContain('UB13-30');
    expect(run({ ...noMain, tpNFDebito: '07' })).not.toContain('UB13-30');
    const immune = docOf([{ n: 1, cst: '410', cClassTrib: '410001', base: '1' }]);
    const main = doc.itens[0]?.IBSCBS?.gIBSCBS;
    if (!main) throw new Error('sem gIBSCBS');
    expect(run(patch(immune, (ib) => ({ ...ib, gIBSCBS: main })))).toContain('UB13-20');
    expect(run(patch(doc, (ib) => ({ ...ib, gTransfCred: { vIBS: '1.00', vCBS: '1.00' } })))).toContain('UB13-44');
    const transfer = docOf([
      { n: 1, cst: '800', cClassTrib: '800001', base: '0', transferenciaDeCredito: { vIBS: '0', vCBS: '0' } },
    ]);
    expect(run(patch(transfer, ({ gTransfCred: _t, ...rest }) => rest))).toContain('UB13-45');
    expect(run(transfer)).toEqual(expect.arrayContaining(['UB106-30', 'UB106-31', 'UB106-40', 'UB14-60']));
  });

  test('tipo de nota de débito e crédito', () => {
    expect(run({ ...doc, tpNFDebito: '07' })).toContain('UB14-70');
    expect(run({ ...doc, tpNFCredito: '05' })).toContain('UB14-80');
    expect(run({ ...doc, tpNFDebito: '04' })).toEqual([]);
  });

  test('alíquotas por ano de emissão (UB18-10, UB37-10, UB56-10) e exceções', () => {
    const wrong = patch(doc, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      return {
        ...ib,
        gIBSCBS: {
          ...g,
          gIBSUF: { ...g.gIBSUF, pIBSUF: '0.05', vIBSUF: '0.50' },
          gIBSMun: { ...g.gIBSMun, pIBSMun: '0.05', vIBSMun: '0.50' },
          gCBS: { ...g.gCBS, pCBS: '1.00', vCBS: '10.00' },
        },
      };
    });
    const ub = (d: DocumentoDasRegras, date?: string): string[] => run(d, date).filter((x) => x.startsWith('UB'));
    expect(ub(wrong)).toEqual(['UB18-10', 'UB37-10', 'UB56-10']);
    expect(ub({ ...wrong, finNFe: 4 })).toEqual([]);
    expect(ub({ ...wrong, tpNFCredito: '04' })).toEqual([]);
    expect(ub(wrong, '2029-05-05')).toEqual([]);
    // tributação regular: alíquota do grupo principal tem de ser zero
    const regular = docOf([
      { n: 1, cst: '550', cClassTrib: '550001', base: '1', regular: { cst: '000', cClassTrib: '000001' } },
    ]);
    const regularWrong = patch(regular, (ib) =>
      ib.gIBSCBS ? { ...ib, gIBSCBS: { ...ib.gIBSCBS, gCBS: { ...ib.gIBSCBS.gCBS, pCBS: '0.90' } } } : ib,
    );
    expect(run(regularWrong)).toContain('UB56-10');
  });

  test('CBS zero em área incentivada (UB56-10, exceção 3)', () => {
    const zero = patch(doc, (ib) =>
      ib.gIBSCBS ? { ...ib, gIBSCBS: { ...ib.gIBSCBS, gCBS: { pCBS: '0.00', vCBS: '0.00' } } } : ib,
    );
    const zfm = { ...zero, munEmitente: '1302603', munDestinatario: '1303569' };
    const withNcm = (ncm: string): DocumentoDasRegras => ({ ...zfm, itens: zfm.itens.map((i) => ({ ...i, ncm })) });
    expect(run(withNcm('84713012'))).not.toContain('UB56-10');
    expect(run(withNcm('93011000'))).toContain('UB56-10');
    expect(run(withNcm('33030010'))).not.toContain('UB56-10');
    expect(run({ ...withNcm('84713012'), munDestinatario: '4314902' })).toContain('UB56-10');
    expect(run(zero)).toContain('UB56-10');
  });

  test('diferimento: presença e valor', () => {
    const def = docOf([{ n: 1, cst: '510', cClassTrib: '510001', base: '1000.00' }]);
    const noDif = patch(def, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      const { gDif: _a, ...uf } = g.gIBSUF;
      const { gDif: _b, ...mun } = g.gIBSMun;
      const { gDif: _c, ...cbs } = g.gCBS;
      return { ...ib, gIBSCBS: { ...g, gIBSUF: uf, gIBSMun: mun, gCBS: cbs } };
    });
    expect(run(noDif)).toEqual(expect.arrayContaining(['UB22-20', 'UB40-10', 'UB59-10']));
    const badDif = patch(def, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      return {
        ...ib,
        gIBSCBS: {
          ...g,
          gIBSUF: { ...g.gIBSUF, gDif: { pDif: '100.00', vDif: '9.99' } },
          gIBSMun: { ...g.gIBSMun, gDif: { pDif: '100.00', vDif: '9.99' } },
          gCBS: { ...g.gCBS, gDif: { pDif: '100.00', vDif: '1.00' } },
        },
      };
    });
    expect(run(badDif)).toEqual(expect.arrayContaining(['UB23-10', 'UB42-10', 'UB61-10']));
    const forbidden = patch(doc, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      const dif = { pDif: '0.00', vDif: '0.00' };
      return {
        ...ib,
        gIBSCBS: {
          ...g,
          gIBSUF: { ...g.gIBSUF, gDif: dif },
          gIBSMun: { ...g.gIBSMun, gDif: dif },
          gCBS: { ...g.gCBS, gDif: dif },
        },
      };
    });
    expect(run(forbidden)).toEqual(expect.arrayContaining(['UB22-10', 'UB40-20', 'UB59-20']));
  });

  test('redução: presença, pRedAliq, pAliqEfet e valores', () => {
    const red = docOf([{ n: 1, cst: '200', cClassTrib: '200034', base: '1000.00' }]);
    const noRed = patch(red, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      const { gRed: _a, ...uf } = g.gIBSUF;
      const { gRed: _b, ...mun } = g.gIBSMun;
      const { gRed: _c, ...cbs } = g.gCBS;
      return { ...ib, gIBSCBS: { ...g, gIBSUF: uf, gIBSMun: mun, gCBS: cbs } };
    });
    expect(run(noRed)).toEqual(expect.arrayContaining(['UB26-20', 'UB45-20', 'UB64-20', 'UB35-10', 'UB67-10']));
    const badRed = patch(red, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      const r = { pRedAliq: '50.00', pAliqEfet: '0.40' };
      return {
        ...ib,
        gIBSCBS: {
          ...g,
          gIBSUF: { ...g.gIBSUF, gRed: r },
          gIBSMun: { ...g.gIBSMun, gRed: r },
          gCBS: { ...g.gCBS, gRed: r },
        },
      };
    });
    expect(run(badRed)).toEqual(
      expect.arrayContaining(['UB27-10', 'UB28-10', 'UB46-10', 'UB47-10', 'UB65-10', 'UB66-10', 'UB54-10']),
    );
    const forbidden = patch(doc, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      const r = { pRedAliq: '10.00', pAliqEfet: '0.81' };
      return {
        ...ib,
        gIBSCBS: {
          ...g,
          gIBSUF: { ...g.gIBSUF, gRed: r },
          gIBSMun: { ...g.gIBSMun, gRed: r },
          gCBS: { ...g.gCBS, gRed: r },
        },
      };
    });
    expect(run(forbidden)).toEqual(expect.arrayContaining(['UB26-10', 'UB45-10', 'UB64-10']));
    // compra governamental: gRed com pRedAliq zero é aceito mesmo com CST que veda
    const gov = docOf([full], { gov: 4 });
    const govNoRed = patch(gov, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      const { gRed: _c, ...cbs } = g.gCBS;
      return { ...ib, gIBSCBS: { ...g, gCBS: cbs } };
    });
    expect(run(govNoRed)).toContain('UB64-20');
    const govBad = patch(gov, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      return { ...ib, gIBSCBS: { ...g, gCBS: { ...g.gCBS, gRed: { pRedAliq: '5.00', pAliqEfet: '0.8550' } } } };
    });
    expect(run(govBad)).toEqual(expect.arrayContaining(['UB64-10', 'UB65-10']));
  });

  test('compra governamental a partir de 2027: a fórmula da NT não tem a redistribuição do art. 473', () => {
    const doc2027 = docOf(
      [{ ...full, aliquotasInformadas: { CBS: '8.8', IBSUF: '0.05', IBSMun: '0.05', motivo: 'teste' } }],
      {
        date: '2027-02-02',
        gov: 1,
      },
    );
    expect(run(doc2027, '2027-02-02')).toEqual(['UB28-10', 'UB47-10', 'UB66-10']);
  });

  test('devolução de tributos', () => {
    const dev = docOf([{ ...full, devolucaoDeTributo: { pDevTrib: '20' } }]);
    const badDev = patch(dev, (ib) =>
      ib.gIBSCBS
        ? {
            ...ib,
            gIBSCBS: { ...ib.gIBSCBS, gCBS: { ...ib.gIBSCBS.gCBS, gDevTrib: { pDevTrib: '', vDevTrib: '5.00' } } },
          }
        : ib,
    );
    expect(run(badDev)).toEqual(expect.arrayContaining(['UB62a-10', 'UB63-10']));
    const ibsDev = patch(doc, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      const dev0 = { gDevTrib: { vDevTrib: '0.00' } };
      return { ...ib, gIBSCBS: { ...g, gIBSUF: { ...g.gIBSUF, ...dev0 }, gIBSMun: { ...g.gIBSMun, ...dev0 } } };
    });
    expect(run(ibsDev)).toEqual(['UB24-10', 'UB43-10']);
    const nfce = docOf([{ ...full, devolucaoDeTributo: { pDevTrib: '20' } }], { modelo: 65 });
    expect(run(nfce)).toContain('UB62-10');
  });

  test('vIBS do item e tributação regular', () => {
    expect(run(patch(doc, (ib) => (ib.gIBSCBS ? { ...ib, gIBSCBS: { ...ib.gIBSCBS, vIBS: '0.99' } } : ib)))).toEqual([
      'UB54a-10',
      'W47-10',
    ]);
    const regular = docOf([
      { n: 1, cst: '550', cClassTrib: '550001', base: '100', regular: { cst: '000', cClassTrib: '000001' } },
    ]);
    const noReg = patch(regular, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      const { gTribRegular: _r, ...rest } = g;
      return { ...ib, gIBSCBS: rest };
    });
    expect(run(noReg)).toContain('UB68-10');
    const reg = regular.itens[0]?.IBSCBS?.gIBSCBS?.gTribRegular;
    if (!reg) throw new Error('sem gTribRegular');
    const withReg = patch(doc, (ib) => (ib.gIBSCBS ? { ...ib, gIBSCBS: { ...ib.gIBSCBS, gTribRegular: reg } } : ib));
    expect(run(withReg)).toContain('UB68-11');
    const badReg = patch(regular, (ib) =>
      ib.gIBSCBS
        ? {
            ...ib,
            gIBSCBS: {
              ...ib.gIBSCBS,
              gTribRegular: {
                ...reg,
                CSTReg: '999',
                cClassTribReg: '999999',
                vTribRegIBSUF: '9.99',
                vTribRegIBSMun: '9.99',
                vTribRegCBS: '9.99',
              },
            },
          }
        : ib,
    );
    expect(run(badReg)).toEqual(expect.arrayContaining(['UB69-10', 'UB70-10', 'UB72-10', 'UB72b-10', 'UB72d-10']));
  });

  test('gTribCompraGov', () => {
    const gov = docOf([full], { gov: 2 });
    const noCg = patch(gov, (ib) => {
      const g = ib.gIBSCBS;
      if (!g) return ib;
      const { gTribCompraGov: _c, ...rest } = g;
      return { ...ib, gIBSCBS: rest };
    });
    expect(run(noCg)).toContain('UB82a-10');
    const cg = gov.itens[0]?.IBSCBS?.gIBSCBS?.gTribCompraGov;
    if (!cg) throw new Error('sem gTribCompraGov');
    expect(
      run(
        patch(gov, (ib) =>
          ib.gIBSCBS ? { ...ib, gIBSCBS: { ...ib.gIBSCBS, gTribCompraGov: { ...cg, vTribCBS: '1.00' } } } : ib,
        ),
      ),
    ).toContain('UB82a-20');
    const { gCompraGov: _g, ...noGov } = gov;
    expect(run(noGov)).toContain('UB82a-30');
  });

  test('ajuste de competência e estorno de crédito', () => {
    const adj = docOf([
      {
        n: 1,
        cst: '811',
        cClassTrib: '811001',
        base: '0',
        ajusteDeCompetencia: { competApur: '2026-01', vIBS: '0', vCBS: '0' },
      },
    ]);
    expect(run(adj)).toContain('UB112-30');
    expect(run(patch(adj, ({ gAjusteCompet: _a, ...rest }) => rest))).toContain('UB112-20');
    const aj = adj.itens[0]?.IBSCBS?.gAjusteCompet;
    expect(run(patch(doc, (ib) => ({ ...ib, ...(aj ? { gAjusteCompet: aj } : {}) })))).toContain('UB112-10');
    const rev = docOf([
      { n: 1, cst: '410', cClassTrib: '410026', base: '1', estornoDeCredito: { vIBSEstCred: '0', vCBSEstCred: '0' } },
    ]);
    expect(run(rev)).toContain('UB116-30');
    expect(run({ ...rev, tpNFDebito: '07' })).not.toContain('UB116-30');
    expect(run(patch(rev, ({ gEstornoCred: _e, ...rest }) => rest))).toContain('UB116-20');
    expect(run({ ...doc, tpNFDebito: '07' })).toContain('UB116-20');
    const e = { vIBSEstCred: '1.00', vCBSEstCred: '1.00' };
    expect(run(patch(doc, (ib) => ({ ...ib, gEstornoCred: e })))).toContain('UB116-10');
    expect(run({ ...patch(doc, (ib) => ({ ...ib, gEstornoCred: e })), tpNFDebito: '07' })).not.toContain('UB116-10');
  });

  test('crédito presumido', () => {
    const withCred = (
      cp: NonNullable<IBSCBS['gCredPresOper']>,
      it: Partial<ItemDasRegras> = {},
      d = doc,
    ): DocumentoDasRegras => ({
      ...d,
      itens: d.itens.map((i) => (i.IBSCBS ? { ...i, ...it, IBSCBS: { ...i.IBSCBS, gCredPresOper: cp } } : i)),
    });
    const cp = { vBCCredPres: '100.00', cCredPres: 4, gIBSCredPres: { pCredPres: '1.00', vCredPres: '1.00' } };
    expect(run(withCred(cp), '2027-02-02')).toEqual(expect.arrayContaining(['UB120-20', 'UB127-20']));
    expect(run(withCred(cp, { bemMovelUsado: true }), '2027-02-02')).not.toContain('UB120-20');
    expect(run(withCred({ ...cp, cCredPres: 99 }))).toContain('UB122-10');
    expect(
      run(withCred({ vBCCredPres: '1', cCredPres: 5, gIBSCredPres: { pCredPres: '1', vCredPres: '1' } }), '2027-02-02'),
    ).toEqual(expect.arrayContaining(['UB123-10', 'UB127-20']));
    expect(
      run(withCred({ vBCCredPres: '1', cCredPres: 7, gCBSCredPres: { pCredPres: '1', vCredPres: '1' } }), '2027-02-02'),
    ).toEqual(expect.arrayContaining(['UB123-20', 'UB127-10']));
    const big = {
      vBCCredPres: '100.00',
      cCredPres: 4,
      gIBSCredPres: { pCredPres: '1.00', vCredPres: '500.00' },
      gCBSCredPres: { pCredPres: '1.00', vCredPres: '500.00' },
    };
    expect(run(withCred(big, { vProd: '100.00' }), '2027-02-02')).toEqual(
      expect.arrayContaining(['UB125-10', 'UB129-10']),
    );
    const condSus = {
      vBCCredPres: '100.00',
      cCredPres: 1,
      gIBSCredPres: { pCredPres: '1.00', vCredPresCondSus: '1.00' },
      gCBSCredPres: { pCredPres: '1.00', vCredPresCondSus: '1.00' },
    };
    expect(run(withCred(condSus), '2027-02-02')).toEqual(expect.arrayContaining(['UB126-10', 'UB130-10']));
    expect(run(withCred({ ...condSus, cCredPres: 4 }), '2027-02-02')).not.toContain('UB130-10');
    expect(run(withCred(cp, {}, docOf([full], { modelo: 65 })), '2027-02-02')).toContain('UB120-10');
    // crédito abatido do vIBS (indDeduzCredPres)
    const deduct = withCred({
      vBCCredPres: '100.00',
      cCredPres: 11,
      gIBSCredPres: { pCredPres: '1.00', vCredPres: '0.50' },
    });
    expect(run(deduct, '2027-02-02')).toContain('UB54a-10');
  });

  test('crédito presumido da ZFM', () => {
    const zfm = docOf(
      [
        {
          n: 1,
          cst: '810',
          cClassTrib: '810001',
          base: '0',
          creditoZfm: { competApur: '2026-12', tpCredPresIBSZFM: 1, vCredPresIBSZFM: '1' },
        },
        {
          n: 2,
          cst: '810',
          cClassTrib: '810001',
          base: '0',
          creditoZfm: { competApur: '2026-01', tpCredPresIBSZFM: 1, vCredPresIBSZFM: '1' },
        },
      ],
      { ident: { finNFe: 5 } },
    );
    expect(run(zfm)).toEqual(expect.arrayContaining(['UB131-40', 'UB132-10', 'UB133-10']));
    expect(run(patch({ ...zfm, tpNFCredito: '02' }, ({ gCredPresIBSZFM: _z, ...rest }) => rest))).toEqual(
      expect.arrayContaining(['UB131-30', 'UB131-50']),
    );
    const z = zfm.itens[0]?.IBSCBS?.gCredPresIBSZFM;
    expect(run(patch(doc, (ib) => ({ ...ib, ...(z ? { gCredPresIBSZFM: z } : {}) })))).toContain('UB131-20');
    const nfce = docOf([full], { modelo: 65 });
    expect(run(patch(nfce, (ib) => ({ ...ib, ...(z ? { gCredPresIBSZFM: z } : {}) })))).toContain('UB131-10');
  });

  test('totais', () => {
    const tot = doc.IBSCBSTot;
    if (!tot) throw new Error('sem total');
    expect(run({ ...doc, IBSCBSTot: undefined } as unknown as DocumentoDasRegras)).toContain('W34-20');
    expect(run({ ...doc, itens: [{ nItem: 1 }] })).toEqual(expect.arrayContaining(['W34-10', 'UB12-10']));
    const wrong: DocumentoDasRegras = {
      ...doc,
      IBSCBSTot: {
        vBCIBSCBS: '1.00',
        gIBS: {
          gIBSUF: { vDif: '1.00', vDevTrib: '1.00', vIBSUF: '9.99' },
          gIBSMun: { vDif: '1.00', vDevTrib: '1.00', vIBSMun: '9.99' },
          vIBS: '9.99',
          vCredPres: '1.00',
          vCredPresCondSus: '0.00',
        },
        gCBS: { vDif: '1.00', vDevTrib: '1.00', vCBS: '1.00', vCredPres: '1.00', vCredPresCondSus: '0.00' },
        gEstornoCred: { vIBSEstCred: '1.00', vCBSEstCred: '1.00' },
      },
    };
    expect(run(wrong)).toEqual([
      'W35-10',
      'W38-10',
      'W39-10',
      'W41-10',
      'W43-10',
      'W44-10',
      'W46-10',
      'W47-10',
      'W48-10',
      'W53-10',
      'W54-10',
      'W56-10',
      'W56a-10',
      'W59f-10',
      'W59g-10',
    ]);
  });
});
