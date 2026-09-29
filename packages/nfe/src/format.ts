/**
 * Formatação dos decimais na forma lexical que cada tipo do leiaute aceita (ADR 0002: o número de casas vem do
 * pattern do XSD, nunca do serializer). Cada formato abaixo cita os tipos `TDec_*` que ele cobre.
 */

import type { Decimal, RoundingMode } from './decimal.ts';

export interface DecimalFormat {
  /** Nome curto, para mensagens. */
  readonly name: string;
  /** Casas mínimas (completa com zeros até aqui). */
  readonly min: number;
  /** Casas máximas aceitas pelo pattern. */
  readonly max: number;
  /** Casas exigidas quando a parte inteira é zero e o valor não é zero (`TDec_0803v`: `0\.[0-9]{3}`). */
  readonly minBelowOne?: number;
  /** O pattern recusa zero (`TDec_1302Opc`, `TDec_0302a04Opc`): o campo zerado deve ser omitido. */
  readonly nonZero?: boolean;
  /** Maior quantidade de dígitos inteiros aceita. */
  readonly intDigits: number;
}

/** `TDec_1302`, `TDec1302RTC`: 13 inteiros e exatamente 2 casas. */
export const D1302: DecimalFormat = { name: 'TDec_1302', min: 2, max: 2, intDigits: 13 };
/** `TDec_1302Opc`: como `TDec_1302`, sem zero. */
export const D1302_OPC: DecimalFormat = { name: 'TDec_1302Opc', min: 2, max: 2, intDigits: 13, nonZero: true };
/** `TDec_0302a04`, `TDec_0302_04RTC`, `TDec_0302a04Max100`: 3 inteiros e 2 a 4 casas. */
export const D0302A04: DecimalFormat = { name: 'TDec_0302a04', min: 2, max: 4, intDigits: 3 };
/** `TDec_0302a04Opc`: o pattern (`0\.[0-9]{2,4}|...`) aceita zero, ao contrário de `TDec_1302Opc`. */
export const D0302A04_OPC: DecimalFormat = { name: 'TDec_0302a04Opc', min: 2, max: 4, intDigits: 3 };
/** `TDec_0302Max100`: 2 casas exatas. */
export const D0302: DecimalFormat = { name: 'TDec_0302Max100', min: 2, max: 2, intDigits: 3 };
/** `TDec_1104v`: 11 inteiros e 0 a 4 casas. */
export const D1104V: DecimalFormat = { name: 'TDec_1104v', min: 0, max: 4, intDigits: 11 };
/** `TDec_1104`, `TDec1104RTC`: 11 inteiros e 4 casas. */
export const D1104: DecimalFormat = { name: 'TDec_1104', min: 4, max: 4, intDigits: 11 };
/** `TDec_1110v`: 11 inteiros e 0 a 10 casas. */
export const D1110V: DecimalFormat = { name: 'TDec_1110v', min: 0, max: 10, intDigits: 11 };
/** `TDec_1204v`: 12 inteiros e 0 a 4 casas. */
export const D1204V: DecimalFormat = { name: 'TDec_1204v', min: 0, max: 4, intDigits: 12 };
/** `TDec_1204`: 12 inteiros e 4 casas quando há fração (4 fixas aqui, que o pattern aceita sempre). */
export const D1204: DecimalFormat = { name: 'TDec_1204', min: 4, max: 4, intDigits: 12 };
/** `TDec_1203`: 12 inteiros e 3 casas. */
export const D1203: DecimalFormat = { name: 'TDec_1203', min: 3, max: 3, intDigits: 12 };
/** `TDec_0803v`: 8 inteiros e até 3 casas; abaixo de 1, exatamente 3. */
export const D0803V: DecimalFormat = { name: 'TDec_0803v', min: 0, max: 3, intDigits: 8, minBelowOne: 3 };

/** Texto do valor já arredondado no formato (arredonda em `max` casas pelo modo dado). */
export function formatDecimal(value: Decimal, format: DecimalFormat, mode: RoundingMode = 'HALF_UP'): string {
  const r = value.round(format.max, mode);
  let places = Math.max(format.min, Math.min(format.max, r.significantScale()));
  if (format.minBelowOne !== undefined && !r.isZero() && r.abs().lt(1)) places = Math.max(places, format.minBelowOne);
  return r.toFixed(places, mode);
}

/** Por que o valor não cabe no formato, ou `undefined` se cabe sem perder dígitos. */
export function formatProblem(value: Decimal, format: DecimalFormat): string | undefined {
  if (value.isNegative()) return 'valor negativo';
  if (format.nonZero && value.isZero()) return 'valor zero não é aceito neste campo';
  if (value.significantScale() > format.max) return `mais de ${format.max} casas decimais`;
  const intDigits = value.round(0, 'DOWN').abs().toString().replace(/^0$/, '').length;
  if (intDigits > format.intDigits) return `mais de ${format.intDigits} dígitos inteiros`;
  return undefined;
}
