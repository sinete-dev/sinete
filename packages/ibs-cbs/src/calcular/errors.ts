/** Erros do `@sinete/ibs-cbs/calcular`. Todos carregam o item (`nItem`) em `detalhes.item` quando o erro é de um item. */
import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';

/** Motivo de uma classificação recusada pelo motor, estável como o `code`. */
export type MotivoErroClassificacao =
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
 * cClassTrib fora da CST, não habilitado no modelo de DF-e, grupo exigido ausente ou vedado presente. `motivo` diz qual.
 */
export class ErroClassificacao extends ErroSinete<'ibscbs_classificacao_invalida'> {
  readonly motivo: MotivoErroClassificacao;
  readonly item: number | undefined;

  constructor(motivo: MotivoErroClassificacao, message: string, item?: number, opcoes: ErroSineteOpcoes = {}) {
    super('ibscbs_classificacao_invalida', message, {
      ...opcoes,
      detalhes: { ...opcoes.detalhes, motivo, ...(item === undefined ? {} : { item }) },
    });
    this.name = 'ErroClassificacao';
    this.motivo = motivo;
    this.item = item;
  }
}

/** Regime que o motor ainda não calcula. Nunca sai um valor preenchido com zero no lugar. */
export type RegimeNaoSuportado = 'monofasia' | 'imposto-seletivo' | 'aliquotas-combinadas' | 'ajuste';

export class ErroRegimeNaoSuportado extends ErroSinete<'ibscbs_regime_nao_suportado'> {
  readonly regime: RegimeNaoSuportado;
  readonly item: number | undefined;

  constructor(regime: RegimeNaoSuportado, message: string, item?: number, opcoes: ErroSineteOpcoes = {}) {
    super('ibscbs_regime_nao_suportado', message, {
      ...opcoes,
      detalhes: { ...opcoes.detalhes, regime, ...(item === undefined ? {} : { item }) },
    });
    this.name = 'ErroRegimeNaoSuportado';
    this.regime = regime;
    this.item = item;
  }
}

/** Expressão de cálculo do dataset fora da gramática conhecida: mudança de dado que precisa de revisão. */
export class ErroExpressao extends ErroSinete<'ibscbs_expressao_invalida'> {
  readonly expressao: string;

  constructor(expressao: string, message: string) {
    super('ibscbs_expressao_invalida', `expressão "${expressao}": ${message}`, { detalhes: { expressao } });
    this.name = 'ErroExpressao';
    this.expressao = expressao;
  }
}
