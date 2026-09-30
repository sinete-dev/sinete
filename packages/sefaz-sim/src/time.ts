/**
 * Datas como milissegundos desde a época, sem o global `Date` (princípio 6: o simulador só lê o tempo do `Relogio`
 * injetado). A conversão entre dia civil e dia da época é o algoritmo `days_from_civil`/`civil_from_days` de Howard
 * Hinnant ("chrono-Compatible Low-Level Date Algorithms", domínio público), válido no calendário gregoriano proléptico.
 */

const DAY_MS = 86_400_000;

/** Dia da época (1970-01-01 = 0) de uma data civil. */
export function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

/** Data civil de um dia da época. */
export function civilFromDays(days: number): { year: number; month: number; day: number } {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** Partes UTC de um instante. */
export interface UtcParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

export function utcParts(ms: number): UtcParts {
  const days = Math.floor(ms / DAY_MS);
  const rest = ms - days * DAY_MS;
  const { year, month, day } = civilFromDays(days);
  const secs = Math.floor(rest / 1000);
  return { year, month, day, hour: Math.floor(secs / 3600), minute: Math.floor(secs / 60) % 60, second: secs % 60 };
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

/** `AAAA-MM-DDThh:mm:ss±hh:mm` (TDateTimeUTC dos leiautes) no deslocamento pedido, em minutos. */
export function formatInstant(ms: number, offsetMinutes: number): string {
  const p = utcParts(ms + offsetMinutes * 60_000);
  const abs = Math.abs(offsetMinutes);
  const sign = offsetMinutes < 0 ? '-' : '+';
  return (
    `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

/** Lê um `TDateTimeUTC` (com fuso obrigatório) como milissegundos desde a época; `undefined` fora do formato. */
export function parseDateTime(text: string): number | undefined {
  const m = DATE_TIME.exec(text.trim());
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s, zone, sign, oh, om] = m;
  const days = daysFromCivil(Number(y), Number(mo), Number(d));
  const local = days * DAY_MS + (Number(h) * 3600 + Number(mi) * 60 + Number(s)) * 1000;
  if (zone === 'Z') return local;
  const offset = (Number(oh) * 60 + Number(om)) * (sign === '-' ? -1 : 1);
  return local - offset * 60_000;
}

/** Ano civil de um instante, no deslocamento do autorizador. */
export function yearOf(ms: number, offsetMinutes: number): number {
  return utcParts(ms + offsetMinutes * 60_000).year;
}
