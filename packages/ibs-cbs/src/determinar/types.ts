/**
 * Tipos do `@sinete/ibs-cbs/determinar`.
 *
 * A determinação parte de fatos de negócio (tipo de operação, NCM ou NBS do item, atores das partes, tipo de nota) e
 * chega a um CST e cClassTrib por item, com a lista de candidatos que sobrou, o motivo de cada código excluído e a
 * proveniência da escolha (regra, resolvedor ou usuário, com a versão dos dados). O cálculo fica no `@sinete/ibs-cbs/calcular`,
 * que não conhece fatos de negócio.
 */
import type { IsoDate, TaxContent } from '@sinete/ibs-cbs-dados';

/**
 * Natureza da operação, no que muda a classificação:
 *
 * - `venda`: fornecimento oneroso (o mérito do item decide);
 * - `transferencia`: entre estabelecimentos do mesmo contribuinte;
 * - `bonificacao`: bonificação que consta do documento fiscal e não depende de evento posterior;
 * - `doacao`: doação sem contraprestação em benefício do doador;
 * - `devolucao`: devolução ou cancelamento de operação anterior (informe `referenced` no item);
 * - `exportacao`: exportação de bens ou serviços;
 * - `outra`: nenhuma das acima; só as restrições oficiais valem.
 */
export type OperationKind = 'venda' | 'transferencia' | 'bonificacao' | 'doacao' | 'devolucao' | 'exportacao' | 'outra';

export interface PartyFacts {
  /** Ids da tabela de atores do dataset (`TaxContent.actor`); vazio ou ausente é desconhecido e não restringe. */
  readonly actors?: readonly number[];
  readonly uf?: string;
  readonly cMun?: string;
}

/** Classificação já decidida e guardada no cadastro do item, reaproveitada pelo resolvedor `fromProfile`. */
export interface ItemProfile {
  readonly cClassTrib: string;
  /** Quem decidiu e quando, para a proveniência (`"contador: Fulana, 2026-09-10"`). */
  readonly decidedBy?: string;
}

export interface ItemFacts {
  /** Número do item (`nItem`). */
  readonly n: number;
  /** NCM com 8 dígitos. Incompleto não exclui nada: a aplicabilidade fica sem resposta. */
  readonly ncm?: string;
  /** NBS com 9 dígitos. */
  readonly nbs?: string;
  readonly description?: string;
  /** Natureza do item quando difere da operação. */
  readonly kind?: OperationKind;
  /** Classificação do item no documento referenciado, na devolução. */
  readonly referenced?: { readonly cst: string; readonly cClassTrib: string };
  readonly profile?: ItemProfile;
}

export interface OperationFacts {
  /** Modelo do DF-e (`55`, `65`, `57`...). */
  readonly modelo: number;
  readonly kind: OperationKind;
  readonly supplier?: PartyFacts;
  readonly buyer?: PartyFacts;
  /** Tipo de nota de débito (`tpNFDebito`, finNFe 6), só NF-e e NFC-e. */
  readonly tpNFDebito?: string;
  /** Tipo de nota de crédito (`tpNFCredito`, finNFe 5), só NF-e e NFC-e. */
  readonly tpNFCredito?: string;
  readonly items: readonly ItemFacts[];
}

/** Um cClassTrib possível para o item, com o que o usuário precisa para escolher. */
export interface Candidate {
  readonly cst: string;
  readonly cClassTrib: string;
  readonly name: string | null;
  readonly description: string;
  /** Artigo da LC 214/2025 (`Art. 135`), quando a tabela traz. */
  readonly lc214: string | null;
  readonly link: string | null;
  /** O cálculo exige a tributação regular (`gTribRegular`) junto. */
  readonly requiresRegular: boolean;
}

/**
 * Por que um código saiu:
 *
 * - `vigencia`: o código existe no dataset mas não vale na data do fato gerador;
 * - `dfe`: não está habilitado no modelo de DF-e;
 * - `tipo-de-nota`: a NT 2025.002 amarra o código a um tipo de nota de débito ou crédito (ou o tipo de nota a um código);
 * - `nomenclatura`: o código pede NCM e o item só tem NBS, ou o contrário;
 * - `ncm` e `nbs`: o anexo do código não cobre o NCM ou a NBS do item;
 * - `atores`: o código tem vínculo com atores e nenhum ator conhecido da parte casa;
 * - `regra-legal`: uma `LegalRule` restringiu os candidatos.
 */
export type ExclusionReason =
  | 'vigencia'
  | 'dfe'
  | 'tipo-de-nota'
  | 'nomenclatura'
  | 'ncm'
  | 'nbs'
  | 'atores'
  | 'regra-legal';

export interface Exclusion {
  readonly cClassTrib: string;
  readonly reason: ExclusionReason;
  /** O que foi comparado, em português. */
  readonly detail: string;
  readonly source: string;
}

export interface Provenance {
  readonly by: 'rule' | 'resolver' | 'user';
  /** Id da regra, nome do resolvedor ou id da pergunta respondida. */
  readonly name: string;
  /** Instante ISO 8601 da decisão, do relógio injetado. */
  readonly at: string;
  /** `IbsCbsDataset.contentVersion` dos dados usados. */
  readonly contentVersion: string;
  /** Data do fato gerador em que os dados foram lidos. */
  readonly asOf: IsoDate;
  readonly source?: string;
  readonly confidence?: number;
  readonly evidence?: unknown;
}

export interface QuestionOption {
  readonly label: string;
  readonly cClassTrib: string;
}

export interface Question {
  /** Estável entre chamadas (`cClassTrib:3`): a resposta volta em `answers[id]`. */
  readonly id: string;
  readonly item: number;
  readonly text: string;
  readonly options: readonly QuestionOption[];
}

/** Restrição aplicada por uma regra legal, registrada no item. */
export interface AppliedRule {
  readonly rule: string;
  readonly source: string;
  readonly codes: readonly string[];
  /** A regra pediu códigos que as restrições oficiais já tinham excluído: o item fica sem candidato. */
  readonly conflict: boolean;
}

export interface ItemDetermination {
  readonly n: number;
  /** O que sobrou depois das restrições e das regras. */
  readonly candidates: readonly Candidate[];
  readonly exclusions: readonly Exclusion[];
  readonly rules: readonly AppliedRule[];
  readonly decided?: { readonly candidate: Candidate; readonly provenance: Provenance };
  readonly pending?: readonly Question[];
}

export interface Determination {
  readonly asOf: IsoDate;
  readonly contentVersion: string;
  readonly items: readonly ItemDetermination[];
  /** Todo item tem `decided`. */
  readonly complete: boolean;
}

export interface ResolveContext {
  readonly facts: OperationFacts;
  readonly item: ItemFacts;
  readonly candidates: readonly Candidate[];
  readonly content: TaxContent;
  /** Respostas recebidas em `determine` (id da pergunta para o cClassTrib), para o resolvedor que quiser lê-las. */
  readonly answers: Readonly<Record<string, string>>;
}

export type ResolverOutcome =
  | { readonly kind: 'decided'; readonly cClassTrib: string; readonly confidence: number; readonly evidence?: unknown }
  | { readonly kind: 'ask'; readonly questions: readonly Question[] }
  | { readonly kind: 'abstain' };

/**
 * Resolvedor plugável: histórico do contribuinte, cadastro, IA, fila de revisão. Só escolhe dentro de `candidates`;
 * um código de fora é erro (`DeterminationError` com `reason` `resolvedor_fora_dos_candidatos`).
 */
export interface Resolver {
  readonly name: string;
  resolve(ctx: ResolveContext, signal?: AbortSignal): Promise<ResolverOutcome>;
}

export type LegalOutcome = { readonly kind: 'restrict'; readonly codes: readonly string[] } | { readonly kind: 'none' };

export interface LegalRuleContext {
  readonly facts: OperationFacts;
  readonly item: ItemFacts;
  readonly content: TaxContent;
}

/** Regra fechada, derivada da lei, pura e com fonte: restringe os candidatos a uma lista de códigos. */
export interface LegalRule {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly validity: { readonly from: IsoDate; readonly to: IsoDate | null };
  /** Interpretação adotada onde o texto não fecha a questão. */
  readonly note?: string;
  apply(ctx: LegalRuleContext): LegalOutcome;
}
