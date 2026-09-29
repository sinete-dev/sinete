#!/usr/bin/env bun
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
/**
 * Smoke dos pacotes empacotados: sobe um verdaccio efêmero, publica o workspace nele com o mesmo
 * scripts/release.ts do release real, instala os tarballs em consumidores novos e roda em Node
 * (ESM, require, bin, tsc nodenext), Deno (npm:, deno check) e Chromium real (Playwright).
 *
 * Uso: bun smoke/run.ts
 * Env: VERDACCIO_BIN (padrão: verdaccio no PATH), SMOKE_NODE_VERSIONS="20.20.2 22.23.3" (usa fnm; sem isso usa `node`),
 *      SMOKE_SKIP="deno,browser" para pular alvos.
 */
import { $ } from 'bun';

const root = path.resolve(import.meta.dir, '..');
const work = path.join(import.meta.dir, '.work');
const fixtures = path.join(import.meta.dir, 'fixtures');
const skip = new Set((process.env.SMOKE_SKIP ?? '').split(',').filter(Boolean));
const results: { check: string; ok: boolean; detail: string }[] = [];

function record(check: string, ok: boolean, detail: string): void {
  results.push({ check, ok, detail: detail.replace(/\s+/g, ' ').slice(0, 160) });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${check} :: ${detail.replace(/\s+/g, ' ').slice(0, 160)}`);
}

type Out = { condition?: string; stamp?: string; instanceofOk?: boolean; xml?: string };
const STAMP = '<dhEmi>2026-09-25T12:00:00.000Z</dhEmi>';
function checkJson(check: string, text: string, want: { condition: string }): void {
  try {
    const o = JSON.parse(text.trim().split('\n').at(-1) ?? '') as Out;
    const ok = o.condition === want.condition && (o.stamp ?? o.xml) === STAMP && o.instanceofOk !== false;
    record(check, ok, text);
  } catch {
    record(check, false, text);
  }
}

await rm(work, { recursive: true, force: true });
await mkdir(path.join(work, 'verdaccio/storage'), { recursive: true });

// 1. verdaccio efêmero, morto pelo PID no finally
const port = 40000 + Math.floor(Math.random() * 20000);
const registry = `http://127.0.0.1:${port}/`;
await Bun.write(
  path.join(work, 'verdaccio/config.yaml'),
  `storage: ./storage\npackages:\n  '@sinete/*':\n    access: $all\n    publish: $all\n  '**':\n    access: $all\n    proxy: npmjs\nuplinks:\n  npmjs:\n    url: https://registry.npmjs.org/\nlog: { type: stdout, level: error }\n`,
);
const npmrc = path.join(work, 'npmrc');
await Bun.write(npmrc, `registry=${registry}\n//127.0.0.1:${port}/:_authToken=smoke-fake-token\n`);
const env = { ...process.env, NPM_CONFIG_USERCONFIG: npmrc, NPM_CONFIG_REGISTRY: registry };
const verdaccio = Bun.spawn(
  [
    process.env.VERDACCIO_BIN ?? 'verdaccio',
    '--config',
    path.join(work, 'verdaccio/config.yaml'),
    '--listen',
    `127.0.0.1:${port}`,
  ],
  { stdout: 'ignore', stderr: 'ignore' },
);
console.log(`verdaccio pid=${verdaccio.pid} em ${registry}`);

try {
  for (let i = 0; i < 50; i++) {
    const ok = await fetch(`${registry}-/ping`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) break;
    await Bun.sleep(200);
  }

  // 2. publica com o script de release real (bun pm pack + npm publish <tgz>)
  const pub = await $`bun scripts/release.ts`.cwd(root).env(env).nothrow().quiet();
  record('release.ts publica no verdaccio', pub.exitCode === 0, pub.stdout.toString() + pub.stderr.toString());
  const version = async (p: string): Promise<string> =>
    (await Bun.file(path.join(root, `packages/${p}/package.json`)).json()).version;
  const deps = {
    '@sinete/core': await version('core'),
    '@sinete/xml': await version('xml'),
    '@sinete/cli': await version('cli'),
  };

  // 3. consumidor Node
  const nodeDir = path.join(work, 'node');
  await mkdir(nodeDir, { recursive: true });
  await Bun.write(
    path.join(nodeDir, 'package.json'),
    JSON.stringify({ private: true, type: 'module', dependencies: { ...deps, '@types/node': '^22' } }),
  );
  const inst = await $`npm install --no-audit --no-fund`.cwd(nodeDir).env(env).nothrow().quiet();
  record('npm install dos tarballs', inst.exitCode === 0, inst.stderr.toString() || 'ok');
  await $`cp ${fixtures}/esm.mjs ${fixtures}/cjs.cjs ${fixtures}/typed.ts ${fixtures}/browser.mjs ${nodeDir}/`;
  const versions = (process.env.SMOKE_NODE_VERSIONS ?? '').split(/\s+/).filter(Boolean);
  const nodes = versions.length ? versions.map((v) => ['fnm', 'exec', `--using=${v}`, 'node']) : [['node']];
  for (const cmd of nodes) {
    const label = cmd.length > 1 ? `node ${cmd[2]?.slice(8)}` : 'node';
    for (const file of ['esm.mjs', 'cjs.cjs']) {
      const r = await $`${cmd} ${file}`.cwd(nodeDir).nothrow().quiet();
      checkJson(`${label} ${file === 'esm.mjs' ? 'import' : 'require'}`, r.stdout.toString() + r.stderr.toString(), {
        condition: 'node',
      });
    }
  }
  const bin = await $`npx --no-install sinete doctor`.cwd(nodeDir).nothrow().quiet();
  checkJson('bin sinete doctor', bin.stdout.toString() + bin.stderr.toString(), { condition: 'node' });
  const tsc = path.join(root, 'node_modules/.bin/tsc');
  const tc =
    await $`${tsc} --noEmit --strict --module nodenext --moduleResolution nodenext --types node --skipLibCheck false typed.ts`
      .cwd(nodeDir)
      .nothrow()
      .quiet();
  record('tsc nodenext no consumidor', tc.exitCode === 0, tc.stdout.toString() || 'exit 0');

  // 4. Deno via npm:
  if (!skip.has('deno')) {
    const denoDir = path.join(work, 'deno');
    await mkdir(denoDir, { recursive: true });
    const rewrite = (src: string): string =>
      src
        .replaceAll("'@sinete/core/runtime'", `'npm:@sinete/core@${deps['@sinete/core']}/runtime'`)
        .replaceAll("'@sinete/core'", `'npm:@sinete/core@${deps['@sinete/core']}'`)
        .replaceAll("'@sinete/xml'", `'npm:@sinete/xml@${deps['@sinete/xml']}'`);
    await Bun.write(path.join(denoDir, 'esm.mjs'), rewrite(await Bun.file(path.join(fixtures, 'esm.mjs')).text()));
    await Bun.write(path.join(denoDir, 'typed.ts'), rewrite(await Bun.file(path.join(fixtures, 'typed.ts')).text()));
    const denoEnv = { ...env, DENO_DIR: path.join(work, 'deno-cache') };
    // Deno 2.9 ignora versões com menos de 24 h por padrão; no smoke tudo acabou de ser publicado.
    const age = '--minimum-dependency-age=0';
    const run = await $`deno run --quiet ${age} --allow-read --allow-env esm.mjs`
      .cwd(denoDir)
      .env(denoEnv)
      .nothrow()
      .quiet();
    checkJson('deno run npm:', run.stdout.toString() + run.stderr.toString(), { condition: 'node' });
    const chk = await $`deno check --quiet ${age} typed.ts`.cwd(denoDir).env(denoEnv).nothrow().quiet();
    record('deno check', chk.exitCode === 0, chk.stderr.toString() || 'exit 0');
    const dbin = await $`deno run --quiet ${age} -A npm:@sinete/cli@${deps['@sinete/cli']} doctor`
      .cwd(denoDir)
      .env(denoEnv)
      .nothrow()
      .quiet();
    checkJson('deno bin npm:@sinete/cli', dbin.stdout.toString() + dbin.stderr.toString(), { condition: 'node' });
  }

  // 5. Chromium real: bundle do consumidor com bun build --target=browser, servido pelo Bun.serve
  if (!skip.has('browser')) {
    const b = await Bun.build({ entrypoints: [path.join(nodeDir, 'browser.mjs')], target: 'browser', format: 'esm' });
    const js = b.success ? await b.outputs[0]!.text() : '';
    record(
      'bun build --target=browser sem node:',
      b.success && !js.includes('node:'),
      b.success ? `${js.length} bytes` : String(b.logs),
    );
    const server = Bun.serve({
      port: 0,
      fetch: (req) =>
        new URL(req.url).pathname === '/bundle.js'
          ? new Response(js, { headers: { 'content-type': 'text/javascript' } })
          : new Response('<!doctype html><script type="module" src="/bundle.js"></script>', {
              headers: { 'content-type': 'text/html' },
            }),
    });
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.port}/`);
        await page.waitForFunction(() => (globalThis as { __result?: unknown }).__result, null, { timeout: 10_000 });
        const res = await page.evaluate(() => (globalThis as { __result?: unknown }).__result);
        checkJson(`chromium ${browser.version()}`, JSON.stringify(res), { condition: 'default' });
      } finally {
        await browser.close();
      }
    } catch (e) {
      record('chromium (playwright)', false, String(e));
    } finally {
      server.stop(true);
    }
  }
} finally {
  verdaccio.kill();
  await verdaccio.exited;
  console.log(`verdaccio pid=${verdaccio.pid} encerrado`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações ok`);
process.exit(failed.length ? 1 : 0);
