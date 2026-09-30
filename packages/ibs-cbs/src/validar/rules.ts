/**
 * Regras de validação da NT 2025.002-RTC v1.51 (item 7, grupos UB e W) que dá para conferir sem banco de dados da
 * SEFAZ: presença e vedação de grupos pelos indicadores de CST, cClassTrib e cCredPres, fórmulas de valores com a
 * tolerância da NT, alíquotas por ano de emissão, compatibilidade com o tipo de nota de débito e crédito e somas dos
 * totais. Cada regra tem o id da NT, o cStat de rejeição, os modelos, a implantação por ambiente e a fonte.
 *
 * As tabelas (indicadores, reduções, vigências) vêm do `@sinete/ibs-cbs-dados` na data do fato gerador; as tabelas próprias
 * da NT (tipo de nota x cClassTrib, alíquotas por ano, áreas incentivadas) estão em `data/nt2025002.json`.
 */
import type { ConteudoTributario, RegistroClassTrib, RegistroCst, RegistroTratamento } from '@sinete/ibs-cbs-dados';
import type { ProvedorDeAliquotas } from '../aliquotas/index.ts';
import type { DataIso, GCBS, GIBSMun, GIBSUF, GRed, IBSCBS } from '../calcular/index.ts';
import { Decimal } from '../calcular/index.ts';
import ntData from './data/nt2025002.json' with { type: 'json' };
import type {
  Ativacao,
  DescricaoDaRegra,
  DocumentoDasRegras,
  ItemDasRegras,
  NaoImplementada,
  TabelasNt,
} from './types.ts';

/** Contexto de uma validação. */
export interface ContextoDaRegra {
  readonly documento: DocumentoDasRegras;
  /** Tabelas na data do fato gerador. */
  readonly conteudo: ConteudoTributario;
  /** Data civil de emissão. */
  readonly emissao: DataIso;
  readonly aliquotas?: ProvedorDeAliquotas;
}

export type Relatar = (item: number | undefined, message: string) => void;

export interface Regra extends DescricaoDaRegra {
  conferir(contexto: ContextoDaRegra, relatar: Relatar): void;
}

/** Tabelas da NT embarcadas neste pacote. */
export const TABELAS_NT: TabelasNt = ntData as TabelasNt;
const nt: TabelasNt = TABELAS_NT;

const SRC = 'NT 2025.002 v1.51';
const V130: Ativacao = { homologacao: '2025-10-29', producao: '2025-11-10' };
const V130B: Ativacao = { homologacao: '2025-11-24', producao: '2026-02-02' };
const V140: Ativacao = { homologacao: '2026-07-01', producao: '2026-08-03' };
const V151: Ativacao = { homologacao: '2026-09-01', producao: '2026-10-05' };

/** Implantação por regra, pelo cronograma da NT (versão em que a regra entrou ou mudou pela última vez). */
const ACTIVATION: Readonly<Record<string, Ativacao>> = {
  ...Object.fromEntries(
    ['UB112-20', 'UB112-30', 'UB116-20', 'UB116-30', 'UB120-10', 'UB120-20', 'UB122-10', 'UB123-20', 'UB125-10']
      .concat(['UB126-10', 'UB127-20', 'UB129-10', 'UB130-10', 'UB131-10', 'UB131-30', 'UB131-40', 'UB131-50'])
      .concat(['UB132-10', 'W59f-10', 'W59g-10'])
      .map((id) => [id, V130B]),
  ),
  ...Object.fromEntries(
    ['UB14-60', 'UB14-70', 'UB14-80', 'UB24-10', 'UB43-10', 'UB62-10', 'UB62a-10', 'UB63-10', 'UB82a-10']
      .concat(['UB123-10', 'UB127-10', 'UB133-10'])
      .map((id) => [id, V140]),
  ),
  ...Object.fromEntries(
    ['UB13-20', 'UB13-30', 'UB18-10', 'UB22-10', 'UB22-20', 'UB26-20', 'UB37-10', 'UB40-10', 'UB40-20', 'UB45-10']
      .concat(['UB45-20', 'UB56-10', 'UB56-20', 'UB59-10', 'UB59-20', 'UB64-10', 'UB64-20', 'UB82a-30', 'UB112-10'])
      .concat(['UB116-10', 'UB131-20'])
      .map((id) => [id, V151]),
  ),
};

/** UB12-10: obrigatoriedade do grupo IBSCBS por CRT (cronograma da v1.51 e observação 3 da regra). */
const UB12_ACTIVATION: readonly Ativacao[] = [
  { homologacao: '2026-07-01', producao: '2026-08-03', crt: [3] },
  { homologacao: '2027-01-04', producao: '2027-01-04', crt: [1, 2, 4] },
];

function activationOf(id: string): readonly Ativacao[] {
  if (id === 'UB12-10') return UB12_ACTIVATION;
  return [ACTIVATION[id] ?? V130];
}

const ZERO: Decimal = Decimal.ZERO;
const HUNDRED: Decimal = Decimal.HUNDRED;

function dec(value: string | undefined | null): Decimal {
  return value !== undefined && value !== null && Decimal.isDecimalText(value) ? Decimal.parse(value) : ZERO;
}

function near(a: Decimal, b: Decimal, tol: string): boolean {
  const d = a.sub(b);
  return (d.isNegative() ? d.neg() : d).cmp(Decimal.parse(tol)) <= 0;
}

function sumOf(values: readonly (string | undefined)[]): Decimal {
  return values.reduce((acc, v) => acc.add(dec(v)), ZERO);
}

interface Refs {
  readonly cst: RegistroCst | undefined;
  readonly ct: RegistroClassTrib | undefined;
  readonly treatment: RegistroTratamento | undefined;
}

function refs(ctx: ContextoDaRegra, ib: IBSCBS): Refs {
  const cst = ctx.conteudo.cst(ib.CST);
  const ct = ctx.conteudo.classTrib(ib.cClassTrib);
  const treatment = ct ? ctx.conteudo.tratamento(ct) : undefined;
  return { cst, ct, treatment };
}

function withIbscbs(ctx: ContextoDaRegra, fn: (it: ItemDasRegras, ib: IBSCBS, r: Refs) => void): void {
  for (const it of ctx.documento.itens) if (it.IBSCBS) fn(it, it.IBSCBS, refs(ctx, it.IBSCBS));
}

function needsRegular(r: Refs): boolean {
  return r.ct?.grupos.gTribRegular === 'obrigatorio' || r.treatment?.indicadores.exigeGrupoTribRegular === true;
}

/** Exceção comum às regras de alíquota por ano (UB18-10, UB37-10, UB56-10, UB56-20). */
function rateRuleExempt(doc: DocumentoDasRegras): boolean {
  return doc.finNFe === 4 || ['03', '04', '06'].includes(doc.tpNFCredito ?? '');
}

function yearOf(date: DataIso): number {
  return Number(date.slice(0, 4));
}

function rule(
  id: string,
  cStat: string,
  title: string,
  modelos: readonly (55 | 65)[],
  check: Regra['conferir'],
  note?: string,
): Regra {
  return {
    id,
    cStat,
    titulo: title,
    modelos,
    ativacao: activationOf(id),
    fonte: `${SRC}, ${id}`,
    ...(note === undefined ? {} : { nota: note }),
    conferir: check,
  };
}

const BOTH = [55, 65] as const;
const NFE = [55] as const;

// ---------- regras por ente (UB17 IBS UF, UB36 IBS Mun, UB55 CBS) ----------

type EnteGroup = GIBSUF | GIBSMun | GCBS;

interface EnteSpec {
  readonly key: 'IBSUF' | 'IBSMun' | 'CBS';
  readonly label: string;
  readonly get: (ib: IBSCBS) => GIBSUF | GIBSMun | GCBS | undefined;
  readonly p: (g: GIBSUF | GIBSMun | GCBS) => string;
  readonly v: (g: GIBSUF | GIBSMun | GCBS) => string;
  readonly difForbidden: readonly [string, string];
  readonly difRequired: readonly [string, string];
  readonly vDif: readonly [string, string];
  readonly redForbidden: readonly [string, string];
  readonly redRequired: readonly [string, string];
  readonly redValid: readonly [string, string];
  readonly efet: readonly [string, string];
  readonly value: readonly [string, string];
}

const ENTES: readonly EnteSpec[] = [
  {
    key: 'IBSUF',
    label: 'IBS da UF',
    get: (ib: IBSCBS): EnteGroup | undefined => ib.gIBSCBS?.gIBSUF,
    p: (g: EnteGroup): string => (g as GIBSUF).pIBSUF,
    v: (g: EnteGroup): string => (g as GIBSUF).vIBSUF,
    difForbidden: ['UB22-10', '1029'],
    difRequired: ['UB22-20', '1030'],
    vDif: ['UB23-10', '1031'],
    redForbidden: ['UB26-10', '1032'],
    redRequired: ['UB26-20', '1033'],
    redValid: ['UB27-10', '1034'],
    efet: ['UB28-10', '1035'],
    value: ['UB35-10', '1041'],
  },
  {
    key: 'IBSMun',
    label: 'IBS do Município',
    get: (ib: IBSCBS): EnteGroup | undefined => ib.gIBSCBS?.gIBSMun,
    p: (g: EnteGroup): string => (g as GIBSMun).pIBSMun,
    v: (g: EnteGroup): string => (g as GIBSMun).vIBSMun,
    difForbidden: ['UB40-20', '1083'],
    difRequired: ['UB40-10', '1044'],
    vDif: ['UB42-10', '1045'],
    redForbidden: ['UB45-10', '1007'],
    redRequired: ['UB45-20', '1074'],
    redValid: ['UB46-10', '1046'],
    efet: ['UB47-10', '1047'],
    value: ['UB54-10', '1052'],
  },
  {
    key: 'CBS',
    label: 'CBS',
    get: (ib: IBSCBS): EnteGroup | undefined => ib.gIBSCBS?.gCBS,
    p: (g: EnteGroup): string => (g as GCBS).pCBS,
    v: (g: EnteGroup): string => (g as GCBS).vCBS,
    difForbidden: ['UB59-20', '1090'],
    difRequired: ['UB59-10', '1061'],
    vDif: ['UB61-10', '1062'],
    redForbidden: ['UB64-10', '1028'],
    redRequired: ['UB64-20', '1079'],
    redValid: ['UB65-10', '1063'],
    efet: ['UB66-10', '1064'],
    value: ['UB67-10', '1069'],
  },
];

function effectiveRate(g: GIBSUF | GIBSMun | GCBS, e: EnteSpec): Decimal {
  const red = (g as { gRed?: GRed }).gRed;
  return red ? dec(red.pAliqEfet) : dec(e.p(g));
}

function enteRules(e: EnteSpec): Regra[] {
  const each = (
    ctx: ContextoDaRegra,
    fn: (it: ItemDasRegras, g: GIBSUF | GIBSMun | GCBS, ib: IBSCBS, r: Refs) => void,
  ): void =>
    withIbscbs(ctx, (it, ib, r) => {
      const g = e.get(ib);
      if (g) fn(it, g, ib, r);
    });
  const out: Regra[] = [
    rule(e.difForbidden[0], e.difForbidden[1], `CST veda diferimento do ${e.label}`, BOTH, (ctx, report) =>
      each(ctx, (it, g, ib, r) => {
        if (r.cst?.grupos.gDif === 'vedado' && (g as { gDif?: unknown }).gDif) {
          report(it.nItem, `CST ${ib.CST} não permite gDif no ${e.label}`);
        }
      }),
    ),
    rule(e.difRequired[0], e.difRequired[1], `CST exige diferimento do ${e.label}`, BOTH, (ctx, report) =>
      each(ctx, (it, g, ib, r) => {
        if (r.cst?.grupos.gDif === 'obrigatorio' && !(g as { gDif?: unknown }).gDif) {
          report(it.nItem, `CST ${ib.CST} exige gDif no ${e.label}`);
        }
      }),
    ),
    rule(e.vDif[0], e.vDif[1], `vDif do ${e.label} = vBC x alíquota x pDif`, BOTH, (ctx, report) =>
      each(ctx, (it, g, ib) => {
        const dif = (g as { gDif?: { pDif: string; vDif: string } }).gDif;
        if (!dif) return;
        const expected = dec(ib.gIBSCBS?.vBC).mul(effectiveRate(g, e)).mul(dec(dif.pDif)).div(HUNDRED).div(HUNDRED);
        if (!near(dec(dif.vDif), expected, '0.01')) {
          report(it.nItem, `vDif do ${e.label} ${dif.vDif}, calculado ${expected.toFixed(2)}`);
        }
      }),
    ),
    rule(e.redForbidden[0], e.redForbidden[1], `CST veda redução de alíquota do ${e.label}`, BOTH, (ctx, report) =>
      each(ctx, (it, g, ib, r) => {
        const red = (g as { gRed?: GRed }).gRed;
        if (r.cst?.grupos.gRed !== 'vedado' || !red) return;
        if (ctx.documento.gCompraGov && dec(red.pRedAliq).isZero()) return;
        report(it.nItem, `CST ${ib.CST} não permite gRed no ${e.label}`);
      }),
    ),
    rule(
      e.redRequired[0],
      e.redRequired[1],
      `CST ou compra governamental exige redução de alíquota do ${e.label}`,
      BOTH,
      (ctx, report) =>
        each(ctx, (it, g, ib, r) => {
          const required = r.cst?.grupos.gRed === 'obrigatorio' || ctx.documento.gCompraGov !== undefined;
          if (required && !(g as { gRed?: GRed }).gRed) {
            report(
              it.nItem,
              `gRed do ${e.label} não informado (CST ${ib.CST}${ctx.documento.gCompraGov ? ', compra governamental' : ''})`,
            );
          }
        }),
    ),
    rule(e.redValid[0], e.redValid[1], `pRedAliq do ${e.label} válido para o cClassTrib`, BOTH, (ctx, report) =>
      each(ctx, (it, g, ib, r) => {
        const red = (g as { gRed?: GRed }).gRed;
        if (!red || !r.ct) return;
        if (r.cst?.grupos.gRed === 'obrigatorio') {
          const expected = dec(ctx.conteudo.reducao(r.ct, e.key));
          if (!dec(red.pRedAliq).eq(expected)) {
            report(
              it.nItem,
              `pRedAliq do ${e.label} ${red.pRedAliq}, a tabela dá ${expected.toString()} para ${ib.cClassTrib}`,
            );
          }
        } else if (r.cst?.grupos.gRed === 'vedado' && (!ctx.documento.gCompraGov || !dec(red.pRedAliq).isZero())) {
          report(it.nItem, `pRedAliq do ${e.label} ${red.pRedAliq} com CST ${ib.CST}, que veda redução`);
        }
      }),
    ),
    rule(
      e.efet[0],
      e.efet[1],
      `pAliqEfet do ${e.label} = alíquota x (1 - pRedAliq) x (1 - pRedutor)`,
      BOTH,
      (ctx, report) =>
        each(ctx, (it, g) => {
          const red = (g as { gRed?: GRed }).gRed;
          if (!red) return;
          let expected = dec(e.p(g))
            .mul(HUNDRED.sub(dec(red.pRedAliq)))
            .div(HUNDRED);
          if (ctx.documento.gCompraGov)
            expected = expected.mul(HUNDRED.sub(dec(ctx.documento.gCompraGov.pRedutor))).div(HUNDRED);
          if (!near(dec(red.pAliqEfet), expected.setScale(4), '0.0001')) {
            report(it.nItem, `pAliqEfet do ${e.label} ${red.pAliqEfet}, calculado ${expected.setScale(4).toString()}`);
          }
        }),
      'Em compra governamental a partir de 2027 a NT não considera a redistribuição do art. 473 da LC 214/2025 na fórmula, e a Calculadora da RFB (e o @sinete/ibs-cbs/calcular) aplicam a redistribuição à alíquota efetiva: a regra acusa esses casos até a NT tratar o tema.',
    ),
    rule(e.value[0], e.value[1], `v do ${e.label} = vBC x alíquota - vDif - vDevTrib`, BOTH, (ctx, report) =>
      each(ctx, (it, g, ib) => {
        const vDif = dec((g as { gDif?: { vDif: string } }).gDif?.vDif);
        const vDev = dec((g as { gDevTrib?: { vDevTrib: string } }).gDevTrib?.vDevTrib);
        const expected = dec(ib.gIBSCBS?.vBC).mul(effectiveRate(g, e)).div(HUNDRED).sub(vDif).sub(vDev);
        if (!near(dec(e.v(g)), expected, '0.01')) {
          report(it.nItem, `valor do ${e.label} ${e.v(g)}, calculado ${expected.toFixed(2)}`);
        }
      }),
    ),
  ];
  return out;
}

// ---------- alíquotas por ano de emissão ----------

function rateByYear(year: number): (typeof nt.aliquotasPorAnoDeEmissao)[number] | undefined {
  return nt.aliquotasPorAnoDeEmissao.find((r) => r.inicio <= year && year <= r.fim);
}

function rateRule(id: string, cStat: string, e: EnteSpec, field: 'pIBSUF' | 'pIBSMun' | 'pCBS'): Regra {
  return rule(id, cStat, `alíquota do ${e.label} pelo ano de emissão`, BOTH, (ctx, report) => {
    if (rateRuleExempt(ctx.documento)) return;
    const row = rateByYear(yearOf(ctx.emissao));
    const expected = row?.[field];
    if (expected === null || expected === undefined) return;
    withIbscbs(ctx, (it, ib, r) => {
      const g = e.get(ib);
      if (!g) return;
      const p = dec(e.p(g));
      if (needsRegular(r)) {
        if (!p.isZero()) report(it.nItem, `${field} ${e.p(g)} com cClassTrib de tributação regular: deve ser zero`);
        return;
      }
      if (field === 'pCBS' && p.isZero() && cbsZeroAllowed(ctx.documento, it)) return;
      if (!p.eq(dec(expected))) report(it.nItem, `${field} ${e.p(g)}, esperado ${expected} (${row?.legal})`);
    });
  });
}

function sameIncentivizedArea(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return nt.areasIncentivadas.some((z) => z.municipios.includes(a) && z.municipios.includes(b));
}

/** UB56-10, exceção 3: CBS zero entre emitente e destinatário da mesma área incentivada, fora dos NCM excluídos. */
function cbsZeroAllowed(doc: DocumentoDasRegras, it: ItemDasRegras): boolean {
  const ncm = it.ncm ?? '';
  const x = nt.ncmExcluidosDaCbsZero;
  const excluded = x.prefixos.some((p) => ncm.startsWith(p)) && !x.permitidoDentroDe.some((p) => ncm.startsWith(p));
  return ncm !== '' && !excluded && sameIncentivizedArea(doc.munEmitente, doc.munDestinatario);
}

const [UF, MUN, CBS] = ENTES as readonly [EnteSpec, EnteSpec, EnteSpec];

// ---------- catálogo ----------

function groupPresence(
  id: string,
  cStat: string,
  title: string,
  modelos: readonly (55 | 65)[],
  indicator: (r: Refs) => string | null | undefined,
  present: (ib: IBSCBS) => boolean,
  when: 'vedado' | 'obrigatorio',
  skip?: (ctx: ContextoDaRegra, ib: IBSCBS) => boolean,
): Regra {
  return rule(id, cStat, title, modelos, (ctx, report) =>
    withIbscbs(ctx, (it, ib, r) => {
      if (skip?.(ctx, ib)) return;
      const ind = indicator(r);
      if (when === 'vedado' && ind === 'vedado' && present(ib)) report(it.nItem, `${title}: informado indevidamente`);
      if (when === 'obrigatorio' && ind === 'obrigatorio' && !present(ib)) report(it.nItem, `${title}: não informado`);
    }),
  );
}

const perdaEmEstoque = (ctx: ContextoDaRegra): boolean => ctx.documento.tpNFDebito === '07';

export const REGRAS: readonly Regra[] = [
  rule('UB12-10', '1115', 'grupo IBSCBS obrigatório no item', BOTH, (ctx, report) => {
    const d = ctx.documento;
    if (
      (d.finNFe === 4 || d.finNFe === 2) &&
      d.emissaoReferenciada !== undefined &&
      d.emissaoReferenciada < '2027-01-01'
    )
      return;
    for (const it of d.itens)
      if (!it.IBSCBS && !it.combustivelMonofasico) report(it.nItem, 'grupo IBSCBS não informado');
  }),
  rule('UB13-10', '1020', 'CST do IBS/CBS existente', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib, r) => {
      if (!r.cst) report(it.nItem, `CST ${ib.CST} inexistente em ${ctx.conteudo.dataDeReferencia}`);
    }),
  ),
  groupPresence(
    'UB13-20',
    '1021',
    'grupo gIBSCBS',
    BOTH,
    (r) => r.cst?.grupos.gIBSCBS,
    (ib) => !!ib.gIBSCBS,
    'vedado',
  ),
  groupPresence(
    'UB13-30',
    '1022',
    'grupo gIBSCBS',
    BOTH,
    (r) => r.cst?.grupos.gIBSCBS,
    (ib) => !!ib.gIBSCBS,
    'obrigatorio',
    perdaEmEstoque,
  ),
  groupPresence(
    'UB13-44',
    '1131',
    'grupo gTransfCred',
    BOTH,
    (r) => r.cst?.grupos.gTransfCred,
    (ib) => !!ib.gTransfCred,
    'vedado',
  ),
  groupPresence(
    'UB13-45',
    '1132',
    'grupo gTransfCred',
    BOTH,
    (r) => r.cst?.grupos.gTransfCred,
    (ib) => !!ib.gTransfCred,
    'obrigatorio',
  ),
  rule('UB14-10', '1023', 'cClassTrib existente', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib, r) => {
      if (!r.ct) report(it.nItem, `cClassTrib ${ib.cClassTrib} inexistente em ${ctx.conteudo.dataDeReferencia}`);
    }),
  ),
  rule('UB14-20', '1024', 'cClassTrib compatível com a CST', BOTH, (_ctx, report) =>
    withIbscbs(_ctx, (it, ib, r) => {
      if (r.ct && r.ct.cst !== ib.CST)
        report(it.nItem, `cClassTrib ${ib.cClassTrib} é da CST ${r.ct.cst}, não da ${ib.CST}`);
    }),
  ),
  rule('UB14-25', '1025', 'cClassTrib permitido no modelo', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib, r) => {
      if (r.ct && !ctx.conteudo.permitidoEm(r.ct, ctx.documento.modelo)) {
        report(it.nItem, `cClassTrib ${ib.cClassTrib} não é permitido no modelo ${ctx.documento.modelo}`);
      }
    }),
  ),
  rule('UB14-40', '1057', 'cClassTrib 620005 exige nota de crédito', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.cClassTrib === '620005' && ctx.documento.finNFe !== 5)
        report(it.nItem, 'cClassTrib 620005 exige finNFe 5');
    }),
  ),
  rule('UB14-60', '1202', 'cClassTrib compatível com o tipo de nota de débito ou crédito', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const row = nt.classTribPorTipoDeNota.find((x) => x.cClassTrib === ib.cClassTrib);
      if (!row) return;
      const ok =
        (row.tpNFDebito !== null && ctx.documento.tpNFDebito === row.tpNFDebito) ||
        (row.tpNFCredito !== null && ctx.documento.tpNFCredito === row.tpNFCredito);
      if (!ok) {
        report(
          it.nItem,
          `cClassTrib ${ib.cClassTrib} exige ${[row.tpNFDebito && `tpNFDebito ${row.tpNFDebito}`, row.tpNFCredito && `tpNFCredito ${row.tpNFCredito}`].filter(Boolean).join(' ou ')}`,
        );
      }
    }),
  ),
  rule('UB14-70', '1200', 'tipo de nota de débito compatível com o cClassTrib', NFE, (ctx, report) => {
    const row = nt.tpNFDebito.find((x) => x.codigo === ctx.documento.tpNFDebito);
    if (!row?.cClassTrib) return;
    withIbscbs(ctx, (it, ib) => {
      if (ib.cClassTrib !== row.cClassTrib)
        report(it.nItem, `tpNFDebito ${row.codigo} exige cClassTrib ${row.cClassTrib}`);
    });
  }),
  rule('UB14-80', '1201', 'tipo de nota de crédito compatível com o cClassTrib', NFE, (ctx, report) => {
    const row = nt.tpNFCredito.find((x) => x.codigo === ctx.documento.tpNFCredito);
    if (!row?.cClassTrib) return;
    withIbscbs(ctx, (it, ib) => {
      if (ib.cClassTrib !== row.cClassTrib)
        report(it.nItem, `tpNFCredito ${row.codigo} exige cClassTrib ${row.cClassTrib}`);
    });
  }),
  rateRule('UB18-10', '1026', UF, 'pIBSUF'),
  rateRule('UB37-10', '1036', MUN, 'pIBSMun'),
  rateRule('UB56-10', '1037', CBS, 'pCBS'),
  rule(
    'UB56-20',
    '1037',
    'alíquota da CBS vigente a partir de 2027',
    BOTH,
    (ctx, report) => {
      if (yearOf(ctx.emissao) < 2027 || rateRuleExempt(ctx.documento) || !ctx.aliquotas) return;
      const rate = ctx.aliquotas.referencia(ctx.emissao).CBS;
      if (rate.valor === null) return;
      withIbscbs(ctx, (it, ib, r) => {
        const g = ib.gIBSCBS?.gCBS;
        if (!g) return;
        const expected = needsRegular(r) ? ZERO : dec(rate.valor);
        if (!dec(g.pCBS).eq(expected)) report(it.nItem, `pCBS ${g.pCBS}, vigente ${expected.toString()}`);
      });
    },
    'A alíquota vigente vem do ProvedorDeAliquotas informado em validar(); sem provedor, ou com a alíquota ainda desconhecida, a regra não é avaliada.',
  ),
  ...ENTES.flatMap(enteRules),
  rule('UB24-10', '1111', 'devolução do IBS da UF não permitida', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.gIBSCBS && 'gDevTrib' in ib.gIBSCBS.gIBSUF) report(it.nItem, 'gDevTrib informado no IBS da UF');
    }),
  ),
  rule('UB43-10', '1112', 'devolução do IBS do Município não permitida', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.gIBSCBS && 'gDevTrib' in ib.gIBSCBS.gIBSMun) report(it.nItem, 'gDevTrib informado no IBS do Município');
    }),
  ),
  rule('UB54a-10', '1150', 'vIBS = vIBSUF + vIBSMun - vCredPres deduzido', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const g = ib.gIBSCBS;
      if (!g) return;
      const cp = ib.gCredPresOper;
      const deducts = cp ? ctx.conteudo.credPres(cp.cCredPres)?.registro.deduzDoTributo === true : false;
      const expected = dec(g.gIBSUF.vIBSUF)
        .add(dec(g.gIBSMun.vIBSMun))
        .sub(deducts ? dec(cp?.gIBSCredPres?.vCredPres) : ZERO);
      if (!dec(g.vIBS).eq(expected)) report(it.nItem, `vIBS ${g.vIBS}, soma ${expected.toFixed(2)}`);
    }),
  ),
  rule('UB62-10', '1187', 'devolução da CBS vedada na NFC-e', [65], (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.gIBSCBS?.gCBS.gDevTrib) report(it.nItem, 'gDevTrib da CBS informado na NFC-e');
    }),
  ),
  rule('UB62a-10', '1188', 'percentual de devolução da CBS obrigatório', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const dev = ib.gIBSCBS?.gCBS.gDevTrib;
      if (dev && !Decimal.isDecimalText(dev.pDevTrib)) report(it.nItem, 'pDevTrib não informado');
    }),
  ),
  rule('UB63-10', '1189', 'vDevTrib = vBC x alíquota da CBS x pDevTrib', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const g = ib.gIBSCBS?.gCBS;
      const dev = g?.gDevTrib;
      if (!g || !dev) return;
      const expected = dec(ib.gIBSCBS?.vBC).mul(effectiveRate(g, CBS)).mul(dec(dev.pDevTrib)).div(HUNDRED).div(HUNDRED);
      if (!near(dec(dev.vDevTrib), expected, '0.01'))
        report(it.nItem, `vDevTrib ${dev.vDevTrib}, calculado ${expected.toFixed(2)}`);
    }),
  ),
  rule('UB68-10', '1065', 'cClassTrib exige tributação regular', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib, r) => {
      if (needsRegular(r) && ib.gIBSCBS && !ib.gIBSCBS.gTribRegular)
        report(it.nItem, `cClassTrib ${ib.cClassTrib} exige gTribRegular`);
    }),
  ),
  rule('UB68-11', '1114', 'cClassTrib veda tributação regular', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib, r) => {
      if (ib.gIBSCBS?.gTribRegular && r.ct?.grupos.gTribRegular === 'vedado' && !needsRegular(r)) {
        report(it.nItem, `cClassTrib ${ib.cClassTrib} não permite gTribRegular`);
      }
    }),
  ),
  rule('UB69-10', '1066', 'CST da tributação regular existente', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const reg = ib.gIBSCBS?.gTribRegular;
      if (reg && !ctx.conteudo.cst(reg.CSTReg)) report(it.nItem, `CSTReg ${reg.CSTReg} inexistente`);
    }),
  ),
  rule('UB70-10', '1067', 'cClassTrib da tributação regular existente', BOTH, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const reg = ib.gIBSCBS?.gTribRegular;
      if (reg && !ctx.conteudo.classTrib(reg.cClassTribReg))
        report(it.nItem, `cClassTribReg ${reg.cClassTribReg} inexistente`);
    }),
  ),
  ...(
    [
      ['UB72-10', '1040', 'IBS da UF', 'pAliqEfetRegIBSUF', 'vTribRegIBSUF'],
      ['UB72b-10', '1051', 'IBS do Município', 'pAliqEfetRegIBSMun', 'vTribRegIBSMun'],
      ['UB72d-10', '1068', 'CBS', 'pAliqEfetRegCBS', 'vTribRegCBS'],
    ] as const
  ).map(([id, cStat, label, p, v]) =>
    rule(id, cStat, `valor regular do ${label} = vBC x alíquota efetiva regular`, BOTH, (ctx, report) =>
      withIbscbs(ctx, (it, ib) => {
        const reg = ib.gIBSCBS?.gTribRegular;
        if (!reg) return;
        const expected = dec(ib.gIBSCBS?.vBC).mul(dec(reg[p])).div(HUNDRED);
        if (!near(dec(reg[v]), expected, '0.01')) report(it.nItem, `${v} ${reg[v]}, calculado ${expected.toFixed(2)}`);
      }),
    ),
  ),
  rule('UB82a-10', '1141', 'compra governamental exige gTribCompraGov', NFE, (ctx, report) => {
    if (!ctx.documento.gCompraGov) return;
    withIbscbs(ctx, (it, ib, r) => {
      if (r.cst?.grupos.gIBSCBS !== 'vedado' && ib.gIBSCBS && !ib.gIBSCBS.gTribCompraGov) {
        report(it.nItem, 'gTribCompraGov não informado');
      }
    });
  }),
  rule('UB82a-20', '1142', 'soma de gTribCompraGov igual à soma dos valores do item', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const g = ib.gIBSCBS;
      const cg = g?.gTribCompraGov;
      if (!g || !cg) return;
      const a = sumOf([cg.vTribIBSUF, cg.vTribIBSMun, cg.vTribCBS]);
      const b = sumOf([g.gIBSUF.vIBSUF, g.gIBSMun.vIBSMun, g.gCBS.vCBS]);
      if (!near(a, b, '0.04')) report(it.nItem, `gTribCompraGov soma ${a.toFixed(2)}, itens somam ${b.toFixed(2)}`);
    }),
  ),
  rule('UB82a-30', '1144', 'gTribCompraGov só com compra governamental', NFE, (ctx, report) => {
    if (ctx.documento.gCompraGov) return;
    withIbscbs(ctx, (it, ib) => {
      if (ib.gIBSCBS?.gTribCompraGov) report(it.nItem, 'gTribCompraGov sem gCompraGov');
    });
  }),
  rule('UB106-30', '1133', 'transferência de crédito exige nota de débito', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.gTransfCred && ctx.documento.finNFe !== 6) report(it.nItem, 'gTransfCred com finNFe diferente de 6');
    }),
  ),
  rule('UB106-31', '1168', 'transferência de crédito exige tpNFDebito 01 ou 05', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.gTransfCred && !['01', '05'].includes(ctx.documento.tpNFDebito ?? ''))
        report(it.nItem, 'gTransfCred sem tpNFDebito 01 ou 05');
    }),
  ),
  rule('UB106-40', '1129', 'transferência de crédito com valor', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const t = ib.gTransfCred;
      if (t && dec(t.vIBS).isZero() && dec(t.vCBS).isZero()) report(it.nItem, 'gTransfCred com vIBS e vCBS zero');
    }),
  ),
  groupPresence(
    'UB112-10',
    '1169',
    'grupo gAjusteCompet',
    BOTH,
    (r) => r.cst?.grupos.gAjusteCompet,
    (ib) => !!ib.gAjusteCompet,
    'vedado',
  ),
  groupPresence(
    'UB112-20',
    '1170',
    'grupo gAjusteCompet',
    NFE,
    (r) => r.cst?.grupos.gAjusteCompet,
    (ib) => !!ib.gAjusteCompet,
    'obrigatorio',
  ),
  rule('UB112-30', '1171', 'ajuste de competência com valor', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const a = ib.gAjusteCompet;
      if (a && dec(a.vIBS).isZero() && dec(a.vCBS).isZero()) report(it.nItem, 'gAjusteCompet com vIBS e vCBS zero');
    }),
  ),
  groupPresence(
    'UB116-10',
    '1172',
    'grupo gEstornoCred',
    BOTH,
    (r) => r.ct?.grupos.gEstornoCred,
    (ib) => !!ib.gEstornoCred,
    'vedado',
    perdaEmEstoque,
  ),
  rule('UB116-20', '1173', 'grupo gEstornoCred exigido', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib, r) => {
      if ((r.ct?.grupos.gEstornoCred === 'obrigatorio' || perdaEmEstoque(ctx)) && !ib.gEstornoCred) {
        report(it.nItem, 'grupo gEstornoCred não informado');
      }
    }),
  ),
  rule('UB116-30', '1174', 'estorno de crédito com valor', NFE, (ctx, report) => {
    if (perdaEmEstoque(ctx)) return;
    withIbscbs(ctx, (it, ib) => {
      const e = ib.gEstornoCred;
      if (e && dec(e.vIBSEstCred).isZero() && dec(e.vCBSEstCred).isZero())
        report(it.nItem, 'gEstornoCred com valores zero');
    });
  }),
  rule('UB120-10', '1049', 'crédito presumido vedado na NFC-e', [65], (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.gCredPresOper) report(it.nItem, 'gCredPresOper na NFC-e');
    }),
  ),
  rule('UB120-20', '1175', 'cClassTrib veda crédito presumido', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib, r) => {
      if (ib.gCredPresOper && r.ct?.grupos.gCredPresOper === 'vedado' && !it.bemMovelUsado) {
        report(it.nItem, `cClassTrib ${ib.cClassTrib} não permite gCredPresOper`);
      }
    }),
  ),
  rule('UB122-10', '1055', 'cCredPres existente', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.gCredPresOper && !ctx.conteudo.credPres(ib.gCredPresOper.cCredPres)) {
        report(it.nItem, `cCredPres ${ib.gCredPresOper.cCredPres} inexistente`);
      }
    }),
  ),
  ...(
    [
      ['UB123-10', '1053', 'gIBSCredPres', 'ibs', 'vedado'],
      ['UB123-20', '1054', 'gIBSCredPres', 'ibs', 'obrigatorio'],
      ['UB127-10', '1050', 'gCBSCredPres', 'cbs', 'vedado'],
      ['UB127-20', '1058', 'gCBSCredPres', 'cbs', 'obrigatorio'],
    ] as const
  ).map(([id, cStat, group, tributo, when]) =>
    rule(
      id,
      cStat,
      `cCredPres ${when === 'vedado' ? 'veda' : 'exige'} ${group}`,
      NFE,
      (ctx, report) =>
        withIbscbs(ctx, (it, ib) => {
          const cp = ib.gCredPresOper;
          const info = cp ? ctx.conteudo.credPres(cp.cCredPres) : undefined;
          if (!cp || !info) return;
          const indicator = info[tributo] ? info.registro.grupos[group] : 'vedado';
          const present = cp[group] !== undefined;
          if (when === 'vedado' && indicator === 'vedado' && present)
            report(it.nItem, `${group} informado indevidamente`);
          if (when === 'obrigatorio' && indicator === 'obrigatorio' && !present)
            report(it.nItem, `${group} não informado`);
        }),
      'O indicador só vale no período em que o crédito está vigente para o tributo (vigência da tabela cCredPres); fora dele o grupo é tratado como vedado.',
    ),
  ),
  ...(
    [
      ['UB125-10', '1107', 'gIBSCredPres'],
      ['UB129-10', '1124', 'gCBSCredPres'],
    ] as const
  ).map(([id, cStat, group]) =>
    rule(id, cStat, `vCredPres de ${group} até vProd no cCredPres 4`, NFE, (ctx, report) =>
      withIbscbs(ctx, (it, ib) => {
        const cp = ib.gCredPresOper;
        const v = cp?.[group]?.vCredPres;
        if (cp?.cCredPres !== 4 || v === undefined || it.vProd === undefined) return;
        if (dec(v).cmp(dec(it.vProd)) > 0) report(it.nItem, `vCredPres ${v} maior que vProd ${it.vProd}`);
      }),
    ),
  ),
  ...(
    [
      ['UB126-10', '1056', 'gIBSCredPres', 2033],
      ['UB130-10', '1060', 'gCBSCredPres', 2027],
    ] as const
  ).map(([id, cStat, group, from]) =>
    rule(id, cStat, `vCredPresCondSus de ${group} só a partir de ${from} e no cCredPres 4`, NFE, (ctx, report) =>
      withIbscbs(ctx, (it, ib) => {
        const cp = ib.gCredPresOper;
        if (cp?.[group]?.vCredPresCondSus === undefined) return;
        if (yearOf(ctx.emissao) < from || cp.cCredPres !== 4) {
          report(it.nItem, `vCredPresCondSus em ${group} com cCredPres ${cp.cCredPres} em ${ctx.emissao}`);
        }
      }),
    ),
  ),
  rule('UB131-10', '1138', 'crédito presumido da ZFM vedado na NFC-e', [65], (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.gCredPresIBSZFM) report(it.nItem, 'gCredPresIBSZFM na NFC-e');
    }),
  ),
  groupPresence(
    'UB131-20',
    '1134',
    'grupo gCredPresIBSZFM',
    NFE,
    (r) => r.cst?.grupos.gCredPresIBSZFM,
    (ib) => !!ib.gCredPresIBSZFM,
    'vedado',
  ),
  groupPresence(
    'UB131-30',
    '1135',
    'grupo gCredPresIBSZFM',
    NFE,
    (r) => r.cst?.grupos.gCredPresIBSZFM,
    (ib) => !!ib.gCredPresIBSZFM,
    'obrigatorio',
  ),
  rule('UB131-40', '1158', 'crédito presumido da ZFM exige tpNFCredito 02', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      if (ib.gCredPresIBSZFM && ctx.documento.tpNFCredito !== '02')
        report(it.nItem, 'gCredPresIBSZFM sem tpNFCredito 02');
    }),
  ),
  rule('UB131-50', '1159', 'tpNFCredito 02 exige crédito presumido da ZFM', NFE, (ctx, report) => {
    if (ctx.documento.tpNFCredito !== '02') return;
    withIbscbs(ctx, (it, ib) => {
      if (!ib.gCredPresIBSZFM) report(it.nItem, 'tpNFCredito 02 sem gCredPresIBSZFM');
    });
  }),
  rule('UB132-10', '1160', 'competApur da ZFM não posterior ao mês atual', NFE, (ctx, report) =>
    withIbscbs(ctx, (it, ib) => {
      const c = ib.gCredPresIBSZFM?.competApur;
      if (c !== undefined && c > ctx.emissao.slice(0, 7))
        report(it.nItem, `competApur ${c} depois de ${ctx.emissao.slice(0, 7)}`);
    }),
  ),
  rule('UB133-10', '1136', 'tpCredPresIBSZFM sem repetição no documento', NFE, (ctx, report) => {
    const seen = new Set<number>();
    withIbscbs(ctx, (it, ib) => {
      const t = ib.gCredPresIBSZFM?.tpCredPresIBSZFM;
      if (t === undefined) return;
      if (seen.has(t)) report(it.nItem, `tpCredPresIBSZFM ${t} repetido`);
      seen.add(t);
    });
  }),
  // ---------- totais ----------
  rule('W34-10', '1118', 'IBSCBSTot só com itens com IBSCBS', BOTH, (ctx, report) => {
    if (ctx.documento.IBSCBSTot && !ctx.documento.itens.some((i) => i.IBSCBS))
      report(undefined, 'IBSCBSTot sem item com IBSCBS');
  }),
  rule('W34-20', '1119', 'IBSCBSTot obrigatório com itens com IBSCBS', BOTH, (ctx, report) => {
    if (!ctx.documento.IBSCBSTot && ctx.documento.itens.some((i) => i.IBSCBS))
      report(undefined, 'IBSCBSTot não informado');
  }),
  ...totalRules(),
];

type Tot = NonNullable<DocumentoDasRegras['IBSCBSTot']>;
type Sel = (ib: IBSCBS) => string | undefined;

function totalRules(): Regra[] {
  const specs: readonly [string, string, string, (t: Tot) => string | undefined, Sel][] = [
    [
      'W35-10',
      '1076',
      'vBCIBSCBS',
      (t: Tot): string | undefined => t.vBCIBSCBS,
      (ib: IBSCBS): string | undefined => ib.gIBSCBS?.vBC,
    ],
    [
      'W38-10',
      '1077',
      'vDif do IBS da UF',
      (t: Tot): string | undefined => t.gIBS.gIBSUF.vDif,
      (ib: IBSCBS): string | undefined => ib.gIBSCBS?.gIBSUF.gDif?.vDif,
    ],
    [
      'W39-10',
      '1078',
      'vDevTrib do IBS da UF',
      (t: Tot): string | undefined => t.gIBS.gIBSUF.vDevTrib,
      (): undefined => undefined,
    ],
    [
      'W41-10',
      '1080',
      'vIBSUF',
      (t: Tot): string | undefined => t.gIBS.gIBSUF.vIBSUF,
      (ib: IBSCBS): string | undefined => ib.gIBSCBS?.gIBSUF.vIBSUF,
    ],
    [
      'W43-10',
      '1081',
      'vDif do IBS do Município',
      (t: Tot): string | undefined => t.gIBS.gIBSMun.vDif,
      (ib: IBSCBS): string | undefined => ib.gIBSCBS?.gIBSMun.gDif?.vDif,
    ],
    [
      'W44-10',
      '1082',
      'vDevTrib do IBS do Município',
      (t: Tot): string | undefined => t.gIBS.gIBSMun.vDevTrib,
      (): undefined => undefined,
    ],
    [
      'W46-10',
      '1084',
      'vIBSMun',
      (t: Tot): string | undefined => t.gIBS.gIBSMun.vIBSMun,
      (ib: IBSCBS): string | undefined => ib.gIBSCBS?.gIBSMun.vIBSMun,
    ],
    [
      'W47-10',
      '1085',
      'vIBS',
      (t: Tot): string | undefined => t.gIBS.vIBS,
      (ib: IBSCBS): string | undefined => ib.gIBSCBS?.vIBS,
    ],
    [
      'W48-10',
      '1086',
      'vCredPres do IBS',
      (t: Tot): string | undefined => t.gIBS.vCredPres,
      (ib: IBSCBS): string | undefined => ib.gCredPresOper?.gIBSCredPres?.vCredPres,
    ],
    [
      'W53-10',
      '1088',
      'vDif da CBS',
      (t: Tot): string | undefined => t.gCBS.vDif,
      (ib: IBSCBS): string | undefined => ib.gIBSCBS?.gCBS.gDif?.vDif,
    ],
    [
      'W54-10',
      '1089',
      'vDevTrib da CBS',
      (t: Tot): string | undefined => t.gCBS.vDevTrib,
      (ib: IBSCBS): string | undefined => ib.gIBSCBS?.gCBS.gDevTrib?.vDevTrib,
    ],
    [
      'W56-10',
      '1091',
      'vCBS',
      (t: Tot): string | undefined => t.gCBS.vCBS,
      (ib: IBSCBS): string | undefined => ib.gIBSCBS?.gCBS.vCBS,
    ],
    [
      'W56a-10',
      '1087',
      'vCredPres da CBS',
      (t: Tot): string | undefined => t.gCBS.vCredPres,
      (ib: IBSCBS): string | undefined => ib.gCredPresOper?.gCBSCredPres?.vCredPres,
    ],
    [
      'W59f-10',
      '1176',
      'IBS estornado',
      (t: Tot): string | undefined => t.gEstornoCred?.vIBSEstCred,
      (ib: IBSCBS): string | undefined => ib.gEstornoCred?.vIBSEstCred,
    ],
    [
      'W59g-10',
      '1177',
      'CBS estornada',
      (t: Tot): string | undefined => t.gEstornoCred?.vCBSEstCred,
      (ib: IBSCBS): string | undefined => ib.gEstornoCred?.vCBSEstCred,
    ],
  ];
  return specs.map(([id, cStat, label, total, item]) =>
    rule(id, cStat, `total de ${label} = soma dos itens`, BOTH, (ctx, report) => {
      const tot = ctx.documento.IBSCBSTot;
      if (!tot) return;
      const expected = sumOf(ctx.documento.itens.map((i) => (i.IBSCBS ? item(i.IBSCBS) : undefined)));
      const declared = total(tot);
      if (declared === undefined && expected.isZero()) return;
      if (!dec(declared).eq(expected))
        report(undefined, `total de ${label} ${declared ?? '(ausente)'}, soma dos itens ${expected.toFixed(2)}`);
    }),
  );
}

/** Regras da NT que este pacote ainda não confere, com o motivo. */
export const NAO_IMPLEMENTADAS: readonly NaoImplementada[] = [
  { id: 'UB11-10', motivo: 'Imposto Seletivo: implementação futura na NT e fora do @sinete/ibs-cbs/calcular.' },
  { id: 'UB16-10', motivo: 'Composição da base: "implementação futura, aguardando orientação normativa" na NT.' },
  { id: 'UB13-39', motivo: 'Tributação monofásica ainda não suportada no @sinete/ibs-cbs.' },
  { id: 'UB13-40', motivo: 'Tributação monofásica (implementação futura na NT).' },
  {
    id: 'UB14-30',
    motivo: 'Depende da tabela de índice de mistura do biocombustível por código ANP, fora do dataset.',
  },
  {
    id: 'UB14-50',
    motivo: 'Depende da tabela de índice de mistura do biocombustível por código ANP, fora do dataset.',
  },
  { id: 'UB66a-10', motivo: 'Grupo gALCZFMCBS (CBS zero em áreas incentivadas) ainda não modelado.' },
  { id: 'UB66a-20', motivo: 'Grupo gALCZFMCBS ainda não modelado.' },
  { id: 'UB66c-10', motivo: 'Grupo gALCZFMCBS ainda não modelado.' },
  { id: 'UB66e-10', motivo: 'Grupo gALCZFMCBS ainda não modelado.' },
  { id: 'UB84a-10 a UB104', motivo: 'Grupos de tributação monofásica ainda não suportados.' },
  { id: 'W31-10, W31-20, W33-10', motivo: 'Totais do Imposto Seletivo, fora do escopo.' },
  { id: 'W58-10 a W59d-10', motivo: 'Totais da monofasia, ainda não suportada.' },
  { id: 'VB01-05, VB01-10, VB01-20, W60-05, W60-10', motivo: 'vItem e vNFTot: implementação futura na NT.' },
];
