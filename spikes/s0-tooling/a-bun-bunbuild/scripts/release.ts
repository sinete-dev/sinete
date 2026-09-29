#!/usr/bin/env bun
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
/**
 * Publica os pacotes do workspace bun que ainda não existem no registry.
 *
 * Fluxo: `changeset version` já rodou e o build está em dist/. Para cada pacote público,
 * em ordem topológica: `bun pm pack` (reescreve workspace:*, ^ e ~), confere que o tarball
 * não contém `workspace:`, e publica o tarball com `npm publish` (OIDC e provenance no CI).
 *
 * Uso: bun scripts/release.ts [--dry-run] [--tag next]
 * Registry: publishConfig.registry do pacote, senão NPM_CONFIG_REGISTRY, senão npmjs.
 */
import { $, Glob } from 'bun';

type Manifest = {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  publishConfig?: { registry?: string; access?: string };
};
type Pkg = { dir: string; manifest: Manifest };

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tagIdx = args.indexOf('--tag');
const tag = tagIdx >= 0 ? args[tagIdx + 1] : 'latest';
const root = path.resolve(import.meta.dir, '..');
const outDir = path.join(root, '.release');

async function workspacePackages(): Promise<Pkg[]> {
  const rootManifest = await Bun.file(path.join(root, 'package.json')).json();
  const pkgs: Pkg[] = [];
  for (const pattern of rootManifest.workspaces as string[]) {
    for await (const file of new Glob(`${pattern}/package.json`).scan({ cwd: root })) {
      const dir = path.join(root, path.dirname(file));
      pkgs.push({ dir, manifest: await Bun.file(path.join(dir, 'package.json')).json() });
    }
  }
  return pkgs;
}

function topoSort(pkgs: Pkg[]): Pkg[] {
  const byName = new Map(pkgs.map((p) => [p.manifest.name, p]));
  const seen = new Set<string>();
  const out: Pkg[] = [];
  const visit = (p: Pkg, stack: string[]): void => {
    if (seen.has(p.manifest.name)) return;
    if (stack.includes(p.manifest.name)) throw new Error(`ciclo: ${[...stack, p.manifest.name].join(' -> ')}`);
    const deps = { ...p.manifest.dependencies, ...p.manifest.peerDependencies, ...p.manifest.optionalDependencies };
    for (const name of Object.keys(deps)) {
      const dep = byName.get(name);
      if (dep) visit(dep, [...stack, p.manifest.name]);
    }
    seen.add(p.manifest.name);
    out.push(p);
  };
  for (const p of pkgs) visit(p, []);
  return out;
}

function registryFor(m: Manifest): string {
  const r = m.publishConfig?.registry ?? process.env.NPM_CONFIG_REGISTRY ?? 'https://registry.npmjs.org/';
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
  const packedText = await $`tar -xOzf ${tgz} package/package.json`.text();
  if (packedText.includes('workspace:')) throw new Error(`${id}: tarball ainda contém workspace:, abortando`);
  // O bun reescreve workspace: com a versão gravada no bun.lock, não com a do package.json.
  // Se `bun install` não rodou depois de `changeset version`, o range sai velho: barrar aqui.
  const packed = JSON.parse(packedText) as Manifest;
  for (const [dep, range] of Object.entries({ ...packed.dependencies, ...packed.peerDependencies })) {
    const current = versions.get(dep);
    if (current && !Bun.semver.satisfies(current, range)) {
      throw new Error(
        `${id}: ${dep}@${range} no tarball não aceita a versão atual ${current}; rode \`bun install\` e tente de novo`,
      );
    }
  }
  pending.push({ dir, m, tgz });
}
// Fase 2: publica o tarball com npm (único caminho com OIDC e provenance).
for (const { dir, m, tgz } of pending) {
  const flags = ['--access', m.publishConfig?.access ?? 'public', '--tag', tag];
  if (process.env.GITHUB_ACTIONS === 'true') flags.push('--provenance');
  if (dryRun) flags.push('--dry-run');
  await $`npm publish ${tgz} ${flags}`.cwd(dir).quiet();
  console.log(`${dryRun ? '~' : '+'} ${m.name}@${m.version} (${path.basename(tgz)})`);
}
console.log(`${pending.length} pacote(s) ${dryRun ? 'simulados' : 'publicados'}`);
