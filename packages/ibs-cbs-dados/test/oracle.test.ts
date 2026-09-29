/**
 * O dataset contra respostas gravadas da API `dados-abertos` da Calculadora offline (`tools/ibs-cbs-oraculo/run.ts
 * --record`): aplicabilidade de NCM e NBS, filtro por atores e listas de cClassTrib e CST vigentes por data.
 */
import { describe, expect, test } from 'bun:test';
import { bundledDataset } from '../src/bundled.ts';
import fixture from './fixtures/oracle-data.json' with { type: 'json' };

const ds = bundledDataset();

describe('dataset x Calculadora (respostas gravadas)', () => {
  test('gravado da Calculadora fixada', () => {
    expect(fixture.calculadora.versaoDb).toBe('V0057');
    expect(ds.manifest.sources.find((s) => s.kind === 'CALCULADORA_OFFLINE')?.sha256).toBe(
      fixture.calculadora.zipSha256,
    );
    expect(fixture.pairs.length).toBeGreaterThan(150);
    expect(fixture.pairs.some((p) => p.valid)).toBe(true);
    expect(fixture.pairs.some((p) => !p.valid)).toBe(true);
  });

  test('aplicabilidade de NCM e NBS', () => {
    const wrong: string[] = [];
    for (const p of fixture.pairs) {
      const c = ds.at(p.date);
      const ct = c.classTrib(p.cClassTrib);
      if (!ct) {
        wrong.push(`${p.cClassTrib} fora de vigência em ${p.date}`);
        continue;
      }
      const r = p.kind === 'ncm' ? c.applicableNcm(ct, p.code) : c.applicableNbs(ct, p.code);
      if ((r.result !== 'no') !== p.valid) wrong.push(`${p.kind} ${p.cClassTrib} ${p.code} ${p.date}: ${r.result}`);
    }
    expect(wrong).toEqual([]);
  });

  test('cClassTrib por atores', () => {
    for (const a of fixture.actors) {
      const ours = [...ds.at(a.date).byActors({ supplier: a.supplier, buyer: a.buyer, modelo: a.modelo })].sort();
      expect(ours, `${a.supplier}x${a.buyer} ${a.sigla} ${a.date}`).toEqual(a.codes);
    }
  });

  test('listas de cClassTrib e CST vigentes', () => {
    for (const l of fixture.lists) {
      const c = ds.at(l.date);
      expect(
        c
          .classTribs()
          .map((x) => x.code)
          .sort(),
      ).toEqual(l.classTrib);
      const cst = ds.tables.cst
        .filter((x) => x.family === 'CBS_IBS' && x.validity.from <= l.date && (x.validity.to ?? '9999') >= l.date)
        .map((x) => x.code)
        .sort();
      expect(cst).toEqual(l.cst);
    }
  });
});
