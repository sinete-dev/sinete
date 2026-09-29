#!/usr/bin/env bun
/**
 * Smoke dos pacotes npm do helper (ADR 0014): publica os tarballs num registry, instala o `@sinete/signer` num
 * consumidor novo e, no Node, sobe o helper pelo lançador: `hello` do estático e, quando o pacote da plataforma traz o
 * `-p11`, `hello` com o backend `pkcs11`. Confere que o gerenciador instalou só o pacote da plataforma do host.
 *
 * Dois usos:
 * - `signerSmoke()`, chamado pelo `smoke/run.ts` com o verdaccio dele, depois de o `release.ts` publicar o
 *   `@sinete/transport`: compila o host (`build.ts --only host`), monta e empacota os pacotes e roda o consumidor;
 * - CLI, no job por SO do CI: `bun helpers/signer-tls/scripts/smoke.ts --tarballs dir [--require-p11]`, com os tarballs
 *   do helper e os do `@sinete/core`, `@sinete/cert` e `@sinete/transport` em `dir`. Sobe um verdaccio próprio
 *   (`VERDACCIO_BIN` ou `verdaccio` no PATH), morto pelo PID no fim.
 */
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { $ } from 'bun';
import { binaryName, findGo, HELPER_DIR, hostTarget, version } from './build.ts';
import { pack, stage } from './npm.ts';

export interface SmokeResult {
  readonly check: string;
  readonly ok: boolean;
  readonly detail: string;
}

const CONSUMER = `import { readdirSync } from 'node:fs';
import { signerBinary, signerPackage, startSigner } from '@sinete/signer';

const failures = [];
const { pkg } = signerPackage();
const plataformas = readdirSync('node_modules/@sinete').filter((n) => n.startsWith('signer-'));
if (plataformas.length !== 1 || '@sinete/' + plataformas[0] !== pkg) {
  failures.push('pacotes de plataforma instalados: ' + plataformas.join(', ') + '; esperado só ' + pkg);
}
const s = await startSigner({ lab: true });
if (!s.hello.backends.includes('remote') || s.hello.backends.includes('pkcs11')) {
  failures.push('estático: backends ' + s.hello.backends.join(','));
}
await s.close();
let p11 = false;
try {
  signerBinary({ pkcs11: true });
  p11 = true;
} catch {}
if (p11) {
  const q = await startSigner({ lab: true, pkcs11: true });
  if (!q.hello.backends.includes('pkcs11')) failures.push('-p11: backends ' + q.hello.backends.join(','));
  await q.close();
}
if (process.env.SIGNER_SMOKE_REQUIRE_P11 === '1' && !p11) failures.push(pkg + ' sem o sabor -p11');
console.log(JSON.stringify({ ok: failures.length === 0, failures, pkg, p11, helper: s.hello.helper }));
`;

const out = (r: { stdout: Buffer; stderr: Buffer }): string => r.stdout.toString() + r.stderr.toString();

/** Publica os tarballs no registry de `env` (NPM_CONFIG_USERCONFIG e NPM_CONFIG_REGISTRY), na ordem dada. */
async function publish(tarballs: readonly string[], env: Record<string, string | undefined>): Promise<SmokeResult> {
  const feitos: string[] = [];
  for (const t of tarballs) {
    const r = await $`npm publish ${t} --access public`.env(env).nothrow().quiet();
    if (r.exitCode !== 0) return { check: 'publica os pacotes do helper', ok: false, detail: `${t}: ${out(r)}` };
    feitos.push(path.basename(t));
  }
  return { check: 'publica os pacotes do helper', ok: true, detail: feitos.join(', ') };
}

/** Instala o `@sinete/signer` num consumidor novo e sobe o helper pelo lançador no Node. */
async function consume(
  work: string,
  env: Record<string, string | undefined>,
  requireP11: boolean,
): Promise<SmokeResult[]> {
  const results: SmokeResult[] = [];
  const consumer = path.join(work, 'consumer-signer');
  await rm(consumer, { recursive: true, force: true });
  await mkdir(consumer, { recursive: true });
  await Bun.write(
    path.join(consumer, 'package.json'),
    JSON.stringify({ private: true, type: 'module', dependencies: { '@sinete/signer': await version() } }, null, 2),
  );
  const inst = await $`npm install --no-audit --no-fund`.cwd(consumer).env(env).nothrow().quiet();
  results.push({ check: 'npm install do @sinete/signer', ok: inst.exitCode === 0, detail: out(inst) || 'ok' });
  if (inst.exitCode !== 0) return results;
  await Bun.write(path.join(consumer, 'hello.mjs'), CONSUMER);
  const r = await $`node hello.mjs`
    .cwd(consumer)
    .env({ ...env, SIGNER_SMOKE_REQUIRE_P11: requireP11 ? '1' : '0' })
    .nothrow()
    .quiet();
  let ok = false;
  try {
    const o = JSON.parse(r.stdout.toString().trim().split('\n').at(-1) ?? '') as { ok?: boolean };
    ok = r.exitCode === 0 && o.ok === true;
  } catch {}
  results.push({ check: `node ${process.platform}/${process.arch} hello pelo @sinete/signer`, ok, detail: out(r) });
  return results;
}

/**
 * Para o `smoke/run.ts`: compila o host, monta, empacota, publica e consome. Sem Go, devolve `undefined` (a smoke dos
 * pacotes `@sinete/*` segue sem o helper).
 */
export async function signerSmoke(opts: {
  readonly work: string;
  readonly env: Record<string, string | undefined>;
}): Promise<SmokeResult[] | undefined> {
  if (!findGo()) return undefined;
  const dist = path.join(opts.work, 'signer-dist');
  const b = await $`bun ${path.join(HELPER_DIR, 'scripts/build.ts')} --only host --out ${dist}`.nothrow().quiet();
  if (b.exitCode !== 0) return [{ check: 'build do helper (host)', ok: false, detail: out(b) }];
  const npmDir = path.join(dist, 'npm');
  await stage(dist, npmDir);
  const tarballs = await pack(npmDir);
  // Os pacotes de plataforma antes do lançador, como no release.
  tarballs.sort(
    (a, b) => Number(/sinete-signer-\d/.test(path.basename(a))) - Number(/sinete-signer-\d/.test(path.basename(b))),
  );
  const pub = await publish(tarballs, opts.env);
  if (!pub.ok) return [pub];
  // O host compila o próprio -p11 quando tem toolchain C; se compilou, o pacote tem de levá-lo até o consumidor.
  const p11 = await Bun.file(path.join(dist, binaryName(hostTarget(), 'p11'))).exists();
  return [pub, ...(await consume(opts.work, opts.env, p11))];
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf('--tarballs');
  if (dirIdx < 0) {
    console.error('uso: bun helpers/signer-tls/scripts/smoke.ts --tarballs dir [--require-p11]');
    return 2;
  }
  const dir = path.resolve(args[dirIdx + 1] as string);
  const verdaccioBin = process.env.VERDACCIO_BIN ?? Bun.which('verdaccio');
  if (!verdaccioBin) {
    console.error('smoke do helper: verdaccio não encontrado; defina VERDACCIO_BIN');
    return 1;
  }
  const work = path.join(dir, '.smoke');
  await rm(work, { recursive: true, force: true });
  await mkdir(path.join(work, 'verdaccio/storage'), { recursive: true });
  const port = 40000 + Math.floor(Math.random() * 20000);
  const registry = `http://127.0.0.1:${port}/`;
  await Bun.write(
    path.join(work, 'verdaccio/config.yaml'),
    `storage: ./storage\npackages:\n  '@sinete/*':\n    access: $all\n    publish: $all\n  '**':\n    access: $all\n    proxy: npmjs\nuplinks:\n  npmjs:\n    url: https://registry.npmjs.org/\nlog: { type: stdout, level: error }\n`,
  );
  const npmrc = path.join(work, 'npmrc');
  await Bun.write(npmrc, `registry=${registry}\n//127.0.0.1:${port}/:_authToken=smoke-fake-token\n`);
  const env = { ...process.env, NPM_CONFIG_USERCONFIG: npmrc, NPM_CONFIG_REGISTRY: registry };
  // Script Node (o bin do pacote global) roda pelo node: no Windows o .cmd do npm não sobe pelo spawn.
  const script = (
    await Bun.file(verdaccioBin)
      .text()
      .catch(() => '')
  ).startsWith('#!');
  const verdaccio = Bun.spawn(
    [
      ...(script ? ['node'] : []),
      verdaccioBin,
      '--config',
      path.join(work, 'verdaccio/config.yaml'),
      '--listen',
      `127.0.0.1:${port}`,
    ],
    { stdout: 'ignore', stderr: 'ignore' },
  );
  console.log(`verdaccio pid=${verdaccio.pid} em ${registry}`);
  const results: SmokeResult[] = [];
  try {
    let up = false;
    for (let i = 0; i < 150 && !up; i++) {
      up = await fetch(`${registry}-/ping`).then(
        (r) => r.ok,
        () => false,
      );
      if (!up) await Bun.sleep(200);
    }
    if (!up) throw new Error('verdaccio não respondeu em 30 s');
    // Dependências do lançador primeiro (core, cert, transport), depois os pacotes de plataforma, por fim o lançador.
    const ordem = (f: string): number =>
      f.startsWith('sinete-core-')
        ? 0
        : f.startsWith('sinete-cert-')
          ? 1
          : f.startsWith('sinete-transport-')
            ? 2
            : /^sinete-signer-\d/.test(f)
              ? 4
              : 3;
    const tarballs = (await readdir(dir))
      .filter((f) => f.endsWith('.tgz'))
      .sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b))
      .map((f) => path.join(dir, f));
    const pub = await publish(tarballs, env);
    results.push(pub);
    if (pub.ok) results.push(...(await consume(work, env, args.includes('--require-p11'))));
  } finally {
    verdaccio.kill();
    await verdaccio.exited;
    console.log(`verdaccio pid=${verdaccio.pid} encerrado`);
  }
  for (const r of results) {
    const flat = r.detail.replace(/\s+/g, ' ').trim();
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.check} :: ${r.ok ? flat.slice(0, 160) : flat.slice(0, 3000)}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações ok`);
  return failed === 0 && results.length > 0 ? 0 : 1;
}

if (import.meta.main) process.exit(await main());
