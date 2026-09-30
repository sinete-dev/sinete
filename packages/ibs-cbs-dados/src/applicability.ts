/**
 * Aplicabilidade de NCM e NBS a um cClassTrib, reimplementada a partir do dataset.
 *
 * Espelha a tabela-verdade da Calculadora (`NcmAplicavelService` e `NbsAplicavelService`, V0057), conferida contra o
 * endpoint `/ncm-aplicavel` em 3.000 pares (ADR 0007):
 *
 * - sem nenhum vínculo vigente para o cClassTrib: `sem-restricao` (código conceitual, sem anexo; qualquer NCM passa);
 * - com vínculo, o código de item incompleto (NCM com menos de 8 dígitos, NBS com menos de 9): `incompleta`;
 * - nenhum vínculo vigente cobre o código por prefixo: `nao`;
 * - uma exceção vigente cobre o código, de um vínculo que também o cobre (em qualquer vigência), e não existe vínculo
 *   vigente cobrindo o código que tenha ao menos uma linha de exceção fora de vigência ou nenhuma exceção: `nao`;
 * - senão: `sim`.
 *
 * A última regra reproduz o `LEFT JOIN` da consulta oficial: o anexo modela um vínculo genérico duplicado por
 * exceção, e o vínculo "limpo" é o que tem ao menos uma linha de junção sem exceção vigente.
 */
import { vigente } from './dates.ts';
import type { DataIso, RegistroAplicabilidade } from './types.ts';

export type Aplicabilidade = 'sim' | 'nao' | 'sem-restricao' | 'incompleta';

export interface ResultadoAplicabilidade {
  readonly resultado: Aplicabilidade;
  /** Vínculos vigentes que cobrem o código (com o item de anexo), para explicar a decisão. */
  readonly casou: readonly RegistroAplicabilidade[];
  /** Exceções vigentes que cobrem o código. */
  readonly excluidoPor: readonly string[];
}

export function aplicabilidade(
  vinculos: readonly RegistroAplicabilidade[],
  codigo: string,
  data: DataIso,
  tamanhoCompleto: number,
): ResultadoAplicabilidade {
  const vigentes = vinculos.filter((l) => vigente(l.vigencia, data));
  if (vigentes.length === 0) return { resultado: 'sem-restricao', casou: [], excluidoPor: [] };
  if (codigo.length !== tamanhoCompleto || !/^\d+$/.test(codigo))
    return { resultado: 'incompleta', casou: [], excluidoPor: [] };
  const covering = vigentes.filter((l) => codigo.startsWith(l.prefixo));
  if (covering.length === 0) return { resultado: 'nao', casou: [], excluidoPor: [] };
  const excludedBy = vinculos
    .filter((l) => codigo.startsWith(l.prefixo))
    .flatMap((l) => l.excecoes.filter((e) => codigo.startsWith(e.prefixo) && vigente(e.vigencia, data)))
    .map((e) => e.prefixo);
  const clean = covering.some((l) => l.excecoes.length === 0 || l.excecoes.some((e) => !vigente(e.vigencia, data)));
  if (excludedBy.length > 0 && !clean) return { resultado: 'nao', casou: covering, excluidoPor: excludedBy };
  return { resultado: 'sim', casou: covering, excluidoPor: [] };
}
