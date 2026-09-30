/**
 * A calculadora padrão de IBS/CBS do `buildNfe`: a porta `IbsCbsCalculator` implementada sobre o motor do sinete.
 *
 * Para cada item classificado, monta a operação do `@sinete/ibs-cbs/calcular` (CST, cClassTrib, base, local da operação,
 * compra governamental), calcula com o dataset do `@sinete/ibs-cbs-dados` e as alíquotas do `@sinete/ibs-cbs/aliquotas`, confere o
 * resultado pelas regras da NT 2025.002 do `@sinete/ibs-cbs/validar` e devolve o grupo `IBSCBS` de cada item na forma
 * lexical do leiaute. Erro de classificação, regime não suportado, alíquota desconhecida e violação de regra voltam
 * como ocorrências (`Ocorrencia`) no caminho do item: a nota não é montada, e nunca sai valor zerado no lugar.
 *
 * O dataset embarcado (~2 MB de JSON) só é importado na primeira nota com item classificado, por `import()` dinâmico:
 * quem usa o pacote para ler XML, eventos ou Distribuição DF-e não o carrega, e um bundler com code splitting o põe num
 * chunk à parte.
 */

import type { Ocorrencia } from '@sinete/core';
import { contextoDeTempo, ehUf, relogioFixo, ufPorCUf } from '@sinete/core';
import type { ProvedorDeAliquotas } from '@sinete/ibs-cbs/aliquotas';
import { aliquotasOficiais, ErroAliquotaDesconhecida } from '@sinete/ibs-cbs/aliquotas';
import type {
  IBSCBS,
  ItemClassificado,
  LocalDaOperacao,
  OperacaoClassificada,
  Roc,
  TpEnteGov,
} from '@sinete/ibs-cbs/calcular';
import { calcular, ErroClassificacao, ErroRegimeNaoSuportado } from '@sinete/ibs-cbs/calcular';
import type { Regra } from '@sinete/ibs-cbs/validar';
import { documentoDoRoc, validar } from '@sinete/ibs-cbs/validar';
import type { DatasetIbsCbs } from '@sinete/ibs-cbs-dados';
import type { IbsCbsCalculator, IbsCbsItemRequest, IbsCbsNotaRequest, IbsCbsResponse } from './ports.ts';

/** Grupo `IBSCBS` do item, como o `@sinete/nfe` o recebe. */
export type GrupoIbsCbs = IbsCbsResponse['itens'][number]['IBSCBS'];

export interface IbsCbsCalculatorOptions {
  /**
   * Dataset do IBS/CBS. Padrão: o embarcado no `@sinete/ibs-cbs-dados`, importado sob demanda na primeira nota
   * (`carregarDatasetEmbarcado`). Informe um bundle verificado em runtime (`conferirDataset`) para usar dados de outra
   * origem, ou o `datasetEmbarcado()` já carregado para o cálculo ser síncrono.
   */
  readonly dataset?: DatasetIbsCbs;
  /** Alíquotas. Padrão: `aliquotasOficiais()` do `@sinete/ibs-cbs/aliquotas`; troque por um provedor com alíquotas informadas. */
  readonly rates?: ProvedorDeAliquotas;
  /**
   * Base do IBS/CBS do item que não trouxe `vBC`, em texto com até 2 casas. A composição da base (NT 2025.002, UB16-10)
   * ainda é "implementação futura, aguardando orientação normativa": sem esta função, item sem `vBC` vira ocorrência
   * `ibscbs_base_ausente` em vez de uma base presumida.
   */
  readonly base?: (item: IbsCbsItemRequest, nota: IbsCbsNotaRequest) => string;
  /**
   * Regras da NT 2025.002 conferidas sobre os grupos produzidos (`@sinete/ibs-cbs/validar`). Padrão: as implantadas na data
   * de emissão e no ambiente. `false` desliga; `{ rules }` troca a lista.
   */
  readonly regras?: false | { readonly rules?: readonly Regra[]; readonly ignoreActivation?: boolean };
  /** Fuso do local da operação para a data civil do fato gerador, em minutos. Padrão: Brasília (-180). */
  readonly utcOffsetMinutes?: number;
}

const BASE = /^\d{1,13}(\.\d{1,2})?$/;

/** Texto decimal sem zeros à direita, para comparar valores com escalas diferentes (`'0.00'` e `'0'`). */
function normalizado(v: string): string {
  const [int = '0', frac = ''] = v.split('.');
  const f = frac.replace(/0+$/, '');
  const i = int.replace(/^0+(?=\d)/, '');
  return f === '' ? i : `${i}.${f}`;
}

const caminho = (nItem: number): string => `itens[${nItem - 1}].impostos.ibsCbs`;

/** UF do município pelo código IBGE (os dois primeiros dígitos são o cUF). */
function ufDoMunicipio(cMun: string): string | undefined {
  return ufPorCUf(cMun.slice(0, 2))?.sigla;
}

/**
 * Local da operação para as alíquotas próprias de UF e município: o `cMunFGIBS` informado (campo B12a da NT
 * 2025.002, município de ocorrência do fato gerador do IBS/CBS), senão o destino da mercadoria (entrega ou
 * destinatário, pela LC 214/2025, art. 11, o local da entrega), senão o emitente. Destino no exterior cai no emitente.
 */
export function localDaOperacao(nota: IbsCbsNotaRequest): LocalDaOperacao {
  if (nota.cMunFGIBS !== undefined) {
    const uf = ufDoMunicipio(nota.cMunFGIBS);
    if (uf !== undefined) return { uf, cMun: nota.cMunFGIBS };
  }
  const d = nota.destino;
  if (d !== undefined && d.UF !== 'EX' && ehUf(d.UF)) return { uf: d.UF, cMun: d.cMun };
  return { uf: nota.emitente.UF, cMun: nota.emitente.cMun };
}

/** Converte o grupo do motor para o do leiaute: os códigos numéricos do motor viram texto. */
function grupoDoLeiaute(g: IBSCBS, indDoacao: '1' | undefined): GrupoIbsCbs {
  const { gCredPresOper, gCredPresIBSZFM, ...resto } = g;
  return {
    ...resto,
    ...(indDoacao === undefined ? {} : { indDoacao }),
    ...(gCredPresOper === undefined
      ? {}
      : { gCredPresOper: { ...gCredPresOper, cCredPres: String(gCredPresOper.cCredPres).padStart(2, '0') } }),
    ...(gCredPresIBSZFM === undefined
      ? {}
      : {
          gCredPresIBSZFM: {
            ...gCredPresIBSZFM,
            tpCredPresIBSZFM: String(gCredPresIBSZFM.tpCredPresIBSZFM),
          },
        }),
  } as GrupoIbsCbs;
}

/** Erro do motor ou das alíquotas como ocorrência no item (ou na nota, quando o erro não diz o item). */
function ocorrenciaDoMotor(e: unknown, itens: readonly IbsCbsItemRequest[]): Ocorrencia | undefined {
  if (e instanceof ErroClassificacao || e instanceof ErroRegimeNaoSuportado) {
    const path = e.item !== undefined ? caminho(e.item) : caminho(itens[0]?.nItem ?? 1);
    return { caminho: path, code: e.code, mensagem: e.message, origem: 'entrada' };
  }
  // Alíquota que o sinete não conhece para a data: falta de dado do pacote, não da nota.
  if (e instanceof ErroAliquotaDesconhecida)
    return { caminho: 'impostos.ibsCbs', code: e.code, mensagem: e.message, origem: 'montagem' };
  return undefined;
}

let embarcado: Promise<DatasetIbsCbs> | undefined;

/**
 * O dataset embarcado no `@sinete/ibs-cbs-dados`, importado sob demanda (`import()` dinâmico) e carregado uma vez por
 * processo. É o que a calculadora padrão usa quando `dataset` não é informado; chamar antes só adianta a carga. Se o
 * import falhar, a próxima chamada tenta de novo.
 */
export function carregarDatasetEmbarcado(): Promise<DatasetIbsCbs> {
  embarcado ??= import('@sinete/ibs-cbs-dados/bundled').then(
    (m) => m.datasetEmbarcado(),
    (e: unknown) => {
      embarcado = undefined;
      throw e;
    },
  );
  return embarcado;
}

/**
 * Cria a calculadora de IBS/CBS sobre o motor do sinete. O `buildNfe` usa uma com as opções padrão quando
 * `options.ibsCbs` não é informado; crie a sua para trocar dataset, alíquotas, base ou regras. Com `dataset` informado
 * o cálculo é síncrono; sem ele, a primeira chamada espera o import do dataset embarcado.
 */
export function ibsCbsCalculator(options: IbsCbsCalculatorOptions = {}): IbsCbsCalculator {
  const rates = options.rates ?? aliquotasOficiais();
  const dataset = options.dataset;
  return {
    calcular(request: {
      readonly nota: IbsCbsNotaRequest;
      readonly itens: readonly IbsCbsItemRequest[];
    }): IbsCbsResponse | Promise<IbsCbsResponse> {
      if (dataset !== undefined) return calcularCom(dataset, rates, options, request);
      return carregarDatasetEmbarcado().then((ds) => calcularCom(ds, rates, options, request));
    },
  };
}

function calcularCom(
  dataset: DatasetIbsCbs,
  rates: ProvedorDeAliquotas,
  options: IbsCbsCalculatorOptions,
  {
    nota,
    itens,
  }: {
    readonly nota: IbsCbsNotaRequest;
    readonly itens: readonly IbsCbsItemRequest[];
  },
): IbsCbsResponse {
  const issues: Ocorrencia[] = [];
  const classificados: ItemClassificado[] = [];
  for (const it of itens) {
    if (it.cCredPres !== undefined) {
      // O crédito presumido pede os percentuais por tributo (pCredPres), que a porta não traz.
      issues.push({
        caminho: caminho(it.nItem),
        code: 'ibscbs_nao_suportado',
        mensagem: 'crédito presumido (cCredPres) precisa do grupo gCredPresOper pronto (ibsCbs.grupo)',
        origem: 'entrada',
      });
      continue;
    }
    const base = it.vBC !== undefined ? it.vBC.toFixed(2) : options.base?.(it, nota);
    if (base === undefined) {
      issues.push({
        caminho: `${caminho(it.nItem)}.classificacao.vBC`,
        code: 'ibscbs_base_ausente',
        mensagem:
          'informe vBC do IBS/CBS ou IbsCbsCalculatorOptions.base: a composição da base (UB16-10) ainda não tem regra publicada',
        origem: 'entrada',
      });
      continue;
    }
    if (!BASE.test(base)) {
      // Da entrada quando é o vBC do item; da montagem quando veio da função `base` das opções.
      issues.push({
        caminho: `${caminho(it.nItem)}.classificacao.vBC`,
        code: 'decimal_invalido',
        mensagem: base,
        origem: it.vBC !== undefined ? 'entrada' : 'montagem',
      });
      continue;
    }
    classificados.push({
      n: it.nItem,
      cst: it.CST,
      cClassTrib: it.cClassTrib,
      base,
      quantidade: it.qTrib.toString(),
      unidade: it.uTrib,
      ...(it.gTribRegular === undefined
        ? {}
        : { regular: { cst: it.gTribRegular.CSTReg, cClassTrib: it.gTribRegular.cClassTribReg } }),
    });
  }
  if (issues.length > 0) return { itens: [], issues };

  const op: OperacaoClassificada = {
    modelo: Number(nota.mod),
    local: localDaOperacao(nota),
    ...(nota.compraGov === undefined
      ? {}
      : {
          compraGovernamental: {
            tpEnteGov: Number(nota.compraGov.tpEnteGov) as TpEnteGov,
            ...(nota.compraGov.tpOperGov === '1' || nota.compraGov.tpOperGov === '2'
              ? { tpOperGov: Number(nota.compraGov.tpOperGov) as 1 | 2 }
              : {}),
          },
        }),
    itens: classificados,
  };
  const time = contextoDeTempo({ emissao: relogioFixo(nota.emissao), fatoGerador: relogioFixo(nota.fatoGerador) });
  let roc: Roc;
  try {
    roc = calcular(op, {
      dataset,
      aliquotas: rates,
      tempo: time,
      ...(options.utcOffsetMinutes === undefined ? {} : { deslocamentoMin: options.utcOffsetMinutes }),
    });
  } catch (e) {
    const issue = ocorrenciaDoMotor(e, itens);
    if (issue === undefined) throw e;
    return { itens: [], issues: [issue] };
  }

  // O redutor da compra governamental vai no ide.gCompraGov como a nota informou, mas o motor calcula com o do
  // dataset: se diferirem, os valores do item não fechariam com o cabeçalho emitido.
  const redutor = roc.oper?.gCompraGov.pRedutor;
  if (
    nota.compraGov !== undefined &&
    redutor !== undefined &&
    normalizado(nota.compraGov.pRedutor.toString()) !== normalizado(redutor)
  ) {
    issues.push({
      caminho: 'gCompraGov.pRedutor',
      code: 'ibscbs_redutor_divergente',
      mensagem: `pRedutor informado (${nota.compraGov.pRedutor.toString()}) difere do vigente no fato gerador (${redutor})`,
      origem: 'entrada',
    });
  }

  if (options.regras !== false) {
    const doc = documentoDoRoc(roc, {
      modelo: op.modelo as 55 | 65,
      crt: Number(nota.emitente.CRT) as 1 | 2 | 3 | 4,
      finNFe: Number(nota.finNFe) as 1 | 2 | 3 | 4 | 5 | 6,
      ...(nota.tpNFDebito === undefined ? {} : { tpNFDebito: nota.tpNFDebito }),
      ...(nota.tpNFCredito === undefined ? {} : { tpNFCredito: nota.tpNFCredito }),
      munEmitente: nota.emitente.cMun,
      ...(nota.destino === undefined ? {} : { munDestinatario: nota.destino.cMun }),
      itens: itens.map((it) => ({ nItem: it.nItem, ncm: it.NCM, vProd: it.vProd.toFixed(2) })),
    });
    const report = validar(doc, {
      dataset,
      tempo: time,
      ambiente: nota.ambiente,
      aliquotas: rates,
      ...(options.utcOffsetMinutes === undefined ? {} : { deslocamentoMin: options.utcOffsetMinutes }),
      ...(options.regras?.rules === undefined ? {} : { regras: options.regras.rules }),
      ...(options.regras?.ignoreActivation === undefined ? {} : { ignorarAtivacao: options.regras.ignoreActivation }),
    });
    for (const v of report.violacoes) {
      issues.push({
        caminho: v.item === undefined ? 'total.IBSCBSTot' : caminho(v.item),
        code: 'ibscbs_regra_nt',
        mensagem: `${v.regra} (rejeição ${v.cStat}): ${v.message} [${v.fonte}]`,
        origem: 'montagem',
      });
    }
  }

  const porItem = new Map(itens.map((it) => [it.nItem, it]));
  return {
    itens: roc.itens.map((r) => ({
      nItem: r.nItem,
      IBSCBS: grupoDoLeiaute(r.IBSCBS, porItem.get(r.nItem)?.indDoacao),
    })),
    ...(issues.length === 0 ? {} : { issues }),
  };
}
