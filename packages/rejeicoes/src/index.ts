/**
 * `@sinete/rejeicoes`: catálogo de rejeições e denegações da SEFAZ para NF-e e NFC-e.
 *
 * O catálogo vive em `data/rejeicoes.json`, gerado por `tools/rejeicoes-data` a partir dos PDFs oficiais (MOC 7.0
 * Anexo I e NT 2025.002, mais códigos avulsos das NT 2025.001 e 2024.003) com sha256 conferido, mais a curadoria manual de causa provável e correção. Este módulo só
 * consulta a tabela e preenche o `RejectionHint` do `SefazOutcome` do `@sinete/core`.
 */

import type { DataSource, Rejected, RejectionHint, SefazOutcome } from '@sinete/core';
import table from './data/rejeicoes.json' with { type: 'json' };

/** Categoria do problema, para agrupar tratamento e mensagens de interface. */
export type RejeicaoCategory =
  | 'schema'
  | 'assinatura'
  | 'certificado'
  | 'cadastro'
  | 'regra-negocio'
  | 'duplicidade'
  | 'reforma';

export const REJEICAO_CATEGORIES: readonly RejeicaoCategory[] = [
  'schema',
  'assinatura',
  'certificado',
  'cadastro',
  'regra-negocio',
  'duplicidade',
  'reforma',
];

/** Regra de validação em que o código aparece. */
export interface RejeicaoRule {
  /** Id do documento em `REJEICOES_TABLE.sources` (`moc70-anexo1`, `nt2025002`, `nt2025001`, `nt2024003`). */
  readonly doc: string;
  /** Id da regra no documento (`C17-20`, `UB13-10`). */
  readonly id: string;
}

export interface Rejeicao {
  /** `cStat`, 3 ou 4 dígitos. */
  readonly code: string;
  /** Rejeição (pode corrigir e reenviar) ou denegação (número consumido). */
  readonly effect: 'rejeicao' | 'denegacao';
  /** Mensagem oficial, sem o prefixo "Rejeição:" e com os placeholders do documento (`[nItem: 999]`). */
  readonly message: string;
  /** Todas as mensagens oficiais quando o documento atribui mais de uma ao mesmo código. */
  readonly messages?: readonly string[];
  /** Modelos em que a regra se aplica (`55` NF-e, `65` NFC-e). */
  readonly modelos: readonly ('55' | '65')[];
  /** Origem do código: documento, versão e tabela ou regra (`MOC 7.0 Anexo I, tabela 4.4.2`). */
  readonly source: string;
  readonly rules: readonly RejeicaoRule[];
  readonly category: RejeicaoCategory;
  /** Diagnóstico curado; presente só nos códigos revisados. */
  readonly causaProvavel?: string;
  readonly comoCorrigir?: string;
  /** Regra citada pela curadoria (`MOC 7.0 Anexo I, RV C17-20`). */
  readonly referencia?: string;
}

export interface RejeicaoSource extends DataSource {
  readonly id: string;
  readonly versao: string;
  readonly citation: string;
  readonly sha256: string;
}

export interface RejeicoesTableInfo {
  readonly schemaVersion: number;
  readonly version: string;
  readonly sources: readonly RejeicaoSource[];
}

/** Metadados do catálogo: versão (data de coleta) e documentos de origem com sha256. */
export const REJEICOES_TABLE: RejeicoesTableInfo = {
  schemaVersion: table.schemaVersion,
  version: table.version,
  sources: table.sources,
};

/** Todas as entradas, em ordem numérica de código. */
export const REJEICOES: readonly Rejeicao[] = table.rejeicoes as readonly Rejeicao[];

const byCode: ReadonlyMap<string, Rejeicao> = new Map(REJEICOES.map((r) => [r.code, r]));

/** Entrada do catálogo para o `cStat` (`'204'`, `'1020'`), ou `undefined` se o código não está catalogado. */
export function rejeicaoByCode(cStat: string): Rejeicao | undefined {
  return byCode.get(cStat.trim());
}

/** `RejectionHint` do core para o código, quando há curadoria de causa e correção. */
export function rejectionHint(cStat: string): RejectionHint | undefined {
  const r = rejeicaoByCode(cStat);
  if (!r?.causaProvavel || !r.comoCorrigir) return undefined;
  return { probableCause: r.causaProvavel, suggestedFix: r.comoCorrigir, source: r.referencia ?? r.source };
}

/**
 * Preenche o `hint` de um desfecho `rejected` a partir do catálogo. Não sobrescreve um `hint` já presente e devolve o
 * mesmo objeto quando não há o que acrescentar.
 */
export function enrichRejected(outcome: Rejected): Rejected {
  if (outcome.hint !== undefined) return outcome;
  const hint = rejectionHint(outcome.cStat);
  return hint === undefined ? outcome : { ...outcome, hint };
}

/** Como `enrichRejected`, aceitando qualquer desfecho; só o `rejected` muda. */
export function enrichOutcome<T, D = T>(outcome: SefazOutcome<T, D>): SefazOutcome<T, D> {
  return outcome.status === 'rejected' ? enrichRejected(outcome) : outcome;
}
