#!/usr/bin/env bun
/**
 * Diff semântico entre duas versões do `@sinete/ibs-cbs-dados` (ADR 0007): por tabela, registros incluídos, removidos e
 * alterados pela `key` estável, com o caminho de cada campo e o tipo da mudança (fim de vigência, indicador de grupo,
 * DF-e, redução, expressão de cálculo, texto). É o corpo do PR de atualização do dataset.
 *
 * Cada lado é um diretório com `manifest.json` e as tabelas (como `packages/ibs-cbs-dados/src/data`) ou `git:<ref>`, que lê
 * o diretório versionado naquele commit. Sem argumentos, compara `git:HEAD` com a árvore de trabalho.
 *
 * Uso:
 *   bun tools/ibs-cbs-dados/diff.ts [antes] [depois] [--json] [--limit 20]
 *   bun tools/ibs-cbs-dados/diff.ts git:main packages/ibs-cbs-dados/src/data
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { $ } from 'bun';
import type { DatasetBundle, DatasetTables } from '../../packages/ibs-cbs-dados/src/index.ts';
import { diffDatasets, formatDiff, TABLE_NAMES } from '../../packages/ibs-cbs-dados/src/index.ts';

const root = path.resolve(import.meta.dir, '../..');
const DATA = 'packages/ibs-cbs-dados/src/data';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: { json: { type: 'boolean', default: false }, limit: { type: 'string', default: '20' } },
});

async function readSide(spec: string): Promise<DatasetBundle> {
  const read = spec.startsWith('git:')
    ? async (file: string): Promise<unknown> =>
        JSON.parse(await $`git show ${`${spec.slice(4)}:${DATA}/${file}`}`.cwd(root).quiet().text())
    : async (file: string): Promise<unknown> => JSON.parse(await Bun.file(path.resolve(spec, file)).text());
  const tables: Record<string, unknown> = {};
  for (const name of TABLE_NAMES) tables[name] = await read(`${name}.json`);
  return { manifest: (await read('manifest.json')) as DatasetBundle['manifest'], tables: tables as DatasetTables };
}

const [before = 'git:HEAD', after = path.join(root, DATA)] = positionals;
const diff = diffDatasets(await readSide(before), await readSide(after));
if (args.json) console.log(JSON.stringify(diff, null, 2));
else console.log(formatDiff(diff, Number(args.limit)));
