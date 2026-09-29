/**
 * `@sinete/rejeicoes/mdfe`: catálogo de rejeições do MDF-e (modelo 58).
 *
 * Os códigos do MDF-e colidem com os da NF-e com outro significado (611 e 686 são bloqueios por MDF-e não encerrado,
 * 220 é o prazo de 24 horas do cancelamento do MDF-e), então o catálogo é outro e fica numa entrada própria: quem não
 * emite MDF-e não carrega este JSON. Gerado por `tools/rejeicoes-data/mdfe.ts` a partir das regras de validação do MOC
 * MDF-e 3.00b (Anexo I e Visão Geral) e das NT 2025.001 e 2026.001, com o sha256 de cada PDF conferido.
 */

import type { Rejected, RejectionHint, SefazOutcome } from '@sinete/core';
import table from './data/rejeicoes-mdfe.json' with { type: 'json' };
import type { RejeicaoCategory, RejeicaoRule, RejeicoesTableInfo } from './index.ts';

export interface RejeicaoMdfe {
  /** `cStat`, 3 ou 4 dígitos (NT 2025.001, item 5). */
  readonly code: string;
  /** O MDF-e não tem denegação: todo código é rejeição. */
  readonly effect: 'rejeicao';
  /** Mensagem oficial sem o prefixo "Rejeição:", com os marcadores do documento (`[nProt:999999999999999]`). */
  readonly message: string;
  /** Todas as mensagens quando o código aparece em regras com texto diferente (684 no MOC e na NT 2026.001). */
  readonly messages?: readonly string[];
  readonly modelos: readonly '58'[];
  /** Documento e regra de origem (`MOC MDF-e 3.00b Anexo I, regra F85`). */
  readonly source: string;
  readonly rules: readonly RejeicaoRule[];
  readonly category: RejeicaoCategory;
  readonly causaProvavel?: string;
  readonly comoCorrigir?: string;
  readonly referencia?: string;
}

/** Metadados do catálogo do MDF-e: versão (data de coleta) e documentos de origem com sha256. */
export const REJEICOES_MDFE_TABLE: RejeicoesTableInfo = {
  schemaVersion: table.schemaVersion,
  version: table.version,
  sources: table.sources,
};

/** Todas as entradas do MDF-e, em ordem numérica de código. */
export const REJEICOES_MDFE: readonly RejeicaoMdfe[] = table.rejeicoes as readonly RejeicaoMdfe[];

const byCode: ReadonlyMap<string, RejeicaoMdfe> = new Map(REJEICOES_MDFE.map((r) => [r.code, r]));

/** Entrada do catálogo do MDF-e para o `cStat`, ou `undefined` se o código não está catalogado. */
export function rejeicaoMdfeByCode(cStat: string): RejeicaoMdfe | undefined {
  return byCode.get(cStat.trim());
}

/** `RejectionHint` do core para o código do MDF-e, quando há curadoria de causa e correção. */
export function rejectionHintMdfe(cStat: string): RejectionHint | undefined {
  const r = rejeicaoMdfeByCode(cStat);
  if (!r?.causaProvavel || !r.comoCorrigir) return undefined;
  return { probableCause: r.causaProvavel, suggestedFix: r.comoCorrigir, source: r.referencia ?? r.source };
}

/** Preenche o `hint` de um desfecho `rejected` do MDF-e. Não sobrescreve um `hint` já presente. */
export function enrichRejectedMdfe(outcome: Rejected): Rejected {
  if (outcome.hint !== undefined) return outcome;
  const hint = rejectionHintMdfe(outcome.cStat);
  return hint === undefined ? outcome : { ...outcome, hint };
}

/** Como `enrichRejectedMdfe`, aceitando qualquer desfecho; só o `rejected` muda. */
export function enrichOutcomeMdfe<T, D = T>(outcome: SefazOutcome<T, D>): SefazOutcome<T, D> {
  return outcome.status === 'rejected' ? enrichRejectedMdfe(outcome) : outcome;
}
