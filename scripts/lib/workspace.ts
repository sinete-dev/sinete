/** Leitura dos pacotes do workspace bun, compartilhada pelos scripts de build, checagem e release. */
import path from 'node:path';
import { Glob } from 'bun';

export type ExportTarget = string | { readonly [condition: string]: ExportTarget } | null;

export type Manifest = {
  name: string;
  version: string;
  private?: boolean;
  bin?: string | Record<string, string>;
  exports?: Record<string, ExportTarget>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  publishConfig?: { registry?: string; access?: string };
  license?: string;
  files?: string[];
  description?: string;
};

export type Pkg = { dir: string; manifest: Manifest };

export const root: string = path.resolve(import.meta.dir, '../..');

/** Pacotes com `package.json` dentro dos globs de `workspaces` (diretórios só com README ficam de fora). */
export async function workspacePackages(): Promise<Pkg[]> {
  const rootManifest = await Bun.file(path.join(root, 'package.json')).json();
  const pkgs: Pkg[] = [];
  for (const pattern of rootManifest.workspaces as string[]) {
    for await (const file of new Glob(`${pattern}/package.json`).scan({ cwd: root })) {
      const dir = path.join(root, path.dirname(file));
      pkgs.push({ dir, manifest: await Bun.file(path.join(dir, 'package.json')).json() });
    }
  }
  return pkgs.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

/** Ordem topológica pelas dependências internas (dependencies, peer, optional e dev). */
export function topoSort(pkgs: Pkg[]): Pkg[] {
  const byName = new Map(pkgs.map((p) => [p.manifest.name, p]));
  const seen = new Set<string>();
  const out: Pkg[] = [];
  const visit = (p: Pkg, stack: string[]): void => {
    if (seen.has(p.manifest.name)) return;
    if (stack.includes(p.manifest.name)) throw new Error(`ciclo: ${[...stack, p.manifest.name].join(' -> ')}`);
    const m = p.manifest;
    const deps = { ...m.dependencies, ...m.peerDependencies, ...m.optionalDependencies, ...m.devDependencies };
    for (const name of Object.keys(deps)) {
      const dep = byName.get(name);
      if (dep) visit(dep, [...stack, m.name]);
    }
    seen.add(m.name);
    out.push(p);
  };
  for (const p of pkgs) visit(p, []);
  return out;
}

/** Todos os caminhos de arquivo citados em `exports`, com a condição de cada um (`types`, `node`, `default`...). */
export function exportTargets(m: Manifest): { subpath: string; condition: string; file: string }[] {
  const out: { subpath: string; condition: string; file: string }[] = [];
  const walk = (subpath: string, condition: string, t: ExportTarget): void => {
    if (t === null) return;
    if (typeof t === 'string') {
      out.push({ subpath, condition, file: t });
      return;
    }
    for (const [cond, next] of Object.entries(t)) walk(subpath, cond, next);
  };
  for (const [subpath, t] of Object.entries(m.exports ?? {})) walk(subpath, 'default', t);
  return out;
}

export function binTargets(m: Manifest): string[] {
  if (!m.bin) return [];
  return typeof m.bin === 'string' ? [m.bin] : Object.values(m.bin);
}

export function rel(p: string): string {
  return path.relative(root, p) || '.';
}
