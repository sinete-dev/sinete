#!/usr/bin/env bun
/**
 * Extrator reprodutível do `@sinete/ibs-cbs-dados` e do `@sinete/ibs-cbs/aliquotas` (ADR 0007).
 *
 * Fluxo:
 *   1. obtém o `calculadora.zip` oficial (URL de `sources.json`, cache local ou `--calculadora-zip`) e confere o sha256
 *      do zip, do `calculadora.tar.gz`, do `codigo-fonte-backend.zip` e do SQLite embarcado; com `--verify-layer`,
 *      também o `diff_id` da camada (o sha256 do tar descomprimido, que amarra o dataset ao contêiner do oráculo);
 *   2. extrai as tabelas do SQLite embarcado e, pelo segundo caminho, de um SQLite reconstruído das migrações Flyway
 *      do mesmo zip; os dois precisam dar as mesmas tabelas, byte a byte (`--skip-flyway` pula, só para desenvolvimento).
 *      Quando o código-fonte não traz as migrações (V0058 em diante, `segundoCaminho` do pin), o segundo caminho é o
 *      `.db` que o código-fonte publica, conferido contra o do rootfs;
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
import type {
  FonteDoDataset,
  ManifestoDoDataset,
  NomeDaTabela,
  TabelasDoDataset,
} from '../../packages/ibs-cbs-dados/src/types.ts';
import type { CalculadoraPin } from './src/artifact.ts';
import { dbFromSourceZip, layerDiffId, rebuildFromFlyway, unpackCalculadora } from './src/artifact.ts';
import type { CalcTables } from './src/calculadora.ts';
import { extractCalculadora } from './src/calculadora.ts';
import { defaultCacheDir, ensureFile } from './src/fetch.ts';
import { readItClassTrib, readItCredPres } from './src/it.ts';
import { canonicalPretty, sha256, tabelaCanonica } from './src/lib.ts';
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
  readonly vigencia: { readonly inicio: string; readonly fim: string | null };
  readonly situacao: 'oficial' | 'desconhecida';
  readonly aliquota: string | null;
  readonly legal: string;
  readonly nota?: string;
  readonly fontes: readonly string[];
}
interface CuratedRates {
  readonly fontesLegais: readonly { id: string; titulo: string; url: string }[];
  readonly referencia: readonly CuratedRate[];
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
      .map(([k, v]) => [k, tabelaCanonica(v as unknown[])]),
  );
const segundo = pin.segundoCaminho ?? { tipo: 'flyway' };
if (args['skip-flyway']) {
  log('AVISO: segundo caminho pulado (--skip-flyway); não use para gerar o dataset versionado');
} else if (segundo.tipo === 'db-do-codigo-fonte') {
  // Sem migrações no código-fonte (V0058 em diante): o segundo caminho é o .db que o código-fonte publica, que precisa
  // ser o mesmo arquivo do rootfs e dar as mesmas tabelas. Não é uma reconstrução independente (ver a nota do pin).
  const fromSource = await dbFromSourceZip(unpacked.sourceZip, segundo.pathInSourceZip, pin.db.sha256, cacheDir);
  const a = tableBytes(shipped);
  const b = tableBytes(extractCalculadora(fromSource));
  const differ = Object.keys(a).filter((k) => a[k] !== b[k]);
  if (differ.length) fail(`SQLite do rootfs e do código-fonte divergem em: ${differ.join(', ')}`);
  log(
    `AVISO: código-fonte sem migrações Flyway; o .db publicado no código-fonte é o mesmo do rootfs (${pin.versao.versaoDb}), sem reconstrução independente`,
  );
} else {
  const rebuiltDb = await rebuildFromFlyway(unpacked.sourceZip, pin.versao.versaoDb, cacheDir);
  const rebuilt = extractCalculadora(rebuiltDb);
  const a = tableBytes(shipped);
  const b = tableBytes(rebuilt);
  const differ = Object.keys(a).filter((k) => a[k] !== b[k]);
  if (differ.length) fail(`SQLite embarcado e reconstruído das migrações divergem em: ${differ.join(', ')}`);
  log(`SQLite embarcado e reconstruído das migrações (${pin.versao.versaoDb}) dão as mesmas tabelas`);
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
for (const r of shipped.aliquotasDeReferencia) {
  const c = curatedRates.referencia.find(
    (x) => x.tributo === r.tributo && x.vigencia.inicio === r.vigencia.inicio && x.vigencia.fim === r.vigencia.fim,
  );
  if (c?.situacao !== 'oficial' || Number(c.aliquota) !== Number(r.aliquota)) {
    fail(
      `alíquota de referência da Calculadora ${r.tributo} ${r.vigencia.inicio} = ${r.aliquota} sem par igual em rates.json`,
    );
  }
}
for (const c of curatedRates.referencia.filter((x) => x.fontes.includes('calculadora'))) {
  if (!shipped.aliquotasDeReferencia.some((r) => r.tributo === c.tributo && r.vigencia.inicio === c.vigencia.inicio)) {
    fail(`rates.json cita a Calculadora para ${c.tributo} ${c.vigencia.inicio}, mas ela não tem a linha`);
  }
}

// 4. saída
const calcSource: FonteDoDataset = {
  id: pin.id,
  tipo: 'CALCULADORA_OFFLINE',
  titulo: pin.title,
  versao: pin.versao.versaoDb,
  data: pin.versao.dataVersaoDb,
  url: pin.url,
  sha256: pin.zipSha256,
  pins: {
    'calculadora.tar.gz': pin.entries['calculadora.tar.gz'] ?? '',
    'codigo-fonte-backend.zip': pin.entries['codigo-fonte-backend.zip'] ?? '',
    dockerLayerDiffId: pin.dockerLayerDiffId,
    [pin.db.pathInTar]: pin.db.sha256,
    versaoApp: pin.versao.versaoApp,
  },
  notas: pin.versao.descricaoVersaoDb,
};
const itSource = (p: ItPin): FonteDoDataset => ({
  id: p.id,
  tipo: 'IT',
  titulo: p.title,
  versao: p.version,
  data: p.date,
  url: p.url,
  sha256: p.sha256,
});
const tables: TabelasDoDataset = {
  cst: merged.cst,
  classTrib: merged.classTrib,
  tratamentos: shipped.tratamentos,
  credPres: credPres,
  aplicabilidadeNcm: shipped.aplicabilidadeNcm,
  aplicabilidadeNbs: shipped.aplicabilidadeNbs,
  anexos: shipped.anexos,
  nfseNbs: shipped.nfseNbs,
  gruposDeAtores: shipped.gruposDeAtores,
  atores: shipped.atores,
  atorClassTrib: shipped.atorClassTrib,
  tiposDfe: shipped.tiposDfe,
  redutorCompraGov: shipped.redutorCompraGov,
  transferenciaCbs: shipped.transferenciaCbs,
};
for (const [name, records] of Object.entries(tables) as [NomeDaTabela, readonly { chave: string }[]][]) {
  const keys = new Set(records.map((r) => r.chave));
  if (keys.size !== records.length) fail(`tabela ${name} com chave repetida`);
}
const files: Record<string, string> = {};
const tableManifest = (Object.keys(tables) as NomeDaTabela[]).map((name) => {
  const body = tabelaCanonica(tables[name]);
  files[`${name}.json`] = body;
  return { nome: name, registros: tables[name].length, sha256: sha256(body) };
});
const dataSources = [calcSource, itSource(it.classTrib), itSource(it.credPres)];
const knownAt =
  dataSources
    .map((s) => s.data)
    .sort()
    .at(-1) ?? '';
const manifest: ManifestoDoDataset = {
  versaoDoFormato: 2,
  versaoDosDados: knownAt.slice(0, 7).replace('-', '.'),
  conhecidoEm: knownAt,
  fontes: dataSources,
  tabelas: tableManifest,
  sha256DoDataset: sha256(tableManifest.map((t) => `${t.sha256}  ${t.nome}`).join('\n')),
};
files['manifest.json'] = canonicalPretty(manifest);

const rateSourceIds = new Map<string, unknown>([
  [
    'calculadora',
    {
      id: pin.id,
      titulo: pin.title,
      versao: pin.versao.versaoDb,
      data: pin.versao.dataVersaoDb,
      url: pin.url,
      sha256: pin.zipSha256,
    },
  ],
  [
    'it-aliquotas-cbs',
    {
      id: it.aliquotasCbs.id,
      titulo: it.aliquotasCbs.title,
      versao: it.aliquotasCbs.version,
      data: it.aliquotasCbs.date,
      url: it.aliquotasCbs.url,
      sha256: it.aliquotasCbs.sha256,
    },
  ],
  ...curatedRates.fontesLegais.map((s) => [s.id, s] as const),
]);
const usedSources = [...new Set(curatedRates.referencia.flatMap((r) => r.fontes))].sort();
for (const s of usedSources) if (!rateSourceIds.has(s)) fail(`rates.json cita a fonte ${s}, que não existe`);
const ratesOut = canonicalPretty({
  versaoDoFormato: 2,
  versaoDosDados: manifest.versaoDosDados,
  conhecidoEm: knownAt,
  fontes: usedSources.map((s) => rateSourceIds.get(s)),
  referencia: curatedRates.referencia.map((r) => ({
    ...r,
    fontes: r.fontes.map((s) => {
      const src = rateSourceIds.get(s) as { id?: string };
      return src.id ?? s;
    }),
  })),
  padrao: [],
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
  log(`--check ok: ${outputs.length} arquivos idênticos (sha256DoDataset ${manifest.sha256DoDataset.slice(0, 12)})`);
} else {
  for (const [file, body] of outputs) await Bun.write(file, body);
  log(`gravados ${outputs.length} arquivos; sha256DoDataset ${manifest.sha256DoDataset}`);
}
