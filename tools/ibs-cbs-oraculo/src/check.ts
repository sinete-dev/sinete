/**
 * Um caso contra os dois lados: o motor local (`calcularEm`) e a Calculadora (`POST /calculadora/regime-geral`).
 */

import type { ProvedorDeAliquotas } from '@sinete/ibs-cbs/aliquotas';
import type { Roc } from '@sinete/ibs-cbs/calcular';
import { calcularEm } from '@sinete/ibs-cbs/calcular';
import type { DatasetIbsCbs } from '@sinete/ibs-cbs-dados';
import type { Flat } from './compare.ts';
import { diff, flattenOracle, flattenRoc, toApi } from './compare.ts';
import type { OracleCase } from './generate.ts';
import type { Divergence } from './ledger.ts';

/** `typed`: recusa reconhecida (erro tipado do motor, 4xx da Calculadora); o resto é falha inesperada. */
export type Side<T> = { ok: true; value: T } | { ok: false; error: string; typed: boolean };

export interface CaseResult {
  readonly engine: Side<Roc>;
  readonly oracle: Side<unknown>;
  readonly divergences: readonly Divergence[];
  /** Projeção plana da resposta da Calculadora, quando ela calculou. */
  readonly oracleFlat?: Flat;
}

export function runEngine(c: OracleCase, dataset: DatasetIbsCbs, rates: ProvedorDeAliquotas): Side<Roc> {
  try {
    return { ok: true, value: calcularEm(c.op, { dataset, aliquotas: rates, data: c.date }) };
  } catch (e) {
    const err = e as { code?: string; motivo?: string; regime?: string; message?: string };
    const detail = [err.code, err.motivo ?? err.regime].filter(Boolean).join(':');
    const typed = typeof err.code === 'string' && err.code.startsWith('ibscbs_');
    return { ok: false, error: `${detail} ${err.message ?? String(e)}`, typed };
  }
}

export async function runOracle(api: string, c: OracleCase): Promise<Side<unknown>> {
  const res = await fetch(`${api}/calculadora/regime-geral`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(toApi(c)),
  });
  const body = (await res.json().catch(() => null)) as { detail?: string; title?: string } | null;
  if (!res.ok) {
    const typed = res.status >= 400 && res.status < 500 && typeof body?.detail === 'string';
    return { ok: false, error: `${res.status} ${body?.detail ?? body?.title ?? JSON.stringify(body)}`, typed };
  }
  return { ok: true, value: body };
}

export function compareCase(engine: Side<Roc>, oracle: Side<unknown>): CaseResult {
  if (!engine.ok && !oracle.ok) {
    // Só recusa reconhecida dos dois lados conta como concordância; falha inesperada de um deles passa pelo ledger.
    const divergences: Divergence[] = [];
    if (!engine.typed) divergences.push({ outcome: 'engine-error', engineError: engine.error });
    if (!oracle.typed) divergences.push({ outcome: 'oracle-error', oracleError: oracle.error });
    return { engine, oracle, divergences };
  }
  if (!oracle.ok) {
    return { engine, oracle, divergences: [{ outcome: 'oracle-error', oracleError: oracle.error }] };
  }
  const oracleFlat = flattenOracle(oracle.value as Parameters<typeof flattenOracle>[0]);
  if (!engine.ok) {
    return { engine, oracle, oracleFlat, divergences: [{ outcome: 'engine-error', engineError: engine.error }] };
  }
  const diffs = diff(flattenRoc(engine.value), oracleFlat);
  return { engine, oracle, oracleFlat, divergences: diffs.map((d) => ({ outcome: 'diff', diff: d })) };
}
