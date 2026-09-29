/** Erros do `@sinete/ibs-cbs/calcular`. Todos carregam o item (`nItem`) em `details.item` quando o erro é de um item. */
import type { SineteErrorOptions } from '@sinete/core';
import { SineteError } from '@sinete/core';

/** Motivo de uma classificação recusada pelo motor, estável como o `code`. */
export type ClassificationReason =
  | 'cst_inexistente'
  | 'cclasstrib_inexistente'
  | 'cclasstrib_fora_da_cst'
  | 'nao_habilitado_no_dfe'
  | 'tratamento_ausente'
  | 'tributacao_regular_obrigatoria'
  | 'tributacao_regular_invalida'
  | 'grupo_obrigatorio'
  | 'grupo_vedado'
  | 'grupos_exclusivos'
  | 'ccredpres_inexistente'
  | 'ccredpres_fora_de_vigencia'
  | 'dados_incompletos'
  | 'entrada_invalida';

/**
 * A classificação informada não pode ser calculada: código inexistente ou fora de vigência na data do fato gerador,
 * cClassTrib fora da CST, não habilitado no modelo de DF-e, grupo exigido ausente ou vedado presente. `reason` diz qual.
 */
export class ClassificationError extends SineteError<'ibscbs_classificacao_invalida'> {
  readonly reason: ClassificationReason;
  readonly item: number | undefined;

  constructor(reason: ClassificationReason, message: string, item?: number, options: SineteErrorOptions = {}) {
    super('ibscbs_classificacao_invalida', message, {
      ...options,
      details: { ...options.details, reason, ...(item === undefined ? {} : { item }) },
    });
    this.name = 'ClassificationError';
    this.reason = reason;
    this.item = item;
  }
}

/** Regime que o motor ainda não calcula. Nunca sai um valor preenchido com zero no lugar. */
export type UnsupportedRegime = 'monofasia' | 'imposto-seletivo' | 'aliquotas-combinadas' | 'ajuste';

export class UnsupportedRegimeError extends SineteError<'ibscbs_regime_nao_suportado'> {
  readonly regime: UnsupportedRegime;
  readonly item: number | undefined;

  constructor(regime: UnsupportedRegime, message: string, item?: number, options: SineteErrorOptions = {}) {
    super('ibscbs_regime_nao_suportado', message, {
      ...options,
      details: { ...options.details, regime, ...(item === undefined ? {} : { item }) },
    });
    this.name = 'UnsupportedRegimeError';
    this.regime = regime;
    this.item = item;
  }
}

/** Expressão de cálculo do dataset fora da gramática conhecida: mudança de dado que precisa de revisão. */
export class ExpressionError extends SineteError<'ibscbs_expressao_invalida'> {
  readonly expression: string;

  constructor(expression: string, message: string) {
    super('ibscbs_expressao_invalida', `expressão "${expression}": ${message}`, { details: { expression } });
    this.name = 'ExpressionError';
    this.expression = expression;
  }
}
