/**
 * Ledger de divergências conhecidas entre o motor e a Calculadora. Cada entrada descreve um padrão (caminho do campo,
 * condição do caso, erro de um dos lados), o motivo e a fonte. Divergência que nenhuma entrada explica falha a
 * execução; entrada com `expectHits` que não explicou nada também falha, para o ledger não acumular entulho.
 */
import { Decimal } from '@sinete/ibs-cbs/calcular';
import type { FieldDiff } from './compare.ts';
import type { OracleCase } from './generate.ts';

export type Outcome = 'diff' | 'oracle-error' | 'engine-error';

export interface LedgerMatch {
  readonly outcome: Outcome;
  /** Expressão regular sobre o caminho do campo (`item1.gIBSCBS.vIBS`, `total.gCBS.vCBS`). */
  readonly path?: string;
  /** Diferença absoluta máxima entre os dois valores (texto decimal). */
  readonly maxAbsDiff?: string;
  /** Só casos com (true) ou sem (false) compra governamental. */
  readonly gov?: boolean;
  readonly yearFrom?: number;
  readonly yearTo?: number;
  /** Algum item do caso usa um destes cClassTrib. */
  readonly cClassTrib?: readonly string[];
  /** Trecho do `detail` do erro da Calculadora. */
  readonly oracleError?: string;
  /** `code` ou `reason`/`regime` do erro do motor. */
  readonly engineError?: string;
  /** Algum item do caso informa este grupo de entrada do motor (`presumedCredit`, `creditReversal`...). */
  readonly withInput?: string;
}

export interface LedgerEntry {
  readonly id: string;
  readonly kind: 'engine-choice' | 'oracle-gap' | 'oracle-refuses' | 'oracle-input';
  readonly match: LedgerMatch;
  readonly reason: string;
  readonly source: string;
  readonly expectHits: boolean;
}

export interface Ledger {
  readonly comment: string;
  readonly calculadora: { readonly versaoDb: string; readonly zipSha256: string };
  readonly entries: readonly LedgerEntry[];
}

export interface Divergence {
  readonly outcome: Outcome;
  readonly diff?: FieldDiff;
  readonly oracleError?: string;
  readonly engineError?: string;
}

function absDiff(a: string | null, b: string | null): Decimal | undefined {
  if (a === null || b === null || !Decimal.isDecimalText(a) || !Decimal.isDecimalText(b)) return undefined;
  const d = Decimal.parse(a).sub(Decimal.parse(b));
  return d.isNegative() ? d.neg() : d;
}

export function matches(e: LedgerEntry, c: OracleCase, d: Divergence): boolean {
  const m = e.match;
  if (m.outcome !== d.outcome) return false;
  const year = Number(c.date.slice(0, 4));
  if (m.gov !== undefined && (c.op.governmentPurchase !== undefined) !== m.gov) return false;
  if (m.yearFrom !== undefined && year < m.yearFrom) return false;
  if (m.yearTo !== undefined && year > m.yearTo) return false;
  // Divergência num campo de item só se explica pelo próprio item; total e erro do caso olham o caso inteiro.
  const at = d.diff ? /^item(\d+)\./.exec(d.diff.path) : null;
  const items = at ? c.op.items.filter((i) => i.n === Number(at[1])) : c.op.items;
  if (m.cClassTrib && !items.some((i) => m.cClassTrib?.includes(i.cClassTrib))) return false;
  if (
    m.withInput !== undefined &&
    !items.some((i) => (i as unknown as Record<string, unknown>)[m.withInput ?? ''] !== undefined)
  ) {
    return false;
  }
  if (m.oracleError !== undefined && !(d.oracleError ?? '').includes(m.oracleError)) return false;
  if (m.engineError !== undefined && !(d.engineError ?? '').includes(m.engineError)) return false;
  if (m.path !== undefined && !(d.diff && new RegExp(m.path).test(d.diff.path))) return false;
  if (m.maxAbsDiff !== undefined) {
    const x = d.diff ? absDiff(d.diff.ours, d.diff.theirs) : undefined;
    if (x === undefined || x.cmp(Decimal.parse(m.maxAbsDiff)) > 0) return false;
  }
  return true;
}

export function explain(ledger: Ledger, c: OracleCase, d: Divergence): LedgerEntry | undefined {
  return ledger.entries.find((e) => matches(e, c, d));
}
