/**
 * IPI (O), II (P), PIS (Q, R), COFINS (S, T), ISSQN (U) e ICMS para a UF de destino (NA) do item.
 */

import type {
  TIpi,
  TNFe_infNFe_det_imposto_COFINS,
  TNFe_infNFe_det_imposto_COFINSST,
  TNFe_infNFe_det_imposto_ICMSUFDest,
  TNFe_infNFe_det_imposto_II,
  TNFe_infNFe_det_imposto_ISSQN,
  TNFe_infNFe_det_imposto_PIS,
  TNFe_infNFe_det_imposto_PISST,
} from '@sinete/schemas/nfe/PL_010f';
import type { DecimalInput } from '../decimal.ts';
import { Decimal } from '../decimal.ts';
import { D0302A04, D1104, D1104V, D1204, D1204V, D1302, D1302_OPC } from '../format.ts';
import type { IcmsUfDest, ImpostoImportacao, Ipi, Issqn, PisCofins, PisCofinsSt } from '../model.ts';
import type { Ctx } from './values.ts';
import { clean, digits } from './values.ts';

type Out = Record<string, string | undefined>;

/** IPI: por alíquota `vBC × pIPI` ou por unidade `qUnid × vUnid` (MOC O10 a O14; RV O14-10, nota *4). */
export function buildIpi(ctx: Ctx, input: Ipi, vOp: Decimal, path: string): { grupo: TIpi; vIPI: Decimal } {
  const head: Out = {
    CNPJProd: input.CNPJProd === undefined ? undefined : input.CNPJProd.replace(/[./-]/g, '').toUpperCase(),
    cSelo: input.cSelo,
    qSelo: input.qSelo,
    cEnq: input.cEnq,
  };
  if (!['00', '49', '50', '99'].includes(input.CST)) {
    return { grupo: { ...clean(head), IPINT: { CST: input.CST } } as unknown as TIpi, vIPI: Decimal.ZERO };
  }
  const i = input as {
    CST: string;
    vBC?: DecimalInput;
    pIPI?: DecimalInput;
    qUnid?: DecimalInput;
    vUnid?: DecimalInput;
    vIPI?: DecimalInput;
  };
  let trib: Out;
  let vIPI: Decimal;
  if (i.qUnid !== undefined || i.vUnid !== undefined) {
    const qUnid = ctx.req(i.qUnid, `${path}.qUnid`, D1204V);
    const vUnid = ctx.req(i.vUnid, `${path}.vUnid`, D1104);
    vIPI = ctx.calc(i.vIPI, qUnid.times(vUnid), `${path}.vIPI`, D1302, 'ipi');
    trib = { CST: i.CST, qUnid: ctx.s(qUnid, D1204V), vUnid: ctx.s(vUnid, D1104), vIPI: ctx.s(vIPI, D1302) };
  } else {
    const pIPI = ctx.req(i.pIPI, `${path}.pIPI`, D0302A04);
    const vBC = ctx.base(i.vBC, vOp, `${path}.vBC`, D1302, 'ipi');
    vIPI = ctx.calc(i.vIPI, vBC.percent(pIPI), `${path}.vIPI`, D1302, 'ipi');
    trib = { CST: i.CST, vBC: ctx.s(vBC, D1302), pIPI: ctx.s(pIPI, D0302A04), vIPI: ctx.s(vIPI, D1302) };
  }
  return { grupo: { ...clean(head), IPITrib: clean(trib) } as unknown as TIpi, vIPI };
}

export function buildIi(
  ctx: Ctx,
  input: ImpostoImportacao,
  path: string,
): { grupo: TNFe_infNFe_det_imposto_II; vII: Decimal } {
  const vII = ctx.req(input.vII, `${path}.vII`, D1302);
  return {
    grupo: {
      vBC: ctx.s(ctx.req(input.vBC, `${path}.vBC`, D1302), D1302),
      vDespAdu: ctx.s(ctx.req(input.vDespAdu, `${path}.vDespAdu`, D1302), D1302),
      vII: ctx.s(vII, D1302),
      vIOF: ctx.s(ctx.req(input.vIOF, `${path}.vIOF`, D1302), D1302),
    },
    vII,
  };
}

/**
 * PIS ou COFINS (Q02 a Q05, S02 a S05): `valor = vBC × aliquota / 100` ou `qBCProd × vAliqProd` (RV Q09-10, S11-10,
 * nota *4). `tag` escolhe os nomes do leiaute (`PIS`/`pPIS`/`vPIS` ou `COFINS`/`pCOFINS`/`vCOFINS`).
 */
export function buildPisCofins(
  ctx: Ctx,
  input: PisCofins,
  tag: 'PIS' | 'COFINS',
  path: string,
): { grupo: TNFe_infNFe_det_imposto_PIS | TNFe_infNFe_det_imposto_COFINS; valor: Decimal } {
  const p = `p${tag}`;
  const v = `v${tag}`;
  const cst = input.CST;
  if (!('vBC' in input) && !('qBCProd' in input)) {
    return { grupo: { [`${tag}NT`]: { CST: cst } } as unknown as TNFe_infNFe_det_imposto_PIS, valor: Decimal.ZERO };
  }
  const i = input as {
    CST: string;
    vBC?: DecimalInput;
    aliquota?: DecimalInput;
    qBCProd?: DecimalInput;
    vAliqProd?: DecimalInput;
    valor?: DecimalInput;
  };
  let body: Out;
  let valor: Decimal;
  if (i.qBCProd !== undefined) {
    const q = ctx.req(i.qBCProd, `${path}.qBCProd`, D1204V);
    const a = ctx.req(i.vAliqProd, `${path}.vAliqProd`, D1104V);
    valor = ctx.calc(i.valor, q.times(a), `${path}.valor`, D1302, 'pisCofins');
    body = { CST: cst, qBCProd: ctx.s(q, D1204V), vAliqProd: ctx.s(a, D1104V), [v]: ctx.s(valor, D1302) };
  } else {
    const vBC = ctx.req(i.vBC, `${path}.vBC`, D1302);
    const a = ctx.req(i.aliquota, `${path}.aliquota`, D0302A04);
    valor = ctx.calc(i.valor, vBC.percent(a), `${path}.valor`, D1302, 'pisCofins');
    body = { CST: cst, vBC: ctx.s(vBC, D1302), [p]: ctx.s(a, D0302A04), [v]: ctx.s(valor, D1302) };
  }
  const nome = cst === '01' || cst === '02' ? 'Aliq' : cst === '03' ? 'Qtde' : 'Outr';
  return { grupo: { [`${tag}${nome}`]: body } as unknown as TNFe_infNFe_det_imposto_PIS, valor };
}

/** PIS ST ou COFINS ST (R, T). */
export function buildPisCofinsSt(
  ctx: Ctx,
  input: PisCofinsSt,
  tag: 'PIS' | 'COFINS',
  path: string,
): { grupo: TNFe_infNFe_det_imposto_PISST | TNFe_infNFe_det_imposto_COFINSST; valor: Decimal; soma: boolean } {
  let body: Out;
  let valor: Decimal;
  if (input.qBCProd !== undefined) {
    const q = ctx.req(input.qBCProd, `${path}.qBCProd`, D1204);
    const a = ctx.req(input.vAliqProd, `${path}.vAliqProd`, D1104);
    valor = ctx.calc(input.valor, q.times(a), `${path}.valor`, D1302, 'pisCofins');
    body = { qBCProd: ctx.s(q, D1204), vAliqProd: ctx.s(a, D1104) };
  } else {
    // No XSD o vBC do PISST é TDec_1302Opc (sem zero) e o do COFINSST é TDec_1302 (aceita zero).
    const fBC = tag === 'PIS' ? D1302_OPC : D1302;
    const vBC = ctx.req(input.vBC, `${path}.vBC`, fBC);
    const a = ctx.req(input.aliquota, `${path}.aliquota`, D0302A04);
    valor = ctx.calc(input.valor, vBC.percent(a), `${path}.valor`, D1302, 'pisCofins');
    body = { vBC: ctx.s(vBC, fBC), [`p${tag}`]: ctx.s(a, D0302A04) };
  }
  body[`v${tag}`] = ctx.s(valor, D1302);
  body[`indSoma${tag}ST`] = input.indSoma;
  return { grupo: clean(body) as unknown as TNFe_infNFe_det_imposto_PISST, valor, soma: input.indSoma === '1' };
}

/** ISSQN: `vISSQN = vBC × vAliq / 100` (RV U04-10, nota *4). */
export function buildIssqn(
  ctx: Ctx,
  input: Issqn,
  path: string,
): { grupo: TNFe_infNFe_det_imposto_ISSQN; vBC: Decimal; vISSQN: Decimal; opcionais: Record<string, Decimal> } {
  const vBC = ctx.req(input.vBC, `${path}.vBC`, D1302);
  const vAliq = ctx.req(input.vAliq, `${path}.vAliq`, D0302A04);
  const vISSQN = ctx.calc(input.vISSQN, vBC.percent(vAliq), `${path}.vISSQN`, D1302, 'issqn');
  const opcionais: Record<string, Decimal> = {};
  const opt = (k: 'vDeducao' | 'vOutro' | 'vDescIncond' | 'vDescCond' | 'vISSRet'): string | undefined => {
    const d = ctx.opt(input[k], `${path}.${k}`, D1302);
    if (d !== undefined) opcionais[k] = d;
    return ctx.so(d, D1302_OPC);
  };
  return {
    grupo: clean({
      vBC: ctx.s(vBC, D1302),
      vAliq: ctx.s(vAliq, D0302A04),
      vISSQN: ctx.s(vISSQN, D1302),
      cMunFG: input.cMunFG,
      cListServ: input.cListServ,
      vDeducao: opt('vDeducao'),
      vOutro: opt('vOutro'),
      vDescIncond: opt('vDescIncond'),
      vDescCond: opt('vDescCond'),
      vISSRet: opt('vISSRet'),
      indISS: input.indISS,
      cServico: input.cServico,
      cMun: input.cMun,
      cPais: input.cPais === undefined ? undefined : digits(input.cPais),
      nProcesso: input.nProcesso,
      indIncentivo: input.indIncentivo,
    }) as TNFe_infNFe_det_imposto_ISSQN,
    vBC,
    vISSQN,
    opcionais,
  };
}

/** ICMS para a UF de destino (NA): valores informados; defaults de partilha 100% e remetente zero desde 2019. */
export function buildIcmsUfDest(
  ctx: Ctx,
  input: IcmsUfDest,
  path: string,
): { grupo: TNFe_infNFe_det_imposto_ICMSUFDest; vFCPUFDest: Decimal; vICMSUFDest: Decimal; vICMSUFRemet: Decimal } {
  const pFCPUFDest = ctx.opt(input.pFCPUFDest, `${path}.pFCPUFDest`, D0302A04);
  const vFCPUFDest = ctx.opt(input.vFCPUFDest, `${path}.vFCPUFDest`, D1302);
  if (pFCPUFDest !== undefined && vFCPUFDest === undefined) {
    ctx.issues.add(`${path}.vFCPUFDest`, 'campo_obrigatorio', 'pFCPUFDest informado exige vFCPUFDest');
  }
  const vICMSUFDest = ctx.req(input.vICMSUFDest, `${path}.vICMSUFDest`, D1302);
  const vICMSUFRemet = ctx.opt(input.vICMSUFRemet, `${path}.vICMSUFRemet`, D1302) ?? Decimal.ZERO;
  const vBCFCPUFDest = ctx.opt(input.vBCFCPUFDest, `${path}.vBCFCPUFDest`, D1302);
  return {
    grupo: clean({
      vBCUFDest: ctx.s(ctx.req(input.vBCUFDest, `${path}.vBCUFDest`, D1302), D1302),
      vBCFCPUFDest: ctx.so(vBCFCPUFDest, D1302),
      pFCPUFDest: ctx.so(pFCPUFDest, D0302A04),
      pICMSUFDest: ctx.s(ctx.req(input.pICMSUFDest, `${path}.pICMSUFDest`, D0302A04), D0302A04),
      pICMSInter: input.pICMSInter,
      pICMSInterPart: ctx.s(
        ctx.opt(input.pICMSInterPart, `${path}.pICMSInterPart`, D0302A04) ?? Decimal.HUNDRED,
        D0302A04,
      ),
      vFCPUFDest: ctx.so(vFCPUFDest, D1302),
      vICMSUFDest: ctx.s(vICMSUFDest, D1302),
      vICMSUFRemet: ctx.s(vICMSUFRemet, D1302),
    }) as TNFe_infNFe_det_imposto_ICMSUFDest,
    vFCPUFDest: vFCPUFDest ?? Decimal.ZERO,
    vICMSUFDest,
    vICMSUFRemet,
  };
}
