/**
 * Grupo ICMS do item (N01 a N10h). Cada CST/CSOSN do modelo vira o grupo do leiaute correspondente; os valores
 * derivados são calculados com as fórmulas das regras de validação do MOC 7.0 Anexo I, citadas em cada conta.
 */

import type { TNFe_infNFe_det_imposto_ICMS } from '@sinete/schemas/nfe/PL_010f';
import type { DecimalInput } from '../decimal.ts';
import { Decimal } from '../decimal.ts';
import type { FormatoDecimal } from '../format.ts';
import { D0302A04, D0302A04_OPC, D1104V, D1302 } from '../format.ts';
import type {
  Desoneracao,
  DesoneracaoSt,
  Icms,
  IcmsFcp,
  IcmsSt,
  IcmsStRetido,
  MotivoDesoneracaoIcms,
} from '../model.ts';
import type { Ctx } from './values.ts';
import { clean } from './values.ts';

/** O que o grupo ICMS do item soma nos totais (W02 a W06a e os monofásicos). */
export interface IcmsTotais {
  vBC: Decimal;
  vICMS: Decimal;
  vICMSDeson: Decimal;
  /** Parte do desonerado que deduz do valor do item e do total (indDeduzDeson=1). */
  vICMSDesonDeduz: Decimal;
  vFCP: Decimal;
  vBCST: Decimal;
  vST: Decimal;
  vFCPST: Decimal;
  vFCPSTRet: Decimal;
  qBCMono: Decimal;
  vICMSMono: Decimal;
  qBCMonoReten: Decimal;
  vICMSMonoReten: Decimal;
  qBCMonoRet: Decimal;
  vICMSMonoRet: Decimal;
  /** O item tem algum grupo monofásico (os totais monofásicos só vão para o XML nesse caso). */
  mono: boolean;
}

export function zeroIcmsTotais(): IcmsTotais {
  const z = Decimal.ZERO;
  return {
    vBC: z,
    vICMS: z,
    vICMSDeson: z,
    vICMSDesonDeduz: z,
    vFCP: z,
    vBCST: z,
    vST: z,
    vFCPST: z,
    vFCPSTRet: z,
    qBCMono: z,
    vICMSMono: z,
    qBCMonoReten: z,
    vICMSMonoReten: z,
    qBCMonoRet: z,
    vICMSMonoRet: z,
    mono: false,
  };
}

/** Dados do item que as contas do ICMS usam. */
export interface IcmsItemBase {
  /** Valor da operação: vProd + vFrete + vSeg + vOutro - vDesc. */
  readonly vOp: Decimal;
  /** IPI do item (entra na base do ST por MVA). */
  readonly vIPI: Decimal;
}

type Out = Record<string, string | undefined>;

const M: FormatoDecimal = D1302;
const P: FormatoDecimal = D0302A04;
const PO: FormatoDecimal = D0302A04_OPC;

function nonNeg(d: Decimal): Decimal {
  return d.isNegative() ? Decimal.ZERO : d;
}

export function buildIcms(
  ctx: Ctx,
  input: Icms,
  base: IcmsItemBase,
  path: string,
): { grupo: TNFe_infNFe_det_imposto_ICMS; totais: IcmsTotais } {
  const t = zeroIcmsTotais();
  const S = (d: Decimal): string => ctx.s(d, M);

  /** Parte própria: modBC, vBC (reduzida por pRedBC quando houver), pICMS, vICMS. MOC N15, N16, N17 (RV N17, nota *4). */
  const proprio = (
    i: { modBC?: string; vBC?: DecimalInput; pICMS?: DecimalInput; vICMS?: DecimalInput },
    pRedBC: Decimal | undefined,
    required: boolean,
  ): { out: Out; vBC: Decimal; vICMS: Decimal } | undefined => {
    const pICMS = required ? ctx.req(i.pICMS, `${path}.pICMS`, P) : ctx.opt(i.pICMS, `${path}.pICMS`, P);
    if (pICMS === undefined && i.vBC === undefined && i.vICMS === undefined) return undefined;
    const reduzida =
      pRedBC === undefined ? base.vOp : base.vOp.times(Decimal.HUNDRED.minus(pRedBC)).dividedBy(100, 10, 'HALF_EVEN');
    const vBC = ctx.base(i.vBC, reduzida, `${path}.vBC`, M, 'icms');
    const aliq = pICMS ?? Decimal.ZERO;
    const vICMS = ctx.calc(i.vICMS, vBC.percent(aliq), `${path}.vICMS`, M, 'icms');
    t.vBC = t.vBC.plus(vBC);
    t.vICMS = t.vICMS.plus(vICMS);
    return {
      out: { modBC: i.modBC ?? '3', vBC: S(vBC), pICMS: ctx.s(aliq, P), vICMS: S(vICMS) },
      vBC,
      vICMS,
    };
  };

  /**
   * Valor informado cujo grupo depende de outro campo ausente: vira ocorrência no campo que falta, nunca some do XML
   * em silêncio.
   */
  const orfao = (
    valor: DecimalInput | undefined,
    presente: boolean,
    campo: string,
    exige: string,
    base = path,
  ): void => {
    if (valor !== undefined && !presente) {
      ctx.issues.add(`${base}.${exige}`, 'campo_obrigatorio', `${campo} informado exige ${exige}`);
    }
  };

  /** FCP próprio (N17a a N17c). `vBCFCP` só vai para o XML nos grupos que o têm. */
  const fcp = (i: IcmsFcp & { pFCP?: DecimalInput; vFCP?: DecimalInput }, vBC: Decimal, withBase: boolean): Out => {
    const pFCP = ctx.opt(i.pFCP, `${path}.pFCP`, PO);
    orfao(i.vBCFCP, i.pFCP !== undefined || i.vFCP !== undefined, 'vBCFCP', 'pFCP');
    if (pFCP === undefined && i.vFCP === undefined) return {};
    const vBCFCP = ctx.base(i.vBCFCP, vBC, `${path}.vBCFCP`, M, 'icms');
    const vFCP = ctx.calc(i.vFCP, vBCFCP.percent(pFCP ?? Decimal.ZERO), `${path}.vFCP`, M, 'icms');
    t.vFCP = t.vFCP.plus(vFCP);
    return { ...(withBase ? { vBCFCP: S(vBCFCP) } : {}), pFCP: ctx.so(pFCP, PO), vFCP: S(vFCP) };
  };

  /**
   * ICMS-ST (N18 a N23d). Base por MVA (modBCST 4) quando `vBCST` não vem: (vOp + vIPI) × (1 + pMVAST) × (1 - pRedBCST).
   * `vICMSST = vBCST × pICMSST - ICMS próprio` (MOC N23); `vFCPST = vBCFCPST × pFCPST - vFCP` (RV N23d-10).
   */
  const st = (i: IcmsSt, vICMSProprio: Decimal, vFCPProprio: Decimal): Out => {
    const sp = `${path}.st`;
    const pMVAST = ctx.opt(i.pMVAST, `${sp}.pMVAST`, PO);
    const pRedBCST = ctx.opt(i.pRedBCST, `${sp}.pRedBCST`, PO);
    const pICMSST = ctx.req(i.pICMSST, `${sp}.pICMSST`, P);
    if (i.modBCST === '4' && pMVAST === undefined) {
      // RV N19-10 (rejeição 932): MVA como modalidade exige pMVAST.
      ctx.issues.add(`${sp}.pMVAST`, 'campo_obrigatorio', 'modBCST 4 (MVA) exige pMVAST');
    }
    if (i.modBCST !== '4' && pMVAST !== undefined) {
      // RV N19-20 (rejeição 933): pMVAST só com modalidade MVA.
      ctx.issues.add(`${sp}.pMVAST`, 'combinacao_invalida', 'pMVAST só pode ser informado com modBCST 4 (MVA)');
    }
    let vBCST: Decimal;
    if (i.vBCST === undefined && i.modBCST === '4') {
      const bruta = base.vOp
        .plus(base.vIPI)
        .times(Decimal.HUNDRED.plus(pMVAST ?? Decimal.ZERO))
        .dividedBy(100, 12, 'HALF_EVEN');
      const reduzida =
        pRedBCST === undefined ? bruta : bruta.times(Decimal.HUNDRED.minus(pRedBCST)).dividedBy(100, 12, 'HALF_EVEN');
      vBCST = ctx.round(reduzida, M, 'icms');
    } else {
      vBCST = ctx.req(i.vBCST, `${sp}.vBCST`, M);
    }
    const deducao = ctx.opt(i.vICMSDeducaoST, `${sp}.vICMSDeducaoST`, M) ?? vICMSProprio;
    const vICMSST = ctx.calc(
      i.vICMSST,
      nonNeg(ctx.round(vBCST.percent(pICMSST), M, 'icms').minus(deducao)),
      `${sp}.vICMSST`,
      M,
      'icms',
    );
    t.vBCST = t.vBCST.plus(vBCST);
    t.vST = t.vST.plus(vICMSST);
    const out: Out = {
      modBCST: i.modBCST,
      pMVAST: ctx.so(pMVAST, PO),
      pRedBCST: ctx.so(pRedBCST, PO),
      vBCST: S(vBCST),
      pICMSST: ctx.s(pICMSST, P),
      vICMSST: S(vICMSST),
    };
    const pFCPST = ctx.opt(i.pFCPST, `${sp}.pFCPST`, PO);
    orfao(i.vBCFCPST, i.pFCPST !== undefined || i.vFCPST !== undefined, 'vBCFCPST', 'pFCPST', sp);
    if (pFCPST !== undefined || i.vFCPST !== undefined) {
      const vBCFCPST = ctx.base(i.vBCFCPST, vBCST, `${sp}.vBCFCPST`, M, 'icms');
      const vFCPST = ctx.calc(
        i.vFCPST,
        nonNeg(ctx.round(vBCFCPST.percent(pFCPST ?? Decimal.ZERO), M, 'icms').minus(vFCPProprio)),
        `${sp}.vFCPST`,
        M,
        'icms',
      );
      t.vFCPST = t.vFCPST.plus(vFCPST);
      Object.assign(out, { vBCFCPST: S(vBCFCPST), pFCPST: ctx.so(pFCPST, PO), vFCPST: S(vFCPST) });
    }
    return out;
  };

  /** Desoneração (N27a, N28, N28b): valor e motivo juntos. */
  const deson = <K extends MotivoDesoneracaoIcms>(d: Desoneracao<K> | undefined): Out => {
    if (d === undefined) return {};
    const v = ctx.req(d.vICMSDeson, `${path}.desoneracao.vICMSDeson`, M);
    t.vICMSDeson = t.vICMSDeson.plus(v);
    if (d.indDeduzDeson === '1') t.vICMSDesonDeduz = t.vICMSDesonDeduz.plus(v);
    return { vICMSDeson: S(v), motDesICMS: d.motDesICMS, indDeduzDeson: d.indDeduzDeson };
  };

  const desonSt = (d: DesoneracaoSt | undefined): Out => {
    if (d === undefined) return {};
    const v = ctx.req(d.vICMSSTDeson, `${path}.desoneracaoSt.vICMSSTDeson`, M);
    return { vICMSSTDeson: S(v), motDesICMSST: d.motDesICMSST };
  };

  /** Retido anteriormente (N26 a N26b, N27a a N27c, N34 a N37): informativo, só o FCP retido entra no total. */
  const retido = (i: IcmsStRetido): Out => {
    const o = (k: keyof IcmsStRetido, f: FormatoDecimal): string | undefined =>
      ctx.so(ctx.opt(i[k], `${path}.${k}`, f), f);
    const vFCPSTRet = ctx.opt(i.vFCPSTRet, `${path}.vFCPSTRet`, M);
    if (vFCPSTRet !== undefined) t.vFCPSTRet = t.vFCPSTRet.plus(vFCPSTRet);
    return {
      vBCSTRet: o('vBCSTRet', M),
      pST: o('pST', PO),
      vICMSSubstituto: o('vICMSSubstituto', M),
      vICMSSTRet: o('vICMSSTRet', M),
      vBCFCPSTRet: o('vBCFCPSTRet', M),
      pFCPSTRet: o('pFCPSTRet', PO),
      vFCPSTRet: ctx.so(vFCPSTRet, M),
      pRedBCEfet: o('pRedBCEfet', PO),
      vBCEfet: o('vBCEfet', M),
      pICMSEfet: o('pICMSEfet', PO),
      vICMSEfet: o('vICMSEfet', M),
    };
  };

  /** Diferimento (CST 51 e 90): vICMSOp = vBC × pICMS; vICMSDif = vICMSOp × pDif; vICMS = vICMSOp - vICMSDif (RV N16a, N16c). */
  const diferimento = (
    i: {
      modBC?: string;
      vBC?: DecimalInput;
      pRedBC?: DecimalInput;
      cBenefRBC?: string;
      pICMS?: DecimalInput;
      vICMSOp?: DecimalInput;
      pDif?: DecimalInput;
      vICMSDif?: DecimalInput;
      vICMS?: DecimalInput;
      pFCP?: DecimalInput;
      vBCFCP?: DecimalInput;
      vFCP?: DecimalInput;
      pFCPDif?: DecimalInput;
      vFCPDif?: DecimalInput;
      vFCPEfet?: DecimalInput;
    },
    redFormat: FormatoDecimal,
    triade: boolean,
  ): Out => {
    const pRedBC = ctx.opt(i.pRedBC, `${path}.pRedBC`, redFormat);
    const pICMS = ctx.opt(i.pICMS, `${path}.pICMS`, P);
    const out: Out = {};
    let vBC: Decimal | undefined;
    if (pICMS !== undefined || i.vBC !== undefined) {
      const reduzida =
        pRedBC === undefined ? base.vOp : base.vOp.times(Decimal.HUNDRED.minus(pRedBC)).dividedBy(100, 10, 'HALF_EVEN');
      vBC = ctx.base(i.vBC, reduzida, `${path}.vBC`, M, 'icms');
      out.modBC = i.modBC ?? '3';
      out.vBC = S(vBC);
    }
    out.pRedBC = ctx.so(pRedBC, redFormat);
    out.cBenefRBC = i.cBenefRBC;
    if (pICMS !== undefined && vBC !== undefined) {
      out.pICMS = ctx.s(pICMS, P);
      const vICMSOp = ctx.calc(i.vICMSOp, vBC.percent(pICMS), `${path}.vICMSOp`, M, 'icms');
      const pDif = ctx.opt(i.pDif, `${path}.pDif`, P);
      const vICMSDif = ctx.calc(i.vICMSDif, vICMSOp.percent(pDif ?? Decimal.ZERO), `${path}.vICMSDif`, M, 'icms');
      const vICMS = ctx.calc(i.vICMS, vICMSOp.minus(vICMSDif), `${path}.vICMS`, M, 'icms');
      const temDif = pDif !== undefined || i.vICMSDif !== undefined || i.vICMSOp !== undefined;
      if (triade) {
        // No CST 90, vICMSOp, pDif e vICMSDif são uma sequência opcional do XSD: vão os três ou nenhum.
        if (temDif)
          Object.assign(out, { vICMSOp: S(vICMSOp), pDif: ctx.s(pDif ?? Decimal.ZERO, P), vICMSDif: S(vICMSDif) });
      } else {
        Object.assign(out, {
          vICMSOp: S(vICMSOp),
          pDif: ctx.so(pDif, P),
          vICMSDif: pDif === undefined && i.vICMSDif === undefined ? undefined : S(vICMSDif),
        });
      }
      Object.assign(out, {
        vICMS: S(vICMS),
      });
      t.vBC = t.vBC.plus(vBC);
      t.vICMS = t.vICMS.plus(vICMS);
    } else {
      const informados = [i.vBC, i.vICMS, i.vICMSOp, i.pDif, i.vICMSDif, i.pRedBC].some((x) => x !== undefined);
      if (triade && informados) {
        // No CST 90 o ICMS próprio é uma sequência do XSD (modBC, vBC, pICMS, vICMS e a tríade do diferimento): sem
        // pICMS nada dela pode ir, e o que veio não pode sumir em silêncio.
        ctx.issues.add(
          `${path}.pICMS`,
          'campo_obrigatorio',
          'o ICMS próprio do CST 90 (vBC, vICMS, diferimento) exige pICMS',
        );
      }
      if (!triade) {
        // CST 51 sem alíquota: cada campo do XSD é opcional e vai como veio (há diferimento informado só com pDif).
        Object.assign(out, {
          modBC: out.modBC ?? i.modBC,
          vICMSOp: ctx.so(ctx.opt(i.vICMSOp, `${path}.vICMSOp`, M), M),
          pDif: ctx.so(ctx.opt(i.pDif, `${path}.pDif`, P), P),
          vICMSDif: ctx.so(ctx.opt(i.vICMSDif, `${path}.vICMSDif`, M), M),
        });
      }
      const vICMS = ctx.opt(i.vICMS, `${path}.vICMS`, M);
      if (vICMS !== undefined) {
        out.vICMS = S(vICMS);
        t.vICMS = t.vICMS.plus(vICMS);
      }
      if (vBC !== undefined) t.vBC = t.vBC.plus(vBC);
    }
    const pFCP = ctx.opt(i.pFCP, `${path}.pFCP`, PO);
    const temFcp = i.pFCP !== undefined || i.vFCP !== undefined;
    for (const k of ['vBCFCP', 'pFCPDif', 'vFCPDif', 'vFCPEfet'] as const) orfao(i[k], temFcp, k, 'pFCP');
    orfao(i.vFCPEfet, !temFcp || i.pFCPDif !== undefined || i.vFCPDif !== undefined, 'vFCPEfet', 'pFCPDif');
    if (pFCP !== undefined || i.vFCP !== undefined) {
      const vBCFCP = ctx.base(i.vBCFCP, vBC ?? Decimal.ZERO, `${path}.vBCFCP`, M, 'icms');
      const vFCP = ctx.calc(i.vFCP, vBCFCP.percent(pFCP ?? Decimal.ZERO), `${path}.vFCP`, M, 'icms');
      const pFCPDif = ctx.opt(i.pFCPDif, `${path}.pFCPDif`, PO);
      const vFCPDif = ctx.calc(i.vFCPDif, vFCP.percent(pFCPDif ?? Decimal.ZERO), `${path}.vFCPDif`, M, 'icms');
      const vFCPEfet = ctx.calc(i.vFCPEfet, vFCP.minus(vFCPDif), `${path}.vFCPEfet`, M, 'icms');
      // W04b-10 (rejeição 861): o total soma o vFCP declarado no item (N17c), não o efetivo depois do diferimento.
      t.vFCP = t.vFCP.plus(vFCP);
      const temDif = pFCPDif !== undefined || i.vFCPDif !== undefined;
      Object.assign(out, {
        vBCFCP: S(vBCFCP),
        pFCP: ctx.so(pFCP, PO),
        vFCP: S(vFCP),
        pFCPDif: ctx.so(pFCPDif, PO),
        vFCPDif: temDif ? S(vFCPDif) : undefined,
        vFCPEfet: temDif ? S(vFCPEfet) : undefined,
      });
    }
    return out;
  };

  const q = (v: DecimalInput | undefined, k: string): Decimal | undefined => ctx.opt(v, `${path}.${k}`, D1104V);
  /**
   * Valor monofásico (NT 2023.001): padrão quantidade × ad rem em 2 casas. O informado prevalece sem conferência: há
   * notas autorizadas cujo valor não é o produto exato (corpus local, `test/golden/golden.ts`).
   */
  const mono = (
    qtd: Decimal | undefined,
    adRem: Decimal | undefined,
    given: DecimalInput | undefined,
    k: string,
  ): Decimal => ctx.base(given, (qtd ?? Decimal.ZERO).times(adRem ?? Decimal.ZERO), `${path}.${k}`, M, 'icms');

  let grupo: Record<string, Out>;
  if ('CSOSN' in input) {
    const orig = input.orig;
    switch (input.CSOSN) {
      case '101': {
        const pCredSN = ctx.req(input.pCredSN, `${path}.pCredSN`, P);
        const v = ctx.calc(input.vCredICMSSN, base.vOp.percent(pCredSN), `${path}.vCredICMSSN`, M, 'icms');
        grupo = { ICMSSN101: { orig, CSOSN: '101', pCredSN: ctx.s(pCredSN, P), vCredICMSSN: S(v) } };
        break;
      }
      case '102':
      case '103':
      case '300':
      case '400':
        grupo = { ICMSSN102: { orig, CSOSN: input.CSOSN } };
        break;
      case '201': {
        const stOut = st(input.st, Decimal.ZERO, Decimal.ZERO);
        const pCredSN = ctx.req(input.pCredSN, `${path}.pCredSN`, P);
        const v = ctx.calc(input.vCredICMSSN, base.vOp.percent(pCredSN), `${path}.vCredICMSSN`, M, 'icms');
        grupo = { ICMSSN201: { orig, CSOSN: '201', ...stOut, pCredSN: ctx.s(pCredSN, P), vCredICMSSN: S(v) } };
        break;
      }
      case '202':
      case '203':
        grupo = { ICMSSN202: { orig, CSOSN: input.CSOSN, ...st(input.st, Decimal.ZERO, Decimal.ZERO) } };
        break;
      case '500':
        grupo = { ICMSSN500: { orig, CSOSN: '500', ...retido(input) } };
        break;
      case '900': {
        const pRedBC = ctx.opt(input.pRedBC, `${path}.pRedBC`, PO);
        const p = proprio(input, pRedBC, false);
        const out: Out = { orig, CSOSN: '900' };
        if (p)
          Object.assign(out, {
            modBC: p.out.modBC,
            vBC: p.out.vBC,
            pRedBC: ctx.so(pRedBC, PO),
            pICMS: p.out.pICMS,
            vICMS: p.out.vICMS,
          });
        // Com ICMS próprio destacado, o ST abate o próprio, como nos grupos do regime normal (MOC N23).
        if (input.st) Object.assign(out, st(input.st, p?.vICMS ?? Decimal.ZERO, Decimal.ZERO));
        const pCredSN = ctx.opt(input.pCredSN, `${path}.pCredSN`, P);
        orfao(input.vCredICMSSN, input.pCredSN !== undefined, 'vCredICMSSN', 'pCredSN');
        if (pCredSN !== undefined) {
          const v = ctx.calc(input.vCredICMSSN, base.vOp.percent(pCredSN), `${path}.vCredICMSSN`, M, 'icms');
          Object.assign(out, { pCredSN: ctx.s(pCredSN, P), vCredICMSSN: S(v) });
        }
        grupo = { ICMSSN900: out };
        break;
      }
    }
  } else if (input.grupo === 'Part') {
    const pRedBC = ctx.opt(input.pRedBC, `${path}.pRedBC`, PO);
    const p = proprio(input, pRedBC, true) as { out: Out; vICMS: Decimal };
    const pBCOp = ctx.req(input.pBCOp, `${path}.pBCOp`, PO);
    grupo = {
      ICMSPart: {
        orig: input.orig,
        CST: input.CST,
        modBC: input.modBC,
        vBC: p.out.vBC,
        pRedBC: ctx.so(pRedBC, PO),
        pICMS: p.out.pICMS,
        vICMS: p.out.vICMS,
        ...st(input.st, p.vICMS, Decimal.ZERO),
        pBCOp: ctx.s(pBCOp, PO),
        UFST: input.UFST,
        ...deson(input.desoneracao),
      },
    };
  } else if (input.grupo === 'ST') {
    grupo = {
      ICMSST: {
        orig: input.orig,
        CST: input.CST,
        ...retido(input),
        vBCSTRet: S(ctx.req(input.vBCSTRet, `${path}.vBCSTRet`, M)),
        vICMSSTRet: S(ctx.req(input.vICMSSTRet, `${path}.vICMSSTRet`, M)),
        vBCSTDest: S(ctx.req(input.vBCSTDest, `${path}.vBCSTDest`, M)),
        vICMSSTDest: S(ctx.req(input.vICMSSTDest, `${path}.vICMSSTDest`, M)),
      },
    };
  } else {
    const orig = input.orig;
    switch (input.CST) {
      case '00': {
        const p = proprio(input, undefined, true) as { out: Out; vBC: Decimal };
        grupo = { ICMS00: { orig, CST: '00', ...p.out, ...fcp(input, p.vBC, false) } };
        break;
      }
      case '02': {
        const qBCMono = q(input.qBCMono, 'qBCMono');
        const adRem = ctx.req(input.adRemICMS, `${path}.adRemICMS`, P);
        const v = mono(qBCMono, adRem, input.vICMSMono, 'vICMSMono');
        t.mono = true;
        t.qBCMono = t.qBCMono.plus(qBCMono ?? Decimal.ZERO);
        t.vICMSMono = t.vICMSMono.plus(v);
        grupo = {
          ICMS02: {
            orig,
            CST: '02',
            qBCMono: ctx.so(qBCMono, D1104V),
            adRemICMS: ctx.s(adRem, P),
            vICMSMono: S(v),
          },
        };
        break;
      }
      case '10': {
        const p = proprio(input, undefined, true) as { out: Out; vBC: Decimal; vICMS: Decimal };
        const f = fcp(input, p.vBC, true);
        const vFCP = f.vFCP === undefined ? Decimal.ZERO : Decimal.of(f.vFCP);
        grupo = {
          ICMS10: { orig, CST: '10', ...p.out, ...f, ...st(input.st, p.vICMS, vFCP), ...desonSt(input.desoneracaoSt) },
        };
        break;
      }
      case '15': {
        const qBCMono = q(input.qBCMono, 'qBCMono');
        const adRem = ctx.req(input.adRemICMS, `${path}.adRemICMS`, P);
        const v = mono(qBCMono, adRem, input.vICMSMono, 'vICMSMono');
        const qReten = q(input.qBCMonoReten, 'qBCMonoReten');
        const adRemReten = ctx.req(input.adRemICMSReten, `${path}.adRemICMSReten`, P);
        if (input.pRedAdRem !== undefined) {
          // Com redução da ad rem (pRedAdRem, motRedAdRem) a conta de cada valor não está nas fontes que este pacote
          // cita (NT 2023.001 não versionada aqui): os valores vêm informados em vez de derivados sem a redução.
          if (input.vICMSMono === undefined)
            ctx.issues.add(`${path}.vICMSMono`, 'campo_obrigatorio', 'com pRedAdRem, informe vICMSMono');
          if (input.vICMSMonoReten === undefined) {
            ctx.issues.add(`${path}.vICMSMonoReten`, 'campo_obrigatorio', 'com pRedAdRem, informe vICMSMonoReten');
          }
        }
        const vReten = mono(qReten, adRemReten, input.vICMSMonoReten, 'vICMSMonoReten');
        t.mono = true;
        t.qBCMono = t.qBCMono.plus(qBCMono ?? Decimal.ZERO);
        t.vICMSMono = t.vICMSMono.plus(v);
        t.qBCMonoReten = t.qBCMonoReten.plus(qReten ?? Decimal.ZERO);
        t.vICMSMonoReten = t.vICMSMonoReten.plus(vReten);
        grupo = {
          ICMS15: {
            orig,
            CST: '15',
            qBCMono: ctx.so(qBCMono, D1104V),
            adRemICMS: ctx.s(adRem, P),
            vICMSMono: S(v),
            qBCMonoReten: ctx.so(qReten, D1104V),
            adRemICMSReten: ctx.s(adRemReten, P),
            vICMSMonoReten: S(vReten),
            pRedAdRem: ctx.so(ctx.opt(input.pRedAdRem, `${path}.pRedAdRem`, D0302A04), D0302A04),
            motRedAdRem: input.motRedAdRem,
          },
        };
        break;
      }
      case '20': {
        const pRedBC = ctx.req(input.pRedBC, `${path}.pRedBC`, P);
        const p = proprio(input, pRedBC, true) as { out: Out; vBC: Decimal };
        grupo = {
          ICMS20: {
            orig,
            CST: '20',
            modBC: p.out.modBC,
            pRedBC: ctx.s(pRedBC, P),
            vBC: p.out.vBC,
            pICMS: p.out.pICMS,
            vICMS: p.out.vICMS,
            ...fcp(input, p.vBC, true),
            ...deson(input.desoneracao),
          },
        };
        break;
      }
      case '30':
        grupo = {
          ICMS30: { orig, CST: '30', ...st(input.st, Decimal.ZERO, Decimal.ZERO), ...deson(input.desoneracao) },
        };
        break;
      case '40':
      case '41':
      case '50':
        grupo = { ICMS40: { orig, CST: input.CST, ...deson(input.desoneracao) } };
        break;
      case '51':
        grupo = { ICMS51: { orig, CST: '51', ...diferimento(input, P, false) } };
        break;
      case '53': {
        const qBCMono = q(input.qBCMono, 'qBCMono');
        const adRem = ctx.opt(input.adRemICMS, `${path}.adRemICMS`, P);
        const vOp = mono(qBCMono, adRem, input.vICMSMonoOp, 'vICMSMonoOp');
        const pDif = ctx.opt(input.pDif, `${path}.pDif`, P);
        const vDif = ctx.calc(input.vICMSMonoDif, vOp.percent(pDif ?? Decimal.ZERO), `${path}.vICMSMonoDif`, M, 'icms');
        const v = ctx.calc(input.vICMSMono, vOp.minus(vDif), `${path}.vICMSMono`, M, 'icms');
        const qDif = q(input.qBCMonoDif, 'qBCMonoDif');
        const adRemDif = ctx.opt(input.adRemICMSDif, `${path}.adRemICMSDif`, P);
        t.mono = true;
        t.qBCMono = t.qBCMono.plus(qBCMono ?? Decimal.ZERO);
        t.vICMSMono = t.vICMSMono.plus(v);
        grupo = {
          ICMS53: {
            orig,
            CST: '53',
            qBCMono: ctx.so(qBCMono, D1104V),
            adRemICMS: ctx.so(adRem, P),
            vICMSMonoOp: adRem === undefined && input.vICMSMonoOp === undefined ? undefined : S(vOp),
            pDif: ctx.so(pDif, P),
            vICMSMonoDif: pDif === undefined && input.vICMSMonoDif === undefined ? undefined : S(vDif),
            vICMSMono: adRem === undefined && input.vICMSMono === undefined ? undefined : S(v),
            qBCMonoDif: ctx.so(qDif, D1104V),
            adRemICMSDif: ctx.so(adRemDif, P),
          },
        };
        break;
      }
      case '60':
        grupo = { ICMS60: { orig, CST: '60', ...retido(input) } };
        break;
      case '61': {
        const qRet = q(input.qBCMonoRet, 'qBCMonoRet');
        const adRem = ctx.req(input.adRemICMSRet, `${path}.adRemICMSRet`, P);
        const v = mono(qRet, adRem, input.vICMSMonoRet, 'vICMSMonoRet');
        t.mono = true;
        t.qBCMonoRet = t.qBCMonoRet.plus(qRet ?? Decimal.ZERO);
        t.vICMSMonoRet = t.vICMSMonoRet.plus(v);
        grupo = {
          ICMS61: {
            orig,
            CST: '61',
            qBCMonoRet: ctx.so(qRet, D1104V),
            adRemICMSRet: ctx.s(adRem, P),
            vICMSMonoRet: S(v),
          },
        };
        break;
      }
      case '70': {
        const pRedBC = ctx.req(input.pRedBC, `${path}.pRedBC`, P);
        const p = proprio(input, pRedBC, true) as { out: Out; vBC: Decimal; vICMS: Decimal };
        const f = fcp(input, p.vBC, true);
        const vFCP = f.vFCP === undefined ? Decimal.ZERO : Decimal.of(f.vFCP);
        grupo = {
          ICMS70: {
            orig,
            CST: '70',
            modBC: p.out.modBC,
            pRedBC: ctx.s(pRedBC, P),
            vBC: p.out.vBC,
            pICMS: p.out.pICMS,
            vICMS: p.out.vICMS,
            ...f,
            ...st(input.st, p.vICMS, vFCP),
            ...deson(input.desoneracao),
            ...desonSt(input.desoneracaoSt),
          },
        };
        break;
      }
      case '90': {
        const d = diferimento(input, PO, true);
        const vICMS = d.vICMS === undefined ? Decimal.ZERO : Decimal.of(d.vICMS);
        // RV N23d-10: vFCPST = vBCFCPST × pFCPST - vFCP (o vFCP declarado, N17c).
        const vFCP = d.vFCP;
        grupo = {
          ICMS90: {
            orig,
            CST: '90',
            ...d,
            ...(input.st ? st(input.st, vICMS, vFCP === undefined ? Decimal.ZERO : Decimal.of(vFCP)) : {}),
            ...deson(input.desoneracao),
            ...desonSt(input.desoneracaoSt),
          },
        };
        break;
      }
    }
  }
  const [name, body] = Object.entries(grupo)[0] as [string, Out];
  return { grupo: { [name]: clean(body) } as unknown as TNFe_infNFe_det_imposto_ICMS, totais: t };
}
