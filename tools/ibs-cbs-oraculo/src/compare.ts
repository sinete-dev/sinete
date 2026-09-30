/**
 * Tradução de um caso para o `POST /calculadora/regime-geral`, projeção das duas respostas num mesmo formato plano
 * (caminho -> texto) e comparação campo a campo, com igualdade exata dos textos formatados (valores em 2 casas e
 * percentuais de 2 a 4 casas, como no XML). Tolerância só existe dentro de uma entrada do ledger.
 */
import type { Roc } from '@sinete/ibs-cbs/calcular';
import type { OracleCase } from './generate.ts';

/** Corpo do `POST /calculadora/regime-geral` equivalente ao caso. */
export function toApi(c: OracleCase): unknown {
  const { op } = c;
  return {
    id: c.id,
    versao: '0.0.1',
    dhFatoGerador: `${c.date}T12:00:00-03:00`,
    municipio: Number(op.local.cMun),
    uf: op.local.uf,
    tpDoc: op.modelo,
    ...(op.compraGovernamental
      ? {
          gCompraGov: {
            tpEnteGov: op.compraGovernamental.tpEnteGov,
            ...(op.compraGovernamental.tpOperGov ? { tpOperGov: op.compraGovernamental.tpOperGov } : {}),
          },
        }
      : {}),
    itens: op.itens.map((it) => {
      const meta = c.meta.find((m) => m.n === it.n);
      const r = it.aliquotasInformadas;
      return {
        numero: it.n,
        cst: it.cst,
        cClassTrib: it.cClassTrib,
        baseCalculo: Number(it.base),
        quantidade: 1,
        unidade: 'UN',
        ...(meta?.ncm ? { ncm: meta.ncm } : {}),
        ...(meta?.nbs ? { nbs: meta.nbs } : {}),
        ...(it.regular ? { tributacaoRegular: { cst: it.regular.cst, cClassTrib: it.regular.cClassTrib } } : {}),
        ...(r
          ? {
              aliquotasNominais: {
                cbs: Number(r.CBS),
                ibsEstadual: Number(r.IBSUF),
                ibsMunicipal: Number(r.IBSMun),
              },
            }
          : {}),
      };
    }),
  };
}

export type Flat = Record<string, string>;

function flatten(prefix: string, value: unknown, out: Flat): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flatten(prefix ? `${prefix}.${k}` : k, v, out);
    }
    return;
  }
  out[prefix] = String(value);
}

const DROP = new Set(['memoriaCalculo']);

function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (!DROP.has(k)) o[k] = clean(v);
    return o;
  }
  return value;
}

interface OracleRoc {
  oper?: { gCompraGov?: Record<string, unknown> };
  objetos?: { nObj: number; tribCalc?: { IBSCBS?: unknown }; calculoSimulado?: boolean }[];
  total?: { tribCalc?: { IBSCBSTot?: Record<string, unknown> } };
}

/** Projeção da resposta da Calculadora. `gMono` dos totais sai: o motor não suporta monofasia. */
export function flattenOracle(body: OracleRoc): Flat {
  const out: Flat = {};
  if (body.oper?.gCompraGov) flatten('oper.gCompraGov', body.oper.gCompraGov, out);
  for (const o of body.objetos ?? []) {
    flatten(`item${o.nObj}`, clean(o.tribCalc?.IBSCBS), out);
    out[`item${o.nObj}.simulated`] = String(Boolean(o.calculoSimulado));
  }
  const tot = body.total?.tribCalc?.IBSCBSTot;
  if (tot) {
    const { gMono: _mono, ...rest } = tot;
    flatten('total', rest, out);
  }
  return out;
}

export function flattenRoc(roc: Roc): Flat {
  const out: Flat = {};
  if (roc.oper) flatten('oper.gCompraGov', roc.oper.gCompraGov, out);
  for (const it of roc.itens) {
    flatten(`item${it.nItem}`, it.IBSCBS, out);
    out[`item${it.nItem}.simulated`] = String(it.simulado);
  }
  flatten('total', roc.total.IBSCBSTot, out);
  return out;
}

export interface FieldDiff {
  readonly path: string;
  readonly ours: string | null;
  readonly theirs: string | null;
}

export function diff(ours: Flat, theirs: Flat): FieldDiff[] {
  const out: FieldDiff[] = [];
  const keys = [...new Set([...Object.keys(ours), ...Object.keys(theirs)])].sort();
  for (const k of keys) {
    const a = ours[k] ?? null;
    const b = theirs[k] ?? null;
    if (a !== b) out.push({ path: k, ours: a, theirs: b });
  }
  return out;
}
