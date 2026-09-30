/**
 * Carga do dataset e visão numa data de fato gerador (`ConteudoTributario`).
 *
 * `carregarDataset` aceita qualquer `BundleDoDataset`: o embarcado neste pacote (`@sinete/ibs-cbs-dados/bundled`) ou um obtido em
 * runtime de outra origem (arquivo, URL), o que permite atualizar dados sem atualizar código enquanto o
 * `versaoDoFormato` for compatível. `conferirDataset` confere os hashes do manifesto antes de confiar num bundle externo.
 */
import type { ResultadoAplicabilidade } from './applicability.ts';
import { aplicabilidade } from './applicability.ts';
import { tabelaCanonica } from './canonical.ts';
import { exigirDataIso, vigente } from './dates.ts';
import { ErroDadosIbsCbs } from './errors.ts';
import type {
  BundleDoDataset,
  DataIso,
  Dec,
  Familia,
  ManifestoDoDataset,
  NomeDaTabela,
  RegistroAnexo,
  RegistroAplicabilidade,
  RegistroAtor,
  RegistroClassTrib,
  RegistroCredPres,
  RegistroCst,
  RegistroNfseNbs,
  RegistroTipoDfe,
  RegistroTratamento,
  TabelasDoDataset,
  Tributo,
} from './types.ts';

/** Versão do formato que este código lê. Bundle com versão maior é recusado. */
export const VERSAO_DO_FORMATO_DOS_DADOS = 2;

export const NOMES_DAS_TABELAS: readonly NomeDaTabela[] = [
  'cst',
  'classTrib',
  'tratamentos',
  'credPres',
  'aplicabilidadeNcm',
  'aplicabilidadeNbs',
  'anexos',
  'nfseNbs',
  'gruposDeAtores',
  'atores',
  'atorClassTrib',
  'tiposDfe',
  'redutorCompraGov',
  'transferenciaCbs',
];

/** Crédito presumido vigente na data, por tributo. */
export interface CredPresVigente {
  readonly registro: RegistroCredPres;
  readonly cbs: boolean;
  readonly ibs: boolean;
}

/** Filtro de `classTribs`. */
export interface FiltroClassTrib {
  readonly familia?: Familia;
  readonly cst?: string;
  /** Modelo de DF-e (`55`, `65`, `91`...) em que o código precisa estar habilitado na data. */
  readonly modelo?: number;
}

/** Atores de uma operação, pelos ids da tabela de atores; `undefined` não restringe o papel. */
export interface FiltroDeAtores {
  readonly fornecedor?: number;
  readonly adquirente?: number;
  readonly modelo?: number;
}

/** O dataset visto numa data de fato gerador: só registros vigentes nela. */
export interface ConteudoTributario {
  readonly dataDeReferencia: DataIso;
  readonly dataset: DatasetIbsCbs;
  cst(codigo: string, familia?: Familia): RegistroCst | undefined;
  classTrib(codigo: string, familia?: Familia): RegistroClassTrib | undefined;
  classTribs(filtro?: FiltroClassTrib): readonly RegistroClassTrib[];
  /** CST do cClassTrib na data. */
  cstDe(classTrib: RegistroClassTrib): RegistroCst | undefined;
  tratamento(classTrib: RegistroClassTrib): RegistroTratamento | undefined;
  /** Percentual de redução vigente para o tributo (`'60'`), ou `undefined` sem redução. */
  reducao(classTrib: RegistroClassTrib, tributo: Tributo): Dec | undefined;
  aliquotaFixa(classTrib: RegistroClassTrib, tributo: Tributo): Dec | undefined;
  /** O cClassTrib está habilitado no modelo de DF-e na data. */
  permitidoEm(classTrib: RegistroClassTrib, modelo: number): boolean;
  credPres(codigo: number): CredPresVigente | undefined;
  ncmAplicavel(classTrib: RegistroClassTrib, ncm: string): ResultadoAplicabilidade;
  nbsAplicavel(classTrib: RegistroClassTrib, nbs: string): ResultadoAplicabilidade;
  /**
   * cClassTrib (família IBS/CBS) admitidos para o par de atores, com a regra da Calculadora: código sem vínculo vigente
   * de ator num papel admite qualquer ator nesse papel; filtros compõem um E lógico.
   */
  porAtores(filtro: FiltroDeAtores): readonly string[];
  ator(id: number): RegistroAtor | undefined;
  nfseNbs(nbs: string): readonly RegistroNfseNbs[];
  anexo(item: string): RegistroAnexo | undefined;
  tipoDfe(modelo: number): RegistroTipoDfe | undefined;
  /** Redutor de compras governamentais em percentual (arts. 370 e 472 da LC 214/2025). */
  redutorCompraGov(): Dec | undefined;
  /** Percentual da CBS transferido ao ente contratante na compra governamental. */
  percentualTransferenciaCbs(): Dec | undefined;
}

export interface DatasetIbsCbs {
  readonly manifesto: ManifestoDoDataset;
  readonly tabelas: TabelasDoDataset;
  /**
   * Identificador curto do conteúdo, para proveniência: `AAAA.MM+<versões oficiais>#<sha256 do dataset, 12>`. Vai junto
   * de toda determinação e de todo cálculo, para reprocessar um documento com os dados da época.
   */
  readonly versaoDoConteudo: string;
  /** Visão na data de fato gerador (`AAAA-MM-DD`). */
  em(data: DataIso): ConteudoTributario;
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

function checkShape(bundle: unknown): asserts bundle is BundleDoDataset {
  const b = bundle as Partial<BundleDoDataset> | null;
  if (!b || typeof b !== 'object' || !b.manifesto || !b.tabelas) {
    throw new ErroDadosIbsCbs('ibscbs_dados_invalidos', 'bundle sem manifesto ou tabelas');
  }
  const v = b.manifesto.versaoDoFormato;
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new ErroDadosIbsCbs('ibscbs_dados_invalidos', 'manifesto sem versaoDoFormato inteiro');
  }
  if (v !== VERSAO_DO_FORMATO_DOS_DADOS) {
    throw new ErroDadosIbsCbs(
      'ibscbs_dados_versao_incompativel',
      `versaoDoFormato ${v} não suportado; este código lê a versão ${VERSAO_DO_FORMATO_DOS_DADOS}`,
      { detalhes: { versaoDoFormato: v, suportada: VERSAO_DO_FORMATO_DOS_DADOS } },
    );
  }
  for (const name of NOMES_DAS_TABELAS) {
    if (!Array.isArray((b.tabelas as unknown as Record<string, unknown>)[name])) {
      throw new ErroDadosIbsCbs('ibscbs_dados_invalidos', `tabela ${name} ausente no bundle`, {
        detalhes: { tabela: name },
      });
    }
  }
}

/** Identificador curto do conteúdo (ver `DatasetIbsCbs.versaoDoConteudo`). */
export function versaoDoConteudo(manifesto: ManifestoDoDataset): string {
  const versions = manifesto.fontes.map((s) => s.versao).join('+');
  return `${manifesto.versaoDosDados}+${versions}#${manifesto.sha256DoDataset.slice(0, 12)}`;
}

export function carregarDataset(bundle: BundleDoDataset): DatasetIbsCbs {
  checkShape(bundle);
  const { manifesto: manifest, tabelas: tables } = bundle;
  const famCode = (x: { familia: Familia; codigo: string }): string => `${x.familia}:${x.codigo}`;
  const cstByCode = group(tables.cst, famCode);
  const classByCode = group(tables.classTrib, famCode);
  const classByKey = new Map(tables.classTrib.map((c) => [c.chave, c]));
  const treatmentById = new Map(tables.tratamentos.map((t) => [t.id, t]));
  const credByCode = new Map(tables.credPres.map((c) => [c.codigo, c]));
  const ncmByClass = group(tables.aplicabilidadeNcm, (a) => a.chaveClassTrib);
  const nbsByClass = group(tables.aplicabilidadeNbs, (a) => a.chaveClassTrib);
  const nfseByNbs = group(tables.nfseNbs, (n) => n.nbs);
  const actorLinks = group(tables.atorClassTrib, (a) => `${a.chaveClassTrib}:${a.papel}`);
  const annexByItem = group(tables.anexos, (a) => (a.item ? `${a.anexo}/${a.item}` : a.anexo));
  const views = new Map<DataIso, ConteudoTributario>();

  const dataset: DatasetIbsCbs = {
    manifesto: manifest,
    tabelas: tables,
    versaoDoConteudo: versaoDoConteudo(manifest),
    em(date: DataIso): ConteudoTributario {
      const d = exigirDataIso(date, 'data do fato gerador');
      let view = views.get(d);
      if (!view) {
        view = makeView(d);
        views.set(d, view);
      }
      return view;
    },
  };

  function pick<T extends { vigencia: { inicio: DataIso; fim: DataIso | null } }>(
    xs: readonly T[] | undefined,
    d: DataIso,
  ): T | undefined {
    return xs?.find((x) => vigente(x.vigencia, d));
  }

  function makeView(d: DataIso): ConteudoTributario {
    const vinculosVigentes = (xs: readonly RegistroAplicabilidade[] | undefined): readonly RegistroAplicabilidade[] =>
      xs ?? [];
    const admits = (classKey: string, role: 'Fornecedor' | 'Adquirente', actor: number | undefined): boolean => {
      if (actor === undefined) return true;
      const links = (actorLinks.get(`${classKey}:${role}`) ?? []).filter((l) => vigente(l.vigencia, d));
      return links.length === 0 || links.some((l) => l.ator === actor);
    };
    const view: ConteudoTributario = {
      dataDeReferencia: d,
      dataset,
      cst: (code: string, family: Familia = 'CBS_IBS'): RegistroCst | undefined =>
        pick(cstByCode.get(`${family}:${code}`), d),
      classTrib: (code: string, family: Familia = 'CBS_IBS'): RegistroClassTrib | undefined =>
        pick(classByCode.get(`${family}:${code}`), d),
      classTribs(filter: FiltroClassTrib = {}): readonly RegistroClassTrib[] {
        const family = filter.familia ?? 'CBS_IBS';
        return tables.classTrib.filter(
          (c) =>
            c.familia === family &&
            vigente(c.vigencia, d) &&
            (filter.cst === undefined || c.cst === filter.cst) &&
            (filter.modelo === undefined || view.permitidoEm(c, filter.modelo)),
        );
      },
      cstDe: (c: RegistroClassTrib): RegistroCst | undefined => view.cst(c.cst, c.familia),
      tratamento(c: RegistroClassTrib): RegistroTratamento | undefined {
        const link = pick(c.tratamentos, d);
        return link ? treatmentById.get(link.tratamento) : undefined;
      },
      reducao: (c: RegistroClassTrib, tributo: Tributo): Dec | undefined =>
        c.reducoes.find((r) => r.tributo === tributo && vigente(r.vigencia, d))?.pRed,
      aliquotaFixa: (c: RegistroClassTrib, tributo: Tributo): Dec | undefined =>
        c.aliquotasFixas.find((r) => r.tributo === tributo && vigente(r.vigencia, d))?.aliquota,
      permitidoEm: (c: RegistroClassTrib, modelo: number): boolean =>
        c.dfe.some((x) => x.modelo === modelo && vigente(x.vigencia, d)),
      credPres(code: number): CredPresVigente | undefined {
        const record = credByCode.get(code);
        if (!record) return undefined;
        const cbs = record.vigencia.cbs !== null && vigente(record.vigencia.cbs, d);
        const ibs = record.vigencia.ibs !== null && vigente(record.vigencia.ibs, d);
        return { registro: record, cbs, ibs };
      },
      ncmAplicavel: (c: RegistroClassTrib, ncm: string): ResultadoAplicabilidade =>
        aplicabilidade(vinculosVigentes(ncmByClass.get(c.chave)), ncm, d, 8),
      nbsAplicavel: (c: RegistroClassTrib, nbs: string): ResultadoAplicabilidade =>
        aplicabilidade(vinculosVigentes(nbsByClass.get(c.chave)), nbs, d, 9),
      porAtores(filter: FiltroDeAtores): readonly string[] {
        return view
          .classTribs(filter.modelo === undefined ? {} : { modelo: filter.modelo })
          .filter(
            (c) => admits(c.chave, 'Fornecedor', filter.fornecedor) && admits(c.chave, 'Adquirente', filter.adquirente),
          )
          .map((c) => c.codigo);
      },
      ator: (id: number): RegistroAtor | undefined => tables.atores.find((a) => a.id === id && vigente(a.vigencia, d)),
      nfseNbs: (nbs: string): readonly RegistroNfseNbs[] =>
        (nfseByNbs.get(nbs) ?? []).filter((n) => vigente(n.vigencia, d)),
      anexo: (item: string): RegistroAnexo | undefined => pick(annexByItem.get(item), d),
      tipoDfe: (modelo: number): RegistroTipoDfe | undefined =>
        tables.tiposDfe.find((t) => t.modelo === modelo && vigente(t.vigencia, d)),
      redutorCompraGov: (): Dec | undefined => pick(tables.redutorCompraGov, d)?.pRedutor,
      percentualTransferenciaCbs: (): Dec | undefined => pick(tables.transferenciaCbs, d)?.percentual,
    };
    return view;
  }

  // Integridade referencial mínima: todo vínculo aponta para um cClassTrib do dataset.
  for (const name of ['aplicabilidadeNcm', 'aplicabilidadeNbs', 'nfseNbs', 'atorClassTrib'] as const) {
    for (const r of tables[name]) {
      if (!classByKey.has(r.chaveClassTrib)) {
        throw new ErroDadosIbsCbs('ibscbs_dados_invalidos', `${name}: ${r.chave} aponta para cClassTrib inexistente`, {
          detalhes: { tabela: name, chave: r.chave },
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
 * Confere cada tabela contra o sha256 do manifesto e o `sha256DoDataset`. Use antes de `carregarDataset` num bundle obtido
 * fora do pacote. Lança `ErroDadosIbsCbs` (`ibscbs_dados_invalidos`) na primeira divergência.
 */
export async function conferirDataset(bundle: BundleDoDataset): Promise<void> {
  checkShape(bundle);
  // O manifest precisa cobrir cada tabela exatamente uma vez: tabela fora dele não teria hash conferido.
  const names = bundle.manifesto.tabelas.map((t) => t.nome);
  const missing = NOMES_DAS_TABELAS.filter((n) => !names.includes(n));
  const extra = names.filter((n, i) => !NOMES_DAS_TABELAS.includes(n) || names.indexOf(n) !== i);
  if (missing.length > 0 || extra.length > 0) {
    throw new ErroDadosIbsCbs(
      'ibscbs_dados_invalidos',
      'manifesto não lista cada tabela do dataset exatamente uma vez',
      {
        detalhes: { ausentes: missing, sobrando: extra },
      },
    );
  }
  const lines: string[] = [];
  for (const t of bundle.manifesto.tabelas) {
    const records = (bundle.tabelas as unknown as Record<string, readonly unknown[] | undefined>)[t.nome];
    if (!records)
      throw new ErroDadosIbsCbs('ibscbs_dados_invalidos', `tabela ${t.nome} do manifesto ausente no bundle`);
    const got = await sha256Hex(tabelaCanonica(records));
    if (got !== t.sha256 || records.length !== t.registros) {
      throw new ErroDadosIbsCbs('ibscbs_dados_invalidos', `tabela ${t.nome} não confere com o manifesto`, {
        detalhes: { tabela: t.nome, esperado: t.sha256, obtido: got },
      });
    }
    lines.push(`${t.sha256}  ${t.nome}`);
  }
  const all = await sha256Hex(lines.join('\n'));
  if (all !== bundle.manifesto.sha256DoDataset) {
    throw new ErroDadosIbsCbs('ibscbs_dados_invalidos', 'sha256DoDataset não confere com as tabelas', {
      detalhes: { esperado: bundle.manifesto.sha256DoDataset, obtido: all },
    });
  }
}
