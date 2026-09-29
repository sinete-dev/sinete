#!/usr/bin/env bun
/**
 * Build de um pacote (ou de todos, em ordem topológica) a partir do `exports` do package.json (ADR 0001).
 *
 * Cada alvo JS em `exports` e `bin` (`./dist/x.js`) vira uma entrada `src/x.ts` numa única chamada ao `Bun.build`
 * (ESM, `splitting: true` para que uma classe usada por duas entradas não duplique e o `instanceof` continue valendo,
 * `external: ['node:*']`, `packages: 'external'`, sourcemap linked). Pacote com `bin` usa `target: 'node'`, os outros
 * `target: 'browser'`. Depois, `tsc -p tsconfig.build.json` emite os `.d.ts` com declaration maps. No fim, todo arquivo
 * citado em `exports` e `bin` precisa existir. Pacote com `docs` em `files` recebe a cópia de `docs/guia/` em `docs/`.
 *
 * Uso: bun scripts/build.ts [dir-do-pacote ...]   (sem argumento: todos os pacotes do workspace)
 */
import { chmod, copyFile, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { $, Glob } from 'bun';
import { GUIA } from './lib/docs.ts';
import type { Pkg } from './lib/workspace.ts';
import { binTargets, exportTargets, rel, root, topoSort, workspacePackages } from './lib/workspace.ts';

const tsc = path.join(root, 'node_modules/.bin/tsc');

function sourceFor(dir: string, target: string): string {
  const m = /^\.\/dist\/(.+)\.js$/.exec(target);
  if (!m) throw new Error(`${rel(dir)}: alvo fora do padrão ./dist/<nome>.js: ${target}`);
  return path.join(dir, 'src', `${m[1]}.ts`);
}

/**
 * O fonte importa com `.ts` (allowImportingTsExtensions) e o tsc mantém `.ts` nos `.d.ts`. O TypeScript 5+ e o Deno
 * via `npm:` aceitam, mas o Deno resolvendo o pacote como workspace local procura `dist/x.ts` e falha (visto na smoke),
 * e TypeScript anterior ao 5.0 também. `.js` é a forma que todo consumidor entende; o `.d.ts` irmão cobre o tipo.
 */
async function rewriteDtsSpecifiers(dist: string): Promise<void> {
  const re = /((?:from|import)\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\.ts\2/g;
  for await (const f of new Glob('**/*.d.ts').scan({ cwd: dist })) {
    const file = path.join(dist, f);
    const text = await Bun.file(file).text();
    const next = text.replace(re, '$1$2$3.js$2');
    if (next !== text) await Bun.write(file, next);
  }
}

async function build(pkg: Pkg): Promise<void> {
  const { dir, manifest: m } = pkg;
  const started = performance.now();
  const targets = exportTargets(m).filter((t) => t.subpath !== './package.json');
  const jsTargets = [...targets.filter((t) => t.condition !== 'types').map((t) => t.file), ...binTargets(m)];
  const entrypoints = [...new Set(jsTargets.map((t) => sourceFor(dir, t)))];
  for (const e of entrypoints) {
    if (!(await Bun.file(e).exists())) throw new Error(`${m.name}: entrada ${rel(e)} não existe`);
  }
  await rm(path.join(dir, 'dist'), { recursive: true, force: true });
  if (entrypoints.length > 0) {
    const r = await Bun.build({
      entrypoints,
      root: path.join(dir, 'src'),
      outdir: path.join(dir, 'dist'),
      format: 'esm',
      sourcemap: 'linked',
      packages: 'external',
      splitting: true,
      external: ['node:*'],
      target: binTargets(m).length > 0 ? 'node' : 'browser',
    });
    if (!r.success) {
      for (const log of r.logs) console.error(log);
      throw new Error(`${m.name}: Bun.build falhou`);
    }
  }
  if (targets.some((t) => t.condition === 'types')) {
    await $`${tsc} -p ${path.join(dir, 'tsconfig.build.json')}`.cwd(dir);
    await rewriteDtsSpecifiers(path.join(dir, 'dist'));
  }
  for (const b of binTargets(m)) await chmod(path.join(dir, b), 0o755);
  // Todo tarball leva a licença e o NOTICE da raiz (Apache-2.0, seção 4). As cópias ficam fora do git.
  for (const f of ['LICENSE', 'NOTICE']) await copyFile(path.join(root, f), path.join(dir, f));
  // A documentação embarcada (docs/guia/) vai como `docs/` no tarball de quem a cita em `files`; a cópia fica fora do
  // git, como a da licença.
  if (m.files?.includes('docs')) {
    await rm(path.join(dir, 'docs'), { recursive: true, force: true });
    await cp(GUIA, path.join(dir, 'docs'), { recursive: true });
  }
  const missing = [];
  for (const f of [...targets.map((t) => t.file), ...binTargets(m)]) {
    if (!(await Bun.file(path.join(dir, f)).exists())) missing.push(f);
  }
  if (missing.length > 0) throw new Error(`${m.name}: build não gerou ${missing.join(', ')}`);
  console.log(`built ${m.name} (${entrypoints.length} entrada(s)) em ${Math.round(performance.now() - started)} ms`);
}

const args = process.argv.slice(2);
const all = topoSort(await workspacePackages());
const selected =
  args.length === 0
    ? all
    : args.map((a) => {
        const dir = path.resolve(process.cwd(), a);
        const p = all.find((x) => x.dir === dir);
        if (!p) throw new Error(`${a} não é um pacote do workspace`);
        return p;
      });
for (const p of selected) {
  if (!p.manifest.exports && !p.manifest.bin) continue;
  await build(p);
}
