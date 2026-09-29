/**
 * Junção das tabelas de CST e cClassTrib da Calculadora com as do IT 2025.002 (desenho §1.2, ADR 0007 pendência 4).
 *
 * A Calculadora é a base (tem vigência, tratamentos e fundamentação); o IT é a tabela que os autorizadores usam nas
 * regras de validação e traz colunas que a Calculadora não tem. Cada divergência entre as duas vira um `Conflict` com
 * id estável. O extrator falha em conflito que não esteja no ledger revisado (`conflicts.json`) e em entrada do
 * ledger que não aconteceu mais, para o ledger nunca envelhecer em silêncio.
 */
import type {
  ClassTribRecord,
  CstRecord,
  Indicator,
  IsoDate,
  TreatmentRecord,
  Validity,
} from '../../../packages/ibs-cbs-dados/src/types.ts';
import type { CalcClassTrib, CalcCst } from './calculadora.ts';
import type { ItClassTrib, ItCst } from './it.ts';
import { IT_DFE_COLUMNS } from './it.ts';

export interface Conflict {
  /** Id estável: `tabela:código:campo`. */
  readonly id: string;
  readonly table: 'cst' | 'classTrib';
  readonly code: string;
  readonly field: string;
  readonly calculadora: unknown;
  readonly it: unknown;
}

export interface LedgerEntry {
  readonly id: string;
  readonly reason: string;
  readonly source: string;
}

export interface MergeResult {
  readonly cst: CstRecord[];
  readonly classTrib: ClassTribRecord[];
  readonly conflicts: Conflict[];
}

const inForce = (v: Validity, d: IsoDate): boolean => v.from <= d && (v.to === null || v.to >= d);
const ind = (b: boolean): Indicator => (b ? 'required' : 'forbidden');

const CST_FIELDS: readonly [keyof CstRecord['groups'], string][] = [
  ['gIBSCBS', 'ind_gIBSCBS'],
  ['gIBSCBSMono', 'ind_gIBSCBSMono'],
  ['gRed', 'ind_gRed'],
  ['gDif', 'ind_gDif'],
  ['gTransfCred', 'ind_gTransfCred'],
  ['gCredPresIBSZFM', 'ind_gCredPresIBSZFM'],
  ['gAjusteCompet', 'ind_gAjusteCompet'],
];

const CLASS_FIELDS: readonly [keyof CalcClassTrib['groups'], string][] = [
  ['gCredPresOper', 'ind_gCredPresOper'],
  ['gMonoPadrao', 'ind_gMonoPadrao'],
  ['gMonoReten', 'ind_gMonoReten'],
  ['gMonoRet', 'ind_gMonoRet'],
  ['gMonoDif', 'ind_gMonoDif'],
  ['gEstornoCred', 'ind_gEstornoCred'],
];

/** Decimal em texto normalizado para comparação (`60.0` e `60` são iguais). */
const num = (s: string | null | undefined): string => (s === null || s === undefined ? '0' : String(Number(s)));

export function merge(
  calc: { cst: readonly CalcCst[]; classTrib: readonly CalcClassTrib[]; treatments: readonly TreatmentRecord[] },
  it: { cst: readonly ItCst[]; classTrib: readonly ItClassTrib[] },
  ids: { calculadora: string; it: string },
  /** Data da tabela do IT: é nela que se comparam valores com vigência (reduções, DF-e). */
  itDate: IsoDate,
): MergeResult {
  const conflicts: Conflict[] = [];
  const push = (
    table: Conflict['table'],
    code: string,
    field: string,
    calculadora: unknown,
    itValue: unknown,
  ): void => {
    conflicts.push({ id: `${table}:${code}:${field}`, table, code, field, calculadora, it: itValue });
  };

  // ---------------- CST ----------------
  const itCst = new Map(it.cst.map((c) => [c.code, c]));
  const cst: CstRecord[] = calc.cst.map(({ _id, ...c }) => {
    if (c.family !== 'CBS_IBS') return { ...c, sources: [ids.calculadora] };
    const i = itCst.get(c.code);
    const current = inForce(c.validity, itDate);
    if (!i) {
      if (current) push('cst', c.code, 'presenca', 'presente', 'ausente');
      return { ...c, sources: [ids.calculadora] };
    }
    for (const [field, col] of CST_FIELDS) {
      const itv = ind(i.groups[col] === true);
      if (c.groups[field] !== itv) push('cst', c.code, field, c.groups[field], itv);
    }
    return {
      ...c,
      groups: { ...c.groups, redutorBC: ind(i.groups.ind_RedutorBC === true) },
      sources: [ids.calculadora, ids.it],
    };
  });
  for (const i of it.cst) {
    if (!calc.cst.some((c) => c.family === 'CBS_IBS' && c.code === i.code && inForce(c.validity, itDate))) {
      push('cst', i.code, 'presenca', 'ausente', 'presente');
    }
  }

  // ---------------- cClassTrib ----------------
  const treatment = new Map(calc.treatments.map((t) => [t.id, t]));
  const itByCode = new Map<string, ItClassTrib[]>();
  for (const i of it.classTrib) itByCode.set(i.code, [...(itByCode.get(i.code) ?? []), i]);
  const itModels = new Set(Object.values(IT_DFE_COLUMNS));

  const classTrib: ClassTribRecord[] = calc.classTrib.map(({ _id, basis, ...c }) => {
    const base = { ...c, legal: { lc214: null, link: null, basis } };
    const at = (v: Validity): IsoDate => (inForce(v, itDate) ? itDate : v.from);
    const tr = c.treatments.find((t) => inForce(t.validity, at(c.validity)));
    const trRegular = tr ? (treatment.get(tr.treatment)?.flags.exigeGrupoTribRegular ?? false) : false;
    if (c.family !== 'CBS_IBS') {
      return {
        ...base,
        name: null,
        groups: { ...c.groups, gTribRegular: ind(trRegular), gpBioDiferenca: null },
        sources: [ids.calculadora],
      };
    }
    const i = (itByCode.get(c.code) ?? []).find((x) => x.validity.from === c.validity.from);
    if (!i) {
      if (inForce(c.validity, itDate) || c.validity.from > itDate)
        push('classTrib', c.code, 'presenca', 'presente', 'ausente');
      return {
        ...base,
        name: null,
        groups: { ...c.groups, gTribRegular: ind(trRegular), gpBioDiferenca: null },
        sources: [ids.calculadora],
      };
    }
    const d = at(c.validity);
    const check = (field: string, cv: unknown, iv: unknown): void => {
      if (JSON.stringify(cv) !== JSON.stringify(iv)) push('classTrib', c.code, field, cv, iv);
    };
    check('cst', c.cst, i.cst);
    check('rateKind', c.rateKind, i.rateKind);
    check('validity.to', c.validity.to, i.validity.to);
    check('tpRBSN', c.tpRBSN, i.tpRBSN);
    check('annex', c.annex, i.annex);
    for (const [field, col] of CLASS_FIELDS) {
      const iv: Indicator =
        field === 'gCredPresOper' ? (i.indicators[col] ? 'allowed' : 'forbidden') : ind(i.indicators[col] === true);
      check(field, c.groups[field], iv);
    }
    check('gTribRegular', ind(trRegular), ind(i.indicators.ind_gTribRegular === true));
    const red = (t: string): string => num(c.reductions.find((r) => r.tributo === t && inForce(r.validity, d))?.pRed);
    check('pRedCBS', red('CBS'), num(i.pRedCBS));
    check('pRedIBSUF', red('IBSUF'), num(i.pRedIBS));
    check('pRedIBSMun', red('IBSMun'), num(i.pRedIBS));
    const calcDfe = [
      ...new Set(c.dfe.filter((x) => itModels.has(x.modelo) && inForce(x.validity, d)).map((x) => x.modelo)),
    ].sort((a, b) => a - b);
    for (const m of new Set([...calcDfe, ...i.dfe])) {
      if (calcDfe.includes(m) !== i.dfe.includes(m)) {
        push('classTrib', c.code, `dfe.${m}`, calcDfe.includes(m), i.dfe.includes(m));
      }
    }
    return {
      ...base,
      name: i.name,
      legal: { lc214: i.lc214, link: i.link, basis },
      groups: {
        ...c.groups,
        gTribRegular: ind(i.indicators.ind_gTribRegular === true),
        gpBioDiferenca: ind(i.indicators.ind_gpBioDiferenca === true),
      },
      sources: [ids.calculadora, ids.it],
    };
  });
  for (const i of it.classTrib) {
    if (
      !calc.classTrib.some((c) => c.family === 'CBS_IBS' && c.code === i.code && c.validity.from === i.validity.from)
    ) {
      push('classTrib', i.code, 'presenca', 'ausente', 'presente');
    }
  }
  conflicts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { cst, classTrib, conflicts };
}

/** Confronta os conflitos com o ledger: devolve os novos (fora do ledger) e as entradas que não aconteceram. */
export function reconcile(
  conflicts: readonly Conflict[],
  ledger: readonly LedgerEntry[],
): { unexpected: Conflict[]; stale: LedgerEntry[] } {
  const known = new Set(ledger.map((l) => l.id));
  const seen = new Set(conflicts.map((c) => c.id));
  return {
    unexpected: conflicts.filter((c) => !known.has(c.id)),
    stale: ledger.filter((l) => !seen.has(l.id)),
  };
}
