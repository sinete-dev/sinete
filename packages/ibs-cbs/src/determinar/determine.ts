/**
 * Determinação: restrições oficiais, depois regras legais, depois respostas do usuário e resolvedores plugáveis, nessa
 * ordem. Cada decisão sai com proveniência (quem, quando, com que versão dos dados e por qual fonte), porque é isso que
 * o contribuinte mostra numa fiscalização. Assíncrona porque um resolvedor pode ser IA, cadastro ou fila de revisão.
 */
import type { Relogio } from '@sinete/core';
import type { TaxContent } from '@sinete/ibs-cbs-dados';
import { inForce } from '@sinete/ibs-cbs-dados';
import type { ClassifiedItem, ClassifiedOperation, GovernmentPurchase, OperationPlace } from '../calcular/index.ts';
import type { ConstrainOptions } from './constrain.ts';
import { constrainAt, factDate } from './constrain.ts';
import { DeterminationError } from './errors.ts';
import { LEGAL_RULES } from './legal.ts';
import type {
  AppliedRule,
  Candidate,
  Determination,
  Exclusion,
  ItemDetermination,
  ItemFacts,
  LegalRule,
  OperationFacts,
  Provenance,
  Question,
  ResolveContext,
  Resolver,
  ResolverOutcome,
} from './types.ts';

export interface DetermineAtOptions {
  /** Regras legais aplicadas; padrão: `LEGAL_RULES`. */
  readonly rules?: readonly LegalRule[];
  /** Resolvedores na ordem de consulta; padrão: `fromProfile()`, `uniqueCandidate()`, `askUser()`. */
  readonly resolvers?: readonly Resolver[];
  /** Respostas às perguntas de uma chamada anterior: id da pergunta para o cClassTrib escolhido. */
  readonly answers?: Readonly<Record<string, string>>;
  /** Relógio do instante da decisão, que vai na proveniência. */
  readonly clock: Relogio;
  readonly signal?: AbortSignal;
}

export interface DetermineOptions extends ConstrainOptions, Omit<DetermineAtOptions, 'clock'> {
  /** Relógio do instante da decisão; padrão: o de emissão de `time`. */
  readonly clock?: Relogio;
}

/** Id estável da pergunta de classificação de um item. */
export function questionId(n: number): string {
  return `cClassTrib:${n}`;
}

/** Decide quando só sobrou um candidato. */
export function uniqueCandidate(): Resolver {
  return {
    name: 'unique-candidate',
    resolve: async (ctx: ResolveContext): Promise<ResolverOutcome> =>
      ctx.candidates.length === 1 && ctx.candidates[0]
        ? { kind: 'decided', cClassTrib: ctx.candidates[0].cClassTrib, confidence: 1, evidence: 'único candidato' }
        : { kind: 'abstain' },
  };
}

/** Reaproveita a classificação guardada no cadastro do item, se ela ainda estiver entre os candidatos. */
export function fromProfile(): Resolver {
  return {
    name: 'item-profile',
    resolve: async ({ item, candidates }: ResolveContext): Promise<ResolverOutcome> => {
      const p = item.profile;
      if (!p || !candidates.some((c) => c.cClassTrib === p.cClassTrib)) return { kind: 'abstain' };
      return { kind: 'decided', cClassTrib: p.cClassTrib, confidence: 1, evidence: { decidedBy: p.decidedBy ?? null } };
    },
  };
}

/** Pergunta ao usuário entre os candidatos que sobraram; a resposta volta em `answers[questionId(n)]`. */
export function askUser(): Resolver {
  return {
    name: 'ask-user',
    resolve: async ({ item, candidates }: ResolveContext): Promise<ResolverOutcome> => {
      if (candidates.length === 0) return { kind: 'abstain' };
      const what = item.description ? `: ${item.description}` : '';
      return {
        kind: 'ask',
        questions: [
          {
            id: questionId(item.n),
            item: item.n,
            text: `Qual a classificação tributária do item ${item.n}${what}?`,
            options: candidates.map((c) => ({
              label: `${c.cClassTrib} ${c.name ?? c.description}`,
              cClassTrib: c.cClassTrib,
            })),
          },
        ],
      };
    },
  };
}

export const DEFAULT_RESOLVERS: readonly Resolver[] = [fromProfile(), uniqueCandidate(), askUser()];

interface Narrowed {
  readonly candidates: readonly Candidate[];
  readonly exclusions: readonly Exclusion[];
  readonly rules: readonly AppliedRule[];
}

function applyRules(
  facts: OperationFacts,
  item: ItemFacts,
  content: TaxContent,
  rules: readonly LegalRule[],
  start: { candidates: readonly Candidate[]; exclusions: readonly Exclusion[] },
): Narrowed {
  let candidates = start.candidates;
  const exclusions = [...start.exclusions];
  const applied: AppliedRule[] = [];
  for (const rule of rules) {
    if (!inForce(rule.validity, content.asOf)) continue;
    const out = rule.apply({ facts, item, content });
    if (out.kind === 'none') continue;
    const keep = new Set(out.codes);
    const kept = candidates.filter((c) => keep.has(c.cClassTrib));
    for (const c of candidates) {
      if (keep.has(c.cClassTrib)) continue;
      exclusions.push({
        cClassTrib: c.cClassTrib,
        reason: 'regra-legal',
        detail: `${rule.title}: só ${out.codes.join(' ou ')}`,
        source: rule.source,
      });
    }
    applied.push({ rule: rule.id, source: rule.source, codes: out.codes, conflict: kept.length === 0 });
    candidates = kept;
  }
  return { candidates, exclusions, rules: applied };
}

function pick(candidates: readonly Candidate[], code: string): Candidate | undefined {
  return candidates.find((c) => c.cClassTrib === code);
}

/** Determinação na data do fato gerador de `options.time`. */
export function determine(facts: OperationFacts, options: DetermineOptions): Promise<Determination> {
  const content = options.dataset.at(factDate(options.time, options.utcOffsetMinutes));
  return determineAt(facts, content, { ...options, clock: options.clock ?? options.time.emissao });
}

/** Determinação numa visão já fixada numa data. */
export async function determineAt(
  facts: OperationFacts,
  content: TaxContent,
  options: DetermineAtOptions,
): Promise<Determination> {
  const constrained = constrainAt(facts, content);
  const rules = options.rules ?? LEGAL_RULES;
  const resolvers = options.resolvers ?? DEFAULT_RESOLVERS;
  const answers = options.answers ?? {};
  const base = (): Pick<Provenance, 'at' | 'contentVersion' | 'asOf'> => ({
    at: options.clock.agora().toISOString(),
    contentVersion: content.dataset.contentVersion,
    asOf: content.asOf,
  });
  const items: ItemDetermination[] = [];
  for (const [i, item] of facts.items.entries()) {
    const start = constrained[i] as (typeof constrained)[number];
    const { candidates, exclusions, rules: applied } = applyRules(facts, item, content, rules, start);
    const common = { n: item.n, candidates, exclusions, rules: applied };

    const byUser = (id: string, answer: string): NonNullable<ItemDetermination['decided']> => {
      const chosen = pick(candidates, answer);
      if (!chosen) {
        throw new DeterminationError(
          'resposta_fora_dos_candidatos',
          `resposta ${answer} à pergunta ${id} fora dos candidatos do item ${item.n}`,
          item.n,
        );
      }
      return { candidate: chosen, provenance: { by: 'user', name: id, ...base() } };
    };
    const answer = answers[questionId(item.n)];
    if (answer !== undefined) {
      items.push({ ...common, decided: byUser(questionId(item.n), answer) });
      continue;
    }

    const last = applied.at(-1);
    if (last && candidates.length === 1 && candidates[0]) {
      items.push({
        ...common,
        decided: {
          candidate: candidates[0],
          provenance: { by: 'rule', name: last.rule, source: last.source, ...base() },
        },
      });
      continue;
    }

    let decided: ItemDetermination['decided'];
    let pending: readonly Question[] | undefined;
    for (const resolver of resolvers) {
      options.signal?.throwIfAborted();
      const out = await resolver.resolve({ facts, item, candidates, content, answers }, options.signal);
      if (out.kind === 'abstain') continue;
      if (out.kind === 'ask') {
        // Pergunta de um resolvedor com id próprio: a resposta volta em answers[id], como a do askUser.
        const answered = out.questions.find((q) => q.item === item.n && answers[q.id] !== undefined);
        if (answered) decided = byUser(answered.id, answers[answered.id] as string);
        else pending = out.questions;
        break;
      }
      if (typeof out.confidence !== 'number' || !(out.confidence >= 0 && out.confidence <= 1)) {
        throw new DeterminationError(
          'resolvedor_invalido',
          `resolvedor ${resolver.name} devolveu confiança fora de [0, 1]: ${String(out.confidence)}`,
          item.n,
        );
      }
      const chosen = pick(candidates, out.cClassTrib);
      if (!chosen) {
        throw new DeterminationError(
          'resolvedor_fora_dos_candidatos',
          `resolvedor ${resolver.name} escolheu ${out.cClassTrib}, fora dos candidatos do item ${item.n}`,
          item.n,
        );
      }
      decided = {
        candidate: chosen,
        provenance: {
          by: 'resolver',
          name: resolver.name,
          confidence: out.confidence,
          ...(out.evidence === undefined ? {} : { evidence: out.evidence }),
          ...base(),
        },
      };
      break;
    }
    items.push({ ...common, ...(decided ? { decided } : {}), ...(pending ? { pending } : {}) });
  }
  return {
    asOf: content.asOf,
    contentVersion: content.dataset.contentVersion,
    items,
    complete: items.every((d) => d.decided !== undefined),
  };
}

/** Dados do item para o cálculo que a determinação não produz (base, tributação regular, diferimento...). */
export type ItemInput = Omit<ClassifiedItem, 'n' | 'cst' | 'cClassTrib'>;

export interface OperationInput {
  readonly modelo: number;
  readonly place: OperationPlace;
  readonly governmentPurchase?: GovernmentPurchase;
}

/** Monta a entrada do `@sinete/ibs-cbs/calcular`. Falha se algum item ficou sem decisão. */
export function toClassified(
  det: Determination,
  op: OperationInput,
  item: (n: number, candidate: Candidate) => ItemInput,
): ClassifiedOperation {
  return {
    ...op,
    items: det.items.map((d) => {
      if (!d.decided) {
        throw new DeterminationError('determinacao_incompleta', `item ${d.n} sem classificação decidida`, d.n);
      }
      const c = d.decided.candidate;
      return { ...item(d.n, c), n: d.n, cst: c.cst, cClassTrib: c.cClassTrib };
    }),
  };
}
