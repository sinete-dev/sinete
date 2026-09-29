/**
 * Carga do dataset e visão numa data de fato gerador (`TaxContent`).
 *
 * `loadDataset` aceita qualquer `DatasetBundle`: o embarcado neste pacote (`@sinete/ibs-cbs-dados/bundled`) ou um obtido em
 * runtime de outra origem (arquivo, URL), o que permite atualizar dados sem atualizar código enquanto o
 * `dataSchemaVersion` for compatível. `verifyDataset` confere os hashes do manifest antes de confiar num bundle externo.
 */
import type { ApplicabilityResult } from './applicability.ts';
import { applicability } from './applicability.ts';
import { canonicalTable } from './canonical.ts';
import { inForce, requireIsoDate } from './dates.ts';
import { IbsCbsDataError } from './errors.ts';
import type {
  ActorRecord,
  AnnexRecord,
  ApplicabilityRecord,
  ClassTribRecord,
  CredPresRecord,
  CstRecord,
  DatasetBundle,
  DatasetManifest,
  DatasetTables,
  Dec,
  DfeTypeRecord,
  Family,
  IsoDate,
  NfseNbsRecord,
  TableName,
  TreatmentRecord,
  Tributo,
} from './types.ts';

/** Versão do formato que este código lê. Bundle com versão maior é recusado. */
export const DATA_SCHEMA_VERSION = 1;

export const TABLE_NAMES: readonly TableName[] = [
  'cst',
  'classTrib',
  'treatments',
  'credPres',
  'ncmApplicability',
  'nbsApplicability',
  'annexes',
  'nfseNbs',
  'actorGroups',
  'actors',
  'actorClassTrib',
  'dfeTypes',
  'govPurchaseReducer',
  'cbsTransfer',
];

/** Crédito presumido vigente na data, por tributo. */
export interface CredPresInForce {
  readonly record: CredPresRecord;
  readonly cbs: boolean;
  readonly ibs: boolean;
}

/** Filtro de `classTribs`. */
export interface ClassTribFilter {
  readonly family?: Family;
  readonly cst?: string;
  /** Modelo de DF-e (`55`, `65`, `91`...) em que o código precisa estar habilitado na data. */
  readonly modelo?: number;
}

/** Atores de uma operação, pelos ids da tabela de atores; `undefined` não restringe o papel. */
export interface ActorFilter {
  readonly supplier?: number;
  readonly buyer?: number;
  readonly modelo?: number;
}

/** O dataset visto numa data de fato gerador: só registros vigentes nela. */
export interface TaxContent {
  readonly asOf: IsoDate;
  readonly dataset: IbsCbsDataset;
  cst(code: string, family?: Family): CstRecord | undefined;
  classTrib(code: string, family?: Family): ClassTribRecord | undefined;
  classTribs(filter?: ClassTribFilter): readonly ClassTribRecord[];
  /** CST do cClassTrib na data. */
  cstOf(classTrib: ClassTribRecord): CstRecord | undefined;
  treatment(classTrib: ClassTribRecord): TreatmentRecord | undefined;
  /** Percentual de redução vigente para o tributo (`'60'`), ou `undefined` sem redução. */
  reduction(classTrib: ClassTribRecord, tributo: Tributo): Dec | undefined;
  fixedRate(classTrib: ClassTribRecord, tributo: Tributo): Dec | undefined;
  /** O cClassTrib está habilitado no modelo de DF-e na data. */
  allowedIn(classTrib: ClassTribRecord, modelo: number): boolean;
  credPres(code: number): CredPresInForce | undefined;
  applicableNcm(classTrib: ClassTribRecord, ncm: string): ApplicabilityResult;
  applicableNbs(classTrib: ClassTribRecord, nbs: string): ApplicabilityResult;
  /**
   * cClassTrib (família IBS/CBS) admitidos para o par de atores, com a regra da Calculadora: código sem vínculo vigente
   * de ator num papel admite qualquer ator nesse papel; filtros compõem um E lógico.
   */
  byActors(filter: ActorFilter): readonly string[];
  actor(id: number): ActorRecord | undefined;
  nfseNbs(nbs: string): readonly NfseNbsRecord[];
  annex(item: string): AnnexRecord | undefined;
  dfeType(modelo: number): DfeTypeRecord | undefined;
  /** Redutor de compras governamentais em percentual (arts. 370 e 472 da LC 214/2025). */
  govPurchaseReducer(): Dec | undefined;
  /** Percentual da CBS transferido ao ente contratante na compra governamental. */
  cbsTransferPercent(): Dec | undefined;
}

export interface IbsCbsDataset {
  readonly manifest: DatasetManifest;
  readonly tables: DatasetTables;
  /**
   * Identificador curto do conteúdo, para proveniência: `AAAA.MM+<versões oficiais>#<sha256 do dataset, 12>`. Vai junto
   * de toda determinação e de todo cálculo, para reprocessar um documento com os dados da época.
   */
  readonly contentVersion: string;
  /** Visão na data de fato gerador (`AAAA-MM-DD`). */
  at(date: IsoDate): TaxContent;
}

function group<T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    const list = m.get(k);
    if (list) list.push(x);
    else m.set(k, [x]);
  }
  return m;
}

function checkShape(bundle: unknown): asserts bundle is DatasetBundle {
  const b = bundle as Partial<DatasetBundle> | null;
  if (!b || typeof b !== 'object' || !b.manifest || !b.tables) {
    throw new IbsCbsDataError('ibscbs_dados_invalidos', 'bundle sem manifest ou tables');
  }
  const v = b.manifest.dataSchemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new IbsCbsDataError('ibscbs_dados_invalidos', 'manifest sem dataSchemaVersion inteiro');
  }
  if (v !== DATA_SCHEMA_VERSION) {
    throw new IbsCbsDataError(
      'ibscbs_dados_versao_incompativel',
      `dataSchemaVersion ${v} não suportado; este código lê a versão ${DATA_SCHEMA_VERSION}`,
      { details: { dataSchemaVersion: v, supported: DATA_SCHEMA_VERSION } },
    );
  }
  for (const name of TABLE_NAMES) {
    if (!Array.isArray((b.tables as unknown as Record<string, unknown>)[name])) {
      throw new IbsCbsDataError('ibscbs_dados_invalidos', `tabela ${name} ausente no bundle`, {
        details: { table: name },
      });
    }
  }
}

/** Identificador curto do conteúdo (ver `IbsCbsDataset.contentVersion`). */
export function contentVersionOf(manifest: DatasetManifest): string {
  const versions = manifest.sources.map((s) => s.version).join('+');
  return `${manifest.dataVersion}+${versions}#${manifest.datasetSha256.slice(0, 12)}`;
}

export function loadDataset(bundle: DatasetBundle): IbsCbsDataset {
  checkShape(bundle);
  const { manifest, tables } = bundle;
  const famCode = (x: { family: Family; code: string }): string => `${x.family}:${x.code}`;
  const cstByCode = group(tables.cst, famCode);
  const classByCode = group(tables.classTrib, famCode);
  const classByKey = new Map(tables.classTrib.map((c) => [c.key, c]));
  const treatmentById = new Map(tables.treatments.map((t) => [t.id, t]));
  const credByCode = new Map(tables.credPres.map((c) => [c.code, c]));
  const ncmByClass = group(tables.ncmApplicability, (a) => a.classTribKey);
  const nbsByClass = group(tables.nbsApplicability, (a) => a.classTribKey);
  const nfseByNbs = group(tables.nfseNbs, (n) => n.nbs);
  const actorLinks = group(tables.actorClassTrib, (a) => `${a.classTribKey}:${a.role}`);
  const annexByItem = group(tables.annexes, (a) => (a.item ? `${a.annex}/${a.item}` : a.annex));
  const views = new Map<IsoDate, TaxContent>();

  const dataset: IbsCbsDataset = {
    manifest,
    tables,
    contentVersion: contentVersionOf(manifest),
    at(date: IsoDate): TaxContent {
      const d = requireIsoDate(date, 'data do fato gerador');
      let view = views.get(d);
      if (!view) {
        view = makeView(d);
        views.set(d, view);
      }
      return view;
    },
  };

  function pick<T extends { validity: { from: IsoDate; to: IsoDate | null } }>(
    xs: readonly T[] | undefined,
    d: IsoDate,
  ): T | undefined {
    return xs?.find((x) => inForce(x.validity, d));
  }

  function makeView(d: IsoDate): TaxContent {
    const linksInForce = (xs: readonly ApplicabilityRecord[] | undefined): readonly ApplicabilityRecord[] => xs ?? [];
    const admits = (classKey: string, role: 'Fornecedor' | 'Adquirente', actor: number | undefined): boolean => {
      if (actor === undefined) return true;
      const links = (actorLinks.get(`${classKey}:${role}`) ?? []).filter((l) => inForce(l.validity, d));
      return links.length === 0 || links.some((l) => l.actor === actor);
    };
    const view: TaxContent = {
      asOf: d,
      dataset,
      cst: (code: string, family: Family = 'CBS_IBS'): CstRecord | undefined =>
        pick(cstByCode.get(`${family}:${code}`), d),
      classTrib: (code: string, family: Family = 'CBS_IBS'): ClassTribRecord | undefined =>
        pick(classByCode.get(`${family}:${code}`), d),
      classTribs(filter: ClassTribFilter = {}): readonly ClassTribRecord[] {
        const family = filter.family ?? 'CBS_IBS';
        return tables.classTrib.filter(
          (c) =>
            c.family === family &&
            inForce(c.validity, d) &&
            (filter.cst === undefined || c.cst === filter.cst) &&
            (filter.modelo === undefined || view.allowedIn(c, filter.modelo)),
        );
      },
      cstOf: (c: ClassTribRecord): CstRecord | undefined => view.cst(c.cst, c.family),
      treatment(c: ClassTribRecord): TreatmentRecord | undefined {
        const link = pick(c.treatments, d);
        return link ? treatmentById.get(link.treatment) : undefined;
      },
      reduction: (c: ClassTribRecord, tributo: Tributo): Dec | undefined =>
        c.reductions.find((r) => r.tributo === tributo && inForce(r.validity, d))?.pRed,
      fixedRate: (c: ClassTribRecord, tributo: Tributo): Dec | undefined =>
        c.fixedRates.find((r) => r.tributo === tributo && inForce(r.validity, d))?.rate,
      allowedIn: (c: ClassTribRecord, modelo: number): boolean =>
        c.dfe.some((x) => x.modelo === modelo && inForce(x.validity, d)),
      credPres(code: number): CredPresInForce | undefined {
        const record = credByCode.get(code);
        if (!record) return undefined;
        const cbs = record.validity.cbs !== null && inForce(record.validity.cbs, d);
        const ibs = record.validity.ibs !== null && inForce(record.validity.ibs, d);
        return { record, cbs, ibs };
      },
      applicableNcm: (c: ClassTribRecord, ncm: string): ApplicabilityResult =>
        applicability(linksInForce(ncmByClass.get(c.key)), ncm, d, 8),
      applicableNbs: (c: ClassTribRecord, nbs: string): ApplicabilityResult =>
        applicability(linksInForce(nbsByClass.get(c.key)), nbs, d, 9),
      byActors(filter: ActorFilter): readonly string[] {
        return view
          .classTribs(filter.modelo === undefined ? {} : { modelo: filter.modelo })
          .filter((c) => admits(c.key, 'Fornecedor', filter.supplier) && admits(c.key, 'Adquirente', filter.buyer))
          .map((c) => c.code);
      },
      actor: (id: number): ActorRecord | undefined => tables.actors.find((a) => a.id === id && inForce(a.validity, d)),
      nfseNbs: (nbs: string): readonly NfseNbsRecord[] =>
        (nfseByNbs.get(nbs) ?? []).filter((n) => inForce(n.validity, d)),
      annex: (item: string): AnnexRecord | undefined => pick(annexByItem.get(item), d),
      dfeType: (modelo: number): DfeTypeRecord | undefined =>
        tables.dfeTypes.find((t) => t.modelo === modelo && inForce(t.validity, d)),
      govPurchaseReducer: (): Dec | undefined => pick(tables.govPurchaseReducer, d)?.pRedutor,
      cbsTransferPercent: (): Dec | undefined => pick(tables.cbsTransfer, d)?.percent,
    };
    return view;
  }

  // Integridade referencial mínima: todo vínculo aponta para um cClassTrib do dataset.
  for (const name of ['ncmApplicability', 'nbsApplicability', 'nfseNbs', 'actorClassTrib'] as const) {
    for (const r of tables[name]) {
      if (!classByKey.has(r.classTribKey)) {
        throw new IbsCbsDataError('ibscbs_dados_invalidos', `${name}: ${r.key} aponta para cClassTrib inexistente`, {
          details: { table: name, key: r.key },
        });
      }
    }
  }
  return dataset;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Confere cada tabela contra o sha256 do manifest e o `datasetSha256`. Use antes de `loadDataset` num bundle obtido
 * fora do pacote. Lança `IbsCbsDataError` (`ibscbs_dados_invalidos`) na primeira divergência.
 */
export async function verifyDataset(bundle: DatasetBundle): Promise<void> {
  checkShape(bundle);
  // O manifest precisa cobrir cada tabela exatamente uma vez: tabela fora dele não teria hash conferido.
  const names = bundle.manifest.tables.map((t) => t.name);
  const missing = TABLE_NAMES.filter((n) => !names.includes(n));
  const extra = names.filter((n, i) => !TABLE_NAMES.includes(n) || names.indexOf(n) !== i);
  if (missing.length > 0 || extra.length > 0) {
    throw new IbsCbsDataError(
      'ibscbs_dados_invalidos',
      'manifest não lista cada tabela do dataset exatamente uma vez',
      {
        details: { missing, extra },
      },
    );
  }
  const lines: string[] = [];
  for (const t of bundle.manifest.tables) {
    const records = (bundle.tables as unknown as Record<string, readonly unknown[] | undefined>)[t.name];
    if (!records) throw new IbsCbsDataError('ibscbs_dados_invalidos', `tabela ${t.name} do manifest ausente no bundle`);
    const got = await sha256Hex(canonicalTable(records));
    if (got !== t.sha256 || records.length !== t.records) {
      throw new IbsCbsDataError('ibscbs_dados_invalidos', `tabela ${t.name} não confere com o manifest`, {
        details: { table: t.name, expected: t.sha256, got },
      });
    }
    lines.push(`${t.sha256}  ${t.name}`);
  }
  const all = await sha256Hex(lines.join('\n'));
  if (all !== bundle.manifest.datasetSha256) {
    throw new IbsCbsDataError('ibscbs_dados_invalidos', 'datasetSha256 não confere com as tabelas', {
      details: { expected: bundle.manifest.datasetSha256, got: all },
    });
  }
}
