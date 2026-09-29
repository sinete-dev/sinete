/**
 * A hora em que a SVC deixa de atender a UF, lida do `xMotivo` do 113 na consulta de status da SVC (NT 2013.007 v1.03,
 * item 04.7: "SVC será desabilitada para a SEFAZ-XX em dd/mm/aa às hh:mm horas"; regra K05.3: "SVC-[XX] será
 * desabilitada para a UF informada às HH:MM").
 */

import type { Clock } from '@sinete/core';
import type { Instante } from './store.ts';

/**
 * Fuso da hora do 113: o horário de Brasília (UTC-3), o das duas SVC (SVC-AN e SVC-RS). A NT não diz o fuso; sem
 * horário de verão desde 2019, os dois autorizadores estão em UTC-3.
 */
const FUSO_MS = -3 * 3_600_000;
const DIA_MS = 86_400_000;

/**
 * O instante do `xMotivo` do 113, ou `undefined` sem hora legível. Com a data (`dd/mm/aa` ou `dd/mm/aaaa`), a hora
 * dessa data; sem ela, a ocorrência da hora mais próxima de agora (o 113 fala dos próximos 15 minutos). Quem chama
 * trata `undefined`, e a hora já passada, como a SVC encerrada na hora.
 */
export function fimDaSvcPeloMotivo(xMotivo: string, clock: Clock): Instante | undefined {
  const horas = [...xMotivo.matchAll(/(?<!\d)([01]?\d|2[0-3])\s*[:hH]\s*([0-5]\d)(?!\d)/g)];
  const hora = horas.at(-1);
  if (hora === undefined) return undefined;
  const minutos = Number(hora[1]) * 60 + Number(hora[2]);
  // O relógio de parede de Brasília, contado como se fosse UTC: meia-noite local é múltiplo do dia.
  const local = clock.now().getTime() + FUSO_MS;
  const data = /(?<!\d)(\d{2})\/(\d{2})\/(\d{4}|\d{2})(?!\d)/.exec(xMotivo);
  let dia: number;
  if (data === null) {
    dia = local - (((local % DIA_MS) + DIA_MS) % DIA_MS);
  } else {
    const [d, m, a] = [Number(data[1]), Number(data[2]), Number(data[3])];
    const ano = (data[3] as string).length === 2 ? 2000 + a : a;
    // Um Date do relógio injetado (sem o global Date), levado à data do xMotivo.
    const c = clock.now();
    c.setUTCFullYear(ano, m - 1, d);
    c.setUTCHours(0, 0, 0, 0);
    if (c.getUTCFullYear() !== ano || c.getUTCMonth() !== m - 1 || c.getUTCDate() !== d) return undefined;
    dia = c.getTime();
  }
  let alvo = dia + minutos * 60_000;
  if (data === null) {
    if (alvo - local > DIA_MS / 2) alvo -= DIA_MS;
    else if (local - alvo > DIA_MS / 2) alvo += DIA_MS;
  }
  const fim = clock.now();
  fim.setTime(alvo - FUSO_MS);
  return fim;
}
