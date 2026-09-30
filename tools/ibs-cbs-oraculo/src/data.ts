/**
 * Verificação cruzada do dataset contra a API `dados-abertos` do oráculo: aplicabilidade de NCM e NBS por
 * cClassTrib e data, filtro por atores e listas de cClassTrib e CST vigentes. Aqui não há ledger: o dataset é extraído
 * do mesmo SQLite, então qualquer diferença é defeito do extrator ou do leitor.
 */
import type { DatasetIbsCbs } from '@sinete/ibs-cbs-dados';
import type { Nomenclatures } from './generate.ts';
import { prng } from './generate.ts';

export interface ApplicabilityPair {
  readonly kind: 'ncm' | 'nbs';
  readonly cClassTrib: string;
  readonly code: string;
  readonly date: string;
  /** Resposta do oráculo (`valido`). */
  readonly valid: boolean;
}

export interface ActorsCase {
  readonly date: string;
  readonly supplier: number;
  readonly buyer: number;
  readonly modelo: number;
  readonly sigla: string;
  /** cClassTrib devolvidos pelo oráculo, ordenados. */
  readonly codes: readonly string[];
}

export interface ListCase {
  readonly date: string;
  readonly classTrib: readonly string[];
  readonly cst: readonly string[];
}

export interface DataMismatch {
  readonly what: string;
  readonly ours: string;
  readonly theirs: string;
}

const DATES = ['2026-01-01', '2026-09-25', '2026-12-31', '2027-01-01', '2028-06-01', '2029-01-01', '2033-01-01'];

async function get<T>(api: string, path: string): Promise<T> {
  const r = await fetch(`${api}/calculadora/dados-abertos${path}`);
  if (!r.ok) throw new Error(`GET ${path}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

/** Sigla da Calculadora no formato do parâmetro `siglaDfe` (`NF-e` -> `NFE`). */
export function siglaParam(sigla: string): string {
  return sigla
    .normalize('NFD')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

export async function collectData(
  api: string,
  dataset: DatasetIbsCbs,
  nom: Nomenclatures,
  opts: { seed: number; pairs: number; actors: number },
): Promise<{ pairs: ApplicabilityPair[]; actors: ActorsCase[]; lists: ListCase[] }> {
  const rnd = prng(opts.seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
  const t = dataset.tabelas;
  const pairs: ApplicabilityPair[] = [];
  for (let i = 0; i < opts.pairs; i++) {
    const kind = rnd() < 0.7 ? 'ncm' : 'nbs';
    const date = pick(DATES);
    const links = kind === 'ncm' ? t.aplicabilidadeNcm : t.aplicabilidadeNbs;
    // Metade dos pares em códigos com anexo, perto dos prefixos (e das exceções), para exercitar as bordas.
    const link = pick(links);
    const cClassTrib = rnd() < 0.8 ? link.cClassTrib : pick(t.classTrib.filter((c) => c.familia === 'CBS_IBS')).codigo;
    const all = kind === 'ncm' ? nom.ncm : nom.nbs;
    const near = [...link.excecoes.map((e) => e.prefixo), link.prefixo];
    const pref = pick(near);
    const pool = rnd() < 0.7 ? all.filter((x) => x.startsWith(pref.slice(0, Math.max(2, pref.length)))) : all;
    const code = pool.length > 0 ? pick(pool) : pick(all);
    const path =
      kind === 'ncm'
        ? `/classificacoes-tributarias/ncm-aplicavel?cClassTrib=${cClassTrib}&ncm=${code}&dataOcorrenciaFatoGerador=${date}`
        : `/classificacoes-tributarias/nbs-aplicavel?cClassTrib=${cClassTrib}&nbs=${code}&dataOcorrenciaFatoGerador=${date}`;
    const r = await fetch(`${api}/calculadora/dados-abertos${path}`);
    if (!r.ok) continue; // cClassTrib fora de vigência na data: a API responde erro, não "inválido"
    const body = (await r.json()) as { valido: boolean };
    pairs.push({ kind, cClassTrib, code, date, valid: body.valido });
  }
  const actors: ActorsCase[] = [];
  const models = [55, 65, 91, 57, 63];
  for (let i = 0; i < opts.actors; i++) {
    const date = pick(DATES);
    const ids = t.atores
      .filter((a) => a.vigencia.inicio <= date && (a.vigencia.fim ?? '9999') >= date)
      .map((a) => a.id);
    const modelo = pick(models);
    const type = t.tiposDfe.find((d) => d.modelo === modelo);
    if (!type || ids.length === 0) continue;
    const supplier = pick(ids);
    const buyer = pick(ids);
    const sigla = siglaParam(type.sigla);
    const list = await get<{ codigo: string }[]>(
      api,
      `/classificacoes-tributarias/cbs-ibs/por-atores?data=${date}&fornecedor=${supplier}&adquirente=${buyer}&siglaDfe=${sigla}`,
    );
    actors.push({ date, supplier, buyer, modelo, sigla, codes: list.map((x) => x.codigo).sort() });
  }
  const lists: ListCase[] = [];
  for (const date of DATES) {
    const ct = await get<{ codigo: string }[]>(api, `/classificacoes-tributarias/cbs-ibs?data=${date}`);
    const cst = await get<{ codigo: string }[]>(api, `/situacoes-tributarias/cbs-ibs?data=${date}`);
    lists.push({ date, classTrib: ct.map((x) => x.codigo).sort(), cst: cst.map((x) => x.codigo).sort() });
  }
  return { pairs, actors, lists };
}

/** Confronta o dataset com o que o oráculo respondeu (usado ao vivo e nos testes com as fixtures gravadas). */
export function checkData(
  dataset: DatasetIbsCbs,
  data: { pairs: readonly ApplicabilityPair[]; actors: readonly ActorsCase[]; lists: readonly ListCase[] },
): DataMismatch[] {
  const out: DataMismatch[] = [];
  for (const p of data.pairs) {
    const c = dataset.em(p.date);
    const ct = c.classTrib(p.cClassTrib);
    if (!ct) {
      out.push({
        what: `${p.kind} ${p.cClassTrib} ${p.code} ${p.date}`,
        ours: 'cClassTrib fora de vigência',
        theirs: String(p.valid),
      });
      continue;
    }
    const r = p.kind === 'ncm' ? c.ncmAplicavel(ct, p.code) : c.nbsAplicavel(ct, p.code);
    const ours = r.resultado !== 'nao';
    if (ours !== p.valid)
      out.push({ what: `${p.kind} ${p.cClassTrib} ${p.code} ${p.date}`, ours: r.resultado, theirs: String(p.valid) });
  }
  for (const a of data.actors) {
    const ours = [
      ...dataset.em(a.date).porAtores({ fornecedor: a.supplier, adquirente: a.buyer, modelo: a.modelo }),
    ].sort();
    if (ours.join(',') !== a.codes.join(',')) {
      out.push({
        what: `por-atores ${a.supplier}x${a.buyer} ${a.sigla} ${a.date}`,
        ours: ours.join(','),
        theirs: a.codes.join(','),
      });
    }
  }
  for (const l of data.lists) {
    const c = dataset.em(l.date);
    const ct = c
      .classTribs()
      .map((x) => x.codigo)
      .sort();
    const cst = dataset.tabelas.cst
      .filter((x) => x.familia === 'CBS_IBS' && x.vigencia.inicio <= l.date && (x.vigencia.fim ?? '9999') >= l.date)
      .map((x) => x.codigo)
      .sort();
    if (ct.join(',') !== l.classTrib.join(','))
      out.push({ what: `classTrib ${l.date}`, ours: ct.join(','), theirs: l.classTrib.join(',') });
    if (cst.join(',') !== l.cst.join(','))
      out.push({ what: `cst ${l.date}`, ours: cst.join(','), theirs: l.cst.join(',') });
  }
  return out;
}
