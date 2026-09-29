#!/usr/bin/env bun
/**
 * Extrator reprodutível do `@sinete/ibs-cbs-dados` e do `@sinete/ibs-cbs/aliquotas` (ADR 0007).
 *
 * Fluxo:
 *   1. obtém o `calculadora.zip` oficial (URL de `sources.json`, cache local ou `--calculadora-zip`) e confere o sha256
 *      do zip, do `calculadora.tar.gz`, do `codigo-fonte-backend.zip` e do SQLite embarcado; com `--verify-layer`,
 *      também o `diff_id` da camada (o sha256 do tar descomprimido, que amarra o dataset ao contêiner do oráculo);
 *   2. extrai as tabelas do SQLite embarcado e, pelo segundo caminho, de um SQLite reconstruído das migrações Flyway
 *      do mesmo zip; os dois precisam dar as mesmas tabelas, byte a byte (`--skip-flyway` pula, só para desenvolvimento);
 *   3. lê as planilhas oficiais do IT 2025.002 (cClassTrib e cCredPres) e do IT 2026.002 (alíquotas da CBS), também
 *      por hash, junta com a Calculadora e confronta as divergências com `conflicts.json`;
 *   4. grava `packages/ibs-cbs-dados/src/data/*.json` + `manifest.json` e `packages/ibs-cbs/src/aliquotas/data/rates.json`, em JSON
 *      canônico; com `--check`, não grava e falha se o resultado diferir do versionado.
 *
 * Requer `unzip`, `tar`, `gunzip`, `shasum` e `sqlite3` no PATH.
 *
 * Uso:
 *   bun tools/ibs-cbs-dados/extract.ts [--check] [--verify-layer] [--skip-flyway] [--cache dir]
 *     [--calculadora-zip calculadora.zip] [--it-classtrib x.xlsx] [--it-credpres x.xlsx] [--it-aliquotas-cbs x.xlsx]
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { $ } from 'bun';
import type { DataSource, DatasetManifest, DatasetTables, TableName } from '../../packages/ibs-cbs-dados/src/types.ts';
import type { CalculadoraPin } from './src/artifact.ts';
import { layerDiffId, rebuildFromFlyway, unpackCalculadora } from './src/artifact.ts';
import type { CalcTables } from './src/calculadora.ts';
import { extractCalculadora } from './src/calculadora.ts';
import { defaultCacheDir, ensureFile } from './src/fetch.ts';
import { readItClassTrib, readItCredPres } from './src/it.ts';
import { canonicalPretty, canonicalTable, sha256 } from './src/lib.ts';
import type { LedgerEntry } from './src/merge.ts';
import { merge, reconcile } from './src/merge.ts';
import { readXlsx } from './src/xlsx.ts';

const here = import.meta.dir;
const root = path.resolve(here, '../..');
const dataDir = path.join(root, 'packages/ibs-cbs-dados/src/data');
const ratesFile = path.join(root, 'packages/ibs-cbs/src/aliquotas/data/rates.json');

const { values: args } = parseArgs({
  options: {
    check: { type: 'boolean', default: false },
    'verify-layer': { type: 'boolean', default: false },
    'skip-flyway': { type: 'boolean', default: false },
    cache: { type: 'string' },
    'calculadora-zip': { type: 'string' },
    'it-classtrib': { type: 'string' },
    'it-credpres': { type: 'string' },
    'it-aliquotas-cbs': { type: 'string' },
  },
});

interface ItPin {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly date: string;
  readonly url: string;
  readonly filename: string;
  readonly sha256: string;
}
interface Sources {
  readonly calculadora: CalculadoraPin;
  readonly it: { readonly classTrib: ItPin; readonly credPres: ItPin; readonly aliquotasCbs: ItPin };
}
interface CuratedRate {
  readonly tributo: string;
  readonly validity: { readonly from: string; readonly to: string | null };
  readonly status: 'official' | 'unknown';
  readonly rate: string | null;
  readonly legal: string;
  readonly note?: string;
  readonly sources: readonly string[];
}
interface CuratedRates {
  readonly legalSources: readonly { id: string; title: string; url: string }[];
  readonly reference: readonly CuratedRate[];
}

const log = (msg: string): void => console.error(`ibs-cbs-dados: ${msg}`);
const fail = (msg: string): never => {
  console.error(`ibs-cbs-dados: FALHOU: ${msg}`);
  process.exit(1);
};

const sources = (await Bun.file(path.join(here, 'sources.json')).json()) as Sources;
const ledger = ((await Bun.file(path.join(here, 'conflicts.json')).json()) as { entries: LedgerEntry[] }).entries;
const curatedRates = (await Bun.file(path.join(here, 'rates.json')).json()) as CuratedRates;
const cacheDir = args.cache ?? defaultCacheDir();
const pin = sources.calculadora;

// 1. artefato da Calculadora
const zip = await ensureFile({
  url: pin.url,
  sha256: pin.zipSha256,
  name: 'calculadora.zip',
  cacheDir,
  local: args['calculadora-zip'],
  log,
});
const unpacked = await unpackCalculadora(zip, pin, cacheDir);
if (args['verify-layer']) {
  const diffId = await layerDiffId(unpacked.tarGz);
  if (diffId !== pin.dockerLayerDiffId) fail(`diff_id da camada ${diffId} difere do fixado ${pin.dockerLayerDiffId}`);
  log(`diff_id da camada confere (${diffId.slice(0, 19)}...)`);
}

// 2. dois caminhos
const shipped = extractCalculadora(unpacked.db);
if (shipped.versao.versaoDb !== pin.versao.versaoDb) {
  fail(`SQLite embarcado é ${shipped.versao.versaoDb}, sources.json fixa ${pin.versao.versaoDb}`);
}
const tableBytes = (t: CalcTables): Record<string, string> =>
  Object.fromEntries(
    Object.entries(t)
      .filter(([k]) => k !== 'versao')
      .map(([k, v]) => [k, canonicalTable(v as unknown[])]),
  );
if (!args['skip-flyway']) {
  const rebuiltDb = await rebuildFromFlyway(unpacked.sourceZip, pin.versao.versaoDb, cacheDir);
  const rebuilt = extractCalculadora(rebuiltDb);
  const a = tableBytes(shipped);
  const b = tableBytes(rebuilt);
  const differ = Object.keys(a).filter((k) => a[k] !== b[k]);
  if (differ.length) fail(`SQLite embarcado e reconstruído das migrações divergem em: ${differ.join(', ')}`);
  log(`SQLite embarcado e reconstruído das migrações (${pin.versao.versaoDb}) dão as mesmas tabelas`);
} else {
  log('AVISO: caminho Flyway pulado (--skip-flyway); não use para gerar o dataset versionado');
}

// 3. IT
const it = sources.it;
const itFile = (p: ItPin, local: string | undefined): Promise<string> =>
  ensureFile({ url: p.url, sha256: p.sha256, name: p.filename.replace(/\s+/g, '_'), cacheDir, local, log });
const itClass = await readItClassTrib(await itFile(it.classTrib, args['it-classtrib']));
const credPres = await readItCredPres(await itFile(it.credPres, args['it-credpres']), it.credPres.id);
const merged = merge(shipped, itClass, { calculadora: pin.id, it: it.classTrib.id }, it.classTrib.date);
const { unexpected, stale } = reconcile(merged.conflicts, ledger);
if (unexpected.length || stale.length) {
  for (const c of unexpected) {
    console.error(`  novo conflito ${c.id}: calculadora=${JSON.stringify(c.calculadora)} it=${JSON.stringify(c.it)}`);
  }
  for (const l of stale) console.error(`  entrada do ledger que não aconteceu mais: ${l.id}`);
  fail(`${unexpected.length} conflito(s) IT x Calculadora fora do ledger, ${stale.length} entrada(s) velha(s)`);
}
log(`IT x Calculadora: ${merged.conflicts.length} divergência(s), todas revisadas em conflicts.json`);

// Alíquotas: as de 2026 da Calculadora precisam bater com as curadas; a da CBS também com a planilha do IT 2026.002.
const cbsSheet = (await readXlsx(await itFile(it.aliquotasCbs, args['it-aliquotas-cbs'])))[0];
const cbs2026 = cbsSheet?.rows.find((r) => r.A === '2026')?.B;
if (cbs2026 === undefined || Math.abs(Number(cbs2026) * 100 - 0.9) > 1e-9) {
  fail(`IT 2026.002: CBS 2026 = ${cbs2026}, esperado 0,9% (fração 0,009)`);
}
for (const r of shipped.referenceRates) {
  const c = curatedRates.reference.find(
    (x) => x.tributo === r.tributo && x.validity.from === r.validity.from && x.validity.to === r.validity.to,
  );
  if (c?.status !== 'official' || Number(c.rate) !== Number(r.rate)) {
    fail(
      `alíquota de referência da Calculadora ${r.tributo} ${r.validity.from} = ${r.rate} sem par igual em rates.json`,
    );
  }
}
for (const c of curatedRates.reference.filter((x) => x.sources.includes('calculadora'))) {
  if (!shipped.referenceRates.some((r) => r.tributo === c.tributo && r.validity.from === c.validity.from)) {
    fail(`rates.json cita a Calculadora para ${c.tributo} ${c.validity.from}, mas ela não tem a linha`);
  }
}

// 4. saída
const calcSource: DataSource = {
  id: pin.id,
  kind: 'CALCULADORA_OFFLINE',
  title: pin.title,
  version: pin.versao.versaoDb,
  date: pin.versao.dataVersaoDb,
  url: pin.url,
  sha256: pin.zipSha256,
  pins: {
    'calculadora.tar.gz': pin.entries['calculadora.tar.gz'] ?? '',
    'codigo-fonte-backend.zip': pin.entries['codigo-fonte-backend.zip'] ?? '',
    dockerLayerDiffId: pin.dockerLayerDiffId,
    [pin.db.pathInTar]: pin.db.sha256,
    versaoApp: pin.versao.versaoApp,
  },
  notes: pin.versao.descricaoVersaoDb,
};
const itSource = (p: ItPin): DataSource => ({
  id: p.id,
  kind: 'IT',
  title: p.title,
  version: p.version,
  date: p.date,
  url: p.url,
  sha256: p.sha256,
});
const tables: DatasetTables = {
  cst: merged.cst,
  classTrib: merged.classTrib,
  treatments: shipped.treatments,
  credPres: credPres,
  ncmApplicability: shipped.ncmApplicability,
  nbsApplicability: shipped.nbsApplicability,
  annexes: shipped.annexes,
  nfseNbs: shipped.nfseNbs,
  actorGroups: shipped.actorGroups,
  actors: shipped.actors,
  actorClassTrib: shipped.actorClassTrib,
  dfeTypes: shipped.dfeTypes,
  govPurchaseReducer: shipped.govPurchaseReducer,
  cbsTransfer: shipped.cbsTransfer,
};
for (const [name, records] of Object.entries(tables) as [TableName, readonly { key: string }[]][]) {
  const keys = new Set(records.map((r) => r.key));
  if (keys.size !== records.length) fail(`tabela ${name} com chave repetida`);
}
const files: Record<string, string> = {};
const tableManifest = (Object.keys(tables) as TableName[]).map((name) => {
  const body = canonicalTable(tables[name]);
  files[`${name}.json`] = body;
  return { name, records: tables[name].length, sha256: sha256(body) };
});
const dataSources = [calcSource, itSource(it.classTrib), itSource(it.credPres)];
const knownAt =
  dataSources
    .map((s) => s.date)
    .sort()
    .at(-1) ?? '';
const manifest: DatasetManifest = {
  dataSchemaVersion: 1,
  dataVersion: knownAt.slice(0, 7).replace('-', '.'),
  knownAt,
  sources: dataSources,
  tables: tableManifest,
  datasetSha256: sha256(tableManifest.map((t) => `${t.sha256}  ${t.name}`).join('\n')),
};
files['manifest.json'] = canonicalPretty(manifest);

const rateSourceIds = new Map<string, unknown>([
  [
    'calculadora',
    {
      id: pin.id,
      title: pin.title,
      version: pin.versao.versaoDb,
      date: pin.versao.dataVersaoDb,
      url: pin.url,
      sha256: pin.zipSha256,
    },
  ],
  [
    'it-aliquotas-cbs',
    {
      id: it.aliquotasCbs.id,
      title: it.aliquotasCbs.title,
      version: it.aliquotasCbs.version,
      date: it.aliquotasCbs.date,
      url: it.aliquotasCbs.url,
      sha256: it.aliquotasCbs.sha256,
    },
  ],
  ...curatedRates.legalSources.map((s) => [s.id, s] as const),
]);
const usedSources = [...new Set(curatedRates.reference.flatMap((r) => r.sources))].sort();
for (const s of usedSources) if (!rateSourceIds.has(s)) fail(`rates.json cita a fonte ${s}, que não existe`);
const ratesOut = canonicalPretty({
  schemaVersion: 1,
  dataVersion: manifest.dataVersion,
  knownAt,
  sources: usedSources.map((s) => rateSourceIds.get(s)),
  reference: curatedRates.reference.map((r) => ({
    ...r,
    sources: r.sources.map((s) => {
      const src = rateSourceIds.get(s) as { id?: string };
      return src.id ?? s;
    }),
  })),
  standard: [],
});

// Formatado pelo Biome do repo (como o tools/rejeicoes-data), para o `bun run format` não reescrever o gerado. Os hashes
// do manifest são do JSON canônico de cada tabela, não dos bytes do arquivo, então a formatação não os altera.
const biome = path.join(root, 'node_modules/.bin/biome');
const formatted = async (file: string, body: string): Promise<string> =>
  await $`${biome} format --stdin-file-path=${file} < ${new Response(body)}`.cwd(root).quiet().text();
const outputs: [string, string][] = await Promise.all(
  [
    ...Object.entries(files).map(([f, body]) => [path.join(dataDir, f), body] as [string, string]),
    [ratesFile, ratesOut] as [string, string],
  ].map(async ([file, body]) => [file, await formatted(file, body)] as [string, string]),
);
if (args.check) {
  const differ: string[] = [];
  for (const [file, body] of outputs) {
    const f = Bun.file(file);
    if (!(await f.exists()) || (await f.text()) !== body) differ.push(path.relative(root, file));
  }
  if (differ.length) fail(`dados versionados diferem do gerado: ${differ.join(', ')}`);
  log(`--check ok: ${outputs.length} arquivos idênticos (datasetSha256 ${manifest.datasetSha256.slice(0, 12)})`);
} else {
  for (const [file, body] of outputs) await Bun.write(file, body);
  log(`gravados ${outputs.length} arquivos; datasetSha256 ${manifest.datasetSha256}`);
}
