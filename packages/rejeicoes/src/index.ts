/**
 * `@sinete/rejeicoes`: catálogo de rejeições e denegações da SEFAZ para NF-e e NFC-e.
 *
 * O catálogo vive em `data/rejeicoes.json`, gerado por `tools/rejeicoes-data` a partir dos PDFs oficiais (MOC 7.0
 * Anexo I e NT 2025.002, mais códigos avulsos das NT 2025.001 e 2024.003) com sha256 conferido, mais a curadoria manual de causa provável e correção. Este módulo só
 * consulta a tabela e preenche o `DicaRejeicao` do `ResultadoSefaz` do `@sinete/core`.
 */

import type { DicaRejeicao, FonteDeDados, Recusado, ResultadoSefaz } from '@sinete/core';
import table from './data/rejeicoes.json' with { type: 'json' };

/** Categoria do problema, para agrupar tratamento e mensagens de interface. */
export type CategoriaRejeicao =
  | 'schema'
  | 'assinatura'
  | 'certificado'
  | 'cadastro'
  | 'regra-negocio'
  | 'duplicidade'
  | 'reforma';

export const CATEGORIAS_REJEICAO: readonly CategoriaRejeicao[] = [
  'schema',
  'assinatura',
  'certificado',
  'cadastro',
  'regra-negocio',
  'duplicidade',
  'reforma',
];

/** Regra de validação em que o código aparece. */
export interface RegraRejeicao {
  /** Id do documento em `TABELA_REJEICOES.fontes` (`moc70-anexo1`, `nt2025002`, `nt2025001`, `nt2024003`). */
  readonly documento: string;
  /** Id da regra no documento (`C17-20`, `UB13-10`). */
  readonly id: string;
}

export interface Rejeicao {
  /** `cStat`, 3 ou 4 dígitos. */
  readonly codigo: string;
  /** Rejeição (pode corrigir e reenviar) ou denegação (número consumido). */
  readonly efeito: 'rejeicao' | 'denegacao';
  /** Mensagem oficial, sem o prefixo "Rejeição:" e com os placeholders do documento (`[nItem: 999]`). */
  readonly mensagem: string;
  /** Todas as mensagens oficiais quando o documento atribui mais de uma ao mesmo código. */
  readonly mensagens?: readonly string[];
  /** Modelos em que a regra se aplica (`55` NF-e, `65` NFC-e). */
  readonly modelos: readonly ('55' | '65')[];
  /** Origem do código: documento, versão e tabela ou regra (`MOC 7.0 Anexo I, tabela 4.4.2`). */
  readonly fonte: string;
  readonly regras: readonly RegraRejeicao[];
  readonly categoria: CategoriaRejeicao;
  /** Diagnóstico curado; presente só nos códigos revisados. */
  readonly causaProvavel?: string;
  readonly comoCorrigir?: string;
  /** Regra citada pela curadoria (`MOC 7.0 Anexo I, RV C17-20`). */
  readonly referencia?: string;
  /**
   * Texto para quem emite a nota (produtor, contador, atendente), em uma ou duas frases sem termo de integração: o que
   * aconteceu e o que mudar na nota, no cadastro ou junto à SEFAZ. Só existe quando a correção está na mão de quem
   * emite; falhas do sistema emissor (schema, assinatura, duplicidade por reenvio, cálculo) ficam sem ela.
   */
  readonly orientacao?: string;
}

export interface FonteRejeicao extends FonteDeDados {
  readonly id: string;
  readonly versao: string;
  readonly citacao: string;
  readonly sha256: string;
}

export interface DescricaoTabelaRejeicoes {
  readonly versaoDoFormato: number;
  readonly versao: string;
  readonly fontes: readonly FonteRejeicao[];
}

/** Metadados do catálogo: versão (data de coleta) e documentos de origem com sha256. */
export const TABELA_REJEICOES: DescricaoTabelaRejeicoes = {
  versaoDoFormato: table.versaoDoFormato,
  versao: table.versao,
  fontes: table.fontes,
};

/** Todas as entradas, em ordem numérica de código. */
export const REJEICOES: readonly Rejeicao[] = table.rejeicoes as readonly Rejeicao[];

const byCode: ReadonlyMap<string, Rejeicao> = new Map(REJEICOES.map((r) => [r.codigo, r]));

/** Entrada do catálogo para o `cStat` (`'204'`, `'1020'`), ou `undefined` se o código não está catalogado. */
export function rejeicaoPorCodigo(cStat: string): Rejeicao | undefined {
  return byCode.get(cStat.trim());
}

/** `DicaRejeicao` do core para o código, quando há curadoria de causa e correção; traz a `orientacao` quando existe. */
export function dicaRejeicao(cStat: string): DicaRejeicao | undefined {
  const r = rejeicaoPorCodigo(cStat);
  if (!r?.causaProvavel || !r.comoCorrigir) return undefined;
  return {
    causaProvavel: r.causaProvavel,
    comoCorrigir: r.comoCorrigir,
    fonte: r.referencia ?? r.fonte,
    ...(r.orientacao ? { orientacao: r.orientacao } : {}),
  };
}

/**
 * Preenche a `dica` de um desfecho `recusado` a partir do catálogo. Não sobrescreve uma `dica` já presente e devolve o
 * mesmo objeto quando não há o que acrescentar.
 */
export function completarRecusado(desfecho: Recusado): Recusado {
  if (desfecho.dica !== undefined) return desfecho;
  const dica = dicaRejeicao(desfecho.cStat);
  return dica === undefined ? desfecho : { ...desfecho, dica };
}

/** Como `completarRecusado`, aceitando qualquer desfecho; só o `recusado` muda. */
export function completarResultado<T, D = T>(desfecho: ResultadoSefaz<T, D>): ResultadoSefaz<T, D> {
  return desfecho.tipo === 'recusado' ? completarRecusado(desfecho) : desfecho;
}
