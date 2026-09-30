/**
 * `@sinete/ibs-cbs/determinar`: determinação do CST e do cClassTrib do IBS e da CBS a partir de fatos de negócio.
 *
 * `restringir` aplica só as restrições oficiais (vigência, DF-e, tipo de nota, nomenclatura, anexos de NCM e NBS, atores)
 * e diz o motivo de cada código excluído. `determinar` soma as regras legais fechadas (`REGRAS_LEGAIS`), as respostas do
 * usuário e os resolvedores plugáveis, e devolve cada decisão com proveniência. `paraClassificado` monta a entrada do
 * `@sinete/ibs-cbs/calcular`.
 */

export type { RestricoesDoItem, RestringirOpcoes } from './constrain.ts';
export { candidatoDe, dataDoFato, restringir, restringirEm } from './constrain.ts';
export type { DeterminarEmOpcoes, DeterminarOpcoes, EntradaDaOperacao, EntradaDoItem } from './determine.ts';
export {
  candidatoUnico,
  determinar,
  determinarEm,
  doPerfil,
  idDaPergunta,
  paraClassificado,
  perguntarAoUsuario,
  RESOLVEDORES_PADRAO,
} from './determine.ts';
export type { MotivoErroDeterminacao } from './errors.ts';
export { ErroDeterminacao } from './errors.ts';
export { ATOR_PRODUTOR_RURAL_NAO_CONTRIBUINTE, REGRAS_LEGAIS } from './legal.ts';
export type {
  Candidato,
  ContextoDoResolvedor,
  ContextoRegraLegal,
  Determinacao,
  DeterminacaoDoItem,
  Exclusao,
  FatosDaOperacao,
  FatosDaParte,
  FatosDoItem,
  MotivoDaExclusao,
  OpcaoDaPergunta,
  PerfilDoItem,
  Pergunta,
  Procedencia,
  RegraAplicada,
  RegraLegal,
  Resolvedor,
  ResultadoDoResolvedor,
  ResultadoRegraLegal,
  TipoDeOperacao,
} from './types.ts';
