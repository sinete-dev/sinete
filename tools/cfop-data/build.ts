/**
 * Gera `packages/validators/src/data/cfop.json` a partir da planilha oficial da Tabela de CFOP do Portal da NF-e
 * (`sources.json`): código, vigência e os indicadores que as regras de validação consultam (indNFe, indComunica,
 * indTransp, indDevol, indRetor, indAnula, indRemes, indComb, indExcIBSCBS). A descrição do CFOP não vai para o pacote.
 *
 *   bun tools/cfop-data/build.ts --xlsx <arquivo>            # grava o JSON
 *   bun tools/cfop-data/build.ts --xlsx <arquivo> --check    # só confere se o JSON versionado é o gerado
 */
import path from 'node:path';
import { $ } from 'bun';
import { readXlsx } from '../ibs-cbs-dados/src/xlsx.ts';

const here = import.meta.dir;
const out = path.resolve(here, '../../packages/validators/src/data/cfop.json');
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const xlsx = arg('--xlsx');
if (xlsx === undefined) {
  console.error('uso: bun tools/cfop-data/build.ts --xlsx <arquivo> [--check]');
  process.exit(2);
}
const fonte = (await Bun.file(path.join(here, 'sources.json')).json()) as {
  titulo: string;
  url: string;
  arquivo: string;
  sha256: string;
  coletadoEm: string;
};
const bytes = new Uint8Array(await Bun.file(xlsx).arrayBuffer());
const sha = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
if (sha !== fonte.sha256) {
  console.error(`cfop-data: ${xlsx} com sha256 ${sha}, esperado ${fonte.sha256}`);
  process.exit(1);
}

export const INDICADORES = [
  'indNFe',
  'indComunica',
  'indTransp',
  'indDevol',
  'indRetor',
  'indAnula',
  'indRemes',
  'indComb',
  'indExcIBSCBS',
] as const;

/** Data serial do Excel (dias desde 1899-12-30) em `AAAA-MM-DD`. */
const dataExcel = (v: string | undefined): string | undefined => {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`data fora do formato: ${v}`);
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86_400_000).toISOString().slice(0, 10);
};

const sheets = await readXlsx(xlsx);
const sheet = sheets.find((s) => s.name === 'CFOP');
if (sheet === undefined) throw new Error('planilha sem a aba CFOP');
const header = sheet.rows[0] ?? {};
const coluna = (nome: string): string => {
  const c = Object.entries(header).find(([, v]) => v.trim() === nome)?.[0];
  if (c === undefined) throw new Error(`coluna ${nome} não encontrada`);
  return c;
};
const cCfop = coluna('CFOP');
const cInicio = coluna('Início de vigência');
const cFim = coluna('Fim de vigência');
const cInd = INDICADORES.map((i) => coluna(i));

const cfop: Record<string, [string, string | null, string]> = {};
for (const r of sheet.rows.slice(1)) {
  const codigo = r[cCfop]?.trim();
  if (codigo === undefined) continue;
  if (!/^[1-7]\d{3}$/.test(codigo)) throw new Error(`CFOP fora do formato: ${codigo}`);
  if (cfop[codigo] !== undefined) throw new Error(`CFOP repetido: ${codigo}`);
  const inicio = dataExcel(r[cInicio]);
  if (inicio === undefined) throw new Error(`CFOP ${codigo} sem início de vigência`);
  const ind = cInd
    .map((c, k) => {
      const v = (r[c] ?? '').trim();
      if (!/^\d$/.test(v)) throw new Error(`CFOP ${codigo}: ${INDICADORES[k]} = ${v}`);
      return v;
    })
    .join('');
  cfop[codigo] = [inicio, dataExcel(r[cFim]) ?? null, ind];
}

const bruto = `${JSON.stringify(
  {
    versaoDoFormato: 1,
    versao: fonte.coletadoEm.replace(/-/g, '.'),
    fontes: [{ titulo: fonte.titulo, url: fonte.url, coletadoEm: fonte.coletadoEm }],
    sha256: fonte.sha256,
    geradoPor: 'tools/cfop-data/build.ts',
    notas:
      'Por CFOP: [início de vigência, fim de vigência ou null, indicadores na ordem de `indicadores`, um algarismo cada, como na planilha (0 ou 1; o indComb também tem 2)]. A descrição do CFOP fica na planilha oficial.',
    indicadores: INDICADORES,
    cfop,
  },
  null,
  2,
)}\n`;

// Na forma do Biome, a mesma que o `bun run check` exige do arquivo versionado.
const json = await $`bunx biome format --stdin-file-path=${out} < ${new Response(bruto)}`
  .cwd(path.resolve(here, '../..'))
  .text();

if (process.argv.includes('--check')) {
  const atual = await Bun.file(out).text();
  if (atual !== json) {
    console.error('cfop-data: o JSON versionado não é o gerado; rode sem --check');
    process.exit(1);
  }
  console.log('cfop-data: ok');
} else {
  await Bun.write(out, json);
  console.log(`cfop-data: ${Object.keys(cfop).length} CFOP gravados em ${path.relative(process.cwd(), out)}`);
}
