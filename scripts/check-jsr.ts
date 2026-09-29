#!/usr/bin/env bun
/**
 * Lint de "slow types" do JSR (ADR 0001: sem publicação no JSR na fase 1, mas o código fica pronto para ele).
 * Monta num diretório temporário um workspace Deno com o `src` de cada pacote público e um `deno.json` derivado do
 * package.json (exports apontando para o fonte .ts) e roda `deno publish --dry-run`. Nada é publicado. O guarda-chuva sem
 * escopo (`sinete`) fica de fora: o JSR exige escopo.
 */
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { $ } from 'bun';
import { exportTargets, topoSort, workspacePackages } from './lib/workspace.ts';

if (!Bun.which('deno')) {
  console.error('check-jsr: deno não encontrado no PATH (https://docs.deno.com/runtime/getting_started/installation/)');
  process.exit(1);
}
const work = await mkdtemp(path.join(tmpdir(), 'sinete-jsr-'));
try {
  const members: string[] = [];
  for (const { dir, manifest: m } of topoSort(await workspacePackages())) {
    if (m.private || !m.exports) continue;
    // O JSR só aceita nome com escopo; o guarda-chuva `sinete` é só do npm (ADR 0008) e só reexporta os `@sinete/*`,
    // que já passam por aqui.
    if (!m.name.startsWith('@')) continue;
    const exportsMap: Record<string, string> = {};
    for (const t of exportTargets(m)) {
      if (t.condition === 'types' || t.subpath === './package.json') continue;
      exportsMap[t.subpath] = t.file.replace(/^\.\/dist\//, './src/').replace(/\.js$/, '.ts');
    }
    const member = path.join(work, path.basename(dir));
    await cp(path.join(dir, 'src'), path.join(member, 'src'), { recursive: true });
    // Dependências de fora do workspace viram `npm:` no import map (o JSR aceita dependência npm).
    const imports: Record<string, string> = {};
    for (const [dep, range] of Object.entries(m.dependencies ?? {})) {
      if (!range.startsWith('workspace:')) imports[dep] = `npm:${dep}@${range}`;
    }
    await Bun.write(
      path.join(member, 'deno.json'),
      JSON.stringify({ name: m.name, version: m.version, license: m.license, exports: exportsMap, imports }, null, 2),
    );
    members.push(`./${path.basename(dir)}`);
  }
  await Bun.write(path.join(work, 'deno.json'), JSON.stringify({ workspace: members }));
  const r = await $`deno publish --dry-run --allow-dirty`.cwd(work).nothrow();
  process.exitCode = r.exitCode;
} finally {
  await rm(work, { recursive: true, force: true });
}
