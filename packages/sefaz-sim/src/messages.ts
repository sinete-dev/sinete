/**
 * `xMotivo` oficial de cada `cStat`: resultados de processamento da tabela 4.4.1 do MOC 7.0 Anexo I
 * (`data/status.json`) e rejeições e denegações do catálogo do `@sinete/rejeicoes`, com os marcadores
 * (`[nRec:999999999999999]`, `[chNFe: 999...]`) preenchidos ou removidos.
 */

import { ErroDeConfiguracao } from '@sinete/core';
import { rejeicaoPorCodigo } from '@sinete/rejeicoes';
import { rejeicaoMdfePorCodigo } from '@sinete/rejeicoes/mdfe';
import tableMdfe from './data/mdfe-status.json' with { type: 'json' };
import table from './data/status.json' with { type: 'json' };

const RESULTS: ReadonlyMap<string, string> = new Map(Object.entries(table.codigos));
const RESULTS_MDFE: ReadonlyMap<string, string> = new Map(Object.entries(tableMdfe.codigos));

/** Valores dos marcadores entre colchetes da mensagem oficial (`nRec`, `chNFe`, `nProt`) ou `campo` do `<nome do campo>`. */
export type ParametrosDoMotivo = Readonly<Record<string, string>>;

/**
 * O `TMotivo` do leiaute só aceita Latin-1 (`[!-ÿ]`); o catálogo guarda aspas e travessões tipográficos do PDF, que
 * viram os equivalentes ASCII para que a resposta continue válida no schema.
 */
const TIPOGRAFICOS: ReadonlyMap<number, string> = new Map([
  [0x201c, '"'],
  [0x201d, '"'],
  [0x2018, "'"],
  [0x2019, "'"],
  [0x2013, '-'],
  [0x2014, '-'],
]);

function latin1(text: string): string {
  let out = '';
  for (const ch of text) out += TIPOGRAFICOS.get(ch.codePointAt(0) ?? 0) ?? ch;
  return out;
}

function fill(message: string, params: ParametrosDoMotivo): string {
  // O catálogo guarda algumas mensagens com o marcador sem o `]` final (quebra de linha no PDF, como o 562).
  const withMarkers = message.replace(/\[\s*([A-Za-z]+)\s*:[^\]]*(?:\]|$)/g, (all, name: string) => {
    const value = params[name];
    return value === undefined ? (/^\[\s*[A-Za-z]+\s*:\s*9+\s*\]?$/.test(all) ? '' : all) : `[${name}:${value}]`;
  });
  const campo = params.campo;
  const filled = campo === undefined ? withMarkers : withMarkers.replace('<nome do campo>', () => campo);
  return latin1(filled.replace(/\s+$/, '').replace(/\s{2,}/g, ' '));
}

/** O `cStat` é um resultado de processamento da tabela 4.4.1 (100, 103, 135...)? */
export function ehResultado(cStat: string): boolean {
  return RESULTS.has(cStat);
}

/**
 * Mensagem de um resultado da tabela 4.4.1 quando houver; senão a rejeição ou denegação do catálogo, com o prefixo
 * `Rejeição: ` ou `Uso Denegado: ` que o Anexo I usa na coluna "Descrição Erro".
 */
export function motivo(cStat: string, parametros: ParametrosDoMotivo = {}): string {
  const result = RESULTS.get(cStat);
  if (result !== undefined) return result;
  return motivoRejeicao(cStat, parametros);
}

/** Mensagem do catálogo com o prefixo, mesmo para os códigos que também são resultado (108 e 109 nos grupos B03 e B04). */
export function motivoRejeicao(cStat: string, parametros: ParametrosDoMotivo = {}): string {
  const r = rejeicaoPorCodigo(cStat);
  if (r === undefined)
    throw new ErroDeConfiguracao(`cStat ${cStat} fora do catálogo de rejeições`, { detalhes: { cStat } });
  return `${r.efeito === 'denegacao' ? 'Uso Denegado' : 'Rejeição'}: ${fill(r.mensagem, parametros)}`;
}

/** O código é uma denegação (o número fica consumido e há protocolo)? */
export function ehDenegacao(cStat: string): boolean {
  return rejeicaoPorCodigo(cStat)?.efeito === 'denegacao';
}

/**
 * Mensagem de um `cStat` do MDF-e: resultado (`data/mdfe-status.json`) ou rejeição do catálogo do MDF-e no
 * `@sinete/rejeicoes/mdfe` (os códigos do MDF-e colidem com os da NF-e e têm outro sentido).
 */
export function motivoMdfe(cStat: string, parametros: ParametrosDoMotivo = {}): string {
  const result = RESULTS_MDFE.get(cStat);
  if (result !== undefined) return result;
  const r = rejeicaoMdfePorCodigo(cStat);
  if (r === undefined)
    throw new ErroDeConfiguracao(`cStat ${cStat} fora do catálogo do MDF-e`, { detalhes: { cStat } });
  return `Rejeição: ${fill(r.mensagem, parametros)}`;
}
