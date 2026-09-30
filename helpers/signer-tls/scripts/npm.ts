#!/usr/bin/env bun
/**
 * Monta os pacotes npm do helper (ADR 0014) a partir dos binários de `scripts/build.ts`:
 *
 * - `@sinete/signer-<os>-<cpu>`: `bin/sinete-signer` (estático) e `bin/sinete-signer-p11` (cgo), com `os` e `cpu` no
 *   package.json para o gerenciador instalar só o da plataforma, sem script de instalação;
 * - `@sinete/signer`: o lançador (`binarioDoSigner`, `iniciarSigner`), com os pacotes de plataforma em
 *   `optionalDependencies` na versão exata.
 *
 * Confere cada binário contra o SHA256SUMS do build. A publicação é do job de release do helper (pendente, ADR 0014);
 * este script só monta, valida e, com `--pack`, gera os tarballs (`npm pack`) em `<out>/tarballs/` com um SHA256SUMS.
 * `--require-p11` exige o `-p11` em todo alvo de `P11_TARGETS`.
 *
 * Uso: bun helpers/signer-tls/scripts/npm.ts [--dist dir] [--out dir] [--require-p11] [--pack]
 */
import { createHash } from 'node:crypto';
import { chmod, copyFile, cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';
import type { Target } from './build.ts';
import { binaryName, HELPER_DIR, P11_TARGETS, readSums, STATIC_TARGETS, version } from './build.ts';

const ROOT = path.resolve(HELPER_DIR, '../..');

/** Nome de plataforma do npm (`process.platform` e `process.arch`) para cada alvo do Go. */
export function npmPlatform(t: Target): { readonly os: string; readonly cpu: string } {
  return { os: t.goos === 'windows' ? 'win32' : t.goos, cpu: t.goarch === 'amd64' ? 'x64' : 'arm64' };
}

export async function stage(distDir: string, outDir: string, opts: { requireP11?: boolean } = {}): Promise<string[]> {
  const v = await version();
  const sums = await readSums(distDir);
  const common = {
    version: v,
    license: 'Apache-2.0',
    repository: { type: 'git', url: 'git+https://github.com/sinete-dev/sinete.git', directory: 'helpers/signer-tls' },
    homepage: 'https://github.com/sinete-dev/sinete/tree/main/helpers/signer-tls#readme',
    publishConfig: { access: 'public' },
  };
  await rm(outDir, { recursive: true, force: true });
  const staged: string[] = [];
  const optional: Record<string, string> = {};
  for (const t of STATIC_TARGETS) {
    const { os, cpu } = npmPlatform(t);
    const name = `@sinete/signer-${os}-${cpu}`;
    const dir = path.join(outDir, `signer-${os}-${cpu}`);
    const bins: string[] = [];
    for (const flavor of ['static', 'p11'] as const) {
      const src = path.join(distDir, binaryName(t, flavor));
      if (!(await Bun.file(src).exists())) {
        const exigido =
          flavor === 'p11' && opts.requireP11 && P11_TARGETS.some((p) => p.goos === t.goos && p.goarch === t.goarch);
        if (exigido) throw new Error(`${name}: falta ${binaryName(t, flavor)}`);
        continue;
      }
      const hash = createHash('sha256')
        .update(new Uint8Array(await Bun.file(src).arrayBuffer()))
        .digest('hex');
      if (sums.get(binaryName(t, flavor)) !== hash) throw new Error(`${binaryName(t, flavor)}: SHA-256 não confere`);
      const dst = path.join(
        dir,
        'bin',
        `sinete-signer${flavor === 'p11' ? '-p11' : ''}${t.goos === 'windows' ? '.exe' : ''}`,
      );
      await mkdir(path.dirname(dst), { recursive: true });
      await copyFile(src, dst);
      await chmod(dst, 0o755);
      bins.push(path.basename(dst));
    }
    if (bins.length === 0) continue;
    await Bun.write(
      path.join(dir, 'package.json'),
      `${JSON.stringify(
        {
          name,
          ...common,
          description: `Binário do sinete-signer para ${os}/${cpu} (${bins.join(', ')}); instalado pelo @sinete/signer`,
          os: [os],
          cpu: [cpu],
          files: ['bin', 'LICENSE', 'NOTICE'],
          preferUnplugged: true,
        },
        null,
        2,
      )}\n`,
    );
    for (const f of ['LICENSE', 'NOTICE']) await copyFile(path.join(ROOT, f), path.join(dir, f));
    optional[name] = v;
    staged.push(name);
  }
  const transport = (await Bun.file(path.join(ROOT, 'packages/transport/package.json')).json()) as { version: string };
  const launcher = path.join(outDir, 'signer');
  await cp(path.join(HELPER_DIR, 'npm/signer'), launcher, { recursive: true });
  for (const f of ['LICENSE', 'NOTICE']) await copyFile(path.join(ROOT, f), path.join(launcher, f));
  await Bun.write(
    path.join(launcher, 'package.json'),
    `${JSON.stringify(
      {
        name: '@sinete/signer',
        ...common,
        description: 'Binário nativo sinete-signer (mTLS com chave fora do processo: A3, PSC, OpenBao) da plataforma',
        type: 'module',
        exports: { '.': { types: './index.d.ts', default: './index.js' }, './package.json': './package.json' },
        files: ['index.js', 'index.d.ts', 'README.md', 'LICENSE', 'NOTICE'],
        engines: { node: '^20.19.0 || >=22.12.0' },
        dependencies: { '@sinete/transport': `^${transport.version}` },
        optionalDependencies: optional,
      },
      null,
      2,
    )}\n`,
  );
  staged.push('@sinete/signer');
  return staged;
}

/** `npm pack` de cada pacote montado em `outDir`, para `outDir/tarballs/`, com SHA256SUMS dos tarballs. */
export async function pack(outDir: string): Promise<string[]> {
  const dest = path.join(outDir, 'tarballs');
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  const tgz: string[] = [];
  for (const d of (await readdir(outDir, { withFileTypes: true })).filter((e) => e.isDirectory())) {
    if (d.name === 'tarballs') continue;
    const r = await $`npm pack --silent --pack-destination ${dest}`.cwd(path.join(outDir, d.name)).nothrow().quiet();
    if (r.exitCode !== 0) throw new Error(`npm pack em ${d.name}: ${r.stderr.toString()}`);
    tgz.push(path.join(dest, r.stdout.toString().trim().split('\n').at(-1) ?? ''));
  }
  tgz.sort();
  const lines: string[] = [];
  for (const f of tgz) {
    const h = createHash('sha256')
      .update(new Uint8Array(await Bun.file(f).arrayBuffer()))
      .digest('hex');
    lines.push(`${h}  ${path.basename(f)}\n`);
  }
  await Bun.write(path.join(dest, 'SHA256SUMS'), lines.join(''));
  return tgz;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (k: string, d: string): string => (args.includes(k) ? (args[args.indexOf(k) + 1] as string) : d);
  const dist = path.resolve(arg('--dist', path.join(HELPER_DIR, 'dist')));
  const out = path.resolve(arg('--out', path.join(dist, 'npm')));
  const staged = await stage(dist, out, { requireP11: args.includes('--require-p11') });
  for (const s of staged) console.log(`montado: ${s}`);
  if (args.includes('--pack'))
    for (const t of await pack(out)) console.log(`tarball: ${path.relative(process.cwd(), t)}`);
}
