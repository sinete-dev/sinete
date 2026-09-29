#!/usr/bin/env bun
/**
 * Gates sobre o artefato real, não sobre o fonte (ADR 0001): empacota cada pacote público com `bun pm pack` e roda
 * publint --strict e attw --profile esm-only no tarball. Nos pacotes que embarcam a documentação (`docs` em `files`),
 * confere também que o tarball leva exatamente as páginas de `docs/guia/`. Rode depois do build.
 */
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';
import { paginasDoGuia } from './lib/docs.ts';
import { root, topoSort, workspacePackages } from './lib/workspace.ts';

const packs = path.join(root, '.packs');
const bin = (name: string): string => path.join(root, 'node_modules/.bin', name);
await rm(packs, { recursive: true, force: true });
await mkdir(packs, { recursive: true });
let failed = 0;
const guia = (await paginasDoGuia()).map((f) => `docs/${f}`).join('\n');
for (const { dir, manifest: m } of topoSort(await workspacePackages())) {
  if (m.private) continue;
  const out = (await $`bun pm pack --quiet --destination ${packs}`.cwd(dir).text()).trim().split('\n').at(-1) ?? '';
  const tgz = path.isAbsolute(out) ? out : path.join(packs, path.basename(out));
  if (m.files?.includes('docs')) {
    const noTarball = (await $`tar -tzf ${tgz}`.text())
      .split('\n')
      .map((l) => l.replace(/^package\//, ''))
      .filter((l) => l.startsWith('docs/'))
      .sort()
      .join('\n');
    const ok = noTarball === guia;
    console.log(`${ok ? 'ok  ' : 'FAIL'} doc embarcada ${m.name}@${m.version}`);
    if (!ok) {
      console.log('o tarball não leva exatamente as páginas de docs/guia/; rode o build');
      failed++;
    }
  }
  for (const [label, cmd] of [
    ['publint', $`${bin('publint')} run ${tgz} --strict`],
    ['attw', $`${bin('attw')} ${tgz} --profile esm-only --format table-flipped`],
  ] as const) {
    const r = await cmd.cwd(root).nothrow().quiet();
    console.log(`${r.exitCode === 0 ? 'ok  ' : 'FAIL'} ${label} ${m.name}@${m.version}`);
    if (r.exitCode !== 0) {
      console.log(r.stdout.toString() + r.stderr.toString());
      failed++;
    }
  }
}
await rm(packs, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
