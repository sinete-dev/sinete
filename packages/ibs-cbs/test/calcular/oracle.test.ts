/**
 * Regressão contra respostas gravadas da Calculadora offline (`tools/ibs-cbs-oraculo/run.ts --record`). Cada caso guarda a
 * saída do motor projetada em `caminho -> texto` e as divergências em relação à Calculadora, cada uma com a entrada do
 * ledger que a explica. O teste recalcula e exige a mesma saída: como a gravação só acontece com o oráculo sem
 * divergência fora do ledger, isto prova, sem contêiner, que o motor segue igual à Calculadora campo a campo.
 */
import { describe, expect, test } from 'bun:test';
import { carregarDataset } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO } from '@sinete/ibs-cbs-dados/embarcado';
import { aliquotasOficiais } from '../../src/aliquotas/index.ts';
import type { OperacaoClassificada, Roc } from '../../src/calcular/index.ts';
import { calcularEm } from '../../src/calcular/index.ts';
import fixture from './fixtures/oracle-cases.json' with { type: 'json' };

interface FixtureCase {
  id: string;
  date: string;
  op: OperacaoClassificada;
  engine: Record<string, string> | { error: string };
  oracleError?: string;
  divergences: {
    path?: string;
    ours?: string | null;
    theirs?: string | null;
    outcome?: string;
    ledger: string | null;
  }[];
}

const dataset = carregarDataset(DATASET_EMBARCADO);
const rates = aliquotasOficiais();
const cases = fixture.cases as unknown as FixtureCase[];

function flatten(prefix: string, value: unknown, out: Record<string, string>): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      flatten(prefix ? `${prefix}.${k}` : k, v, out);
    return;
  }
  out[prefix] = String(value);
}

function flat(roc: Roc): Record<string, string> {
  const out: Record<string, string> = {};
  if (roc.oper) flatten('oper.gCompraGov', roc.oper.gCompraGov, out);
  for (const it of roc.itens) {
    flatten(`item${it.nItem}`, it.IBSCBS, out);
    out[`item${it.nItem}.simulated`] = String(it.simulado);
  }
  flatten('total', roc.total.IBSCBSTot, out);
  return out;
}

describe('fixtures do oráculo', () => {
  test('gravadas da Calculadora fixada, com casos suficientes', () => {
    expect(fixture.calculadora.versaoDb).toBe('V0059');
    expect(cases.length).toBeGreaterThanOrEqual(100);
    const agree = cases.filter((c) => c.divergences.length === 0 && !('error' in c.engine)).length;
    expect(agree).toBeGreaterThan(cases.length / 2);
  });

  test('toda divergência gravada tem entrada no ledger', () => {
    for (const c of cases)
      for (const d of c.divergences) expect(d.ledger, `${c.id} ${d.path ?? d.outcome}`).not.toBeNull();
  });

  for (const c of cases) {
    test(`${c.id} (${c.date}, modelo ${c.op.modelo})`, () => {
      let got: Record<string, string> | { error: string };
      try {
        got = flat(calcularEm(c.op, { dataset, aliquotas: rates, data: c.date }));
      } catch (e) {
        got = { error: String((e as { code?: string }).code) };
      }
      if ('error' in c.engine) {
        expect(got).toMatchObject({ error: c.engine.error.split(':')[0] ?? '' });
      } else {
        expect(got).toEqual(c.engine);
        // A saída da Calculadora é a nossa com as divergências aplicadas; cada uma aponta um campo real.
        const fields = got as Record<string, string>;
        for (const d of c.divergences) if (d.path) expect(fields[d.path] ?? null).toBe(d.ours ?? null);
      }
    });
  }
});
