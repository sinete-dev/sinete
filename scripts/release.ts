#!/usr/bin/env bun
/**
 * Publica os pacotes do workspace que ainda não existem no registry (ADR 0001, rota b).
 *
 * Fluxo: `bun run version` (changeset version + bun install) já rodou e o build está em dist/. Para cada pacote
 * público, em ordem topológica:
 *   fase 1: `bun pm pack` de todos os pendentes e travas no tarball, antes de publicar qualquer coisa: nenhum
 *           `workspace:` restante, todo range interno aceita a versão atual do irmão (lock desatualizado depois do
 *           changeset version) e todo arquivo de `exports` e `bin` está dentro do tarball;
 *   fase 2: `npm publish <tgz>` (único caminho com OIDC e provenance; `bun publish` ignora publishConfig.registry).
 *
 * Idempotente: pula versão já publicada, então pode ser relançado depois de falha parcial.
 * Fora do CI, publicar no npmjs exige --dry-run: o registry público só recebe release do job com OIDC.
 *
 * Uso: bun scripts/release.ts [--dry-run] [--tag next]
 * Registry: publishConfig.registry do pacote, senão NPM_CONFIG_REGISTRY, senão npmjs.
 */
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';
import type { Manifest } from './lib/workspace.ts';
import { binTargets, exportTargets, root, topoSort, workspacePackages } from './lib/workspace.ts';

const NPMJS = 'https://registry.npmjs.org/';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tagIdx = args.indexOf('--tag');
const tag = tagIdx >= 0 ? args[tagIdx + 1] : 'latest';
const outDir = path.join(root, '.release');

function registryFor(m: Manifest): string {
  const r = m.publishConfig?.registry ?? process.env.NPM_CONFIG_REGISTRY ?? NPMJS;
  return r.endsWith('/') ? r : `${r}/`;
}

async function isPublished(m: Manifest): Promise<boolean> {
  const res = await fetch(`${registryFor(m)}${m.name.replace('/', '%2f')}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`registry respondeu ${res.status} para ${m.name}`);
  const doc = (await res.json()) as { versions?: Record<string, unknown> };
  return Boolean(doc.versions?.[m.version]);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const all = await workspacePackages();
const versions = new Map(all.map((p) => [p.manifest.name, p.manifest.version]));
const order = topoSort(all).filter((p) => !p.manifest.private);

for (const { manifest: m } of order) {
  if (registryFor(m) === NPMJS && !dryRun && process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error(`${m.name}: publicar no npmjs só pelo job de release do CI; localmente use --dry-run`);
  }
}

// Fase 1: empacota e valida tudo antes de publicar qualquer coisa (release parcial é pior que nenhum).
const pending: { dir: string; m: Manifest; tgz: string }[] = [];
for (const { dir, manifest: m } of order) {
  const id = `${m.name}@${m.version}`;
  if (await isPublished(m)) {
    console.log(`= ${id} já publicado, pulando`);
    continue;
  }
  const tgzName =
    (await $`bun pm pack --quiet --destination ${outDir}`.cwd(dir).text()).trim().split('\n').at(-1) ?? '';
  const tgz = path.isAbsolute(tgzName) ? tgzName : path.join(outDir, path.basename(tgzName));
  const listing = new Set((await $`tar -tzf ${tgz}`.text()).split('\n').map((l) => l.replace(/^package\//, '')));
  const docs = m.files?.includes('docs') ? ['docs/index.md'] : [];
  for (const f of ['LICENSE', 'NOTICE', ...docs, ...exportTargets(m).map((t) => t.file), ...binTargets(m)]) {
    if (!listing.has(f.replace(/^\.\//, ''))) throw new Error(`${id}: ${f} não está no tarball; rode o build`);
  }
  const packedText = await $`tar -xOzf ${tgz} package/package.json`.text();
  if (packedText.includes('workspace:')) throw new Error(`${id}: tarball ainda contém workspace:, abortando`);
  // O bun reescreve workspace: com a versão gravada no bun.lock, não com a do package.json.
  // Se `bun install` não rodou depois de `changeset version`, o range sai velho: barrar aqui.
  const packed = JSON.parse(packedText) as Manifest;
  const internal = { ...packed.dependencies, ...packed.peerDependencies, ...packed.optionalDependencies };
  const source = { ...m.dependencies, ...m.peerDependencies, ...m.optionalDependencies };
  for (const [dep, range] of Object.entries(internal)) {
    const current = versions.get(dep);
    // `workspace:*` fixa a versão exata (o guarda-chuva `sinete`, ADR 0008): o tarball precisa levar a atual, não um
    // range que ela satisfaça.
    if (current && source[dep] === 'workspace:*' && range !== current) {
      throw new Error(`${id}: ${dep}@${range} no tarball, esperado exatamente ${current}; rode \`bun install\``);
    }
    if (current && !Bun.semver.satisfies(current, range)) {
      throw new Error(
        `${id}: ${dep}@${range} no tarball não aceita a versão atual ${current}; rode \`bun install\` e tente de novo`,
      );
    }
  }
  pending.push({ dir, m, tgz });
}

// Fase 2: publica o tarball com npm (único caminho com OIDC e provenance).
for (const { m, tgz } of pending) {
  const flags = ['--access', m.publishConfig?.access ?? 'public', '--tag', tag ?? 'latest'];
  // Provenance só no release real para o npmjs: a smoke do CI publica num verdaccio efêmero sem id-token.
  if (process.env.GITHUB_ACTIONS === 'true' && registryFor(m) === NPMJS) flags.push('--provenance');
  if (dryRun) flags.push('--dry-run');
  // Fora do diretório do pacote: o npm 10.8 (Node 20) publica o manifesto do package.json do cwd, com `workspace:`, em
  // vez do que está no tarball.
  await $`npm publish ${tgz} ${flags}`.cwd(outDir).quiet();
  console.log(`${dryRun ? '~' : '+'} ${m.name}@${m.version} (${path.basename(tgz)})`);
}
console.log(`${pending.length} pacote(s) ${dryRun ? 'simulados' : 'publicados'}`);
