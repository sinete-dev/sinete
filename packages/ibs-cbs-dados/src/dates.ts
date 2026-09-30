/**
 * Datas civis e vigência. O dataset trabalha com a data civil do fato gerador (`AAAA-MM-DD`); o instante vem do
 * `Relogio` de fato gerador do `@sinete/core` e vira data no fuso do local da operação, informado pelo chamador.
 */
import type { Relogio } from '@sinete/core';
import { ErroDeConfiguracao, formatarDataHoraComFuso } from '@sinete/core';
import type { IsoDate, Validity } from './types.ts';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Confere o formato e a existência da data (`2026-02-30` é inválida). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= (days[mo - 1] ?? 0);
}

/** Valida e devolve a data, ou lança `ErroDeConfiguracao`. */
export function requireIsoDate(value: unknown, what = 'data'): IsoDate {
  if (!isIsoDate(value)) {
    throw new ErroDeConfiguracao(`${what} inválida: ${JSON.stringify(value)}; use AAAA-MM-DD`, { detalhes: { value } });
  }
  return value;
}

/** Vigência fechada nas duas pontas, como nas consultas da Calculadora (`inicio <= data <= fim`). */
export function inForce(validity: Validity, date: IsoDate): boolean {
  return validity.from <= date && (validity.to === null || validity.to >= date);
}

/** Deslocamento padrão: horário de Brasília (UTC-3, sem horário de verão desde 2019). */
export const BRASILIA_OFFSET_MINUTES = -180;

/**
 * Data civil de um instante no deslocamento informado. O deslocamento depende do local da operação (UTC-4 no Amazonas
 * e em Rondônia, UTC-5 no Acre), então vem do chamador; o padrão é Brasília.
 */
export function civilDate(
  instant: ReturnType<Relogio['agora']>,
  offsetMinutes: number = BRASILIA_OFFSET_MINUTES,
): IsoDate {
  return formatarDataHoraComFuso(instant, offsetMinutes).slice(0, 10);
}
