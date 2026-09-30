/**
 * Validação de um documento pelas regras da NT 2025.002, com os dois relógios do `@sinete/core`: o de emissão decide
 * quais regras estão implantadas no ambiente e as regras que a NT amarra ao ano de emissão (alíquotas, crédito
 * presumido em condição suspensiva, competência da ZFM); o de fato gerador decide as tabelas (CST, cClassTrib,
 * cCredPres, reduções) do `@sinete/ibs-cbs-dados`.
 */
import type { ContextoDeTempo } from '@sinete/core';
import { ErroDeConfiguracao } from '@sinete/core';
import type { DatasetIbsCbs } from '@sinete/ibs-cbs-dados';
import { DESLOCAMENTO_BRASILIA_MIN, dataCivil } from '@sinete/ibs-cbs-dados';
import type { ProvedorDeAliquotas } from '../aliquotas/index.ts';
import type { Roc } from '../calcular/index.ts';
import type { ContextoDaRegra, Regra } from './rules.ts';
import { REGRAS } from './rules.ts';
import type { Ambiente, DescricaoDaRegra, DocumentoDasRegras, RelatorioDeValidacao, Violacao } from './types.ts';

export interface ValidarOpcoes {
  readonly dataset: DatasetIbsCbs;
  readonly tempo: ContextoDeTempo;
  readonly ambiente: Ambiente;
  /** Deslocamento do fuso do emitente em minutos (padrão: Brasília). */
  readonly deslocamentoMin?: number;
  /** Alíquotas vigentes, para a UB56-20 (a partir de 2027). */
  readonly aliquotas?: ProvedorDeAliquotas;
  /** Avalia todas as regras, inclusive as ainda não implantadas na data de emissão (para se antecipar). */
  readonly ignorarAtivacao?: boolean;
  /** Regras avaliadas; padrão: `REGRAS`. */
  readonly regras?: readonly Regra[];
}

/** A regra está implantada para o documento na data de emissão e no ambiente. */
export function ativa(
  regra: DescricaoDaRegra,
  documento: DocumentoDasRegras,
  ambiente: Ambiente,
  emissao: string,
): boolean {
  if (!regra.modelos.includes(documento.modelo)) return false;
  const window = regra.ativacao.find((a) => a.crt === undefined || a.crt.includes(documento.crt));
  return window !== undefined && window[ambiente] <= emissao;
}

export function validar(documento: DocumentoDasRegras, opcoes: ValidarOpcoes): RelatorioDeValidacao {
  if (!documento || !Array.isArray(documento.itens)) throw new ErroDeConfiguracao('documento sem itens');
  if (opcoes.ambiente !== 'producao' && opcoes.ambiente !== 'homologacao') {
    throw new ErroDeConfiguracao(`ambiente inválido: ${String(opcoes.ambiente)}`);
  }
  const offset = opcoes.deslocamentoMin ?? DESLOCAMENTO_BRASILIA_MIN;
  const emission = dataCivil(opcoes.tempo.emissao.agora(), offset);
  const factDate = dataCivil(opcoes.tempo.fatoGerador.agora(), offset);
  const ctx: ContextoDaRegra = {
    documento: documento,
    conteudo: opcoes.dataset.em(factDate),
    emissao: emission,
    ...(opcoes.aliquotas ? { aliquotas: opcoes.aliquotas } : {}),
  };
  const violations: Violacao[] = [];
  const evaluated: string[] = [];
  const inactive: string[] = [];
  for (const rule of opcoes.regras ?? REGRAS) {
    const active = opcoes.ignorarAtivacao
      ? rule.modelos.includes(documento.modelo)
      : ativa(rule, documento, opcoes.ambiente, emission);
    if (!active) {
      inactive.push(rule.id);
      continue;
    }
    evaluated.push(rule.id);
    rule.conferir(ctx, (item, message) =>
      violations.push({
        regra: rule.id,
        cStat: rule.cStat,
        ...(item === undefined ? {} : { item }),
        message,
        fonte: rule.fonte,
      }),
    );
  }
  return {
    violacoes: violations,
    avaliadas: evaluated,
    inativas: inactive,
    dataDaEmissao: emission,
    dataDoFato: factDate,
  };
}

/** Documento para `validar` a partir do `Roc` do motor, com os campos de identificação que o `Roc` não tem. */
export function documentoDoRoc(
  roc: Roc,
  identificacao: Omit<DocumentoDasRegras, 'itens' | 'IBSCBSTot' | 'gCompraGov'> & {
    readonly itens?: readonly Omit<DocumentoDasRegras['itens'][number], 'IBSCBS'>[];
  },
): DocumentoDasRegras {
  const { itens: extra, ...rest } = identificacao;
  return {
    ...rest,
    ...(roc.oper ? { gCompraGov: roc.oper.gCompraGov } : {}),
    itens: roc.itens.map((it) => ({ ...extra?.find((x) => x.nItem === it.nItem), nItem: it.nItem, IBSCBS: it.IBSCBS })),
    IBSCBSTot: roc.total.IBSCBSTot,
  };
}
