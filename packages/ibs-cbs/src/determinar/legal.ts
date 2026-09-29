/**
 * Regras legais fechadas: hipóteses em que a lei decide o cClassTrib pela natureza da operação ou pela condição da parte,
 * sem depender de interpretação do item. Cada uma restringe os candidatos e cita o dispositivo. O texto legal de cada
 * código vem da própria tabela (`Candidate.lc214` e `link`); aqui fica só o vínculo entre o fato e o código.
 */
import type { ItemFacts, LegalOutcome, LegalRule, LegalRuleContext, OperationFacts, OperationKind } from './types.ts';

const LC = 'LC 214/2025';
const SINCE = { from: '2026-01-01', to: null } as const;

/** Id do ator "Produtor rural não contribuinte" na tabela de atores da Calculadora (V0057). */
export const ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR = 14;

function kindOf(facts: OperationFacts, item: ItemFacts): OperationKind {
  return item.kind ?? facts.kind;
}

function byKind(id: string, kind: OperationKind, codes: readonly string[], title: string, source: string): LegalRule {
  return {
    id,
    title,
    source,
    validity: SINCE,
    apply: ({ facts, item }: LegalRuleContext): LegalOutcome =>
      kindOf(facts, item) === kind ? { kind: 'restrict', codes } : { kind: 'none' },
  };
}

export const LEGAL_RULES: readonly LegalRule[] = [
  byKind(
    'bonificacao-no-documento',
    'bonificacao',
    ['410001'],
    'bonificação que consta do documento e não depende de evento posterior não sofre incidência',
    `${LC}, art. 5º, § 1º, I`,
  ),
  byKind(
    'transferencia-mesmo-contribuinte',
    'transferencia',
    ['410002'],
    'transferência de bens entre estabelecimentos do mesmo contribuinte não sofre incidência',
    `${LC}, art. 6º, II`,
  ),
  byKind(
    'doacao-sem-contraprestacao',
    'doacao',
    ['410003'],
    'doação sem contraprestação em benefício do doador não sofre incidência',
    `${LC}, art. 6º, VIII`,
  ),
  byKind(
    'exportacao-imune',
    'exportacao',
    ['410004', '410027'],
    'exportação de bens e serviços é imune; serviço vinculado à exportação de bem material tem código próprio',
    `${LC}, arts. 8º e 80, II`,
  ),
  {
    id: 'produtor-rural-nao-contribuinte',
    title: 'fornecimento de produtor rural não contribuinte',
    source: `${LC}, art. 164`,
    validity: SINCE,
    note: 'Vale para a venda: nas outras naturezas (transferência, bonificação, devolução) a regra da natureza decide.',
    apply: ({ facts, item }: LegalRuleContext): LegalOutcome =>
      kindOf(facts, item) === 'venda' && facts.supplier?.actors?.includes(ACTOR_RURAL_PRODUCER_NON_CONTRIBUTOR)
        ? { kind: 'restrict', codes: ['410014'] }
        : { kind: 'none' },
  },
  {
    id: 'devolucao-espelha-original',
    title: 'devolução usa a classificação do item no documento original',
    source: `${LC}, art. 12, § 7º, e art. 17`,
    validity: SINCE,
    note: 'A lei fixa a mesma base e a mesma alíquota da operação original; a regra lê isso como o mesmo cClassTrib.',
    apply: ({ facts, item }: LegalRuleContext): LegalOutcome =>
      kindOf(facts, item) === 'devolucao' && item.referenced
        ? { kind: 'restrict', codes: [item.referenced.cClassTrib] }
        : { kind: 'none' },
  },
];
