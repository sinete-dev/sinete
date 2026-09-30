/**
 * Desfechos da SEFAZ a partir da tabela versionada de `cStat` (`data/cstat.json`, MOC 7.0 Anexo I, tabela 4.4.1).
 * Nenhuma lista de códigos fica no código: quem decide se um `cStat` é autorização, denegação ou pendência é o dado.
 */

import type { DicaRejeicao, Recusado, StatusSefaz } from '@sinete/core';
import { criarRecusado } from '@sinete/core';
import { completarRecusado } from '@sinete/rejeicoes';
import table from '../data/cstat.json' with { type: 'json' };

/** Classes de `cStat` que a tabela descreve. */
export type CStatClasse =
  | 'autorizada'
  | 'denegada'
  | 'cancelada'
  | 'loteRecebido'
  | 'loteProcessado'
  | 'loteEmProcessamento'
  | 'loteNaoLocalizado'
  | 'servicoEmOperacao'
  | 'inutilizacaoHomologada'
  | 'eventoRegistrado'
  | 'loteEventoProcessado'
  | 'cadastroEncontrado'
  | 'distribuicaoNenhumDocumento'
  | 'distribuicaoDocumentos'
  | 'duplicidade'
  | 'duplicidadeChaveDiferente'
  | 'naoConsta'
  | 'outraNfeNoNumero'
  | 'consumoIndevido';

const CLASSES: Readonly<Record<CStatClasse, readonly string[]>> = table;
const DICAS: Readonly<Record<string, DicaRejeicao>> = table.dicas;

/** O `cStat` pertence à classe da tabela. */
export function cstatEm(cStat: string, classe: CStatClasse): boolean {
  return CLASSES[classe].includes(cStat);
}

/**
 * Desfecho `rejected` enriquecido pelo `@sinete/rejeicoes`; sem curadoria lá, usa a dica própria do `@sinete/nfe`
 * (`dicas` em `data/cstat.json`) quando houver.
 */
export function rejeitado(status: StatusSefaz): Recusado {
  const r = completarRecusado(criarRecusado(status));
  if (r.dica !== undefined) return r;
  const dica = Object.hasOwn(DICAS, status.cStat) ? DICAS[status.cStat] : undefined;
  return dica === undefined ? r : criarRecusado(status, dica);
}
