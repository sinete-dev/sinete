/**
 * Cálculo do IBS e da CBS de uma operação já classificada.
 *
 * Puro e determinístico: mesma operação, mesmos dados, mesmas alíquotas e mesma data dão o mesmo `Roc`. As regras de
 * cálculo vêm do dataset (expressões do tratamento tributário de cada cClassTrib, reduções, alíquotas fixas, redutor e
 * transferência de compras governamentais); as alíquotas nominais vêm do `RateProvider`. A precisão segue a
 * Calculadora da RFB: cada expressão é arredondada para 8 casas HALF_EVEN (LC 214/2025, art. 349, § 14) e a saída para
 * 2 casas nos valores e de 2 a 4 casas nos percentuais.
 *
 * Duas escolhas diferem da Calculadora de propósito, e o oráculo as registra no ledger de divergências:
 * - `vIBS` do item e os totais somam os valores já arredondados do XML, como exigem as RV UB54a-10 e W35-10 a W59g-10
 *   (a Calculadora soma os valores internos e arredonda depois);
 * - o diferimento abate `vDif` uma vez do tributo calculado (UB35-10: v = vBC x pAliqEfet - vDif - vDevTrib).
 *
 * A data dos dados e das alíquotas é a data civil do relógio de fato gerador do `TimeContext`, no fuso do local da
 * operação (Brasília por padrão).
 */
import type { ContextoDeTempo } from '@sinete/core';
import type {
  ClassTribRecord,
  CstRecord,
  IbsCbsDataset,
  Indicator,
  TaxContent,
  TreatmentRecord,
} from '@sinete/ibs-cbs-dados';
import { BRASILIA_OFFSET_MINUTES, civilDate } from '@sinete/ibs-cbs-dados';
import type { RateProvider, RateTributo } from '../aliquotas/index.ts';
import { RATE_TRIBUTOS, RateUnknownError, requireRate } from '../aliquotas/index.ts';
import { Decimal, sum } from './decimal.ts';
import type { ClassificationReason } from './errors.ts';
import { ClassificationError, UnsupportedRegimeError } from './errors.ts';
import type { Variables } from './expression.ts';
import { evaluate, INTERNAL_SCALE } from './expression.ts';
import { fromPercent, money, percent, toPercent } from './format.ts';
import type { GovValues } from './govpurchase.ts';
import { REDISTRIBUTION_FROM, redistribute } from './govpurchase.ts';
import type {
  AppliedRate,
  ClassifiedItem,
  ClassifiedOperation,
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
  InformedRates,
  IsoDate,
  Roc,
  RocItem,
  TpEnteGov,
  TraceEntry,
} from './types.ts';

export interface CalculateOptions {
  readonly dataset: IbsCbsDataset;
  readonly rates: RateProvider;
  /** Relógios da operação: o de fato gerador decide dados e alíquotas. */
  readonly time: ContextoDeTempo;
  /** Deslocamento do fuso do local da operação em minutos (padrão: Brasília, `-180`). */
  readonly utcOffsetMinutes?: number;
}

const COMBINED = 'Alíquotas Combinadas (Ad Valorem e Ad Rem)';
const DECIMAL_PERCENT = /^\d{1,3}(\.\d{1,4})?$/;
const COMPET = /^\d{4}-(0[1-9]|1[0-2])$/;

interface Resolved {
  readonly cst: CstRecord;
  readonly classTrib: ClassTribRecord;
  readonly treatment: TreatmentRecord;
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
  readonly content: TaxContent;
  readonly date: IsoDate;
  readonly op: ClassifiedOperation;
  readonly rates: RateProvider;
  readonly gov: GovContext | undefined;
  readonly trace: TraceEntry[];
}

/** Resultado interno de um tributo, em precisão interna. */
interface TribCalc {
  readonly t: RateTributo;
  readonly applied: AppliedRate;
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

function fail(reason: ClassificationReason, message: string, item?: number): never {
  throw new ClassificationError(reason, message, item);
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

/** Confere presença contra o indicador: `required` exige, `forbidden` veda, `allowed` aceita os dois. */
function checkGroup(indicator: Indicator | null, present: boolean, group: string, owner: string, item: number): void {
  if (indicator === 'required' && !present) {
    fail('grupo_obrigatorio', `${owner} exige o grupo ${group}`, item);
  }
  if (indicator === 'forbidden' && present) {
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
  if (!c.allowedIn(classTrib, ctx.op.modelo)) {
    fail(
      'nao_habilitado_no_dfe',
      `${label}cClassTrib ${code} não é permitido no modelo ${ctx.op.modelo} em ${ctx.date}`,
      item,
    );
  }
  const treatment = c.treatment(classTrib);
  if (!treatment)
    fail('tratamento_ausente', `${label}cClassTrib ${code} sem tratamento tributário em ${ctx.date}`, item);
  return { cst: cstRec, classTrib, treatment };
}

/**
 * Regimes que o motor não calcula. Quando o cClassTrib exige tributação regular (suspensão e afins), o cálculo usa o
 * tratamento do cClassTrib regular, então só ele passa pela checagem de tratamento; o principal responde pela CST.
 */
function checkSupported(r: Resolved, item: number, label: string): void {
  const usesOwnTreatment = !r.treatment.flags.exigeGrupoTribRegular;
  if (r.cst.groups.gIBSCBSMono === 'required' || (usesOwnTreatment && r.treatment.flags.possuiMonofasia)) {
    throw new UnsupportedRegimeError(
      'monofasia',
      `${label}cClassTrib ${r.classTrib.code}: tributação monofásica ainda não é suportada pelo motor`,
      item,
    );
  }
  if (r.classTrib.rateKind === COMBINED) {
    throw new UnsupportedRegimeError(
      'aliquotas-combinadas',
      `${label}cClassTrib ${r.classTrib.code}: alíquotas combinadas (ad valorem e ad rem) ainda não são suportadas`,
      item,
    );
  }
  if (usesOwnTreatment && r.treatment.flags.possuiAjuste && r.cst.groups.gIBSCBS === 'required') {
    throw new UnsupportedRegimeError(
      'ajuste',
      `${label}cClassTrib ${r.classTrib.code}: tratamento com ajuste ("${r.treatment.description}") sem regra de cálculo publicada; a Calculadora também recusa`,
      item,
    );
  }
}

interface RateChoice {
  readonly pct: Decimal;
  readonly divided: boolean;
  readonly informed: boolean;
  readonly applied: AppliedRate;
}

function applyRate(
  ctx: Ctx,
  c: ClassTribRecord,
  t: RateTributo,
  informed: InformedRates | undefined,
  item: number,
): RateChoice {
  const kind = c.rateKind;
  if (kind === 'Sem alíquota') {
    const applied: AppliedRate = { tributo: t, value: '0', status: 'official', origin: 'no-rate' };
    return { pct: Decimal.ZERO, divided: false, informed: false, applied };
  }
  const inf = informed?.[t];
  if (inf !== undefined) {
    const pct = percentInput(inf, `alíquota informada de ${t}`, item);
    const applied: AppliedRate = {
      tributo: t,
      value: inf,
      status: 'user-provided',
      origin: 'informed',
      reason: informed?.reason ?? '',
    };
    return { pct, divided: true, informed: true, applied };
  }
  if (kind === 'Uniforme setorial' || kind === 'Fixa') {
    const fixed = ctx.content.fixedRate(c, t);
    if (fixed === undefined) {
      throw new RateUnknownError(
        t,
        ctx.date,
        `cClassTrib ${c.code} (${kind}): sem alíquota de ${t} no dataset em ${ctx.date}; informe-a em informedRates para simular`,
        { detalhes: { tributo: t, date: ctx.date, cClassTrib: c.code, item } },
      );
    }
    const applied: AppliedRate = { tributo: t, value: fixed, status: 'official', origin: 'dataset-fixed' };
    return { pct: Decimal.parse(fixed), divided: true, informed: false, applied };
  }
  const nominal = kind === 'Padrão';
  const rate = nominal ? ctx.rates.nominal(ctx.date, ctx.op.place)[t] : ctx.rates.reference(ctx.date)[t];
  const value = requireRate(rate, ctx.date);
  const applied: AppliedRate = {
    tributo: t,
    value,
    status: rate.status,
    origin: nominal ? 'provider-nominal' : 'provider-reference',
    ...(rate.legal === undefined ? {} : { legal: rate.legal }),
    ...(rate.reason === undefined ? {} : { reason: rate.reason }),
  };
  return { pct: Decimal.parse(value), divided: true, informed: false, applied };
}

const USES_ALIQUOTA = /\baliquota\b/;

function calcTributo(
  ctx: Ctx,
  item: ClassifiedItem,
  calc: Resolved,
  t: RateTributo,
  base: Decimal,
  quantity: Decimal,
  deferralAllowed: boolean,
): TribCalc {
  const n = item.n;
  const { treatment, classTrib } = calc;
  const expr = treatment.expr;
  const rate = applyRate(ctx, classTrib, t, item.informedRates, n);
  const aliqInput = rate.divided ? fromPercent(rate.pct) : rate.pct;
  const log = (field: string, formula: string, inputs: Record<string, Decimal | undefined>, result: Decimal): void => {
    const shown: Record<string, string> = {};
    for (const [k, v] of Object.entries(inputs)) if (v !== undefined) shown[k] = v.toString();
    ctx.trace.push({ item: n, tributo: t, field, formula, inputs: shown, result: result.toString() });
  };

  let pRed: Decimal | undefined;
  if (treatment.flags.possuiPercentualReducao) {
    const red = ctx.content.reduction(classTrib, t);
    if (red === undefined) {
      fail(
        'dados_incompletos',
        `cClassTrib ${classTrib.code}: percentual de redução de ${t} ausente em ${ctx.date}`,
        n,
      );
    }
    pRed = fromPercent(Decimal.parse(red));
  }
  const redutor = ctx.gov?.pRedutor ?? Decimal.ZERO;
  const common: Record<string, Decimal | undefined> = { quantidade: quantity, percentualReducao: pRed };

  let aliq: Decimal;
  if (rate.informed && !(expr.aliquota !== null && USES_ALIQUOTA.test(expr.aliquota))) {
    // Alíquota informada prevalece sobre expressão fixa ("0", "2.08/100"), como na Calculadora.
    aliq = aliqInput;
  } else if (expr.aliquota !== null) {
    aliq = evaluate(expr.aliquota, { ...common, aliquota: aliqInput });
  } else {
    aliq = Decimal.ZERO;
  }
  aliq = emittedRate(aliq, rate.divided);
  log('aliquota', expr.aliquota ?? 'aliquota', { aliquota: aliqInput }, aliq);

  let aliqEfet: Decimal | undefined;
  if (expr.aliquotaEfetiva !== null) {
    const vars: Variables = { ...common, aliquota: aliq, pRedutorCompraGov: redutor };
    aliqEfet = emittedRate(evaluate(expr.aliquotaEfetiva, vars), rate.divided);
    log('aliquotaEfetiva', expr.aliquotaEfetiva, vars, aliqEfet);
  }

  const baseVars: Variables = { ...common, aliquota: aliq, aliquotaEfetiva: aliqEfet, baseCalculoInformada: base };
  let bc = evaluate(expr.baseCalculo, baseVars);
  if (bc.isNegative()) bc = Decimal.ZERO;
  log('baseCalculo', expr.baseCalculo, { baseCalculoInformada: base }, bc);

  const tribVars: Variables = { ...baseVars, baseCalculo: bc };
  const calculated = evaluate(expr.tributoCalculado, tribVars);
  log('tributoCalculado', expr.tributoCalculado, { baseCalculo: bc, aliquotaEfetiva: aliqEfet }, calculated);
  let devido =
    expr.tributoDevido === null
      ? calculated
      : evaluate(expr.tributoDevido, { ...tribVars, tributoCalculado: calculated });

  let pDif: Decimal | undefined;
  let vDif: Decimal | undefined;
  const informedDif = item.deferral?.[t];
  if (deferralAllowed && informedDif !== undefined) {
    pDif = fromPercent(percentInput(informedDif, `percentual de diferimento de ${t}`, n));
  } else if (deferralAllowed && expr.percentualDiferimento !== null && expr.valorDiferimento !== null) {
    pDif = evaluate(expr.percentualDiferimento, { ...tribVars, tributoCalculado: calculated });
  }
  if (pDif !== undefined) {
    vDif = calculated.mul(pDif).setScale(INTERNAL_SCALE, 'HALF_EVEN');
    log('valorDiferimento', 'tributoCalculado*percentualDiferimento', { tributoCalculado: calculated, pDif }, vDif);
    devido = devido.sub(vDif);
  }

  let pDevTrib: Decimal | undefined;
  let vDevTrib: Decimal | undefined;
  if (t === 'CBS' && item.taxRefund !== undefined) {
    pDevTrib = fromPercent(percentInput(item.taxRefund.pDevTrib, 'pDevTrib', n));
    const efet = aliqEfet ?? aliq;
    vDevTrib = bc.mul(efet).mul(pDevTrib).setScale(INTERNAL_SCALE, 'HALF_EVEN');
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
      .sub(Decimal.parse(money(vDif)))
      .sub(Decimal.parse(money(vDevTrib)));
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
  return divided ? toPercent(x) : x;
}

interface ItemResult {
  readonly roc: RocItem;
  readonly vDif: Record<RateTributo, Decimal>;
  readonly vDevTrib: Record<RateTributo, Decimal>;
  readonly credPres: { ibs: Decimal; ibsCond: Decimal; cbs: Decimal; cbsCond: Decimal };
}

function calcItem(ctx: Ctx, item: ClassifiedItem): ItemResult {
  const n = item.n;
  const main = resolve(ctx, item.cst, item.cClassTrib, n, '');
  if (item.monophase !== undefined) {
    throw new UnsupportedRegimeError('monofasia', 'tributação monofásica ainda não é suportada pelo motor', n);
  }
  if (item.selectiveTax !== undefined) {
    throw new UnsupportedRegimeError('imposto-seletivo', 'Imposto Seletivo ainda não é suportado pelo motor', n);
  }
  checkSupported(main, n, '');
  const { cst, classTrib, treatment } = main;
  const owner = `CST ${cst.code}`;
  const ownerCt = `cClassTrib ${classTrib.code}`;

  // Tributação regular (gTribRegular).
  const needsRegular = treatment.flags.exigeGrupoTribRegular || classTrib.groups.gTribRegular === 'required';
  const allowsRegular = needsRegular || classTrib.groups.gTribRegular === 'allowed';
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
    const rt = regular.treatment.flags;
    if (rt.exigeGrupoTribRegular || rt.incompativelComSuspensao || regular.cst.groups.gIBSCBS !== 'required') {
      fail(
        'tributacao_regular_invalida',
        `tributação regular: cClassTrib ${regular.classTrib.code} não pode ser a tributação regular de ${classTrib.code}`,
        n,
      );
    }
  }

  // Grupos governados por indicadores.
  const g = cst.groups;
  checkGroup(g.gTransfCred, item.creditTransfer !== undefined, 'gTransfCred', owner, n);
  checkGroup(g.gAjusteCompet, item.competenceAdjustment !== undefined, 'gAjusteCompet', owner, n);
  checkGroup(g.gCredPresIBSZFM, item.zfmCredit !== undefined, 'gCredPresIBSZFM', owner, n);
  checkGroup(classTrib.groups.gEstornoCred, item.creditReversal !== undefined, 'gEstornoCred', ownerCt, n);
  const ownIndicator = classTrib.groups.gCredPresOper === 'required' ? 'allowed' : classTrib.groups.gCredPresOper;
  // Bem móvel usado: a UB120-20 não se aplica, e o crédito presumido vale mesmo com cClassTrib que o veda.
  const presumedIndicator = item.presumedCredit?.usedMovableGood === true ? 'allowed' : ownIndicator;
  checkGroup(presumedIndicator, item.presumedCredit !== undefined, 'gCredPresOper', ownerCt, n);
  if (item.presumedCredit !== undefined && item.zfmCredit !== undefined) {
    fail('grupos_exclusivos', 'gCredPresOper e gCredPresIBSZFM são exclusivos (UB119)', n);
  }
  const hasMain = g.gIBSCBS !== 'forbidden';
  if (!hasMain && (item.deferral !== undefined || item.taxRefund !== undefined)) {
    fail('grupo_vedado', `${owner} não tem gIBSCBS: diferimento e devolução não se aplicam`, n);
  }
  if (g.gDif === 'forbidden' && item.deferral !== undefined) {
    fail('grupo_vedado', `${owner} não permite o grupo de diferimento (gDif)`, n);
  }

  const out: IBSCBS & Record<string, unknown> = { CST: cst.code, cClassTrib: classTrib.code };
  const ibscbs: Record<string, unknown> = out;
  const applied: AppliedRate[] = [];
  const vDifs: Record<RateTributo, Decimal> = { CBS: Decimal.ZERO, IBSUF: Decimal.ZERO, IBSMun: Decimal.ZERO };
  const vDevs: Record<RateTributo, Decimal> = { CBS: Decimal.ZERO, IBSUF: Decimal.ZERO, IBSMun: Decimal.ZERO };
  let vCredIbs = Decimal.ZERO;
  let vCredIbsCond = Decimal.ZERO;
  let vCredCbs = Decimal.ZERO;
  let vCredCbsCond = Decimal.ZERO;

  // Crédito presumido (antes do gIBSCBS: o vIBS do item pode abater o crédito, UB54a-10).
  let deductIbs = Decimal.ZERO;
  if (item.presumedCredit !== undefined) {
    const pc = item.presumedCredit;
    const cp = ctx.content.credPres(pc.cCredPres);
    if (!cp) fail('ccredpres_inexistente', `cCredPres ${pc.cCredPres} inexistente`, n);
    if (!cp.cbs && !cp.ibs) {
      fail('ccredpres_fora_de_vigencia', `cCredPres ${pc.cCredPres} fora de vigência em ${ctx.date}`, n);
    }
    const vbc = decimalInput(pc.vBCCredPres, 'vBCCredPres', n);
    const group: Record<string, unknown> = { vBCCredPres: money(vbc), cCredPres: pc.cCredPres };
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
      const indicator = cp[which] ? cp.record.groups[name] : 'forbidden';
      checkGroup(indicator, input !== undefined, name, `cCredPres ${pc.cCredPres}`, n);
      if (input === undefined) return undefined;
      const p = percentInput(input.pCredPres, `pCredPres ${which.toUpperCase()}`, n);
      const v = vbc.mul(fromPercent(p)).setScale(INTERNAL_SCALE, 'HALF_EVEN');
      ctx.trace.push({
        item: n,
        field: `vCredPres${which.toUpperCase()}`,
        formula: 'vBCCredPres*pCredPres/100',
        inputs: { vBCCredPres: vbc.toString(), pCredPres: p.toString() },
        result: v.toString(),
      });
      const rounded = Decimal.parse(money(v));
      const tg: GCredPresTributo = input.conditional
        ? { pCredPres: percent(p), vCredPresCondSus: money(v) }
        : { pCredPres: percent(p), vCredPres: money(v) };
      group[name] = tg;
      return input.conditional ? [Decimal.ZERO, rounded] : [rounded, Decimal.ZERO];
    };
    const ibs = one('ibs');
    const cbs = one('cbs');
    if (ibs) [vCredIbs, vCredIbsCond] = [ibs[0] ?? Decimal.ZERO, ibs[1] ?? Decimal.ZERO];
    if (cbs) [vCredCbs, vCredCbsCond] = [cbs[0] ?? Decimal.ZERO, cbs[1] ?? Decimal.ZERO];
    if (cp.record.deductsFromTax) deductIbs = vCredIbs;
    ibscbs.gCredPresOper = group as unknown as GCredPresOper;
  }

  if (hasMain) {
    const calc = regular ?? main;
    const base = decimalInput(item.base, 'base de cálculo (vBC)', n);
    const quantity = item.quantity === undefined ? Decimal.ONE : decimalInput(item.quantity, 'quantidade', n);
    const deferralAllowed = g.gDif !== 'forbidden';
    const results = RATE_TRIBUTOS.map((t) => calcTributo(ctx, item, calc, t, base, quantity, deferralAllowed));
    const byT = (t: RateTributo): TribCalc => results.find((r) => r.t === t) as TribCalc;
    if (g.gDif === 'required' && results.some((r) => r.pDif === undefined)) {
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

    const redAllowed = calc.cst.groups.gRed !== 'forbidden';
    // Na tributação regular o grupo principal sai zerado, mas a CST que exige gRed (UB26-20) ainda pede o grupo com o
    // pRedAliq da tabela do cClassTrib principal (UB27-10); a Calculadora não o emite (divergência no ledger).
    const regularRed = (t: RateTributo): Decimal | undefined =>
      regular && cst.groups.gRed === 'required' ? Decimal.parse(ctx.content.reduction(classTrib, t) ?? '0') : undefined;
    const regularTreat = regular?.treatment.flags.possuiPercentualReducao ?? false;
    const entes = {} as Record<RateTributo, EnteOut>;
    for (const r of results) {
      const withRed = redAllowed && !(regular && !ctx.gov) && r.pRed !== undefined && r.aliqEfet !== undefined;
      let reg: EnteOut['reg'];
      if (regular) {
        const efet = regularTreat
          ? emittedRate(r.aliq.mul(Decimal.ONE.sub(r.pRed ?? Decimal.ZERO)), r.divided)
          : r.aliq;
        const v = r.base.mul(efet).setScale(INTERNAL_SCALE, 'HALF_EVEN');
        reg = { pAliqEfet: pctOut(efet, r.divided), v };
      }
      entes[r.t] = {
        p: regular ? Decimal.ZERO : pctOut(r.aliq, r.divided),
        v: regular ? Decimal.ZERO : r.devido,
        gRed:
          withRed && r.pRed !== undefined && r.aliqEfet !== undefined
            ? { pRedAliq: toPercent(r.pRed), pAliqEfet: pctOut(r.aliqEfet, r.divided) }
            : undefined,
        gDif: r.pDif !== undefined && r.vDif !== undefined ? { pDif: toPercent(r.pDif), vDif: r.vDif } : undefined,
        gDevTrib:
          r.pDevTrib !== undefined && r.vDevTrib !== undefined
            ? { pDevTrib: toPercent(r.pDevTrib), vDevTrib: r.vDevTrib }
            : undefined,
        reg,
      };
      const rr = regularRed(r.t);
      if (rr !== undefined) entes[r.t].gRed = { pRedAliq: rr, pAliqEfet: Decimal.ZERO };
    }

    let compraGov: GTribCompraGov | undefined;
    if (ctx.gov) {
      const values = Object.fromEntries(
        results.map((r) => [r.t, { pAliq: toPercent(r.aliqEfet ?? Decimal.ZERO), vTrib: r.devido }]),
      ) as unknown as GovValues;
      // A parte transferida da CBS (a partir de 2029) dá alíquota com mais de 4 casas: ela sai com a precisão do XML e o
      // valor acompanha na mesma proporção, para `v = vBC x pAliqEfet` fechar com o emitido (UB35-10, UB67-10).
      // A soma das alíquotas não muda com a redistribuição; o resíduo do arredondamento vai para o ente com a maior
      // alíquota, para o total do item continuar igual ao de gTribCompraGov (UB82a-20).
      const raw = redistribute(values, ctx.gov.tp, ctx.date, ctx.gov.transfer);
      const ratio = {} as Record<RateTributo, Decimal | undefined>;
      const eff = {} as Record<RateTributo, GovValues[RateTributo]>;
      const rounded = {} as Record<RateTributo, Decimal>;
      for (const t of RATE_TRIBUTOS) {
        const pAliq = raw[t].pAliq;
        rounded[t] = pAliq.scale > 4 ? pAliq.setScale(4, 'HALF_EVEN') : pAliq;
      }
      const residue = sum(RATE_TRIBUTOS.map((t) => raw[t].pAliq)).sub(sum(RATE_TRIBUTOS.map((t) => rounded[t])));
      if (!residue.isZero()) {
        const top = [...RATE_TRIBUTOS].sort((a, b) => rounded[b].cmp(rounded[a]))[0] as RateTributo;
        rounded[top] = rounded[top].add(residue);
      }
      for (const t of RATE_TRIBUTOS) {
        const { pAliq, vTrib } = raw[t];
        const q = rounded[t];
        const k = q.eq(pAliq) || pAliq.isZero() ? undefined : q.div(pAliq);
        ratio[t] = k;
        eff[t] = { pAliq: q, vTrib: k ? vTrib.mul(k).setScale(INTERNAL_SCALE, 'HALF_EVEN') : vTrib };
      }
      const redistributes = ctx.date >= REDISTRIBUTION_FROM;
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
        ) as unknown as GovValues;
        const moved = redistribute(difs, ctx.gov.tp, ctx.date, ctx.gov.transfer);
        for (const t of RATE_TRIBUTOS) {
          const g = entes[t].gDif;
          const k = ratio[t];
          if (g) g.vDif = k ? moved[t].vTrib.mul(k).setScale(INTERNAL_SCALE, 'HALF_EVEN') : moved[t].vTrib;
        }
      }
      for (const t of RATE_TRIBUTOS) {
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
          field: 'compraGovernamental',
          formula: 'art. 473 da LC 214/2025',
          inputs: { pAliq: values[t].pAliq.toString(), vTrib: values[t].vTrib.toString() },
          result: `${target.pAliq.toString()} / ${target.vTrib.toString()}`,
        });
      }
      const z = regular !== undefined;
      const p = (t: RateTributo): string => percent(z ? Decimal.ZERO : values[t].pAliq);
      const v = (t: RateTributo): string => money(z ? Decimal.ZERO : values[t].vTrib);
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
      ...(e.gDif ? { gDif: { pDif: percent(e.gDif.pDif), vDif: money(e.gDif.vDif) } } : {}),
      ...(e.gDevTrib
        ? { gDevTrib: { pDevTrib: percent(e.gDevTrib.pDevTrib), vDevTrib: money(e.gDevTrib.vDevTrib) } }
        : {}),
      ...(e.gRed ? { gRed: { pRedAliq: percent(e.gRed.pRedAliq), pAliqEfet: percent(e.gRed.pAliqEfet) } } : {}),
    });
    const uf = entes.IBSUF;
    const mun = entes.IBSMun;
    const cbs = entes.CBS;
    const vIBSUF = money(uf.v);
    const vIBSMun = money(mun.v);
    const vIBS = Decimal.parse(vIBSUF).add(Decimal.parse(vIBSMun)).sub(deductIbs);
    if (vIBS.isNegative()) fail('entrada_invalida', 'crédito presumido deduzido excede o IBS do item (UB54a-10)', n);
    const { gDevTrib: _ufDev, ...ufGroups } = fmt(uf);
    const { gDevTrib: _munDev, ...munGroups } = fmt(mun);
    let tribRegular: GTribRegular | undefined;
    if (regular && uf.reg && mun.reg && cbs.reg) {
      tribRegular = {
        CSTReg: regular.cst.code,
        cClassTribReg: regular.classTrib.code,
        pAliqEfetRegIBSUF: percent(uf.reg.pAliqEfet),
        vTribRegIBSUF: money(uf.reg.v),
        pAliqEfetRegIBSMun: percent(mun.reg.pAliqEfet),
        vTribRegIBSMun: money(mun.reg.v),
        pAliqEfetRegCBS: percent(cbs.reg.pAliqEfet),
        vTribRegCBS: money(cbs.reg.v),
      };
    }
    const gIBSCBS: GIBSCBS = {
      vBC: money(byT('CBS').base),
      gIBSUF: { pIBSUF: percent(uf.p), ...ufGroups, vIBSUF },
      gIBSMun: { pIBSMun: percent(mun.p), ...munGroups, vIBSMun },
      vIBS: money(vIBS),
      gCBS: { pCBS: percent(cbs.p), ...fmt(cbs), vCBS: money(cbs.v) },
      ...(tribRegular ? { gTribRegular: tribRegular } : {}),
      ...(compraGov ? { gTribCompraGov: compraGov } : {}),
    };
    ibscbs.gIBSCBS = gIBSCBS;
    for (const t of RATE_TRIBUTOS) {
      const e = entes[t];
      if (e.gDif) vDifs[t] = Decimal.parse(money(e.gDif.vDif));
      if (e.gDevTrib) vDevs[t] = Decimal.parse(money(e.gDevTrib.vDevTrib));
    }
  }

  if (item.creditTransfer !== undefined) {
    const x = item.creditTransfer;
    ibscbs.gTransfCred = {
      vIBS: money(decimalInput(x.vIBS, 'gTransfCred.vIBS', n)),
      vCBS: money(decimalInput(x.vCBS, 'gTransfCred.vCBS', n)),
    };
  }
  if (item.competenceAdjustment !== undefined) {
    const x = item.competenceAdjustment;
    if (!COMPET.test(x.competApur)) fail('entrada_invalida', `competApur inválido: ${x.competApur}; use AAAA-MM`, n);
    ibscbs.gAjusteCompet = {
      competApur: x.competApur,
      vIBS: money(decimalInput(x.vIBS, 'gAjusteCompet.vIBS', n)),
      vCBS: money(decimalInput(x.vCBS, 'gAjusteCompet.vCBS', n)),
    };
  }
  if (item.creditReversal !== undefined) {
    const x = item.creditReversal;
    ibscbs.gEstornoCred = {
      vIBSEstCred: money(decimalInput(x.vIBSEstCred, 'gEstornoCred.vIBSEstCred', n)),
      vCBSEstCred: money(decimalInput(x.vCBSEstCred, 'gEstornoCred.vCBSEstCred', n)),
    };
  }
  if (item.zfmCredit !== undefined) {
    const x = item.zfmCredit;
    if (!COMPET.test(x.competApur)) fail('entrada_invalida', `competApur inválido: ${x.competApur}; use AAAA-MM`, n);
    if (![0, 1, 2, 3, 4].includes(x.tpCredPresIBSZFM)) {
      fail('entrada_invalida', `tpCredPresIBSZFM inválido: ${x.tpCredPresIBSZFM}`, n);
    }
    ibscbs.gCredPresIBSZFM = {
      competApur: x.competApur,
      tpCredPresIBSZFM: x.tpCredPresIBSZFM,
      vCredPresIBSZFM: money(decimalInput(x.vCredPresIBSZFM, 'vCredPresIBSZFM', n)),
    };
  }

  const ordered = orderIbscbs(out);
  return {
    roc: {
      nItem: n,
      IBSCBS: ordered,
      rates: applied,
      simulated: applied.some((a) => a.status !== 'official'),
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

function totals(results: readonly ItemResult[]): IBSCBSTot {
  const d = (s: string | undefined): Decimal => (s === undefined ? Decimal.ZERO : Decimal.parse(s));
  const main = results.map((r) => r.roc.IBSCBS.gIBSCBS).filter((x): x is GIBSCBS => x !== undefined);
  const s = (f: (r: ItemResult) => Decimal): string => money(sum(results.map(f)));
  const reversal = results.map((r) => r.roc.IBSCBS.gEstornoCred).filter((x) => x !== undefined);
  return {
    vBCIBSCBS: money(sum(main.map((m) => d(m.vBC)))),
    gIBS: {
      gIBSUF: {
        vDif: s((r) => r.vDif.IBSUF),
        vDevTrib: s((r) => r.vDevTrib.IBSUF),
        vIBSUF: money(sum(main.map((m) => d(m.gIBSUF.vIBSUF)))),
      },
      gIBSMun: {
        vDif: s((r) => r.vDif.IBSMun),
        vDevTrib: s((r) => r.vDevTrib.IBSMun),
        vIBSMun: money(sum(main.map((m) => d(m.gIBSMun.vIBSMun)))),
      },
      vIBS: money(sum(main.map((m) => d(m.vIBS)))),
      vCredPres: s((r) => r.credPres.ibs),
      vCredPresCondSus: s((r) => r.credPres.ibsCond),
    },
    gCBS: {
      vDif: s((r) => r.vDif.CBS),
      vDevTrib: s((r) => r.vDevTrib.CBS),
      vCBS: money(sum(main.map((m) => d(m.gCBS.vCBS)))),
      vCredPres: s((r) => r.credPres.cbs),
      vCredPresCondSus: s((r) => r.credPres.cbsCond),
    },
    ...(reversal.length > 0
      ? {
          gEstornoCred: {
            vIBSEstCred: money(sum(reversal.map((x) => d(x.vIBSEstCred)))),
            vCBSEstCred: money(sum(reversal.map((x) => d(x.vCBSEstCred)))),
          },
        }
      : {}),
  };
}

function checkOperation(op: ClassifiedOperation): void {
  if (!op || typeof op !== 'object' || !Array.isArray(op.items)) fail('entrada_invalida', 'operação sem itens');
  if (op.items.length === 0) fail('entrada_invalida', 'operação sem itens');
  if (!Number.isInteger(op.modelo)) fail('entrada_invalida', `modelo de DF-e inválido: ${String(op.modelo)}`);
  if (!op.place || typeof op.place.uf !== 'string' || !/^\d{7}$/.test(String(op.place.cMun))) {
    fail('entrada_invalida', 'local da operação inválido: informe uf e cMun (IBGE, 7 dígitos)');
  }
  const seen = new Set<number>();
  for (const it of op.items) {
    if (!Number.isInteger(it.n) || it.n < 1) fail('entrada_invalida', `número de item inválido: ${String(it.n)}`);
    if (seen.has(it.n)) fail('entrada_invalida', `item ${it.n} repetido`, it.n);
    seen.add(it.n);
    if (
      it.informedRates !== undefined &&
      (typeof it.informedRates.reason !== 'string' || !it.informedRates.reason.trim())
    ) {
      fail('entrada_invalida', 'alíquotas informadas exigem o motivo (informedRates.reason)', it.n);
    }
  }
  const gov = op.governmentPurchase;
  if (gov !== undefined && ![1, 2, 3, 4, 5, 6].includes(gov.tpEnteGov)) {
    fail('entrada_invalida', `tpEnteGov inválido: ${String(gov.tpEnteGov)}`);
  }
}

/** Calcula IBS e CBS da operação. Lança `ClassificationError`, `UnsupportedRegimeError` ou `RateUnknownError`. */
export function calculate(op: ClassifiedOperation, options: CalculateOptions): Roc {
  const date = civilDate(options.time.fatoGerador.agora(), options.utcOffsetMinutes ?? BRASILIA_OFFSET_MINUTES);
  return calculateAt(op, { dataset: options.dataset, rates: options.rates, date });
}

/**
 * Variante com a data civil do fato gerador já resolvida (`AAAA-MM-DD`): para reprocessamento e para o oráculo, que
 * trabalham com a data que a Calculadora recebe.
 */
export function calculateAt(
  op: ClassifiedOperation,
  options: { readonly dataset: IbsCbsDataset; readonly rates: RateProvider; readonly date: IsoDate },
): Roc {
  checkOperation(op);
  const content = options.dataset.at(options.date);
  const date = content.asOf;
  let gov: GovContext | undefined;
  if (op.governmentPurchase !== undefined) {
    const red = content.govPurchaseReducer();
    const transfer = content.cbsTransferPercent();
    if (red === undefined || transfer === undefined) {
      fail('dados_incompletos', `redutor ou transferência de compras governamentais ausente no dataset em ${date}`);
    }
    gov = {
      tp: op.governmentPurchase.tpEnteGov,
      tpOperGov: op.governmentPurchase.tpOperGov,
      pRedutor: Decimal.parse(red),
      transfer: fromPercent(Decimal.parse(transfer)),
    };
  }
  const ctx: Ctx = { content, date, op, rates: options.rates, gov, trace: [] };
  const results = [...op.items].sort((a, b) => a.n - b.n).map((it) => calcItem(ctx, it));
  const items = results.map((r) => r.roc);
  return {
    asOf: date,
    ...(gov
      ? {
          oper: {
            gCompraGov: {
              tpEnteGov: gov.tp,
              pRedutor: percent(gov.pRedutor),
              ...(gov.tpOperGov === undefined ? {} : { tpOperGov: gov.tpOperGov }),
            },
          },
        }
      : {}),
    items,
    total: { IBSCBSTot: totals(results) },
    simulated: items.some((i) => i.simulated),
    contentVersion: options.dataset.contentVersion,
    ratesId: options.rates.id,
    trace: ctx.trace,
  };
}
