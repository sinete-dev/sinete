/**
 * `@sinete/ibs-cbs/calcular`: cálculo do IBS e da CBS a partir de uma operação já classificada.
 *
 * Recebe CST, cClassTrib e grupos informados por item (`OperacaoClassificada`) e devolve o `Roc`, com os grupos da NT
 * 2025.002 (`gIBSCBS`, `gRed`, `gDif`, `gDevTrib`, `gTribRegular`, `gTribCompraGov`, `gTransfCred`, `gAjusteCompet`,
 * `gEstornoCred`, `gCredPresOper`, `gCredPresIBSZFM`) e os totais `IBSCBSTot`. As regras vêm do `@sinete/ibs-cbs-dados`, as
 * alíquotas do `@sinete/ibs-cbs/aliquotas`. Monofasia, Imposto Seletivo e alíquotas combinadas lançam
 * `ErroRegimeNaoSuportado`: nunca sai valor zerado no lugar de um regime que o motor não calcula.
 */

export type { CalcularOpcoes } from './calculate.ts';
export { calcular, calcularEm } from './calculate.ts';
export type { RoundingMode } from './decimal.ts';
export { Decimal, dec, sum } from './decimal.ts';
export type { MotivoErroClassificacao, RegimeNaoSuportado } from './errors.ts';
export { ErroClassificacao, ErroExpressao, ErroRegimeNaoSuportado } from './errors.ts';
export type { Variaveis } from './expression.ts';
export { avaliar, conferirExpressao, ESCALA_INTERNA, VARIAVEIS_DAS_EXPRESSOES } from './expression.ts';
export { dePercentual, dinheiro, paraPercentual, percentual } from './format.ts';
export type { ValoresCompraGov } from './govpurchase.ts';
export { enteDe, REDISTRIBUICAO_A_PARTIR_DE, redistribuir } from './govpurchase.ts';
export type {
  AliquotaAplicada,
  AliquotasInformadas,
  CompraGovernamental,
  CreditoPresumido,
  CreditoPresumidoTributo,
  CreditoPresumidoZfm,
  DataIso,
  Dec,
  EntradaDoRastro,
  GCBS,
  GCredPresIBSZFM,
  GCredPresOper,
  GCredPresTributo,
  GDevTrib,
  GDif,
  GIBSCBS,
  GIBSMun,
  GIBSUF,
  GRed,
  GTribCompraGov,
  GTribRegular,
  IBSCBS,
  IBSCBSTot,
  ItemClassificado,
  LocalDaOperacao,
  OperacaoClassificada,
  OrigemDaAliquota,
  Roc,
  RocItem,
  TpEnteGov,
  TributacaoRegular,
} from './types.ts';
