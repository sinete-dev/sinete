/**
 * O dataset contra respostas gravadas da API `dados-abertos` da Calculadora offline (`tools/ibs-cbs-oraculo/run.ts
 * --record`): aplicabilidade de NCM e NBS, filtro por atores e listas de cClassTrib e CST vigentes por data.
 */
import { describe, expect, test } from 'bun:test';
import { datasetEmbarcado } from '../src/embarcado.ts';
import fixture from './fixtures/oracle-data.json' with { type: 'json' };

const ds = datasetEmbarcado();

describe('dataset x Calculadora (respostas gravadas)', () => {
  test('gravado da Calculadora fixada', () => {
    expect(fixture.calculadora.versaoDb).toBe('V0059');
    expect(ds.manifesto.fontes.find((s) => s.tipo === 'CALCULADORA_OFFLINE')?.sha256).toBe(
      fixture.calculadora.zipSha256,
    );
    expect(fixture.pairs.length).toBeGreaterThan(150);
    expect(fixture.pairs.some((p) => p.valid)).toBe(true);
    expect(fixture.pairs.some((p) => !p.valid)).toBe(true);
  });

  test('aplicabilidade de NCM e NBS', () => {
    const wrong: string[] = [];
    for (const p of fixture.pairs) {
      const c = ds.em(p.date);
      const ct = c.classTrib(p.cClassTrib);
      if (!ct) {
        wrong.push(`${p.cClassTrib} fora de vigência em ${p.date}`);
        continue;
      }
      const r = p.kind === 'ncm' ? c.ncmAplicavel(ct, p.code) : c.nbsAplicavel(ct, p.code);
      if ((r.resultado !== 'nao') !== p.valid)
        wrong.push(`${p.kind} ${p.cClassTrib} ${p.code} ${p.date}: ${r.resultado}`);
    }
    expect(wrong).toEqual([]);
  });

  test('cClassTrib por atores', () => {
    for (const a of fixture.actors) {
      const ours = [
        ...ds.em(a.date).porAtores({ fornecedor: a.supplier, adquirente: a.buyer, modelo: a.modelo }),
      ].sort();
      expect(ours, `${a.supplier}x${a.buyer} ${a.sigla} ${a.date}`).toEqual(a.codes);
    }
  });

  test('listas de cClassTrib e CST vigentes', () => {
    for (const l of fixture.lists) {
      const c = ds.em(l.date);
      expect(
        c
          .classTribs()
          .map((x) => x.codigo)
          .sort(),
      ).toEqual(l.classTrib);
      const cst = ds.tabelas.cst
        .filter((x) => x.familia === 'CBS_IBS' && x.vigencia.inicio <= l.date && (x.vigencia.fim ?? '9999') >= l.date)
        .map((x) => x.codigo)
        .sort();
      expect(cst).toEqual(l.cst);
    }
  });
});
