import { describe, expect, test } from 'bun:test';
import { ConfigError } from '@sinete/core';
import pkg from '../package.json' with { type: 'json' };
import { BUNDLED_DATASET, bundledDataset } from '../src/bundled.ts';
import type { ApplicabilityRecord, DatasetBundle, TableName } from '../src/index.ts';
import {
  applicability,
  BRASILIA_OFFSET_MINUTES,
  canonicalJson,
  canonicalTable,
  civilDate,
  contentVersionOf,
  DATA_SCHEMA_VERSION,
  IbsCbsDataError,
  inForce,
  isIsoDate,
  loadDataset,
  requireIsoDate,
  TABLE_NAMES,
  verifyDataset,
} from '../src/index.ts';

const ds = bundledDataset();

function clone(b: DatasetBundle): DatasetBundle {
  return JSON.parse(JSON.stringify(b)) as DatasetBundle;
}

describe('pacote e manifest', () => {
  test('versão do pacote segue AAAA.M.patch do mês dos dados', () => {
    const [y, m] = ds.manifest.dataVersion.split('.').map(Number);
    const [py, pm] = pkg.version.split('.').map(Number);
    expect([py, pm]).toEqual([y, m]);
  });

  test('manifest cita as fontes oficiais fixadas por hash', () => {
    const m = ds.manifest;
    expect(m.dataSchemaVersion).toBe(DATA_SCHEMA_VERSION);
    expect(m.sources.map((s) => s.kind)).toContain('CALCULADORA_OFFLINE');
    for (const s of m.sources) {
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(s.url).toMatch(/^https:\/\//);
    }
    expect(m.tables.map((t) => t.name)).toEqual([...TABLE_NAMES]);
    expect(m.knownAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ds.contentVersion).toBe(contentVersionOf(m));
    expect(ds.contentVersion).toMatch(/^2026\.09\+V0057\+v1\.60\+v1\.60#[0-9a-f]{12}$/);
  });

  test('bundledDataset carrega uma vez', () => {
    expect(bundledDataset()).toBe(ds);
  });

  test('verifyDataset confere tabelas e hash total', async () => {
    await verifyDataset(BUNDLED_DATASET);
    const bad = clone(BUNDLED_DATASET);
    (bad.tables.cst[0] as { description: string }).description = 'adulterado';
    await expect(verifyDataset(bad)).rejects.toThrow(IbsCbsDataError);
    const badTotal = clone(BUNDLED_DATASET);
    (badTotal.manifest as { datasetSha256: string }).datasetSha256 = '0'.repeat(64);
    await expect(verifyDataset(badTotal)).rejects.toThrow(/datasetSha256/);
    const missing = clone(BUNDLED_DATASET);
    (missing.manifest.tables as unknown as { name: string }[]).push({ name: 'inexistente' });
    await expect(verifyDataset(missing)).rejects.toThrow(/exatamente uma vez/);
    // Tabela fora do manifest não escapa da conferência, mesmo com o hash total recalculado.
    const uncovered = clone(BUNDLED_DATASET);
    (uncovered.manifest as unknown as { tables: unknown[] }).tables = uncovered.manifest.tables.filter(
      (t) => t.name !== 'govPurchaseReducer',
    );
    await expect(verifyDataset(uncovered)).rejects.toThrow(/exatamente uma vez/);
    const duplicated = clone(BUNDLED_DATASET);
    (duplicated.manifest as unknown as { tables: unknown[] }).tables = [
      ...duplicated.manifest.tables,
      duplicated.manifest.tables[0],
    ];
    await expect(verifyDataset(duplicated)).rejects.toThrow(/exatamente uma vez/);
  });

  test('loadDataset recusa bundle inválido ou de outro formato', () => {
    const err = (b: unknown): IbsCbsDataError => {
      try {
        loadDataset(b as DatasetBundle);
      } catch (e) {
        return e as IbsCbsDataError;
      }
      throw new Error('não lançou');
    };
    expect(err(null).code).toBe('ibscbs_dados_invalidos');
    expect(err({ manifest: {}, tables: {} }).message).toMatch(/dataSchemaVersion/);
    const future = clone(BUNDLED_DATASET);
    (future.manifest as { dataSchemaVersion: number }).dataSchemaVersion = 99;
    expect(err(future).code).toBe('ibscbs_dados_versao_incompativel');
    const noTable = clone(BUNDLED_DATASET);
    delete (noTable.tables as Partial<Record<TableName, unknown>>).cst;
    expect(err(noTable).message).toMatch(/tabela cst/);
    const dangling = clone(BUNDLED_DATASET);
    (dangling.tables.ncmApplicability[0] as { classTribKey: string }).classTribKey = 'CBS_IBS:000000:2026-01-01';
    expect(err(dangling).message).toMatch(/inexistente/);
  });
});

describe('visão por data de fato gerador', () => {
  const c = ds.at('2026-09-25');

  test('CST, cClassTrib e tratamento vigentes', () => {
    expect(c.asOf).toBe('2026-09-25');
    expect(ds.at('2026-09-25')).toBe(c);
    expect(c.dataset).toBe(ds);
    const ct = c.classTrib('200034');
    expect(ct?.cst).toBe('200');
    expect(c.cstOf(ct as NonNullable<typeof ct>)?.groups.gRed).toBe('required');
    expect(c.cst('000')?.groups.gIBSCBS).toBe('required');
    expect(c.cst('000', 'IS')).toBeUndefined();
    expect(c.classTrib('999999')).toBeUndefined();
    expect(c.treatment(ct as NonNullable<typeof ct>)?.expr.tributoCalculado).toBe('baseCalculo*aliquotaEfetiva');
    expect(c.reduction(ct as NonNullable<typeof ct>, 'CBS')).toBe('60');
    expect(c.fixedRate(ct as NonNullable<typeof ct>, 'CBS')).toBeUndefined();
    expect(c.allowedIn(ct as NonNullable<typeof ct>, 55)).toBe(true);
    // 220001 só vigorou em 01/01/2026
    expect(ds.at('2026-01-01').classTrib('220001')).toBeDefined();
    expect(c.classTrib('220001')).toBeUndefined();
  });

  test('filtros de classTribs', () => {
    const all = c.classTribs();
    expect(all.length).toBeGreaterThan(150);
    expect(c.classTribs({ cst: '410' }).every((x) => x.cst === '410')).toBe(true);
    expect(c.classTribs({ modelo: 65 }).every((x) => c.allowedIn(x, 65))).toBe(true);
    expect(c.classTribs({ family: 'IS' }).every((x) => x.family === 'IS')).toBe(true);
  });

  test('crédito presumido, atores, NFS-e, anexos, DF-e e compras governamentais', () => {
    expect(c.credPres(1)).toMatchObject({ cbs: false, ibs: false });
    expect(ds.at('2027-01-01').credPres(1)).toMatchObject({ cbs: true, ibs: true });
    expect(ds.at('2027-01-01').credPres(3)).toMatchObject({ cbs: true, ibs: false });
    expect(c.credPres(99)).toBeUndefined();
    expect(c.actor(1)?.description).toBe('Praça de Pedágio');
    expect(c.actor(9999)).toBeUndefined();
    const nbs = ds.tables.nfseNbs[0];
    if (!nbs) throw new Error('sem nfseNbs');
    expect(c.nfseNbs(nbs.nbs).length).toBeGreaterThan(0);
    expect(c.nfseNbs('000000000')).toEqual([]);
    const annex = ds.tables.annexes.find((a) => a.item !== null);
    if (!annex) throw new Error('sem anexo');
    expect(c.annex(`${annex.annex}/${annex.item}`)?.annex).toBe(annex.annex);
    expect(c.annex('ZZ/99')).toBeUndefined();
    expect(c.dfeType(55)?.sigla).toBe('NF-e');
    expect(c.dfeType(1)).toBeUndefined();
    expect(c.govPurchaseReducer()).toBe('0');
    expect(c.cbsTransferPercent()).toBe('0');
    expect(ds.at('2033-06-01').cbsTransferPercent()).toBe('100');
  });

  test('byActors: código sem vínculo de ator admite qualquer ator', () => {
    const everyone = c.byActors({});
    expect(everyone.length).toBe(c.classTribs().length);
    const nfe = c.byActors({ modelo: 55 });
    expect(nfe.length).toBe(c.classTribs({ modelo: 55 }).length);
    const narrowed = c.byActors({ supplier: 14, buyer: 22, modelo: 55 });
    expect(narrowed.length).toBeLessThan(nfe.length);
    expect(narrowed).toContain('410014');
  });

  test('data inválida é ConfigError', () => {
    expect(() => ds.at('2026-02-30')).toThrow(ConfigError);
  });
});

describe('aplicabilidade de NCM e NBS', () => {
  const v = { from: '2026-01-01', to: null };
  const link = (prefix: string, exceptions: ApplicabilityRecord['exceptions'] = []): ApplicabilityRecord => ({
    key: prefix,
    classTribKey: 'CBS_IBS:200003:2026-01-01',
    family: 'CBS_IBS',
    cClassTrib: '200003',
    prefix,
    annexItem: 'I/1',
    validity: v,
    exceptions,
  });

  test('tabela-verdade da Calculadora', () => {
    expect(applicability([], '10063021', '2026-05-01', 8).result).toBe('not-restricted');
    expect(applicability([link('1006')], '1006', '2026-05-01', 8).result).toBe('incomplete');
    expect(applicability([link('1006')], '10063O21', '2026-05-01', 8).result).toBe('incomplete');
    expect(applicability([link('1006')], '12019000', '2026-05-01', 8).result).toBe('no');
    const yes = applicability([link('1006')], '10063021', '2026-05-01', 8);
    expect(yes.result).toBe('yes');
    expect(yes.matched.map((m) => m.prefix)).toEqual(['1006']);
    const excl = applicability([link('1006', [{ prefix: '100630', validity: v }])], '10063021', '2026-05-01', 8);
    expect(excl).toMatchObject({ result: 'no', excludedBy: ['100630'] });
    // exceção fora de vigência não exclui
    const old = { from: '2026-01-01', to: '2026-03-31' };
    expect(
      applicability([link('1006', [{ prefix: '100630', validity: old }])], '10063021', '2026-05-01', 8).result,
    ).toBe('yes');
    // vínculo "limpo" duplicado (LEFT JOIN): a exceção de um vínculo não derruba o outro
    expect(
      applicability([link('1006', [{ prefix: '100630', validity: v }]), link('1006')], '10063021', '2026-05-01', 8)
        .result,
    ).toBe('yes');
    // vínculo fora de vigência na data
    expect(applicability([{ ...link('1006'), validity: old }], '10063021', '2026-05-01', 8).result).toBe(
      'not-restricted',
    );
  });

  test('pela visão do dataset', () => {
    const c = ds.at('2026-09-25');
    const arroz = c.classTrib('200003');
    const livre = c.classTrib('000001');
    if (!arroz || !livre) throw new Error('dataset incompleto');
    expect(c.applicableNcm(arroz, '10063021').result).toBe('yes');
    expect(c.applicableNcm(arroz, '12019000').result).toBe('no');
    expect(c.applicableNcm(livre, '84713012').result).toBe('not-restricted');
    expect(c.applicableNbs(livre, '123012100').result).toBe('not-restricted');
  });
});

describe('datas e serialização canônica', () => {
  test('datas civis', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2100-02-29')).toBe(false);
    expect(isIsoDate('2000-02-29')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
    expect(isIsoDate(20260101)).toBe(false);
    expect(requireIsoDate('2026-01-01')).toBe('2026-01-01');
    expect(() => requireIsoDate('x', 'data de teste')).toThrow(/data de teste/);
    expect(inForce({ from: '2026-01-01', to: '2026-12-31' }, '2026-12-31')).toBe(true);
    expect(inForce({ from: '2026-01-01', to: '2026-12-31' }, '2027-01-01')).toBe(false);
    expect(inForce({ from: '2026-01-01', to: null }, '2099-01-01')).toBe(true);
  });

  test('data civil do instante no fuso do local', () => {
    const instant = new globalThis.Date('2027-01-01T02:30:00Z');
    expect(BRASILIA_OFFSET_MINUTES).toBe(-180);
    expect(civilDate(instant)).toBe('2026-12-31');
    expect(civilDate(instant, 0)).toBe('2027-01-01');
    expect(civilDate(instant, -300)).toBe('2026-12-31');
  });

  test('JSON canônico com chaves ordenadas', () => {
    expect(canonicalTable([])).toBe('[]\n');
    expect(canonicalTable([{ b: 1, a: { d: 2, c: undefined } }])).toBe('[\n{"a":{"d":2},"b":1}\n]\n');
    expect(canonicalJson({ b: [2, 1], a: 'x' })).toBe('{\n  "a": "x",\n  "b": [\n    2,\n    1\n  ]\n}\n');
  });
});
