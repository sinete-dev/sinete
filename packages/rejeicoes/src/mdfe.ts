/**
 * `@sinete/rejeicoes/mdfe`: catálogo de rejeições do MDF-e (modelo 58).
 *
 * Os códigos do MDF-e colidem com os da NF-e com outro significado (611 e 686 são bloqueios por MDF-e não encerrado,
 * 220 é o prazo de 24 horas do cancelamento do MDF-e), então o catálogo é outro e fica numa entrada própria: quem não
 * emite MDF-e não carrega este JSON. Gerado por `tools/rejeicoes-data/mdfe.ts` a partir das regras de validação do MOC
 * MDF-e 3.00b (Anexo I e Visão Geral) e das NT 2025.001 e 2026.001, com o sha256 de cada PDF conferido.
 */

import type { DicaRejeicao, Recusado, ResultadoSefaz } from '@sinete/core';
import table from './data/rejeicoes-mdfe.json' with { type: 'json' };
import type { CategoriaRejeicao, DescricaoTabelaRejeicoes, RegraRejeicao } from './index.ts';

export interface RejeicaoMdfe {
  /** `cStat`, 3 ou 4 dígitos (NT 2025.001, item 5). */
  readonly codigo: string;
  /** O MDF-e não tem denegação: todo código é rejeição. */
  readonly efeito: 'rejeicao';
  /** Mensagem oficial sem o prefixo "Rejeição:", com os marcadores do documento (`[nProt:999999999999999]`). */
  readonly mensagem: string;
  /** Todas as mensagens quando o código aparece em regras com texto diferente (684 no MOC e na NT 2026.001). */
  readonly mensagens?: readonly string[];
  readonly modelos: readonly '58'[];
  /** Documento e regra de origem (`MOC MDF-e 3.00b Anexo I, regra F85`). */
  readonly fonte: string;
  readonly regras: readonly RegraRejeicao[];
  readonly categoria: CategoriaRejeicao;
  readonly causaProvavel?: string;
  readonly comoCorrigir?: string;
  readonly referencia?: string;
  /** Texto para quem emite o MDF-e, como em `Rejeicao.orientacao`; ausente quando a correção não está na mão dele. */
  readonly orientacao?: string;
}

/** Metadados do catálogo do MDF-e: versão (data de coleta) e documentos de origem com sha256. */
export const TABELA_REJEICOES_MDFE: DescricaoTabelaRejeicoes = {
  versaoDoFormato: table.versaoDoFormato,
  versao: table.versao,
  fontes: table.fontes,
};

/** Todas as entradas do MDF-e, em ordem numérica de código. */
export const REJEICOES_MDFE: readonly RejeicaoMdfe[] = table.rejeicoes as readonly RejeicaoMdfe[];

const byCode: ReadonlyMap<string, RejeicaoMdfe> = new Map(REJEICOES_MDFE.map((r) => [r.codigo, r]));

/** Entrada do catálogo do MDF-e para o `cStat`, ou `undefined` se o código não está catalogado. */
export function rejeicaoMdfePorCodigo(cStat: string): RejeicaoMdfe | undefined {
  return byCode.get(cStat.trim());
}

/** `DicaRejeicao` do core para o código do MDF-e, quando há curadoria de causa e correção; traz a `orientacao` quando existe. */
export function dicaRejeicaoMdfe(cStat: string): DicaRejeicao | undefined {
  const r = rejeicaoMdfePorCodigo(cStat);
  if (!r?.causaProvavel || !r.comoCorrigir) return undefined;
  return {
    causaProvavel: r.causaProvavel,
    comoCorrigir: r.comoCorrigir,
    fonte: r.referencia ?? r.fonte,
    ...(r.orientacao ? { orientacao: r.orientacao } : {}),
  };
}

/** Preenche a `dica` de um desfecho `recusado` do MDF-e. Não sobrescreve uma `dica` já presente. */
export function completarRecusadoMdfe(desfecho: Recusado): Recusado {
  if (desfecho.dica !== undefined) return desfecho;
  const dica = dicaRejeicaoMdfe(desfecho.cStat);
  return dica === undefined ? desfecho : { ...desfecho, dica };
}

/** Como `completarRecusadoMdfe`, aceitando qualquer desfecho; só o `recusado` muda. */
export function completarResultadoMdfe<T, D = T>(desfecho: ResultadoSefaz<T, D>): ResultadoSefaz<T, D> {
  return desfecho.tipo === 'recusado' ? completarRecusadoMdfe(desfecho) : desfecho;
}
