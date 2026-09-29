/**
 * Fuso do emitente e formatação dos instantes do leiaute (`TDateTimeUTC`, `AAAA-MM-DDThh:mm:ss±hh:mm`). O fuso vem da
 * tabela `data/fusos.json` pela UF, ou do chamador; nunca do fuso da máquina.
 */

import type { Clock, Uf } from '@sinete/core';
import { formatDateTimeOffset } from '@sinete/core';
import fusos from './data/fusos.json' with { type: 'json' };

/** Instante no tempo, como os relógios do `@sinete/core` o devolvem (o tipo `Date`, sem tocar no global). */
export type Instante = ReturnType<Clock['now']>;

const UF_OFFSETS: Readonly<Record<string, number>> = fusos.ufs;

/** Deslocamento do horário legal da UF em minutos (`-180` para Brasília). */
export function offsetDaUf(uf: Uf): number {
  return Object.hasOwn(UF_OFFSETS, uf) ? (UF_OFFSETS[uf] as number) : fusos.padrao;
}

/** `TDateTimeUTC` do instante no deslocamento dado. */
export function formatDh(date: Instante, offsetMinutes: number): string {
  return formatDateTimeOffset(date, offsetMinutes);
}
