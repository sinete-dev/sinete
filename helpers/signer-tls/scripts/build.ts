#!/usr/bin/env bun
/**
 * Build reproduzível do `sinete-signer` (ADR 0005 e ADR 0012). Dois sabores do mesmo código:
 *
 * - estático (`CGO_ENABLED=0`, backend `remote`): compila cruzado daqui para linux, windows e darwin, amd64 e arm64;
 * - `-p11` (cgo, backend `pkcs11`): precisa de um compilador C para o alvo. No macOS, as duas arquiteturas darwin pelo
 *   clang com `-arch`; nos outros, o `cc` do host para o próprio alvo e, para os demais, o compilador cruzado em
 *   `SINETE_CC_<GOOS>_<GOARCH>` (o CI usa `aarch64-linux-gnu-gcc` e `x86_64-w64-mingw32-gcc` no Ubuntu 22.04, ADR 0014).
 *   Windows arm64 fica sem `-p11` (sem compilador cruzado empacotado no Ubuntu).
 *
 * Reprodutível: `-trimpath`, `-buildvcs=false`, `-ldflags "-s -w -buildid="`, `-mod=readonly` e a versão de
 * `VERSION`; `--verify` compila tudo duas vezes em diretórios diferentes e compara os SHA-256.
 *
 * Uso: bun helpers/signer-tls/scripts/build.ts [--out dir] [--only host|p11] [--verify] [--no-p11]
 *      bun helpers/signer-tls/scripts/build.ts --merge dir [--merge dir...] --out dir
 * Saída: <out>/sinete-signer-<os>-<arch>[.exe], <out>/sinete-signer-p11-<os>-<arch>[.exe] e <out>/SHA256SUMS.
 * `--only p11` compila só os `-p11` desta máquina (o job do macOS no CI). `--merge` junta os `dist/` dos jobs do CI,
 * conferindo cada arquivo contra o SHA256SUMS de origem e exigindo o mesmo hash quando dois jobs trazem o mesmo nome
 * (os estáticos saem iguais em qualquer host).
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { $ } from 'bun';

export const HELPER_DIR: string = path.resolve(import.meta.dir, '..');

export interface Target {
  readonly goos: 'linux' | 'darwin' | 'windows';
  readonly goarch: 'amd64' | 'arm64';
}

export const STATIC_TARGETS: readonly Target[] = [
  { goos: 'linux', goarch: 'amd64' },
  { goos: 'linux', goarch: 'arm64' },
  { goos: 'windows', goarch: 'amd64' },
  { goos: 'windows', goarch: 'arm64' },
  { goos: 'darwin', goarch: 'amd64' },
  { goos: 'darwin', goarch: 'arm64' },
];

/** Alvos com sabor `-p11` na distribuição: todos menos windows/arm64. */
export const P11_TARGETS: readonly Target[] = STATIC_TARGETS.filter(
  (t) => !(t.goos === 'windows' && t.goarch === 'arm64'),
);

const sameTarget = (a: Target, b: Target): boolean => a.goos === b.goos && a.goarch === b.goarch;

const GOARCH: Record<string, Target['goarch']> = { x64: 'amd64', arm64: 'arm64' };
const GOOS: Record<string, Target['goos']> = { linux: 'linux', darwin: 'darwin', win32: 'windows' };

export function hostTarget(): Target {
  const goos = GOOS[process.platform];
  const goarch = GOARCH[process.arch];
  if (!goos || !goarch) throw new Error(`plataforma sem binário do sinete-signer: ${process.platform}/${process.arch}`);
  return { goos, goarch };
}

export function binaryName(t: Target, flavor: 'static' | 'p11'): string {
  return `sinete-signer${flavor === 'p11' ? '-p11' : ''}-${t.goos}-${t.goarch}${t.goos === 'windows' ? '.exe' : ''}`;
}

/** `go` do PATH ou de `GO`; `undefined` sem Go. */
export function findGo(): string | undefined {
  const candidates = [
    process.env.GO,
    Bun.which('go'),
    path.join(process.env.HOME ?? '', '.local/state/sinete/go/bin/go'),
  ];
  for (const c of candidates) if (c && Bun.spawnSync([c, 'version']).exitCode === 0) return c;
  return undefined;
}

export async function version(): Promise<string> {
  return (await Bun.file(path.join(HELPER_DIR, 'VERSION')).text()).trim();
}

/** Compila um binário. `cc` só no sabor p11 (cgo). */
export async function buildOne(go: string, t: Target, flavor: 'static' | 'p11', outDir: string): Promise<string> {
  const out = path.join(outDir, binaryName(t, flavor));
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    GOOS: t.goos,
    GOARCH: t.goarch,
    CGO_ENABLED: flavor === 'p11' ? '1' : '0',
    GOFLAGS: '-mod=readonly',
  };
  const cc = flavor === 'p11' ? crossCc(t) : undefined;
  if (cc) env.CC = cc;
  const ldflags = `-s -w -buildid= -X main.version=${await version()}`;
  const r = await $`${go} build -trimpath -buildvcs=false -ldflags=${ldflags} -o ${out} ./cmd/sinete-signer`
    .cwd(HELPER_DIR)
    .env(env)
    .nothrow()
    .quiet();
  if (r.exitCode !== 0) throw new Error(`${binaryName(t, flavor)}: ${r.stderr.toString()}`);
  return out;
}

/** Compilador C para o `-p11` de um alvo que não é o host: `clang -arch` entre os darwin, `SINETE_CC_<GOOS>_<GOARCH>`. */
export function crossCc(t: Target): string | undefined {
  if (process.platform === 'darwin' && t.goos === 'darwin')
    return `clang -arch ${t.goarch === 'amd64' ? 'x86_64' : 'arm64'}`;
  const v = process.env[`SINETE_CC_${t.goos.toUpperCase()}_${t.goarch.toUpperCase()}`];
  return v === undefined || v === '' ? undefined : v;
}

/** Sabores p11 que dá para compilar nesta máquina: o host, os darwin no macOS e os que têm `SINETE_CC_*`. */
export function p11Targets(): Target[] {
  const host = hostTarget();
  return P11_TARGETS.filter((t) => sameTarget(t, host) || crossCc(t) !== undefined);
}

async function sha256(file: string): Promise<string> {
  return createHash('sha256')
    .update(new Uint8Array(await Bun.file(file).arrayBuffer()))
    .digest('hex');
}

async function writeSums(outDir: string): Promise<Map<string, string>> {
  const sums = new Map<string, string>();
  for (const f of (await readdir(outDir)).sort()) {
    if (f.startsWith('sinete-signer')) sums.set(f, await sha256(path.join(outDir, f)));
  }
  await Bun.write(path.join(outDir, 'SHA256SUMS'), [...sums].map(([f, h]) => `${h}  ${f}\n`).join(''));
  return sums;
}

/** Lê um SHA256SUMS (`<hash>  <arquivo>` por linha). */
export async function readSums(dir: string): Promise<Map<string, string>> {
  const text = await Bun.file(path.join(dir, 'SHA256SUMS')).text();
  return new Map(
    text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split(/\s+/))
      .map(([h, f]) => [f as string, h as string]),
  );
}

async function buildAll(
  go: string,
  outDir: string,
  opts: { only: 'host' | 'p11' | 'all'; p11: boolean },
): Promise<Map<string, string>> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const statics = opts.only === 'host' ? [hostTarget()] : opts.only === 'p11' ? [] : STATIC_TARGETS;
  for (const t of statics) await buildOne(go, t, 'static', outDir);
  if (opts.p11) {
    const p11 = opts.only === 'host' ? [hostTarget()] : p11Targets();
    for (const t of p11) {
      try {
        await buildOne(go, t, 'p11', outDir);
      } catch (e) {
        // Compilador pedido explicitamente (ou o job só de p11) que falha é erro; o do host sem toolchain C, aviso.
        if (opts.only === 'p11' || crossCc(t) !== undefined) throw e;
        console.warn(`aviso: ${(e as Error).message.split('\n')[0]} (sabor p11 fica para o CI)`);
      }
    }
  }
  return writeSums(outDir);
}

/**
 * Junta os `dist/` de vários jobs num só, com SHA256SUMS novo. Cada arquivo confere com o SHA256SUMS do dist de origem,
 * e o mesmo nome vindo de dois jobs precisa do mesmo hash.
 */
export async function mergeDists(inputs: readonly string[], outDir: string): Promise<Map<string, string>> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const seen = new Map<string, string>();
  for (const dir of inputs) {
    for (const [f, h] of await readSums(dir)) {
      if ((await sha256(path.join(dir, f))) !== h) throw new Error(`${dir}/${f}: SHA-256 não confere com o SHA256SUMS`);
      const prev = seen.get(f);
      if (prev !== undefined && prev !== h) throw new Error(`${f}: hashes diferentes entre os builds (${prev} e ${h})`);
      if (prev === undefined) await copyFile(path.join(dir, f), path.join(outDir, f));
      seen.set(f, h);
    }
  }
  return writeSums(outDir);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outDir = path.resolve(outIdx >= 0 ? (args[outIdx + 1] as string) : path.join(HELPER_DIR, 'dist'));
  const merges = args.flatMap((a, i) => (a === '--merge' ? [path.resolve(args[i + 1] as string)] : []));
  if (merges.length > 0) {
    const sums = await mergeDists(merges, outDir);
    for (const [f, h] of sums) console.log(`${h}  ${f}`);
    process.exit(0);
  }
  const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
  const only = onlyArg === 'host' || onlyArg === 'p11' ? onlyArg : 'all';
  const p11 = !args.includes('--no-p11');
  const go = findGo();
  if (!go) {
    console.error('Go não encontrado (PATH, GO ou ~/.local/state/sinete/go)');
    process.exit(1);
  }
  console.log((await $`${go} version`.text()).trim());
  const sums = await buildAll(go, outDir, { only, p11 });
  for (const [f, h] of sums) console.log(`${h}  ${f}`);
  if (args.includes('--verify')) {
    const again = await buildAll(go, `${outDir}.verify`, { only, p11 });
    const diff = [...sums].filter(([f, h]) => again.get(f) !== h).map(([f]) => f);
    await rm(`${outDir}.verify`, { recursive: true, force: true });
    if (diff.length > 0 || again.size !== sums.size) {
      console.error(`build não reprodutível: ${diff.join(', ') || 'conjuntos diferentes'}`);
      process.exit(1);
    }
    console.log(`reprodutível: ${sums.size} binários idênticos em dois builds`);
  }
}
