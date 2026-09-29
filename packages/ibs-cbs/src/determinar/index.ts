/**
 * `@sinete/ibs-cbs/determinar`: determinação do CST e do cClassTrib do IBS e da CBS a partir de fatos de negócio.
 *
 * `constrain` aplica só as restrições oficiais (vigência, DF-e, tipo de nota, nomenclatura, anexos de NCM e NBS, atores)
 * e diz o motivo de cada código excluído. `determine` soma as regras legais fechadas (`LEGAL_RULES`), as respostas do
 * usuário e os resolvedores plugáveis, e devolve cada decisão com proveniência. `toClassified` monta a entrada do
 * `@sinete/ibs-cbs/calcular`.
 */

export type { ConstrainOptions, ItemConstraints } from './constrain.ts';
export { candidateOf, constrain, constrainAt, factDate } from './constrain.ts';
export type { DetermineAtOptions, DetermineOptions, ItemInput, OperationInput } from './determine.ts';
export {
  askUser,
  DEFAULT_RESOLVERS,
  determine,
  determineAt,
  fromProfile,
  questionId,
  toClassified,
  uniqueCandidate,
} from './determine.ts';
export type { DeterminationReason } from './errors.ts';
export { DeterminationError } from './errors.ts';
export { ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR, LEGAL_RULES } from './legal.ts';
export type {
  AppliedRule,
  Candidate,
  Determination,
  Exclusion,
  ExclusionReason,
  ItemDetermination,
  ItemFacts,
  ItemProfile,
  LegalOutcome,
  LegalRule,
  LegalRuleContext,
  OperationFacts,
  OperationKind,
  PartyFacts,
  Provenance,
  Question,
  QuestionOption,
  ResolveContext,
  Resolver,
  ResolverOutcome,
} from './types.ts';
