#!/usr/bin/env bun
/**
 * Typecheck de todos os pacotes (src e test, pelo tsconfig.json de cada um) e do tooling do repo (tsconfig.json da
 * raiz). Imports entre pacotes resolvem pelos `.d.ts` em dist, então rode `bun run build` antes.
 */
import path from 'node:path';
import { $ } from 'bun';
import { rel, root, topoSort, workspacePackages } from './lib/workspace.ts';

const tsc = path.join(root, 'node_modules/.bin/tsc');
const projects = [root];
for (const p of topoSort(await workspacePackages())) {
  if (await Bun.file(path.join(p.dir, 'tsconfig.json')).exists()) projects.push(p.dir);
}
let failed = 0;
for (const dir of projects) {
  const r = await $`${tsc} -p ${path.join(dir, 'tsconfig.json')}`.cwd(dir).nothrow();
  console.log(`${r.exitCode === 0 ? 'ok  ' : 'FAIL'} tsc ${rel(dir)}`);
  if (r.exitCode !== 0) failed++;
}
process.exit(failed ? 1 : 0);
