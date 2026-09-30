/** Utilidades do extrator: JSON canônico, sha256, conversão de REAL do SQLite e de datas de planilha. */
import { createHash } from 'node:crypto';

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export { jsonCanonico as canonicalPretty, tabelaCanonica } from '../../../packages/ibs-cbs-dados/src/canonical.ts';

/**
 * REAL do SQLite para decimal em texto. `Number#toString` dá a menor representação que volta ao mesmo double, o que é
 * exato para percentuais com até 4 casas (ADR 0007, consequências).
 */
export function decimalText(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  if (!Number.isFinite(n)) throw new Error(`valor não finito: ${n}`);
  const s = String(n);
  if (/e/i.test(s)) throw new Error(`valor em notação exponencial, fora do formato esperado: ${s}`);
  return s;
}

/** Data de planilha (número de série do Excel, sistema 1900) para AAAA-MM-DD. */
export function excelDate(serial: string | undefined): string | null {
  if (serial === undefined || serial === '') return null;
  const n = Number(serial);
  if (!Number.isInteger(n) || n < 1) throw new Error(`data de planilha inválida: ${serial}`);
  // 25569 = 1970-01-01 no sistema 1900 do Excel (que conta o 29/02/1900 inexistente, irrelevante depois de 1900-03).
  const ms = (n - 25569) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Valor numérico de planilha (double serializado) para decimal em texto com no máximo `places` casas. */
export function sheetDecimal(v: string | undefined, places = 6): string | null {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const fixed = n.toFixed(places);
  return fixed.replace(/\.?0+$/, '') || '0';
}

export function isoDate(v: string | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`data fora do formato AAAA-MM-DD: ${v}`);
  return d;
}

export function sortBy<T>(xs: readonly T[], key: (x: T) => string): T[] {
  return [...xs].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
