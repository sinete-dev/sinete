/**
 * Gerador determinístico de operações sintéticas válidas segundo o dataset: data de fato gerador em 2026 a 2033,
 * modelo de DF-e, cClassTrib vigente e habilitado no modelo, NCM ou NBS aplicável quando o código tem anexo,
 * tributação regular quando o tratamento exige, compra governamental em parte das operações e bases com centavos nas
 * bordas de arredondamento. Nenhum dado pessoal: CST, códigos e valores inventados, NCM e NBS da tabela oficial.
 *
 * As listas de NCM e NBS vêm do SQLite da Calculadora já baixado e conferido pelo `tools/ibs-cbs-dados` (só para o gerador,
 * que precisa de códigos completos existentes; o dataset publicado não carrega a tabela NCM inteira).
 */
import { Database } from 'bun:sqlite';
import type { ClassifiedItem, ClassifiedOperation, TpEnteGov } from '@sinete/ibs-cbs/calcular';
import type { ClassTribRecord, IbsCbsDataset, TaxContent } from '@sinete/ibs-cbs-dados';

export interface CaseItemMeta {
  readonly n: number;
  readonly ncm?: string;
  readonly nbs?: string;
}

export interface OracleCase {
  readonly id: string;
  readonly date: string;
  readonly op: ClassifiedOperation;
  readonly meta: readonly CaseItemMeta[];
}

/** PRNG mulberry32: a mesma semente gera os mesmos casos em qualquer máquina. */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Nomenclatures {
  readonly ncm: readonly string[];
  readonly nbs: readonly string[];
  /** NCM com alíquota de Imposto Seletivo cadastrada (evitadas: o motor não calcula IS). */
  readonly selectiveNcm: ReadonlySet<string>;
  readonly selectiveNbs: ReadonlySet<string>;
}

export function loadNomenclatures(dbPath: string): Nomenclatures {
  const db = new Database(dbPath, { readonly: true });
  const col = (sql: string): string[] => (db.query(sql).all() as { c: string }[]).map((r) => r.c);
  const out: Nomenclatures = {
    ncm: col(
      "select NCM_CD c from NCM where length(NCM_CD) = 8 and coalesce(NCM_FIM_VIGENCIA, '9999-12-31') >= '2033-12-31' order by 1",
    ),
    nbs: col(
      "select NBS_CD c from NBS where length(NBS_CD) = 9 and coalesce(NBS_FIM_VIGENCIA, '9999-12-31') >= '2033-12-31' order by 1",
    ),
    selectiveNcm: new Set(
      col(
        'select AAVP_NCM_CD c from ALIQUOTA_AD_VALOREM_PRODUTO union select AARP_NCM_CD c from ALIQUOTA_AD_REM_PRODUTO',
      ),
    ),
    selectiveNbs: new Set(col('select AAVS_NBS_CD c from ALIQUOTA_AD_VALOREM_SERVICO')),
  };
  db.close();
  return out;
}

const COMMON_MODELS = [55, 55, 55, 55, 65, 65, 91, 91];
const PLACES = [
  { uf: 'RS', cMun: '4314902' },
  { uf: 'SP', cMun: '3550308' },
  { uf: 'AM', cMun: '1302603' },
  { uf: 'MT', cMun: '5103403' },
];

export interface Generator {
  next(): OracleCase | undefined;
}

export function generator(dataset: IbsCbsDataset, nom: Nomenclatures, seed: number): Generator {
  const rnd = prng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
  const models = [...new Set(dataset.tables.dfeTypes.map((t) => t.modelo))].sort((a, b) => a - b);
  let counter = 0;

  const linksNcm = (content: TaxContent, c: ClassTribRecord) =>
    dataset.tables.ncmApplicability.filter(
      (a) => a.classTribKey === c.key && a.validity.from <= content.asOf && (a.validity.to ?? '9999') >= content.asOf,
    );
  const linksNbs = (content: TaxContent, c: ClassTribRecord) =>
    dataset.tables.nbsApplicability.filter(
      (a) => a.classTribKey === c.key && a.validity.from <= content.asOf && (a.validity.to ?? '9999') >= content.asOf,
    );

  const chooseNcm = (content: TaxContent, cts: readonly ClassTribRecord[]): string | undefined => {
    const withLinks = cts.find((c) => linksNcm(content, c).length > 0);
    const pool = withLinks
      ? nom.ncm.filter((x) => linksNcm(content, withLinks).some((a) => x.startsWith(a.prefix)))
      : nom.ncm;
    for (let t = 0; t < 40 && pool.length > 0; t++) {
      const x = pick(pool);
      if (nom.selectiveNcm.has(x)) continue;
      if (cts.every((c) => content.applicableNcm(c, x).result !== 'no')) return x;
    }
    return undefined;
  };
  const chooseNbs = (content: TaxContent, cts: readonly ClassTribRecord[]): string | undefined => {
    const withLinks = cts.find((c) => linksNbs(content, c).length > 0);
    const pool = withLinks
      ? nom.nbs.filter((x) => linksNbs(content, withLinks).some((a) => x.startsWith(a.prefix)))
      : nom.nbs;
    for (let t = 0; t < 40 && pool.length > 0; t++) {
      const x = pick(pool);
      if (nom.selectiveNbs.has(x)) continue;
      if (cts.every((c) => content.applicableNbs(c, x).result !== 'no')) return x;
    }
    return undefined;
  };

  const base = (): string => {
    const r = rnd();
    if (r < 0.3) return (5 + 10 * Math.floor(rnd() * 2000)).toFixed(2); // termina em 5: meio centavo em 0,1%
    if (r < 0.4) return (Math.floor(rnd() * 1000) / 100 + 0.01).toFixed(2);
    if (r < 0.5) return (Math.floor(rnd() * 1e9) / 100).toFixed(2);
    return (Math.floor(rnd() * 5e6) / 100).toFixed(2);
  };

  const informed = (year: number): ClassifiedItem['informedRates'] | undefined => {
    if (year < 2027) return undefined;
    if (year <= 2028) {
      return {
        CBS: pick(['8.8', '8.7', '9.25', '8.75']),
        IBSUF: pick(['0.05', '0.05', '0.1']),
        IBSMun: '0.05',
        reason: 'simulação sintética do oráculo',
      };
    }
    return {
      CBS: pick(['8.8', '9.3']),
      IBSUF: pick(['17.7', '9.5', '10.25']),
      IBSMun: pick(['7.2', '2.5', '5.05']),
      reason: 'simulação sintética do oráculo',
    };
  };

  function item(
    content: TaxContent,
    modelo: number,
    n: number,
    year: number,
  ): [ClassifiedItem, CaseItemMeta] | undefined {
    const all = content.classTribs({ modelo });
    if (all.length === 0) return undefined;
    // 85% dos itens em códigos que a Calculadora calcula; o resto exercita as recusas (monofasia, ajustes).
    const calculable = all.filter((c) => {
      const t = content.treatment(c);
      return t && !t.flags.possuiAjuste && !t.flags.possuiMonofasia;
    });
    const ct = rnd() < 0.85 && calculable.length > 0 ? pick(calculable) : pick(all);
    const treatment = content.treatment(ct);
    const cst = content.cstOf(ct);
    if (!treatment || !cst) return undefined;
    let regular: ClassTribRecord | undefined;
    if (treatment.flags.exigeGrupoTribRegular) {
      const pool = calculable.filter((c) => {
        const t = content.treatment(c);
        const s = content.cstOf(c);
        return (
          t &&
          s &&
          !t.flags.exigeGrupoTribRegular &&
          !t.flags.incompativelComSuspensao &&
          s.groups.gIBSCBS === 'required' &&
          s.groups.gDif === 'forbidden' &&
          linksNcm(content, c).length === 0 &&
          linksNbs(content, c).length === 0
        );
      });
      if (pool.length === 0) return undefined;
      regular = pick(pool);
    }
    const cts = regular ? [ct, regular] : [ct];
    const hasNcmLinks = cts.some((c) => linksNcm(content, c).length > 0);
    const hasNbsLinks = cts.some((c) => linksNbs(content, c).length > 0);
    let ncm: string | undefined;
    let nbs: string | undefined;
    if (hasNcmLinks || (!hasNbsLinks && modelo !== 91 && [55, 65].includes(modelo))) ncm = chooseNcm(content, cts);
    else if (hasNbsLinks || modelo === 91) nbs = chooseNbs(content, cts);
    if ((hasNcmLinks && !ncm) || (hasNbsLinks && !nbs)) return undefined;
    const rates = cst.groups.gIBSCBS === 'required' ? informed(year) : undefined;
    const money = (): string => (Math.floor(rnd() * 1e6) / 100 + 0.01).toFixed(2);
    const compet = `${year}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}`;
    const g = cst.groups;
    // Grupos informados que a Calculadora não calcula: exigidos sempre, permitidos às vezes. Exercitam o motor e
    // as entradas do ledger de lacunas do oráculo.
    const extra: { -readonly [K in keyof ClassifiedItem]?: ClassifiedItem[K] } = {
      ...(ct.groups.gEstornoCred === 'required' || (ct.groups.gEstornoCred === 'allowed' && rnd() < 0.3)
        ? { creditReversal: { vIBSEstCred: money(), vCBSEstCred: money() } }
        : {}),
      ...(g.gTransfCred === 'required' ? { creditTransfer: { vIBS: money(), vCBS: money() } } : {}),
      ...(g.gAjusteCompet === 'required'
        ? { competenceAdjustment: { competApur: compet, vIBS: money(), vCBS: money() } }
        : {}),
      ...(g.gCredPresIBSZFM === 'required'
        ? {
            zfmCredit: {
              competApur: compet,
              tpCredPresIBSZFM: pick([0, 1, 2, 3, 4] as const),
              vCredPresIBSZFM: money(),
            },
          }
        : {}),
    };
    if (ct.groups.gCredPresOper !== 'forbidden' && g.gCredPresIBSZFM !== 'required' && rnd() < 0.5) {
      const codes = dataset.tables.credPres
        .map((r) => content.credPres(r.code))
        .filter((x): x is NonNullable<typeof x> => x !== undefined && (x.cbs || x.ibs));
      if (codes.length > 0) {
        const cp = pick(codes);
        // Crédito abatido do IBS do item (indDeduzCredPres): percentual pequeno sobre a própria base, para não
        // exceder o IBS (o motor recusa vIBS negativo).
        const deducts = cp.record.deductsFromTax;
        const red = Math.max(Number(content.reduction(ct, 'IBSUF') ?? 0), Number(content.reduction(ct, 'IBSMun') ?? 0));
        if (deducts && red > 60) return undefined;
        const p = (): { pCredPres: string } => ({ pCredPres: deducts ? '0.01' : pick(['1.5', '20', '3.75', '0.9']) });
        Object.assign(extra, {
          presumedCredit: {
            cCredPres: cp.record.code,
            vBCCredPres: deducts ? '__BASE__' : base(),
            ...(cp.ibs && cp.record.groups.gIBSCredPres !== 'forbidden' ? { ibs: p() } : {}),
            ...(cp.cbs && cp.record.groups.gCBSCredPres !== 'forbidden' ? { cbs: p() } : {}),
          },
        });
      }
    }
    const itemBase = base();
    if (extra.presumedCredit?.vBCCredPres === '__BASE__') {
      extra.presumedCredit = { ...extra.presumedCredit, vBCCredPres: itemBase };
    }
    const it: ClassifiedItem = {
      n,
      cst: ct.cst,
      cClassTrib: ct.code,
      base: itemBase,
      ...(regular ? { regular: { cst: regular.cst, cClassTrib: regular.code } } : {}),
      ...(rates ? { informedRates: rates } : {}),
      ...extra,
    };
    return [it, { n, ...(ncm ? { ncm } : {}), ...(nbs ? { nbs } : {}) }];
  }

  return {
    next(): OracleCase | undefined {
      counter++;
      const r = rnd();
      const year = r < 0.65 ? 2026 : r < 0.85 ? pick([2027, 2028]) : pick([2029, 2030, 2031, 2032, 2033]);
      const date = `${year}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`;
      const content = dataset.at(date);
      const modelo = rnd() < 0.85 ? pick(COMMON_MODELS) : pick(models);
      const items: ClassifiedItem[] = [];
      const meta: CaseItemMeta[] = [];
      const want = 1 + Math.floor(rnd() * 3);
      for (let tries = 0; tries < want * 6 && items.length < want; tries++) {
        const x = item(content, modelo, items.length + 1, year);
        if (x) {
          items.push(x[0]);
          meta.push(x[1]);
        }
      }
      if (items.length === 0) return undefined;
      const gov = rnd() < 0.15 ? { tpEnteGov: pick([1, 2, 3, 4, 5, 6] as TpEnteGov[]) } : undefined;
      return {
        id: `s${seed}-${counter}`,
        date,
        op: { modelo, place: pick(PLACES), ...(gov ? { governmentPurchase: gov } : {}), items },
        meta,
      };
    },
  };
}
