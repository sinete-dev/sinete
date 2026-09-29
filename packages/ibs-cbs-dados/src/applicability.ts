/**
 * Aplicabilidade de NCM e NBS a um cClassTrib, reimplementada a partir do dataset.
 *
 * Espelha a tabela-verdade da Calculadora (`NcmAplicavelService` e `NbsAplicavelService`, V0057), conferida contra o
 * endpoint `/ncm-aplicavel` em 3.000 pares (ADR 0007):
 *
 * - sem nenhum vínculo vigente para o cClassTrib: `not-restricted` (código conceitual, sem anexo; qualquer NCM passa);
 * - com vínculo, o código de item incompleto (NCM com menos de 8 dígitos, NBS com menos de 9): `incomplete`;
 * - nenhum vínculo vigente cobre o código por prefixo: `no`;
 * - uma exceção vigente cobre o código, de um vínculo que também o cobre (em qualquer vigência), e não existe vínculo
 *   vigente cobrindo o código que tenha ao menos uma linha de exceção fora de vigência ou nenhuma exceção: `no`;
 * - senão: `yes`.
 *
 * A última regra reproduz o `LEFT JOIN` da consulta oficial: o anexo modela um vínculo genérico duplicado por
 * exceção, e o vínculo "limpo" é o que tem ao menos uma linha de junção sem exceção vigente.
 */
import { inForce } from './dates.ts';
import type { ApplicabilityRecord, IsoDate } from './types.ts';

export type Applicability = 'yes' | 'no' | 'not-restricted' | 'incomplete';

export interface ApplicabilityResult {
  readonly result: Applicability;
  /** Vínculos vigentes que cobrem o código (com o item de anexo), para explicar a decisão. */
  readonly matched: readonly ApplicabilityRecord[];
  /** Exceções vigentes que cobrem o código. */
  readonly excludedBy: readonly string[];
}

export function applicability(
  links: readonly ApplicabilityRecord[],
  code: string,
  date: IsoDate,
  fullLength: number,
): ApplicabilityResult {
  const vigentes = links.filter((l) => inForce(l.validity, date));
  if (vigentes.length === 0) return { result: 'not-restricted', matched: [], excludedBy: [] };
  if (code.length !== fullLength || !/^\d+$/.test(code)) return { result: 'incomplete', matched: [], excludedBy: [] };
  const covering = vigentes.filter((l) => code.startsWith(l.prefix));
  if (covering.length === 0) return { result: 'no', matched: [], excludedBy: [] };
  const excludedBy = links
    .filter((l) => code.startsWith(l.prefix))
    .flatMap((l) => l.exceptions.filter((e) => code.startsWith(e.prefix) && inForce(e.validity, date)))
    .map((e) => e.prefix);
  const clean = covering.some((l) => l.exceptions.length === 0 || l.exceptions.some((e) => !inForce(e.validity, date)));
  if (excludedBy.length > 0 && !clean) return { result: 'no', matched: covering, excludedBy };
  return { result: 'yes', matched: covering, excludedBy: [] };
}
