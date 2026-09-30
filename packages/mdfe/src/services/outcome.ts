/**
 * Desfechos da SEFAZ a partir da tabela versionada de `cStat` do MDF-e (`data/cstat.json`). Nenhuma lista de códigos
 * fica no código: quem decide se um `cStat` é autorização, cancelamento ou encerramento é o dado. A rejeição vem com a
 * dica do catálogo do MDF-e no `@sinete/rejeicoes` (os códigos do MDF-e colidem com os da NF-e e têm outro sentido).
 */

import type { Recusado, StatusSefaz } from '@sinete/core';
import { criarRecusado } from '@sinete/core';
import { completarRecusadoMdfe } from '@sinete/rejeicoes/mdfe';
import table from '../data/cstat.json' with { type: 'json' };

export type CStatClasse =
  | 'autorizado'
  | 'cancelado'
  | 'encerrado'
  | 'servicoEmOperacao'
  | 'naoEncerradosLocalizados'
  | 'naoEncerradosNenhum'
  | 'eventoRegistrado'
  | 'duplicidade'
  | 'duplicidadeChaveDiferente'
  | 'naoConsta';

const CLASSES: Readonly<Record<CStatClasse, readonly string[]>> = table;

/** O `cStat` pertence à classe da tabela. */
export function cstatEm(cStat: string, classe: CStatClasse): boolean {
  return CLASSES[classe].includes(cStat);
}

/** Desfecho `rejected` enriquecido pelo catálogo de rejeições do MDF-e. */
export function rejeitado(status: StatusSefaz): Recusado {
  return completarRecusadoMdfe(criarRecusado(status));
}
