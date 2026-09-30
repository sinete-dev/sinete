/**
 * `@sinete/ibs-cbs/aliquotas`: alíquotas nominais do IBS e da CBS por data de fato gerador, com estado da fonte.
 *
 * Toda alíquota é `oficial` (com dispositivo legal e fonte), `informada` (pelo usuário, com motivo) ou `desconhecida`
 * (ainda não publicada). Em 2026 valem as alíquotas de teste (CBS 0,9%, IBS estadual 0,1%, municipal 0%); em 2027 e
 * 2028, o IBS de 0,05% + 0,05% da LC 214/2025 e a CBS desconhecida até a resolução do Senado; de 2029 em diante,
 * desconhecidas até as leis dos entes e do Senado. Fica fora do `@sinete/ibs-cbs-dados` porque a cadência é outra.
 */

export { ErroAliquotaDesconhecida, ErroDadosDeAliquotas } from './errors.ts';
export {
  aliquotasOficiais,
  comAliquotasInformadas,
  ehSimulada,
  exigirAliquota,
  TABELA_ALIQUOTAS,
  VERSAO_DO_FORMATO_DAS_ALIQUOTAS,
} from './provider.ts';
export type {
  Aliquota,
  AliquotaInformada,
  AliquotasNominais,
  DataIso,
  Dec,
  FonteDaAliquota,
  Local,
  ProvedorDeAliquotas,
  RegistroAliquotaDeReferencia,
  RegistroAliquotaPadrao,
  SituacaoDaAliquota,
  TabelaDeAliquotas,
  TributoDaAliquota,
  Vigencia,
} from './types.ts';
export { TRIBUTOS_DAS_ALIQUOTAS } from './types.ts';
