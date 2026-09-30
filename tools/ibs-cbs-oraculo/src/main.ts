/**
 * Corpo do `run.ts`, carregado depois que os pacotes do workspace foram compilados: os imports de `@sinete/*` resolvem
 * pelo `dist`, que não existe num checkout limpo.
 */
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { aliquotasOficiais } from '@sinete/ibs-cbs/aliquotas';
import { carregarDataset } from '@sinete/ibs-cbs-dados';
import { DATASET_EMBARCADO } from '@sinete/ibs-cbs-dados/bundled';
import { unpackCalculadora } from '../../ibs-cbs-dados/src/artifact.ts';
import { defaultCacheDir, ensureFile } from '../../ibs-cbs-dados/src/fetch.ts';
import type { CaseResult } from './check.ts';
import { compareCase, runEngine, runOracle } from './check.ts';
import { ensureImage, loadPin, startOracle } from './container.ts';
import { checkData, collectData } from './data.ts';
import type { OracleCase } from './generate.ts';
import { generator, loadNomenclatures } from './generate.ts';
import type { Ledger } from './ledger.ts';
import { explain } from './ledger.ts';
import { writeFixtures } from './record.ts';

const here = path.resolve(import.meta.dir, '..');
const root = path.resolve(here, '../..');
const { values: args } = parseArgs({
  options: {
    n: { type: 'string', default: '400' },
    seed: { type: 'string', default: '1' },
    api: { type: 'string' },
    image: { type: 'string' },
    keep: { type: 'boolean', default: false },
    out: { type: 'string' },
    pairs: { type: 'string', default: '400' },
    actors: { type: 'string', default: '60' },
    record: { type: 'boolean', default: false },
    'no-build': { type: 'boolean', default: false },
    cache: { type: 'string' },
  },
});
const log = (m: string): void => console.error(`ibs-cbs-oraculo: ${m}`);
const n = Number(args.n);
const seed = Number(args.seed);

const pin = await loadPin();
const cacheDir = args.cache ?? defaultCacheDir();
const zip = await ensureFile({ url: pin.url, sha256: pin.zipSha256, name: 'calculadora.zip', cacheDir, log });
const { db } = await unpackCalculadora(zip, pin, cacheDir);
const ledger = (await Bun.file(path.join(here, 'ledger.json')).json()) as Ledger;
if (ledger.calculadora.zipSha256 !== pin.zipSha256) {
  log(`ledger.json é da Calculadora ${ledger.calculadora.versaoDb}; o pin mudou: revise o ledger`);
  process.exit(1);
}

let stop = async (): Promise<void> => {};
let api = args.api;
if (!api) {
  const image = await ensureImage(pin, { ...(args.image ? { image: args.image } : {}), cacheDir, log });
  const oracle = await startOracle(pin, image, { log });
  api = oracle.api;
  stop = args.keep ? async () => log(`contêiner ${oracle.name} mantido (--keep) em ${oracle.api}`) : oracle.stop;
}

let exitCode = 0;
try {
  const dataset = carregarDataset(DATASET_EMBARCADO);
  const rates = aliquotasOficiais();
  const nom = loadNomenclatures(db);
  const gen = generator(dataset, nom, seed);
  const hits = new Map<string, number>(ledger.entries.map((e) => [e.id, 0]));
  const unexplained: { case: OracleCase; divergence: unknown }[] = [];
  const recorded: { case: OracleCase; result: CaseResult }[] = [];
  const tally = { cases: 0, agree: 0, bothError: 0, explained: 0, unexplained: 0 };
  const t0 = performance.now();
  while (tally.cases < n) {
    const c = gen.next();
    if (!c) continue;
    tally.cases++;
    const result = compareCase(runEngine(c, dataset, rates), await runOracle(api, c));
    recorded.push({ case: c, result });
    if (!result.engine.ok && !result.oracle.ok) tally.bothError++;
    else if (result.divergences.length === 0) tally.agree++;
    let bad = false;
    for (const d of result.divergences) {
      const e = explain(ledger, c, d);
      if (e) hits.set(e.id, (hits.get(e.id) ?? 0) + 1);
      else {
        bad = true;
        unexplained.push({ case: c, divergence: d });
      }
    }
    if (result.divergences.length > 0) {
      if (bad) tally.unexplained++;
      else tally.explained++;
    }
  }
  const stale = ledger.entries.filter((e) => e.expectHits && (hits.get(e.id) ?? 0) === 0).map((e) => e.id);
  log(`dataset: coletando ${args.pairs} pares de aplicabilidade e ${args.actors} consultas por atores`);
  const data = await collectData(api, dataset, nom, {
    seed,
    pairs: Number(args.pairs),
    actors: Number(args.actors),
  });
  const dataMismatches = checkData(dataset, data);
  const report = {
    calculadora: { versaoDb: pin.versao.versaoDb, zipSha256: pin.zipSha256 },
    contentVersion: dataset.versaoDoConteudo,
    seed,
    elapsedMs: Math.round(performance.now() - t0),
    tally,
    ledgerHits: Object.fromEntries(hits),
    stale,
    unexplained: unexplained.slice(0, 50),
    data: {
      pairs: data.pairs.length,
      actors: data.actors.length,
      lists: data.lists.length,
      mismatches: dataMismatches.slice(0, 50),
    },
  };
  const outDir = args.out ?? path.join(os.homedir(), '.local/state/sinete/ibs-cbs-oraculo', `seed${seed}-n${n}`);
  await Bun.write(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  log(
    `${tally.cases} casos: ${tally.agree} iguais, ${tally.bothError} recusados pelos dois, ${tally.explained} com divergência explicada, ${tally.unexplained} sem explicação`,
  );
  log(`ledger: ${[...hits].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  log(
    `dataset: ${data.pairs.length} pares, ${data.actors.length} por atores, ${data.lists.length} listas, ${dataMismatches.length} diferenças`,
  );
  log(`relatório em ${path.join(outDir, 'report.json')}`);
  if (tally.unexplained > 0) {
    log(`FALHOU: ${tally.unexplained} caso(s) com divergência fora do ledger`);
    exitCode = 1;
  }
  if (stale.length > 0) {
    log(`FALHOU: entradas do ledger sem nenhum caso: ${stale.join(', ')}`);
    exitCode = 1;
  }
  if (dataMismatches.length > 0) {
    log(`FALHOU: ${dataMismatches.length} diferença(s) entre o dataset e a API dados-abertos`);
    exitCode = 1;
  }
  if (args.record) {
    if (exitCode !== 0) log('fixtures não gravadas: a execução falhou');
    else await writeFixtures(root, ledger, recorded, data, { seed, versaoDb: pin.versao.versaoDb, log });
  }
} finally {
  await stop();
}
process.exit(exitCode);
