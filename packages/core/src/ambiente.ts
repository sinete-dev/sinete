/**
 * Ambiente SEFAZ. No XML ele aparece como `tpAmb` (`1` produção, `2` homologação); na API do sinete ele é sempre
 * nomeado, para que um `2` perdido não mande nota de teste para produção nem o contrário.
 */

import { ValidationError } from './errors.ts';

export type Ambiente = 'producao' | 'homologacao';

/** Valor lexical de `tpAmb` no leiaute (`TAmb`). */
export type TpAmb = '1' | '2';

export const AMBIENTES: readonly Ambiente[] = ['producao', 'homologacao'];

export function isAmbiente(value: unknown): value is Ambiente {
  return value === 'producao' || value === 'homologacao';
}

export function tpAmbOf(ambiente: Ambiente): TpAmb {
  return ambiente === 'producao' ? '1' : '2';
}

export function ambienteOfTpAmb(tpAmb: string): Ambiente {
  if (tpAmb === '1') return 'producao';
  if (tpAmb === '2') return 'homologacao';
  throw new ValidationError(`tpAmb inválido: ${JSON.stringify(tpAmb)}`, [
    { path: 'tpAmb', code: 'tpamb_invalido', message: 'tpAmb deve ser 1 (produção) ou 2 (homologação)' },
  ]);
}
