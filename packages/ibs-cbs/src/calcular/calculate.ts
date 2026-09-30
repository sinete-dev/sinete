/**
 * Cálculo do IBS e da CBS de uma operação já classificada.
 *
 * Puro e determinístico: mesma operação, mesmos dados, mesmas alíquotas e mesma data dão o mesmo `Roc`. As regras de
 * cálculo vêm do dataset (expressões do tratamento tributário de cada cClassTrib, reduções, alíquotas fixas, redutor e
 * transferência de compras governamentais); as alíquotas nominais vêm do `ProvedorDeAliquotas`. A precisão segue a
 * Calculadora da RFB: cada expressão é arredondada para 8 casas HALF_EVEN (LC 214/2025, art. 349, § 14) e a saída para
 * 2 casas nos valores e de 2 a 4 casas nos percentuais.
 *
 * Duas escolhas diferem da Calculadora de propósito, e o oráculo as registra no ledger de divergências:
 * - `vIBS` do item e os totais somam os valores já arredondados do XML, como exigem as RV UB54a-10 e W35-10 a W59g-10
 *   (a Calculadora soma os valores internos e arredonda depois);
 * - o diferimento abate `vDif` uma vez do tributo calculado (UB35-10: v = vBC x pAliqEfet - vDif - vDevTrib).
 *
 * A data dos dados e das alíquotas é a data civil do relógio de fato gerador do `ContextoDeTempo`, no fuso do local da
 * operação (Brasília por padrão).
 */
import type { ContextoDeTempo } from '@sinete/core';
import type {
  ConteudoTributario,
  DatasetIbsCbs,
  Indicador,
  RegistroClassTrib,
  RegistroCst,
  RegistroTratamento,
} from '@sinete/ibs-cbs-dados';
import { DESLOCAMENTO_BRASILIA_MIN, dataCivil } from '@sinete/ibs-cbs-dados';
import type { ProvedorDeAliquotas, TributoDaAliquota } from '../aliquotas/index.ts';
import { ErroAliquotaDesconhecida, exigirAliquota, TRIBUTOS_DAS_ALIQUOTAS } from '../aliquotas/index.ts';
import { Decimal, sum } from './decimal.ts';
import type { MotivoErroClassificacao } from './errors.ts';
import { ErroClassificacao, ErroRegimeNaoSuportado } from './errors.ts';
import type { Variaveis } from './expression.ts';
import { avaliar, ESCALA_INTERNA } from './expression.ts';
import { dePercentual, dinheiro, paraPercentual, percentual } from './format.ts';
import type { ValoresCompraGov } from './govpurchase.ts';
import { REDISTRIBUICAO_A_PARTIR_DE, redistribuir } from './govpurchase.ts';
import type {
  AliquotaAplicada,
  AliquotasInformadas,
  DataIso,
  EntradaDoRastro,
  GCredPresOper,
  GCredPresTributo,
  GDevTrib,
  GDif,
  GIBSCBS,
  GRed,
  GTribCompraGov,
  GTribRegular,
  IBSCBS,
  IBSCBSTot,
  ItemClassificado,
  OperacaoClassificada,
  Roc,
  RocItem,
  TpEnteGov,
} from './types.ts';

export interface CalcularOpcoes {
  readonly dataset: DatasetIbsCbs;
  readonly aliquotas: ProvedorDeAliquotas;
  /** Relógios da operação: o de fato gerador decide dados e alíquotas. */
  readonly tempo: ContextoDeTempo;
  /** Deslocamento do fuso do local da operação em minutos (padrão: Brasília, `-180`). */
  readonly deslocamentoMin?: number;
}

const COMBINED = 'Alíquotas Combinadas (Ad Valorem e Ad Rem)';
const DECIMAL_PERCENT = /^\d{1,3}(\.\d{1,4})?$/;
const COMPET = /^\d{4}-(0[1-9]|1[0-2])$/;

interface Resolved {
  readonly cst: RegistroCst;
  readonly classTrib: RegistroClassTrib;
  readonly treatment: RegistroTratamento;
}

interface GovContext {
  readonly tp: TpEnteGov;
  readonly tpOperGov: 1 | 2 | undefined;
  /** Redutor em percentual (`'0'` em 2026). */
  readonly pRedutor: Decimal;
  /** Percentual da CBS transferido ao ente, em fração de 8 casas. */
  readonly transfer: Decimal;
}

interface Ctx {
  readonly content: ConteudoTributario;
  readonly date: DataIso;
  readonly op: OperacaoClassificada;
  readonly rates: ProvedorDeAliquotas;
  readonly gov: GovContext | undefined;
  readonly trace: EntradaDoRastro[];
}

/** Resultado interno de um tributo, em precisão interna. */
interface TribCalc {
  readonly t: TributoDaAliquota;
  readonly applied: AliquotaAplicada;
  readonly divided: boolean;
  readonly aliq: Decimal;
  readonly aliqEfet: Decimal | undefined;
  readonly pRed: Decimal | undefined;
  readonly base: Decimal;
  readonly devido: Decimal;
  readonly pDif: Decimal | undefined;
  readonly vDif: Decimal | undefined;
  readonly pDevTrib: Decimal | undefined;
  readonly vDevTrib: Decimal | undefined;
}

function fail(reason: MotivoErroClassificacao, message: string, item?: number): never {
  throw new ErroClassificacao(reason, message, item);
}

function decimalInput(value: unknown, what: string, item?: number): Decimal {
  if (!Decimal.isDecimalText(value))
    fail('entrada_invalida', `${what}: decimal inválido ${JSON.stringify(value)}`, item);
  const d = Decimal.parse(value);
  if (d.isNegative()) fail('entrada_invalida', `${what}: não pode ser negativo (${value})`, item);
  return d;
}

function percentInput(value: unknown, what: string, item?: number): Decimal {
  if (typeof value !== 'string' || !DECIMAL_PERCENT.test(value) || Number(value) > 100) {
    fail('entrada_invalida', `${what}: percentual de 0 a 100 com até 4 casas, recebido ${JSON.stringify(value)}`, item);
  }
  return Decimal.parse(value);
}

/** Confere presença contra o indicador: `obrigatorio` exige, `vedado` veda, `permitido` aceita os dois. */
function checkGroup(indicator: Indicador | null, present: boolean, group: string, owner: string, item: number): void {
  if (indicator === 'obrigatorio' && !present) {
    fail('grupo_obrigatorio', `${owner} exige o grupo ${group}`, item);
  }
  if (indicator === 'vedado' && present) {
    fail('grupo_vedado', `${owner} não permite o grupo ${group}`, item);
  }
}

function resolve(ctx: Ctx, cst: string, code: string, item: number, label: string): Resolved {
  const c = ctx.content;
  const cstRec = c.cst(cst);
  if (!cstRec) fail('cst_inexistente', `${label}CST ${cst} inexistente ou fora de vigência em ${ctx.date}`, item);
  const classTrib = c.classTrib(code);
  if (!classTrib) {
    fail('cclasstrib_inexistente', `${label}cClassTrib ${code} inexistente ou fora de vigência em ${ctx.date}`, item);
  }
  if (classTrib.cst !== cst) {
    fail('cclasstrib_fora_da_cst', `${label}cClassTrib ${code} pertence à CST ${classTrib.cst}, não à ${cst}`, item);
  }
  if (!c.permitidoEm(classTrib, ctx.op.modelo)) {
    fail(
      'nao_habilitado_no_dfe',
      `${label}cClassTrib ${code} não é permitido no modelo ${ctx.op.modelo} em ${ctx.date}`,
      item,
    );
  }
  const treatment = c.tratamento(classTrib);
  if (!treatment)
    fail('tratamento_ausente', `${label}cClassTrib ${code} sem tratamento tributário em ${ctx.date}`, item);
  return { cst: cstRec, classTrib, treatment };
}

/**
 * Regimes que o motor não calcula. Quando o cClassTrib exige tributação regular (suspensão e afins), o cálculo usa o
 * tratamento do cClassTrib regular, então só ele passa pela checagem de tratamento; o principal responde pela CST.
 */
function checkSupported(r: Resolved, item: number, label: string): void {
  const usesOwnTreatment = !r.treatment.indicadores.exigeGrupoTribRegular;
  if (r.cst.grupos.gIBSCBSMono === 'obrigatorio' || (usesOwnTreatment && r.treatment.indicadores.possuiMonofasia)) {
    throw new ErroRegimeNaoSuportado(
      'monofasia',
      `${label}cClassTrib ${r.classTrib.codigo}: tributação monofásica ainda não é suportada pelo motor`,
      item,
    );
  }
  if (r.classTrib.tipoDeAliquota === COMBINED) {
    throw new ErroRegimeNaoSuportado(
      'aliquotas-combinadas',
      `${label}cClassTrib ${r.classTrib.codigo}: alíquotas combinadas (ad valorem e ad rem) ainda não são suportadas`,
      item,
    );
  }
  if (usesOwnTreatment && r.treatment.indicadores.possuiAjuste && r.cst.grupos.gIBSCBS === 'obrigatorio') {
    throw new ErroRegimeNaoSuportado(
      'ajuste',
      `${label}cClassTrib ${r.classTrib.codigo}: tratamento com ajuste ("${r.treatment.descricao}") sem regra de cálculo publicada; a Calculadora também recusa`,
      item,
    );
  }
}

interface RateChoice {
  readonly pct: Decimal;
  readonly divided: boolean;
  readonly informed: boolean;
  readonly applied: AliquotaAplicada;
}

function applyRate(
  ctx: Ctx,
  c: RegistroClassTrib,
  t: TributoDaAliquota,
  informed: AliquotasInformadas | undefined,
  item: number,
): RateChoice {
  const kind = c.tipoDeAliquota;
  if (kind === 'Sem alíquota') {
    const applied: AliquotaAplicada = { tributo: t, valor: '0', situacao: 'oficial', origem: 'sem-aliquota' };
    return { pct: Decimal.ZERO, divided: false, informed: false, applied };
  }
  const inf = informed?.[t];
  if (inf !== undefined) {
    const pct = percentInput(inf, `alíquota informada de ${t}`, item);
    const applied: AliquotaAplicada = {
      tributo: t,
      valor: inf,
      situacao: 'informada',
      origem: 'informada',
      motivo: informed?.motivo ?? '',
    };
    return { pct, divided: true, informed: true, applied };
  }
  if (kind === 'Uniforme setorial' || kind === 'Fixa') {
    const fixed = ctx.content.aliquotaFixa(c, t);
    if (fixed === undefined) {
      throw new ErroAliquotaDesconhecida(
        t,
        ctx.date,
        `cClassTrib ${c.codigo} (${kind}): sem alíquota de ${t} no dataset em ${ctx.date}; informe-a em aliquotasInformadas para simular`,
        { detalhes: { tributo: t, data: ctx.date, cClassTrib: c.codigo, item } },
      );
    }
    const applied: AliquotaAplicada = { tributo: t, valor: fixed, situacao: 'oficial', origem: 'dataset-fixa' };
    return { pct: Decimal.parse(fixed), divided: true, informed: false, applied };
  }
  const nominal = kind === 'Padrão';
  const rate = nominal ? ctx.rates.nominal(ctx.date, ctx.op.local)[t] : ctx.rates.referencia(ctx.date)[t];
  const value = exigirAliquota(rate, ctx.date);
  const applied: AliquotaAplicada = {
    tributo: t,
    valor: value,
    situacao: rate.situacao,
    origem: nominal ? 'provedor-nominal' : 'provedor-referencia',
    ...(rate.legal === undefined ? {} : { legal: rate.legal }),
    ...(rate.motivo === undefined ? {} : { motivo: rate.motivo }),
  };
  return { pct: Decimal.parse(value), divided: true, informed: false, applied };
}

const USES_ALIQUOTA = /\baliquota\b/;

function calcTributo(
  ctx: Ctx,
  item: ItemClassificado,
  calc: Resolved,
  t: TributoDaAliquota,
  base: Decimal,
  quantity: Decimal,
  deferralAllowed: boolean,
): TribCalc {
  const n = item.n;
  const { treatment, classTrib } = calc;
  const expr = treatment.expressao;
  const rate = applyRate(ctx, classTrib, t, item.aliquotasInformadas, n);
  const aliqInput = rate.divided ? dePercentual(rate.pct) : rate.pct;
  const log = (field: string, formula: string, inputs: Record<string, Decimal | undefined>, result: Decimal): void => {
    const shown: Record<string, string> = {};
    for (const [k, v] of Object.entries(inputs)) if (v !== undefined) shown[k] = v.toString();
    ctx.trace.push({ item: n, tributo: t, campo: field, formula, entradas: shown, resultado: result.toString() });
  };

  let pRed: Decimal | undefined;
  if (treatment.indicadores.possuiPercentualReducao) {
    const red = ctx.content.reducao(classTrib, t);
    if (red === undefined) {
      fail(
        'dados_incompletos',
        `cClassTrib ${classTrib.codigo}: percentual de redução de ${t} ausente em ${ctx.date}`,
        n,
      );
    }
    pRed = dePercentual(Decimal.parse(red));
  }
  const redutor = ctx.gov?.pRedutor ?? Decimal.ZERO;
  const common: Record<string, Decimal | undefined> = { quantidade: quantity, percentualReducao: pRed };

  let aliq: Decimal;
  if (rate.informed && !(expr.aliquota !== null && USES_ALIQUOTA.test(expr.aliquota))) {
    // Alíquota informada prevalece sobre expressão fixa ("0", "2.08/100"), como na Calculadora.
    aliq = aliqInput;
  } else if (expr.aliquota !== null) {
    aliq = avaliar(expr.aliquota, { ...common, aliquota: aliqInput });
  } else {
    aliq = Decimal.ZERO;
  }
  aliq = emittedRate(aliq, rate.divided);
  log('aliquota', expr.aliquota ?? 'aliquota', { aliquota: aliqInput }, aliq);

  let aliqEfet: Decimal | undefined;
  if (expr.aliquotaEfetiva !== null) {
    const vars: Variaveis = { ...common, aliquota: aliq, pRedutorCompraGov: redutor };
    aliqEfet = emittedRate(avaliar(expr.aliquotaEfetiva, vars), rate.divided);
    log('aliquotaEfetiva', expr.aliquotaEfetiva, vars, aliqEfet);
  }

  const baseVars: Variaveis = { ...common, aliquota: aliq, aliquotaEfetiva: aliqEfet, baseCalculoInformada: base };
  let bc = avaliar(expr.baseCalculo, baseVars);
  if (bc.isNegative()) bc = Decimal.ZERO;
  log('baseCalculo', expr.baseCalculo, { baseCalculoInformada: base }, bc);

  const tribVars: Variaveis = { ...baseVars, baseCalculo: bc };
  const calculated = avaliar(expr.tributoCalculado, tribVars);
  log('tributoCalculado', expr.tributoCalculado, { baseCalculo: bc, aliquotaEfetiva: aliqEfet }, calculated);
  let devido =
    expr.tributoDevido === null
      ? calculated
      : avaliar(expr.tributoDevido, { ...tribVars, tributoCalculado: calculated });

  let pDif: Decimal | undefined;
  let vDif: Decimal | undefined;
  const informedDif = item.diferimento?.[t];
  if (deferralAllowed && informedDif !== undefined) {
    pDif = dePercentual(percentInput(informedDif, `percentual de diferimento de ${t}`, n));
  } else if (deferralAllowed && expr.percentualDiferimento !== null && expr.valorDiferimento !== null) {
    pDif = avaliar(expr.percentualDiferimento, { ...tribVars, tributoCalculado: calculated });
  }
  if (pDif !== undefined) {
    vDif = calculated.mul(pDif).setScale(ESCALA_INTERNA, 'HALF_EVEN');
    log('valorDiferimento', 'tributoCalculado*percentualDiferimento', { tributoCalculado: calculated, pDif }, vDif);
    devido = devido.sub(vDif);
  }

  let pDevTrib: Decimal | undefined;
  let vDevTrib: Decimal | undefined;
  if (t === 'CBS' && item.devolucaoDeTributo !== undefined) {
    pDevTrib = dePercentual(percentInput(item.devolucaoDeTributo.pDevTrib, 'pDevTrib', n));
    const efet = aliqEfet ?? aliq;
    vDevTrib = bc.mul(efet).mul(pDevTrib).setScale(ESCALA_INTERNA, 'HALF_EVEN');
    log(
      'valorDevolucao',
      'baseCalculo*aliquotaEfetiva*pDevTrib',
      { baseCalculo: bc, aliquotaEfetiva: efet, pDevTrib },
      vDevTrib,
    );
    devido = devido.sub(vDevTrib);
  }
  if (devido.isNegative()) {
    fail('entrada_invalida', `${t}: diferimento e devolução somados excedem o tributo calculado`, n);
  }
  if (vDif !== undefined && vDevTrib !== undefined) {
    // Com as duas deduções, os arredondamentos independentes de vDif, vDevTrib e do valor podiam somar mais de um
    // centavo de diferença (UB35-10 e análogas): o valor sai do tributo menos as deduções como emitidas.
    const rounded = devido
      .add(vDif)
      .add(vDevTrib)
      .sub(Decimal.parse(dinheiro(vDif)))
      .sub(Decimal.parse(dinheiro(vDevTrib)));
    devido = rounded.isNegative() ? Decimal.ZERO : rounded;
  }
  log('tributoDevido', 'tributoCalculado-vDif-vDevTrib', { tributoCalculado: calculated, vDif, vDevTrib }, devido);

  return {
    t,
    applied: rate.applied,
    divided: rate.divided,
    aliq,
    aliqEfet,
    pRed,
    base: bc,
    devido,
    pDif,
    vDif,
    pDevTrib,
    vDevTrib,
  };
}

interface EnteGroups {
  readonly gDif?: GDif;
  readonly gDevTrib?: GDevTrib;
  readonly gRed?: GRed;
}

interface EnteOut {
  p: Decimal;
  v: Decimal;
  gRed: { pRedAliq: Decimal; pAliqEfet: Decimal } | undefined;
  gDif: { pDif: Decimal; vDif: Decimal } | undefined;
  gDevTrib: { pDevTrib: Decimal; vDevTrib: Decimal } | undefined;
  reg: { pAliqEfet: Decimal; v: Decimal } | undefined;
}

/**
 * Alíquota com a precisão em que sai no XML (percentual com 4 casas, fração com 6), HALF_EVEN. Os valores são calculados
 * com ela, e não com as 8 casas internas, para que `v = vBC x pAliqEfet` feche com o percentual emitido (UB35-10 e
 * análogas). Só muda algo com alíquota informada de 3 ou 4 casas e redução; com as alíquotas oficiais a fração já cabe
 * em 6 casas, e o resultado é o mesmo da Calculadora.
 */
function emittedRate(x: Decimal, divided: boolean): Decimal {
  const scale = divided ? 6 : 4;
  return x.scale > scale ? x.setScale(scale, 'HALF_EVEN') : x;
}

function pctOut(x: Decimal, divided: boolean): Decimal {
  return divided ? paraPercentual(x) : x;
}

interface ResultadoDoItem {
  readonly roc: RocItem;
  readonly vDif: Record<TributoDaAliquota, Decimal>;
  readonly vDevTrib: Record<TributoDaAliquota, Decimal>;
  readonly credPres: { ibs: Decimal; ibsCond: Decimal; cbs: Decimal; cbsCond: Decimal };
}

function calcItem(ctx: Ctx, item: ItemClassificado): ResultadoDoItem {
  const n = item.n;
  const main = resolve(ctx, item.cst, item.cClassTrib, n, '');
  if (item.monofasia !== undefined) {
    throw new ErroRegimeNaoSuportado('monofasia', 'tributação monofásica ainda não é suportada pelo motor', n);
  }
  if (item.impostoSeletivo !== undefined) {
    throw new ErroRegimeNaoSuportado('imposto-seletivo', 'Imposto Seletivo ainda não é suportado pelo motor', n);
  }
  checkSupported(main, n, '');
  const { cst, classTrib, treatment } = main;
  const owner = `CST ${cst.codigo}`;
  const ownerCt = `cClassTrib ${classTrib.codigo}`;

  // Tributação regular (gTribRegular).
  const needsRegular = treatment.indicadores.exigeGrupoTribRegular || classTrib.grupos.gTribRegular === 'obrigatorio';
  const allowsRegular = needsRegular || classTrib.grupos.gTribRegular === 'permitido';
  if (needsRegular && item.regular === undefined) {
    fail('tributacao_regular_obrigatoria', `${ownerCt} exige o grupo de tributação regular (gTribRegular)`, n);
  }
  if (!allowsRegular && item.regular !== undefined) {
    fail('grupo_vedado', `${ownerCt} não permite o grupo de tributação regular (gTribRegular)`, n);
  }
  let regular: Resolved | undefined;
  if (item.regular !== undefined) {
    regular = resolve(ctx, item.regular.cst, item.regular.cClassTrib, n, 'tributação regular: ');
    checkSupported(regular, n, 'tributação regular: ');
    const rt = regular.treatment.indicadores;
    if (rt.exigeGrupoTribRegular || rt.incompativelComSuspensao || regular.cst.grupos.gIBSCBS !== 'obrigatorio') {
      fail(
        'tributacao_regular_invalida',
        `tributação regular: cClassTrib ${regular.classTrib.codigo} não pode ser a tributação regular de ${classTrib.codigo}`,
        n,
      );
    }
  }

  // Grupos governados por indicadores.
  const g = cst.grupos;
  checkGroup(g.gTransfCred, item.transferenciaDeCredito !== undefined, 'gTransfCred', owner, n);
  checkGroup(g.gAjusteCompet, item.ajusteDeCompetencia !== undefined, 'gAjusteCompet', owner, n);
  checkGroup(g.gCredPresIBSZFM, item.creditoZfm !== undefined, 'gCredPresIBSZFM', owner, n);
  checkGroup(classTrib.grupos.gEstornoCred, item.estornoDeCredito !== undefined, 'gEstornoCred', ownerCt, n);
  const ownIndicator = classTrib.grupos.gCredPresOper === 'obrigatorio' ? 'permitido' : classTrib.grupos.gCredPresOper;
  // Bem móvel usado: a UB120-20 não se aplica, e o crédito presumido vale mesmo com cClassTrib que o veda.
  const presumedIndicator = item.creditoPresumido?.bemMovelUsado === true ? 'permitido' : ownIndicator;
  checkGroup(presumedIndicator, item.creditoPresumido !== undefined, 'gCredPresOper', ownerCt, n);
  if (item.creditoPresumido !== undefined && item.creditoZfm !== undefined) {
    fail('grupos_exclusivos', 'gCredPresOper e gCredPresIBSZFM são exclusivos (UB119)', n);
  }
  const hasMain = g.gIBSCBS !== 'vedado';
  if (!hasMain && (item.diferimento !== undefined || item.devolucaoDeTributo !== undefined)) {
    fail('grupo_vedado', `${owner} não tem gIBSCBS: diferimento e devolução não se aplicam`, n);
  }
  if (g.gDif === 'vedado' && item.diferimento !== undefined) {
    fail('grupo_vedado', `${owner} não permite o grupo de diferimento (gDif)`, n);
  }

  const out: IBSCBS & Record<string, unknown> = { CST: cst.codigo, cClassTrib: classTrib.codigo };
  const ibscbs: Record<string, unknown> = out;
  const applied: AliquotaAplicada[] = [];
  const vDifs: Record<TributoDaAliquota, Decimal> = { CBS: Decimal.ZERO, IBSUF: Decimal.ZERO, IBSMun: Decimal.ZERO };
  const vDevs: Record<TributoDaAliquota, Decimal> = { CBS: Decimal.ZERO, IBSUF: Decimal.ZERO, IBSMun: Decimal.ZERO };
  let vCredIbs = Decimal.ZERO;
  let vCredIbsCond = Decimal.ZERO;
  let vCredCbs = Decimal.ZERO;
  let vCredCbsCond = Decimal.ZERO;

  // Crédito presumido (antes do gIBSCBS: o vIBS do item pode abater o crédito, UB54a-10).
  let deductIbs = Decimal.ZERO;
  if (item.creditoPresumido !== undefined) {
    const pc = item.creditoPresumido;
    const cp = ctx.content.credPres(pc.cCredPres);
    if (!cp) fail('ccredpres_inexistente', `cCredPres ${pc.cCredPres} inexistente`, n);
    if (!cp.cbs && !cp.ibs) {
      fail('ccredpres_fora_de_vigencia', `cCredPres ${pc.cCredPres} fora de vigência em ${ctx.date}`, n);
    }
    const vbc = decimalInput(pc.vBCCredPres, 'vBCCredPres', n);
    const group: Record<string, unknown> = { vBCCredPres: dinheiro(vbc), cCredPres: pc.cCredPres };
    const one = (which: 'ibs' | 'cbs'): Decimal[] | undefined => {
      const input = pc[which];
      const name = which === 'ibs' ? 'gIBSCredPres' : 'gCBSCredPres';
      if (input !== undefined && !cp[which]) {
        fail(
          'ccredpres_fora_de_vigencia',
          `cCredPres ${pc.cCredPres} fora de vigência para ${which.toUpperCase()} em ${ctx.date}`,
          n,
        );
      }
      // O indicador só obriga o grupo do tributo em que o crédito está vigente na data.
      const indicator = cp[which] ? cp.registro.grupos[name] : 'vedado';
      checkGroup(indicator, input !== undefined, name, `cCredPres ${pc.cCredPres}`, n);
      if (input === undefined) return undefined;
      const p = percentInput(input.pCredPres, `pCredPres ${which.toUpperCase()}`, n);
      const v = vbc.mul(dePercentual(p)).setScale(ESCALA_INTERNA, 'HALF_EVEN');
      ctx.trace.push({
        item: n,
        campo: `vCredPres${which.toUpperCase()}`,
        formula: 'vBCCredPres*pCredPres/100',
        entradas: { vBCCredPres: vbc.toString(), pCredPres: p.toString() },
        resultado: v.toString(),
      });
      const rounded = Decimal.parse(dinheiro(v));
      const tg: GCredPresTributo = input.condicional
        ? { pCredPres: percentual(p), vCredPresCondSus: dinheiro(v) }
        : { pCredPres: percentual(p), vCredPres: dinheiro(v) };
      group[name] = tg;
      return input.condicional ? [Decimal.ZERO, rounded] : [rounded, Decimal.ZERO];
    };
    const ibs = one('ibs');
    const cbs = one('cbs');
    if (ibs) [vCredIbs, vCredIbsCond] = [ibs[0] ?? Decimal.ZERO, ibs[1] ?? Decimal.ZERO];
    if (cbs) [vCredCbs, vCredCbsCond] = [cbs[0] ?? Decimal.ZERO, cbs[1] ?? Decimal.ZERO];
    if (cp.registro.deduzDoTributo) deductIbs = vCredIbs;
    ibscbs.gCredPresOper = group as unknown as GCredPresOper;
  }

  if (hasMain) {
    const calc = regular ?? main;
    const base = decimalInput(item.base, 'base de cálculo (vBC)', n);
    const quantity = item.quantidade === undefined ? Decimal.ONE : decimalInput(item.quantidade, 'quantidade', n);
    const deferralAllowed = g.gDif !== 'vedado';
    const results = TRIBUTOS_DAS_ALIQUOTAS.map((t) => calcTributo(ctx, item, calc, t, base, quantity, deferralAllowed));
    const byT = (t: TributoDaAliquota): TribCalc => results.find((r) => r.t === t) as TribCalc;
    if (g.gDif === 'obrigatorio' && results.some((r) => r.pDif === undefined)) {
      fail('grupo_obrigatorio', `${owner} exige o grupo de diferimento (gDif) e o tratamento não define percentual`, n);
    }
    for (const r of results) applied.push(r.applied);
    // Com tributação regular o grupo principal sai zerado: diferimento ou devolução calculados sobre o tratamento
    // regular dariam gDif e gDevTrib sobre alíquota zero (UB23-10, UB63-10 e análogas). Sem regra publicada, recusa.
    if (regular && results.some((r) => r.pDif !== undefined || r.pDevTrib !== undefined)) {
      fail(
        'entrada_invalida',
        'diferimento ou devolução de tributos com tributação regular: o grupo principal sai zerado e não há regra publicada para eles',
        n,
      );
    }

    const redAllowed = calc.cst.grupos.gRed !== 'vedado';
    // Na tributação regular o grupo principal sai zerado, mas a CST que exige gRed (UB26-20) ainda pede o grupo com o
    // pRedAliq da tabela do cClassTrib principal (UB27-10); a Calculadora não o emite (divergência no ledger).
    const regularRed = (t: TributoDaAliquota): Decimal | undefined =>
      regular && cst.grupos.gRed === 'obrigatorio'
        ? Decimal.parse(ctx.content.reducao(classTrib, t) ?? '0')
        : undefined;
    const regularTreat = regular?.treatment.indicadores.possuiPercentualReducao ?? false;
    const entes = {} as Record<TributoDaAliquota, EnteOut>;
    for (const r of results) {
      const withRed = redAllowed && !(regular && !ctx.gov) && r.pRed !== undefined && r.aliqEfet !== undefined;
      let reg: EnteOut['reg'];
      if (regular) {
        const efet = regularTreat
          ? emittedRate(r.aliq.mul(Decimal.ONE.sub(r.pRed ?? Decimal.ZERO)), r.divided)
          : r.aliq;
        const v = r.base.mul(efet).setScale(ESCALA_INTERNA, 'HALF_EVEN');
        reg = { pAliqEfet: pctOut(efet, r.divided), v };
      }
      entes[r.t] = {
        p: regular ? Decimal.ZERO : pctOut(r.aliq, r.divided),
        v: regular ? Decimal.ZERO : r.devido,
        gRed:
          withRed && r.pRed !== undefined && r.aliqEfet !== undefined
            ? { pRedAliq: paraPercentual(r.pRed), pAliqEfet: pctOut(r.aliqEfet, r.divided) }
            : undefined,
        gDif: r.pDif !== undefined && r.vDif !== undefined ? { pDif: paraPercentual(r.pDif), vDif: r.vDif } : undefined,
        gDevTrib:
          r.pDevTrib !== undefined && r.vDevTrib !== undefined
            ? { pDevTrib: paraPercentual(r.pDevTrib), vDevTrib: r.vDevTrib }
            : undefined,
        reg,
      };
      const rr = regularRed(r.t);
      if (rr !== undefined) entes[r.t].gRed = { pRedAliq: rr, pAliqEfet: Decimal.ZERO };
    }

    let compraGov: GTribCompraGov | undefined;
    if (ctx.gov) {
      const values = Object.fromEntries(
        results.map((r) => [r.t, { pAliq: paraPercentual(r.aliqEfet ?? Decimal.ZERO), vTrib: r.devido }]),
      ) as unknown as ValoresCompraGov;
      // A parte transferida da CBS (a partir de 2029) dá alíquota com mais de 4 casas: ela sai com a precisão do XML e o
      // valor acompanha na mesma proporção, para `v = vBC x pAliqEfet` fechar com o emitido (UB35-10, UB67-10).
      // A soma das alíquotas não muda com a redistribuição; o resíduo do arredondamento vai para o ente com a maior
      // alíquota, para o total do item continuar igual ao de gTribCompraGov (UB82a-20).
      const raw = redistribuir(values, ctx.gov.tp, ctx.date, ctx.gov.transfer);
      const ratio = {} as Record<TributoDaAliquota, Decimal | undefined>;
      const eff = {} as Record<TributoDaAliquota, ValoresCompraGov[TributoDaAliquota]>;
      const rounded = {} as Record<TributoDaAliquota, Decimal>;
      for (const t of TRIBUTOS_DAS_ALIQUOTAS) {
        const pAliq = raw[t].pAliq;
        rounded[t] = pAliq.scale > 4 ? pAliq.setScale(4, 'HALF_EVEN') : pAliq;
      }
      const residue = sum(TRIBUTOS_DAS_ALIQUOTAS.map((t) => raw[t].pAliq)).sub(
        sum(TRIBUTOS_DAS_ALIQUOTAS.map((t) => rounded[t])),
      );
      if (!residue.isZero()) {
        const top = [...TRIBUTOS_DAS_ALIQUOTAS].sort((a, b) => rounded[b].cmp(rounded[a]))[0] as TributoDaAliquota;
        rounded[top] = rounded[top].add(residue);
      }
      for (const t of TRIBUTOS_DAS_ALIQUOTAS) {
        const { pAliq, vTrib } = raw[t];
        const q = rounded[t];
        const k = q.eq(pAliq) || pAliq.isZero() ? undefined : q.div(pAliq);
        ratio[t] = k;
        eff[t] = { pAliq: q, vTrib: k ? vTrib.mul(k).setScale(ESCALA_INTERNA, 'HALF_EVEN') : vTrib };
      }
      const redistributes = ctx.date >= REDISTRIBUICAO_A_PARTIR_DE;
      // Diferimento e devolução acompanham a redistribuição do art. 473: senão o gDif e o gDevTrib ficariam no ente de
      // origem, calculados sobre uma alíquota que ele não tem mais (UB23-10, UB24-10 e análogas). O vDif é linear e
      // se redistribui como o tributo, desde que o percentual seja o mesmo nos três; devolução não tem regra publicada.
      if (redistributes && results.some((r) => r.pDevTrib !== undefined)) {
        fail(
          'entrada_invalida',
          'devolução de tributos (gDevTrib) em compra governamental a partir de 2027: a redistribuição do art. 473 não tem regra publicada para ela',
          n,
        );
      }
      if (redistributes && !regular && results.some((r) => r.pDif !== undefined)) {
        const pDifs = new Set(results.map((r) => r.pDif?.toString() ?? '-'));
        if (pDifs.size !== 1) {
          fail(
            'entrada_invalida',
            'diferimento com percentuais diferentes por tributo em compra governamental a partir de 2027: a redistribuição do art. 473 não tem regra publicada para ele',
            n,
          );
        }
        const difs = Object.fromEntries(
          results.map((r) => [r.t, { pAliq: Decimal.ZERO, vTrib: r.vDif ?? Decimal.ZERO }]),
        ) as unknown as ValoresCompraGov;
        const moved = redistribuir(difs, ctx.gov.tp, ctx.date, ctx.gov.transfer);
        for (const t of TRIBUTOS_DAS_ALIQUOTAS) {
          const g = entes[t].gDif;
          const k = ratio[t];
          if (g) g.vDif = k ? moved[t].vTrib.mul(k).setScale(ESCALA_INTERNA, 'HALF_EVEN') : moved[t].vTrib;
        }
      }
      for (const t of TRIBUTOS_DAS_ALIQUOTAS) {
        const e = entes[t];
        const target = eff[t];
        if (regular) {
          e.gRed = { pRedAliq: regularRed(t) ?? Decimal.ZERO, pAliqEfet: Decimal.ZERO };
          e.v = Decimal.ZERO;
          e.reg = { pAliqEfet: target.pAliq, v: target.vTrib };
        } else {
          e.gRed = { pRedAliq: e.gRed?.pRedAliq ?? Decimal.ZERO, pAliqEfet: target.pAliq };
          e.v = target.vTrib;
        }
        ctx.trace.push({
          item: n,
          tributo: t,
          campo: 'compraGovernamental',
          formula: 'art. 473 da LC 214/2025',
          entradas: { pAliq: values[t].pAliq.toString(), vTrib: values[t].vTrib.toString() },
          resultado: `${target.pAliq.toString()} / ${target.vTrib.toString()}`,
        });
      }
      const z = regular !== undefined;
      const p = (t: TributoDaAliquota): string => percentual(z ? Decimal.ZERO : values[t].pAliq);
      const v = (t: TributoDaAliquota): string => dinheiro(z ? Decimal.ZERO : values[t].vTrib);
      compraGov = {
        pAliqIBSUF: p('IBSUF'),
        vTribIBSUF: v('IBSUF'),
        pAliqIBSMun: p('IBSMun'),
        vTribIBSMun: v('IBSMun'),
        pAliqCBS: p('CBS'),
        vTribCBS: v('CBS'),
      };
    }

    const fmt = (e: EnteOut): EnteGroups => ({
      ...(e.gDif ? { gDif: { pDif: percentual(e.gDif.pDif), vDif: dinheiro(e.gDif.vDif) } } : {}),
      ...(e.gDevTrib
        ? { gDevTrib: { pDevTrib: percentual(e.gDevTrib.pDevTrib), vDevTrib: dinheiro(e.gDevTrib.vDevTrib) } }
        : {}),
      ...(e.gRed ? { gRed: { pRedAliq: percentual(e.gRed.pRedAliq), pAliqEfet: percentual(e.gRed.pAliqEfet) } } : {}),
    });
    const uf = entes.IBSUF;
    const mun = entes.IBSMun;
    const cbs = entes.CBS;
    const vIBSUF = dinheiro(uf.v);
    const vIBSMun = dinheiro(mun.v);
    const vIBS = Decimal.parse(vIBSUF).add(Decimal.parse(vIBSMun)).sub(deductIbs);
    if (vIBS.isNegative()) fail('entrada_invalida', 'crédito presumido deduzido excede o IBS do item (UB54a-10)', n);
    const { gDevTrib: _ufDev, ...ufGroups } = fmt(uf);
    const { gDevTrib: _munDev, ...munGroups } = fmt(mun);
    let tribRegular: GTribRegular | undefined;
    if (regular && uf.reg && mun.reg && cbs.reg) {
      tribRegular = {
        CSTReg: regular.cst.codigo,
        cClassTribReg: regular.classTrib.codigo,
        pAliqEfetRegIBSUF: percentual(uf.reg.pAliqEfet),
        vTribRegIBSUF: dinheiro(uf.reg.v),
        pAliqEfetRegIBSMun: percentual(mun.reg.pAliqEfet),
        vTribRegIBSMun: dinheiro(mun.reg.v),
        pAliqEfetRegCBS: percentual(cbs.reg.pAliqEfet),
        vTribRegCBS: dinheiro(cbs.reg.v),
      };
    }
    const gIBSCBS: GIBSCBS = {
      vBC: dinheiro(byT('CBS').base),
      gIBSUF: { pIBSUF: percentual(uf.p), ...ufGroups, vIBSUF },
      gIBSMun: { pIBSMun: percentual(mun.p), ...munGroups, vIBSMun },
      vIBS: dinheiro(vIBS),
      gCBS: { pCBS: percentual(cbs.p), ...fmt(cbs), vCBS: dinheiro(cbs.v) },
      ...(tribRegular ? { gTribRegular: tribRegular } : {}),
      ...(compraGov ? { gTribCompraGov: compraGov } : {}),
    };
    ibscbs.gIBSCBS = gIBSCBS;
    for (const t of TRIBUTOS_DAS_ALIQUOTAS) {
      const e = entes[t];
      if (e.gDif) vDifs[t] = Decimal.parse(dinheiro(e.gDif.vDif));
      if (e.gDevTrib) vDevs[t] = Decimal.parse(dinheiro(e.gDevTrib.vDevTrib));
    }
  }

  if (item.transferenciaDeCredito !== undefined) {
    const x = item.transferenciaDeCredito;
    ibscbs.gTransfCred = {
      vIBS: dinheiro(decimalInput(x.vIBS, 'gTransfCred.vIBS', n)),
      vCBS: dinheiro(decimalInput(x.vCBS, 'gTransfCred.vCBS', n)),
    };
  }
  if (item.ajusteDeCompetencia !== undefined) {
    const x = item.ajusteDeCompetencia;
    if (!COMPET.test(x.competApur)) fail('entrada_invalida', `competApur inválido: ${x.competApur}; use AAAA-MM`, n);
    ibscbs.gAjusteCompet = {
      competApur: x.competApur,
      vIBS: dinheiro(decimalInput(x.vIBS, 'gAjusteCompet.vIBS', n)),
      vCBS: dinheiro(decimalInput(x.vCBS, 'gAjusteCompet.vCBS', n)),
    };
  }
  if (item.estornoDeCredito !== undefined) {
    const x = item.estornoDeCredito;
    ibscbs.gEstornoCred = {
      vIBSEstCred: dinheiro(decimalInput(x.vIBSEstCred, 'gEstornoCred.vIBSEstCred', n)),
      vCBSEstCred: dinheiro(decimalInput(x.vCBSEstCred, 'gEstornoCred.vCBSEstCred', n)),
    };
  }
  if (item.creditoZfm !== undefined) {
    const x = item.creditoZfm;
    if (!COMPET.test(x.competApur)) fail('entrada_invalida', `competApur inválido: ${x.competApur}; use AAAA-MM`, n);
    if (![0, 1, 2, 3, 4].includes(x.tpCredPresIBSZFM)) {
      fail('entrada_invalida', `tpCredPresIBSZFM inválido: ${x.tpCredPresIBSZFM}`, n);
    }
    ibscbs.gCredPresIBSZFM = {
      competApur: x.competApur,
      tpCredPresIBSZFM: x.tpCredPresIBSZFM,
      vCredPresIBSZFM: dinheiro(decimalInput(x.vCredPresIBSZFM, 'vCredPresIBSZFM', n)),
    };
  }

  const ordered = orderIbscbs(out);
  return {
    roc: {
      nItem: n,
      IBSCBS: ordered,
      aliquotas: applied,
      simulado: applied.some((a) => a.situacao !== 'oficial'),
    },
    vDif: vDifs,
    vDevTrib: vDevs,
    credPres: { ibs: vCredIbs, ibsCond: vCredIbsCond, cbs: vCredCbs, cbsCond: vCredCbsCond },
  };
}

/** Ordem dos grupos do leiaute (UB12): facilita comparar e serializar. */
function orderIbscbs(x: IBSCBS): IBSCBS {
  const keys = [
    'CST',
    'cClassTrib',
    'gIBSCBS',
    'gTransfCred',
    'gAjusteCompet',
    'gEstornoCred',
    'gCredPresOper',
    'gCredPresIBSZFM',
  ] as const;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (x[k] !== undefined) out[k] = x[k];
  return out as unknown as IBSCBS;
}

function totals(results: readonly ResultadoDoItem[]): IBSCBSTot {
  const d = (s: string | undefined): Decimal => (s === undefined ? Decimal.ZERO : Decimal.parse(s));
  const main = results.map((r) => r.roc.IBSCBS.gIBSCBS).filter((x): x is GIBSCBS => x !== undefined);
  const s = (f: (r: ResultadoDoItem) => Decimal): string => dinheiro(sum(results.map(f)));
  const reversal = results.map((r) => r.roc.IBSCBS.gEstornoCred).filter((x) => x !== undefined);
  return {
    vBCIBSCBS: dinheiro(sum(main.map((m) => d(m.vBC)))),
    gIBS: {
      gIBSUF: {
        vDif: s((r) => r.vDif.IBSUF),
        vDevTrib: s((r) => r.vDevTrib.IBSUF),
        vIBSUF: dinheiro(sum(main.map((m) => d(m.gIBSUF.vIBSUF)))),
      },
      gIBSMun: {
        vDif: s((r) => r.vDif.IBSMun),
        vDevTrib: s((r) => r.vDevTrib.IBSMun),
        vIBSMun: dinheiro(sum(main.map((m) => d(m.gIBSMun.vIBSMun)))),
      },
      vIBS: dinheiro(sum(main.map((m) => d(m.vIBS)))),
      vCredPres: s((r) => r.credPres.ibs),
      vCredPresCondSus: s((r) => r.credPres.ibsCond),
    },
    gCBS: {
      vDif: s((r) => r.vDif.CBS),
      vDevTrib: s((r) => r.vDevTrib.CBS),
      vCBS: dinheiro(sum(main.map((m) => d(m.gCBS.vCBS)))),
      vCredPres: s((r) => r.credPres.cbs),
      vCredPresCondSus: s((r) => r.credPres.cbsCond),
    },
    ...(reversal.length > 0
      ? {
          gEstornoCred: {
            vIBSEstCred: dinheiro(sum(reversal.map((x) => d(x.vIBSEstCred)))),
            vCBSEstCred: dinheiro(sum(reversal.map((x) => d(x.vCBSEstCred)))),
          },
        }
      : {}),
  };
}

function checkOperation(op: OperacaoClassificada): void {
  if (!op || typeof op !== 'object' || !Array.isArray(op.itens)) fail('entrada_invalida', 'operação sem itens');
  if (op.itens.length === 0) fail('entrada_invalida', 'operação sem itens');
  if (!Number.isInteger(op.modelo)) fail('entrada_invalida', `modelo de DF-e inválido: ${String(op.modelo)}`);
  if (!op.local || typeof op.local.uf !== 'string' || !/^\d{7}$/.test(String(op.local.cMun))) {
    fail('entrada_invalida', 'local da operação inválido: informe uf e cMun (IBGE, 7 dígitos)');
  }
  const seen = new Set<number>();
  for (const it of op.itens) {
    if (!Number.isInteger(it.n) || it.n < 1) fail('entrada_invalida', `número de item inválido: ${String(it.n)}`);
    if (seen.has(it.n)) fail('entrada_invalida', `item ${it.n} repetido`, it.n);
    seen.add(it.n);
    if (
      it.aliquotasInformadas !== undefined &&
      (typeof it.aliquotasInformadas.motivo !== 'string' || !it.aliquotasInformadas.motivo.trim())
    ) {
      fail('entrada_invalida', 'alíquotas informadas exigem o motivo (aliquotasInformadas.motivo)', it.n);
    }
  }
  const gov = op.compraGovernamental;
  if (gov !== undefined && ![1, 2, 3, 4, 5, 6].includes(gov.tpEnteGov)) {
    fail('entrada_invalida', `tpEnteGov inválido: ${String(gov.tpEnteGov)}`);
  }
}

/** Calcula IBS e CBS da operação. Lança `ErroClassificacao`, `ErroRegimeNaoSuportado` ou `ErroAliquotaDesconhecida`. */
export function calcular(op: OperacaoClassificada, opcoes: CalcularOpcoes): Roc {
  const date = dataCivil(opcoes.tempo.fatoGerador.agora(), opcoes.deslocamentoMin ?? DESLOCAMENTO_BRASILIA_MIN);
  return calcularEm(op, { dataset: opcoes.dataset, aliquotas: opcoes.aliquotas, data: date });
}

/**
 * Variante com a data civil do fato gerador já resolvida (`AAAA-MM-DD`): para reprocessamento e para o oráculo, que
 * trabalham com a data que a Calculadora recebe.
 */
export function calcularEm(
  op: OperacaoClassificada,
  opcoes: { readonly dataset: DatasetIbsCbs; readonly aliquotas: ProvedorDeAliquotas; readonly data: DataIso },
): Roc {
  checkOperation(op);
  const content = opcoes.dataset.em(opcoes.data);
  const date = content.dataDeReferencia;
  let gov: GovContext | undefined;
  if (op.compraGovernamental !== undefined) {
    const red = content.redutorCompraGov();
    const transfer = content.percentualTransferenciaCbs();
    if (red === undefined || transfer === undefined) {
      fail('dados_incompletos', `redutor ou transferência de compras governamentais ausente no dataset em ${date}`);
    }
    gov = {
      tp: op.compraGovernamental.tpEnteGov,
      tpOperGov: op.compraGovernamental.tpOperGov,
      pRedutor: Decimal.parse(red),
      transfer: dePercentual(Decimal.parse(transfer)),
    };
  }
  const ctx: Ctx = { content, date, op, rates: opcoes.aliquotas, gov, trace: [] };
  const results = [...op.itens].sort((a, b) => a.n - b.n).map((it) => calcItem(ctx, it));
  const items = results.map((r) => r.roc);
  return {
    dataDeReferencia: date,
    ...(gov
      ? {
          oper: {
            gCompraGov: {
              tpEnteGov: gov.tp,
              pRedutor: percentual(gov.pRedutor),
              ...(gov.tpOperGov === undefined ? {} : { tpOperGov: gov.tpOperGov }),
            },
          },
        }
      : {}),
    itens: items,
    total: { IBSCBSTot: totals(results) },
    simulado: items.some((i) => i.simulado),
    versaoDoConteudo: opcoes.dataset.versaoDoConteudo,
    idDasAliquotas: opcoes.aliquotas.id,
    rastro: ctx.trace,
  };
}
