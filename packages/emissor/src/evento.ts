/** Montagem do `DesfechoEvento` a partir dos desfechos dos pacotes de documento (uso interno dos subpaths). */

import type { DicaRejeicao } from '@sinete/core';
import type { DesfechoEvento } from './desfecho.ts';

/** `cStat` e `xMotivo` do retorno de um evento (`retEvento`, `retEventoMDFe`), o primeiro de cada. */
export function statusDoRetorno(retorno: string): { readonly cStat: string; readonly xMotivo: string } {
  const texto = (tag: string): string => new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</`).exec(retorno)?.[1]?.trim() ?? '';
  return { cStat: texto('cStat'), xMotivo: texto('xMotivo') };
}

export function eventoRegistrado<E, B>(
  evento: E,
  procEvento: string,
  status: { readonly cStat: string; readonly xMotivo: string },
  recuperado: boolean,
  bruto: B,
): DesfechoEvento<E, B> {
  return { tipo: 'registrado', cStat: status.cStat, xMotivo: status.xMotivo, evento, procEvento, recuperado, bruto };
}

export function eventoRecusado<E, B>(
  r: { readonly cStat: string; readonly xMotivo: string; readonly hint?: DicaRejeicao },
  bruto: B,
): DesfechoEvento<E, B> {
  return {
    tipo: 'recusado',
    cStat: r.cStat,
    xMotivo: r.xMotivo,
    ...(r.hint === undefined ? {} : { hint: r.hint }),
    bruto,
  };
}
