/**
 * Tipos do `@sinete/ibs-cbs/determinar`.
 *
 * A determinação parte de fatos de negócio (tipo de operação, NCM ou NBS do item, atores das partes, tipo de nota) e
 * chega a um CST e cClassTrib por item, com a lista de candidatos que sobrou, o motivo de cada código excluído e a
 * proveniência da escolha (regra, resolvedor ou usuário, com a versão dos dados). O cálculo fica no `@sinete/ibs-cbs/calcular`,
 * que não conhece fatos de negócio.
 */
import type { ConteudoTributario, DataIso } from '@sinete/ibs-cbs-dados';

/**
 * Natureza da operação, no que muda a classificação:
 *
 * - `venda`: fornecimento oneroso (o mérito do item decide);
 * - `transferencia`: entre estabelecimentos do mesmo contribuinte;
 * - `bonificacao`: bonificação que consta do documento fiscal e não depende de evento posterior;
 * - `doacao`: doação sem contraprestação em benefício do doador;
 * - `devolucao`: devolução ou cancelamento de operação anterior (informe `referenciado` no item);
 * - `exportacao`: exportação de bens ou serviços;
 * - `outra`: nenhuma das acima; só as restrições oficiais valem.
 */
export type TipoDeOperacao =
  | 'venda'
  | 'transferencia'
  | 'bonificacao'
  | 'doacao'
  | 'devolucao'
  | 'exportacao'
  | 'outra';

export interface FatosDaParte {
  /** Ids da tabela de atores do dataset (`ConteudoTributario.ator`); vazio ou ausente é desconhecido e não restringe. */
  readonly atores?: readonly number[];
  readonly uf?: string;
  readonly cMun?: string;
}

/** Classificação já decidida e guardada no cadastro do item, reaproveitada pelo resolvedor `doPerfil`. */
export interface PerfilDoItem {
  readonly cClassTrib: string;
  /** Quem decidiu e quando, para a proveniência (`"contador: Fulana, 2026-09-10"`). */
  readonly decididoPor?: string;
}

export interface FatosDoItem {
  /** Número do item (`nItem`). */
  readonly n: number;
  /** NCM com 8 dígitos. Incompleto não exclui nada: a aplicabilidade fica sem resposta. */
  readonly ncm?: string;
  /** NBS com 9 dígitos. */
  readonly nbs?: string;
  readonly descricao?: string;
  /** Natureza do item quando difere da operação. */
  readonly tipo?: TipoDeOperacao;
  /** Classificação do item no documento referenciado, na devolução. */
  readonly referenciado?: { readonly cst: string; readonly cClassTrib: string };
  readonly perfil?: PerfilDoItem;
}

export interface FatosDaOperacao {
  /** Modelo do DF-e (`55`, `65`, `57`...). */
  readonly modelo: number;
  readonly tipo: TipoDeOperacao;
  readonly fornecedor?: FatosDaParte;
  readonly adquirente?: FatosDaParte;
  /** Tipo de nota de débito (`tpNFDebito`, finNFe 6), só NF-e e NFC-e. */
  readonly tpNFDebito?: string;
  /** Tipo de nota de crédito (`tpNFCredito`, finNFe 5), só NF-e e NFC-e. */
  readonly tpNFCredito?: string;
  readonly itens: readonly FatosDoItem[];
}

/** Um cClassTrib possível para o item, com o que o usuário precisa para escolher. */
export interface Candidato {
  readonly cst: string;
  readonly cClassTrib: string;
  readonly nome: string | null;
  readonly descricao: string;
  /** Artigo da LC 214/2025 (`Art. 135`), quando a tabela traz. */
  readonly lc214: string | null;
  readonly url: string | null;
  /** O cálculo exige a tributação regular (`gTribRegular`) junto. */
  readonly exigeRegular: boolean;
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
 * - `regra-legal`: uma `RegraLegal` restringiu os candidatos.
 */
export type MotivoDaExclusao =
  | 'vigencia'
  | 'dfe'
  | 'tipo-de-nota'
  | 'nomenclatura'
  | 'ncm'
  | 'nbs'
  | 'atores'
  | 'regra-legal';

export interface Exclusao {
  readonly cClassTrib: string;
  readonly motivo: MotivoDaExclusao;
  /** O que foi comparado, em português. */
  readonly detalhe: string;
  readonly fonte: string;
}

export interface Procedencia {
  readonly por: 'regra' | 'resolvedor' | 'usuario';
  /** Id da regra, nome do resolvedor ou id da pergunta respondida. */
  readonly nome: string;
  /** Instante ISO 8601 da decisão, do relógio injetado. */
  readonly em: string;
  /** `DatasetIbsCbs.versaoDoConteudo` dos dados usados. */
  readonly versaoDoConteudo: string;
  /** Data do fato gerador em que os dados foram lidos. */
  readonly dataDeReferencia: DataIso;
  readonly fonte?: string;
  readonly confianca?: number;
  readonly evidencia?: unknown;
}

export interface OpcaoDaPergunta {
  readonly rotulo: string;
  readonly cClassTrib: string;
}

export interface Pergunta {
  /** Estável entre chamadas (`cClassTrib:3`): a resposta volta em `respostas[id]`. */
  readonly id: string;
  readonly item: number;
  readonly texto: string;
  readonly opcoes: readonly OpcaoDaPergunta[];
}

/** Restrição aplicada por uma regra legal, registrada no item. */
export interface RegraAplicada {
  readonly regra: string;
  readonly fonte: string;
  readonly codigos: readonly string[];
  /** A regra pediu códigos que as restrições oficiais já tinham excluído: o item fica sem candidato. */
  readonly conflito: boolean;
}

export interface DeterminacaoDoItem {
  readonly n: number;
  /** O que sobrou depois das restrições e das regras. */
  readonly candidatos: readonly Candidato[];
  readonly exclusoes: readonly Exclusao[];
  readonly regras: readonly RegraAplicada[];
  readonly decidido?: { readonly candidato: Candidato; readonly procedencia: Procedencia };
  readonly pendente?: readonly Pergunta[];
}

export interface Determinacao {
  readonly dataDeReferencia: DataIso;
  readonly versaoDoConteudo: string;
  readonly itens: readonly DeterminacaoDoItem[];
  /** Todo item tem `decidido`. */
  readonly completa: boolean;
}

export interface ContextoDoResolvedor {
  readonly fatos: FatosDaOperacao;
  readonly item: FatosDoItem;
  readonly candidatos: readonly Candidato[];
  readonly conteudo: ConteudoTributario;
  /** Respostas recebidas em `determinar` (id da pergunta para o cClassTrib), para o resolvedor que quiser lê-las. */
  readonly respostas: Readonly<Record<string, string>>;
}

export type ResultadoDoResolvedor =
  | { readonly tipo: 'decidido'; readonly cClassTrib: string; readonly confianca: number; readonly evidencia?: unknown }
  | { readonly tipo: 'perguntar'; readonly perguntas: readonly Pergunta[] }
  | { readonly tipo: 'abster' };

/**
 * Resolvedor plugável: histórico do contribuinte, cadastro, IA, fila de revisão. Só escolhe dentro de `candidatos`;
 * um código de fora é erro (`ErroDeterminacao` com `motivo` `resolvedor_fora_dos_candidatos`).
 */
export interface Resolvedor {
  readonly nome: string;
  resolver(contexto: ContextoDoResolvedor, signal?: AbortSignal): Promise<ResultadoDoResolvedor>;
}

export type ResultadoRegraLegal =
  | { readonly tipo: 'restringir'; readonly codigos: readonly string[] }
  | { readonly tipo: 'nenhum' };

export interface ContextoRegraLegal {
  readonly fatos: FatosDaOperacao;
  readonly item: FatosDoItem;
  readonly conteudo: ConteudoTributario;
}

/** Regra fechada, derivada da lei, pura e com fonte: restringe os candidatos a uma lista de códigos. */
export interface RegraLegal {
  readonly id: string;
  readonly titulo: string;
  readonly fonte: string;
  readonly vigencia: { readonly inicio: DataIso; readonly fim: DataIso | null };
  /** Interpretação adotada onde o texto não fecha a questão. */
  readonly nota?: string;
  aplicar(contexto: ContextoRegraLegal): ResultadoRegraLegal;
}
