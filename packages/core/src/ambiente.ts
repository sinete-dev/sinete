/**
 * Ambiente SEFAZ. No XML ele aparece como `tpAmb` (`1` produção, `2` homologação); na API do sinete ele é sempre
 * nomeado, para que um `2` perdido não mande nota de teste para produção nem o contrário.
 */

import { ErroDeValidacao } from './errors.ts';

export type Ambiente = 'producao' | 'homologacao';

/** Valor lexical de `tpAmb` no leiaute (`TAmb`). */
export type TpAmb = '1' | '2';

export const AMBIENTES: readonly Ambiente[] = ['producao', 'homologacao'];

export function ehAmbiente(valor: unknown): valor is Ambiente {
  return valor === 'producao' || valor === 'homologacao';
}

export function tpAmbDoAmbiente(ambiente: Ambiente): TpAmb {
  return ambiente === 'producao' ? '1' : '2';
}

export function ambienteDoTpAmb(tpAmb: string): Ambiente {
  if (tpAmb === '1') return 'producao';
  if (tpAmb === '2') return 'homologacao';
  throw new ErroDeValidacao(`tpAmb inválido: ${JSON.stringify(tpAmb)}`, [
    { caminho: 'tpAmb', code: 'tpamb_invalido', mensagem: 'tpAmb deve ser 1 (produção) ou 2 (homologação)' },
  ]);
}
