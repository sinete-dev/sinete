/**
 * Leitura das planilhas oficiais do IT 2025.002 publicadas no Portal Nacional da NF-e ("Documentos > Diversos"):
 * a tabela de CST e cClassTrib (com os indicadores que a Calculadora não tem, como `ind_RedutorBC`,
 * `ind_gTribRegular` e `ind_gpBioDiferenca`) e a tabela de crédito presumido (`cCredPres`), que não existe na
 * Calculadora.
 *
 * O parser é por nome de coluna, não por posição: o IT já trocou indicadores de tabela entre versões (v1.20, v1.30),
 * e coluna desconhecida ou ausente falha a extração em vez de deslocar dados em silêncio.
 */
import type { DataIso, Indicador, RegistroCredPres, Vigencia } from '../../../packages/ibs-cbs-dados/src/types.ts';
import { excelDate, sheetDecimal } from './lib.ts';
import { readXlsx, recordsByHeader } from './xlsx.ts';

export interface ItCst {
  readonly code: string;
  readonly description: string;
  readonly groups: Readonly<Record<string, boolean>>;
}

export interface ItClassTrib {
  readonly cst: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly lc214: string | null;
  readonly link: string | null;
  readonly rateKind: string;
  readonly pRedIBS: string;
  readonly pRedCBS: string;
  readonly indicators: Readonly<Record<string, boolean>>;
  readonly tpRBSN: number;
  readonly validity: Vigencia;
  readonly updatedAt: DataIso | null;
  readonly annex: string | null;
  /** Modelos de DF-e habilitados pelos indicadores `ind<DFe>`. */
  readonly dfe: readonly number[];
}

/** Coluna `ind<DFe>` do IT para o modelo de documento da tabela `TIPO_DFE` da Calculadora. */
export const IT_DFE_COLUMNS: Readonly<Record<string, number>> = {
  indNFeABI: 77,
  indNFe: 55,
  indNFCe: 65,
  indCTe: 57,
  indCTeOS: 67,
  indBPe: 63,
  indBPeTA: 83,
  indBPeTM: 93,
  indNF3e: 66,
  indNFSe: 91,
  'indNFSe Via': 92,
  indNFCom: 62,
  indNFAg: 75,
  indNFGas: 76,
  indDERE: 94,
  indDIR: 95,
  indDUIMP: 96,
};

const CST_GROUP_COLUMNS = [
  'ind_gIBSCBS',
  'ind_gIBSCBSMono',
  'ind_gRed',
  'ind_gDif',
  'ind_gTransfCred',
  'ind_gCredPresIBSZFM',
  'ind_gAjusteCompet',
  'ind_RedutorBC',
] as const;

const CLASS_INDICATOR_COLUMNS = [
  'ind_gTribRegular',
  'ind_gCredPresOper',
  'ind_gMonoPadrao',
  'ind_gMonoReten',
  'ind_gMonoRet',
  'ind_gpBioDiferenca',
  'ind_gEstornoCred',
] as const;

const CLASS_COLUMNS = [
  'CST-IBS/CBS',
  'Descrição CST-IBS/CBS',
  'cClassTrib',
  'Nome cClassTrib',
  'Descrição cClassTrib',
  'LC Redação',
  'LC 214/25',
  'Regulamento CBS',
  'Regulamento IBS',
  'Tipo de Alíquota',
  'pRedIBS',
  'pRedCBS',
  ...CLASS_INDICATOR_COLUMNS,
  'tpRBSN',
  'tpDoacao',
  'dIniVig',
  'dFimVig',
  'DataAtualização',
  ...Object.keys(IT_DFE_COLUMNS),
  'ANEXO',
  'Link',
];

function flag(v: string | undefined, where: string): boolean {
  if (v === undefined || v === '' || v === '0') return false;
  if (v === '1') return true;
  throw new Error(`${where}: indicador fora de 0/1: ${JSON.stringify(v)}`);
}

function checkColumns(found: readonly string[], expected: readonly string[], where: string): void {
  const unknown = found.filter((c) => !expected.includes(c));
  const missing = expected.filter((c) => !found.includes(c));
  if (unknown.length || missing.length) {
    throw new Error(
      `${where}: colunas mudaram (novas: ${unknown.join(', ') || '-'}; ausentes: ${missing.join(', ') || '-'}); revise o parser`,
    );
  }
}

/** Nome da coluna normalizado: o IT tem `ind_ gCredPresIBSZFM` com espaço. */
const norm = (s: string): string => s.replace(/_\s+/g, '_').replace(/\s+/g, ' ').trim();

function normalizeRecords(recs: Record<string, string>[]): Record<string, string>[] {
  return recs.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [norm(k), v])));
}

export async function readItClassTrib(file: string): Promise<{ cst: ItCst[]; classTrib: ItClassTrib[] }> {
  const sheets = await readXlsx(file);
  const cstSheet = sheets.find((s) => s.name.startsWith('CST'));
  const classSheet = sheets.find((s) => s.name.startsWith('cClass'));
  if (!cstSheet || !classSheet) throw new Error(`${file}: planilhas CST e cClass não encontradas`);

  const cstHeaderRow = cstSheet.rows.find((r) => Object.values(r)[0]?.trim() === 'CST-IBS/CBS');
  if (!cstHeaderRow) throw new Error(`${file}: cabeçalho da CST não encontrado`);
  checkColumns(
    Object.values(cstHeaderRow).map(norm),
    ['CST-IBS/CBS', 'Descrição CST-IBS/CBS', ...CST_GROUP_COLUMNS],
    `${file} (CST)`,
  );
  const cstRecs = normalizeRecords(recordsByHeader(cstSheet, 'CST-IBS/CBS')).filter((r) =>
    /^\d{3}$/.test(r['CST-IBS/CBS'] ?? ''),
  );
  const cst: ItCst[] = cstRecs.map((r) => ({
    code: r['CST-IBS/CBS'] ?? '',
    description: r['Descrição CST-IBS/CBS'] ?? '',
    groups: Object.fromEntries(CST_GROUP_COLUMNS.map((c) => [c, flag(r[c], `CST ${r['CST-IBS/CBS']} ${c}`)])),
  }));

  const headerRow = classSheet.rows.find((r) => Object.values(r)[0]?.trim() === 'CST-IBS/CBS');
  if (!headerRow) throw new Error(`${file}: cabeçalho da cClass não encontrado`);
  checkColumns(Object.values(headerRow).map(norm), CLASS_COLUMNS, `${file} (cClass)`);
  const classRecs = normalizeRecords(recordsByHeader(classSheet, 'CST-IBS/CBS')).filter((r) =>
    /^\d{6}$/.test(r.cClassTrib ?? ''),
  );
  const classTrib: ItClassTrib[] = classRecs.map((r) => {
    const code = r.cClassTrib ?? '';
    const where = `cClassTrib ${code}`;
    const from = excelDate(r.dIniVig);
    if (!from) throw new Error(`${where}: sem dIniVig`);
    return {
      cst: r['CST-IBS/CBS'] ?? '',
      code,
      name: r['Nome cClassTrib'] ?? '',
      description: r['Descrição cClassTrib'] ?? '',
      lc214: r['LC 214/25'] ?? null,
      link: r.Link ?? null,
      rateKind: r['Tipo de Alíquota'] ?? '',
      pRedIBS: sheetDecimal(r.pRedIBS) ?? '0',
      pRedCBS: sheetDecimal(r.pRedCBS) ?? '0',
      indicators: Object.fromEntries(CLASS_INDICATOR_COLUMNS.map((c) => [c, flag(r[c], `${where} ${c}`)])),
      tpRBSN: Number(r.tpRBSN ?? '0'),
      validity: { inicio: from, fim: excelDate(r.dFimVig) },
      updatedAt: excelDate(r.DataAtualização),
      annex: r.ANEXO ?? null,
      dfe: Object.entries(IT_DFE_COLUMNS)
        .filter(([col]) => flag(r[col], `${where} ${col}`))
        .map(([, modelo]) => modelo)
        .sort((a, b) => a - b),
    };
  });
  return { cst, classTrib };
}

const CRED_COLUMNS = [
  'cCredPres',
  'Descrição',
  'LC 214/2025',
  'Apropria via NF?',
  'Apropria via evento?',
  'indDeduzCredPres',
  'ind_gCBSCredPres',
  'ind_gIBSCredPres',
  'Alíquota CBS',
  'Alíquota IBS',
  'pAliqCredPresCBS',
  'pAliqCredPresIBS',
  'pRedTransicaoIBS',
  'cClassTrib nota referenciada',
  'dIniVigCBS',
  'dFimVigCBS',
  'dIniVigIBS',
  'dFimVigIBS',
  'indDecPag',
  'indNFe',
  'indNFCe',
  'indCTe',
  'indNFSe',
];
const CALC_COLUMNS = ['cCredPres', 'LC 214/2025', 'pAliq', 'vBC_CredPres', 'vCred Pres', 'Impedimento de CredPres'];

/** Célula que pode ser número (double da planilha) ou orientação em texto. */
function numberOrText(v: string | undefined): string | null {
  if (v === undefined || v === '') return null;
  if (/^-?\d+(\.\d+)?(E-?\d+)?$/i.test(v)) {
    // Percentual guardado como fração (0.07 = 7%): converter para percentual, como no leiaute.
    const pct = sheetDecimal(String(Number(v) * 100), 4);
    return pct;
  }
  return v;
}

function validityOf(from: string | undefined, to: string | undefined): Vigencia | null {
  const f = excelDate(from);
  return f ? { inicio: f, fim: excelDate(to) } : null;
}

export async function readItCredPres(file: string, sourceId: string): Promise<RegistroCredPres[]> {
  const sheets = await readXlsx(file);
  const main = sheets.find((s) => s.name === 'cCredPres');
  // A planilha de cálculo não tem nome fixo ("Planilha2"); desde a v1.70 há também a de domínio do `indDecPag`.
  const calc = sheets.find((s) => s.name !== 'cCredPres' && s.rows.some((r) => Object.values(r)[0] === 'cCredPres'));
  if (!main || !calc) throw new Error(`${file}: planilhas cCredPres e de cálculo não encontradas`);
  const mainHeader = main.rows.find((r) => Object.values(r)[0] === 'cCredPres');
  const calcHeader = calc.rows.find((r) => Object.values(r)[0] === 'cCredPres');
  if (!mainHeader || !calcHeader) throw new Error(`${file}: cabeçalhos não encontrados`);
  checkColumns(Object.values(mainHeader).map(norm), CRED_COLUMNS, `${file} (cCredPres)`);
  checkColumns(Object.values(calcHeader).map(norm), CALC_COLUMNS, `${file} (cálculo)`);
  const calcByCode = new Map(
    normalizeRecords(recordsByHeader(calc, 'cCredPres')).map((r) => [r.cCredPres ?? '', r] as const),
  );
  const ind = (v: string | undefined, where: string): Indicador => (flag(v, where) ? 'obrigatorio' : 'vedado');
  return normalizeRecords(recordsByHeader(main, 'cCredPres'))
    .filter((r) => /^\d+$/.test(r.cCredPres ?? ''))
    .map((r): RegistroCredPres => {
      const code = Number(r.cCredPres);
      const where = `cCredPres ${code}`;
      const c = calcByCode.get(String(code));
      return {
        chave: String(code).padStart(2, '0'),
        codigo: code,
        descricao: r.Descrição ?? '',
        legal: r['LC 214/2025'] ?? '',
        viaDocumento: flag(r['Apropria via NF?'], `${where} via NF`),
        viaEvento: flag(r['Apropria via evento?'], `${where} via evento`),
        deduzDoTributo: flag(r.indDeduzCredPres, `${where} indDeduzCredPres`),
        grupos: {
          gCBSCredPres: ind(r.ind_gCBSCredPres, `${where} ind_gCBSCredPres`),
          gIBSCredPres: ind(r.ind_gIBSCredPres, `${where} ind_gIBSCredPres`),
        },
        aliquotas: {
          cbs: r['Alíquota CBS'] ?? null,
          ibs: r['Alíquota IBS'] ?? null,
          pAliqCredPresCBS: numberOrText(r.pAliqCredPresCBS),
          pAliqCredPresIBS: numberOrText(r.pAliqCredPresIBS),
          pRedTransicaoIBS: numberOrText(r.pRedTransicaoIBS),
        },
        classTribReferenciado: r['cClassTrib nota referenciada'] ?? null,
        vigencia: {
          cbs: validityOf(r.dIniVigCBS, r.dFimVigCBS),
          ibs: validityOf(r.dIniVigIBS, r.dFimVigIBS),
        },
        calculo: {
          pAliq: c?.pAliq ?? null,
          base: c?.vBC_CredPres ?? null,
          formula: c?.['vCred Pres'] ?? null,
          impedimento: c?.['Impedimento de CredPres'] ?? null,
        },
        fontes: [sourceId],
      };
    });
}
