#!/usr/bin/env bun
/**
 * Smoke dos pacotes empacotados (ADR 0001): sobe um verdaccio efêmero só em 127.0.0.1, publica o workspace nele com o
 * mesmo scripts/release.ts do release real, instala os tarballs num consumidor novo e roda as fixtures de
 * `smoke/fixtures/<pacote>/` em:
 *   - Node: `import` (esm.mjs) e `require` (cjs.cjs), por versão, e o bin `sinete doctor`;
 *   - Bun: `import` do pacote instalado;
 *   - tsc nodenext no consumidor (typed.ts);
 *   - Deno: `run` e `check` via `npm:`;
 *   - Chromium real via Playwright, com o bundle `bun build --target=browser` do consumidor (browser.mjs);
 *   - os pacotes npm do helper `sinete-signer` da plataforma do host (ADR 0014), compilado aqui quando há Go.
 * Um segundo consumidor, sem o `@sinete/da` (peer opcional do `@sinete/emissor`), roda `fixtures/_sem-da/` no Node, no
 * Deno e no bundle de browser.
 * Cada fixture imprime (ou deixa em `globalThis.__result`) um JSON `{ ok, failures }`; o runner confere com asserção.
 *
 * Todo pacote público precisa de um diretório de fixtures: a smoke cresce junto com os pacotes.
 *
 * Uso: bun run build && bun smoke/run.ts
 * Env: VERDACCIO_BIN (padrão: verdaccio no PATH ou instalado em smoke/.tools/), SMOKE_NODE_VERSIONS="20.20.2 22.23.3" (via fnm; sem isso usa o
 *      `node` do PATH), VERDACCIO_NODE (o Node que roda o verdaccio, que exige 22 ou mais novo, quando o do PATH é mais
 *      antigo), SMOKE_SKIP="deno,browser,bun,signer" para pular alvos.
 */
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';
import { signerSmoke } from '../helpers/signer-tls/scripts/smoke.ts';
import { exportTargets, root, workspacePackages } from '../scripts/lib/workspace.ts';

const work = path.join(import.meta.dir, '.work');
const fixtures = path.join(import.meta.dir, 'fixtures');
const skip = new Set((process.env.SMOKE_SKIP ?? '').split(',').filter(Boolean));
const results: { check: string; ok: boolean }[] = [];

function record(check: string, ok: boolean, detail: string): void {
  results.push({ check, ok });
  const flat = detail.replace(/\s+/g, ' ').trim();
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${check} :: ${ok ? flat.slice(0, 140) : flat.slice(0, 2000)}`);
}

/** A fixture imprime um JSON na última linha: `{ ok: true, failures: [] }`. */
function checkJson(check: string, text: string): void {
  try {
    const o = JSON.parse(text.trim().split('\n').at(-1) ?? '') as { ok?: boolean; failures?: string[] };
    record(check, o.ok === true && (o.failures ?? []).length === 0, text);
  } catch {
    record(check, false, text || '(sem saída)');
  }
}

const out = (r: { stdout: Buffer; stderr: Buffer }): string => r.stdout.toString() + r.stderr.toString();

/**
 * O verdaccio vem de VERDACCIO_BIN, do PATH ou, sem nenhum dos dois, de uma instalação local em `smoke/.tools/` (fora do
 * git, reaproveitada entre execuções), na versão fixada aqui. Assim a smoke roda numa máquina sem instalação global e
 * o processo continua sendo o próprio verdaccio, morto pelo PID no fim.
 */
const VERDACCIO_VERSION = '6.10.4';
async function verdaccioLocal(): Promise<string | undefined> {
  const tools = path.join(import.meta.dir, '.tools');
  const bin = path.join(tools, 'node_modules/.bin/verdaccio');
  const instalado = await Bun.file(path.join(tools, 'node_modules/verdaccio/package.json'))
    .json()
    .then(
      (m: { version?: string }) => m.version,
      () => undefined,
    );
  if (instalado === VERDACCIO_VERSION) return bin;
  console.log(`smoke: instalando verdaccio@${VERDACCIO_VERSION} em ${tools}`);
  await mkdir(tools, { recursive: true });
  await Bun.write(path.join(tools, 'package.json'), '{ "private": true }\n');
  const r = await $`npm install --no-audit --no-fund --no-save verdaccio@${VERDACCIO_VERSION}`
    .cwd(tools)
    .nothrow()
    .quiet();
  if (r.exitCode !== 0) {
    console.error(out(r));
    return undefined;
  }
  return bin;
}

// Caminho resolvido: com VERDACCIO_NODE, o node recebe o arquivo do bin, não o nome.
const verdaccioEnv = process.env.VERDACCIO_BIN;
const verdaccioBin =
  (verdaccioEnv ? (Bun.which(verdaccioEnv) ?? verdaccioEnv) : undefined) ??
  Bun.which('verdaccio') ??
  (await verdaccioLocal());
if (!verdaccioBin) {
  console.error('smoke: verdaccio não encontrado nem instalável em smoke/.tools; defina VERDACCIO_BIN');
  process.exit(1);
}

const pkgs = (await workspacePackages()).filter((p) => !p.manifest.private);
for (const { dir, manifest: m } of pkgs) {
  for (const t of exportTargets(m)) {
    if (!(await Bun.file(path.join(dir, t.file)).exists())) {
      console.error(`smoke: ${m.name} sem ${t.file}; rode bun run build antes`);
      process.exit(1);
    }
  }
}
const fixtureDirs = new Set(await readdir(fixtures));
const covered = pkgs.filter((p) => fixtureDirs.has(path.basename(p.dir)));
for (const p of pkgs) {
  if (!fixtureDirs.has(path.basename(p.dir))) {
    record(`fixtures de ${p.manifest.name}`, false, `falta smoke/fixtures/${path.basename(p.dir)}/`);
  }
}

await rm(work, { recursive: true, force: true });
await mkdir(path.join(work, 'verdaccio/storage'), { recursive: true });

// 1. verdaccio efêmero, morto pelo PID no finally
const port = 40000 + Math.floor(Math.random() * 20000);
const registry = `http://127.0.0.1:${port}/`;
await Bun.write(
  path.join(work, 'verdaccio/config.yaml'),
  `storage: ./storage\npackages:\n  '@sinete/*':\n    access: $all\n    publish: $all\n  sinete:\n    access: $all\n    publish: $all\n  '**':\n    access: $all\n    proxy: npmjs\nuplinks:\n  npmjs:\n    url: https://registry.npmjs.org/\nlog: { type: stdout, level: error }\n`,
);
const npmrc = path.join(work, 'npmrc');
await Bun.write(npmrc, `registry=${registry}\n//127.0.0.1:${port}/:_authToken=smoke-fake-token\n`);
const env = { ...process.env, NPM_CONFIG_USERCONFIG: npmrc, NPM_CONFIG_REGISTRY: registry };
const verdaccio = Bun.spawn(
  [
    ...(process.env.VERDACCIO_NODE ? [process.env.VERDACCIO_NODE] : []),
    verdaccioBin,
    '--config',
    path.join(work, 'verdaccio/config.yaml'),
    '--listen',
    `127.0.0.1:${port}`,
  ],
  { stdout: 'ignore', stderr: 'ignore' },
);
console.log(`verdaccio pid=${verdaccio.pid} em ${registry}`);

try {
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    up = await fetch(`${registry}-/ping`).then(
      (r) => r.ok,
      () => false,
    );
    if (!up) await Bun.sleep(200);
  }
  if (!up) throw new Error('verdaccio não respondeu em 20 s');

  // 2. publica com o script de release real (bun pm pack + travas + npm publish <tgz>)
  const pub = await $`bun scripts/release.ts`.cwd(root).env(env).nothrow().quiet();
  record('release.ts publica no verdaccio', pub.exitCode === 0, out(pub));

  // 3. consumidor novo, instalado do registry
  const consumer = path.join(work, 'consumer');
  await mkdir(consumer, { recursive: true });
  const deps = Object.fromEntries(pkgs.map((p) => [p.manifest.name, p.manifest.version]));
  await Bun.write(
    path.join(consumer, 'package.json'),
    JSON.stringify({ private: true, type: 'module', dependencies: deps }, null, 2),
  );
  const inst = await $`npm install --no-audit --no-fund`.cwd(consumer).env(env).nothrow().quiet();
  record('npm install dos tarballs', inst.exitCode === 0, inst.exitCode === 0 ? 'ok' : out(inst));
  for (const p of covered)
    await cp(path.join(fixtures, path.basename(p.dir)), path.join(consumer, path.basename(p.dir)), { recursive: true });
  const names = covered.map((p) => path.basename(p.dir));

  // 3b. Consumidor sem o @sinete/da, peer dependency opcional do @sinete/emissor: a instalação não o traz, o bundle de
  // browser fecha sem ele e o pdf() pede o pacote com ConfigError.
  const semDa = path.join(work, 'consumer-sem-da');
  await mkdir(semDa, { recursive: true });
  const depsSemDa = Object.fromEntries(
    ['@sinete/core', '@sinete/emissor', '@sinete/nfe', '@sinete/mdfe', '@sinete/sefaz-sim'].map((n) => [n, deps[n]]),
  );
  await Bun.write(
    path.join(semDa, 'package.json'),
    JSON.stringify({ private: true, type: 'module', dependencies: depsSemDa }, null, 2),
  );
  const instSemDa = await $`npm install --no-audit --no-fund`.cwd(semDa).env(env).nothrow().quiet();
  const daInstalado = await Bun.file(path.join(semDa, 'node_modules/@sinete/da/package.json')).exists();
  record(
    'npm install do emissor sem o @sinete/da',
    instSemDa.exitCode === 0 && !daInstalado,
    instSemDa.exitCode === 0 ? `@sinete/da instalado: ${daInstalado}` : out(instSemDa),
  );
  await cp(path.join(fixtures, '_sem-da'), semDa, { recursive: true });
  const rSemDa = await $`node curto.mjs`.cwd(semDa).nothrow().quiet();
  checkJson('node emissor sem o @sinete/da', out(rSemDa));
  const bSemDa = await Bun.build({ entrypoints: [path.join(semDa, 'curto.mjs')], target: 'browser', format: 'esm' });
  record(
    'bun build --target=browser do emissor sem o @sinete/da',
    bSemDa.success,
    bSemDa.success ? `${bSemDa.outputs.length} arquivo(s)` : bSemDa.logs.map(String).join('\n'),
  );

  // 4. Node, por versão
  const versions = (process.env.SMOKE_NODE_VERSIONS ?? '').split(/\s+/).filter(Boolean);
  const nodes = versions.length ? versions.map((v) => ['fnm', 'exec', `--using=${v}`, 'node']) : [['node']];
  for (const cmd of nodes) {
    const v = (await $`${cmd} --version`.nothrow().quiet()).stdout.toString().trim();
    for (const n of names) {
      for (const [file, mode] of [
        ['esm.mjs', 'import'],
        ['cjs.cjs', 'require'],
      ] as const) {
        if (!(await Bun.file(path.join(consumer, n, file)).exists())) continue;
        const r = await $`${cmd} ${file}`.cwd(path.join(consumer, n)).nothrow().quiet();
        checkJson(`node ${v} ${mode} ${n}`, out(r));
      }
    }
  }

  // 4b. O bin `sinete doctor` do pacote instalado, por versão do Node, com o PFX sintético e sem rede.
  if (names.includes('cli')) {
    await cp(path.join(root, 'packages/cert/test/fixtures/ecnpj-legacy.pfx'), path.join(consumer, 'sintetico.pfx'));
    for (const cmd of nodes) {
      const v = (await $`${cmd} --version`.nothrow().quiet()).stdout.toString().trim();
      const r = await $`${cmd} node_modules/.bin/sinete doctor --pfx sintetico.pfx --allow-expired --json`
        .cwd(consumer)
        .env({ ...env, SINETE_PFX_SENHA: 'sinete-teste' })
        .nothrow()
        .quiet();
      const text = out(r);
      let ok = false;
      try {
        const report = JSON.parse(r.stdout.toString()) as { checks: { id: string; status: string }[] };
        const pfx = report.checks.find((c) => c.id === 'pfx');
        ok = r.exitCode === 0 && (pfx?.status === 'ok' || pfx?.status === 'aviso') && !text.includes('PRIVATE');
      } catch {}
      record(`node ${v} bin sinete doctor`, ok, text);
    }
  }

  // 4c. O bin do guarda-chuva `sinete`, pelo caminho do próprio pacote: quando o consumidor instala também o
  // `@sinete/cli`, os dois declaram o bin `sinete` e o npm liga um só em node_modules/.bin (os dois são a mesma CLI).
  if (names.includes('sinete')) {
    const bin = (await Bun.file(path.join(consumer, 'node_modules/sinete/package.json')).json()) as {
      bin?: Record<string, string>;
    };
    const cli = path.join('node_modules/sinete', bin.bin?.sinete ?? 'sem-bin');
    for (const cmd of nodes) {
      const v = (await $`${cmd} --version`.nothrow().quiet()).stdout.toString().trim();
      const r = await $`${cmd} ${cli} doctor --pfx sintetico.pfx --allow-expired --json`
        .cwd(consumer)
        .env({ ...env, SINETE_PFX_SENHA: 'sinete-teste' })
        .nothrow()
        .quiet();
      let ok = false;
      try {
        const report = JSON.parse(r.stdout.toString()) as { checks: { id: string; status: string }[] };
        const pfx = report.checks.find((c) => c.id === 'pfx');
        ok = r.exitCode === 0 && (pfx?.status === 'ok' || pfx?.status === 'aviso') && !out(r).includes('PRIVATE');
      } catch {}
      record(`node ${v} bin do guarda-chuva sinete doctor`, ok, out(r));
    }
    // A fixture do guarda-chuva precisa cobrir todo subpath publicado.
    const exportsUmbrella = Object.keys(
      ((await Bun.file(path.join(consumer, 'node_modules/sinete/package.json')).json()) as { exports: object }).exports,
    ).filter((k) => k !== './package.json');
    const fixture = await Bun.file(path.join(fixtures, 'sinete/checks.mjs')).text();
    const faltam = exportsUmbrella.filter((k) => !fixture.includes(`'sinete/${k.slice(2)}'`));
    record('fixture do guarda-chuva cobre todos os subpaths', faltam.length === 0, `faltam [${faltam.join(', ')}]`);
  }

  // 4d. Pacotes do helper (ADR 0014): o da plataforma do host e o lançador, publicados aqui e instalados num consumidor
  // que sobe o helper pelo @sinete/signer. Sem Go, fica de fora (o job signer do CI cobre as outras plataformas).
  if (!skip.has('signer')) {
    const r = await signerSmoke({ work, env });
    if (r === undefined) console.log('smoke: Go ausente, pacotes do sinete-signer pulados');
    else for (const x of r) record(x.check, x.ok, x.detail);
  }

  // 5. Bun consumindo o pacote instalado (não o fonte)
  if (!skip.has('bun')) {
    for (const n of names) {
      const r = await $`bun esm.mjs`.cwd(path.join(consumer, n)).nothrow().quiet();
      checkJson(`bun ${Bun.version} import ${n}`, out(r));
    }
  }

  // 6. tsc nodenext no consumidor, sem @types/node
  await Bun.write(
    path.join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        module: 'nodenext',
        moduleResolution: 'nodenext',
        target: 'es2022',
        lib: ['es2023', 'dom'],
        types: [],
        skipLibCheck: false,
        exactOptionalPropertyTypes: true,
      },
      include: ['*/typed.ts'],
    }),
  );
  const tsc = await $`${path.join(root, 'node_modules/.bin/tsc')} -p tsconfig.json`.cwd(consumer).nothrow().quiet();
  record('tsc nodenext no consumidor', tsc.exitCode === 0, tsc.exitCode === 0 ? 'exit 0' : out(tsc));

  // 7. Deno via npm:
  if (!skip.has('deno')) {
    const denoDir = path.join(work, 'deno');
    // .work fica dentro do repo: sem --no-config e DENO_NO_PACKAGE_JSON o Deno acha o package.json da raiz e resolve
    // npm:@sinete/* para o workspace local em vez do tarball publicado.
    const denoEnv = { ...env, DENO_DIR: path.join(work, 'deno-cache'), DENO_NO_PACKAGE_JSON: '1', NO_COLOR: '1' };
    // Deno 2.9 ignora versões com menos de 24 h por padrão; na smoke tudo acabou de ser publicado.
    const age = ['--no-config', '--minimum-dependency-age=0'];
    // `@sinete/x[/sub]` e o guarda-chuva sem escopo, `sinete[/sub]`, só em especificador de import (um texto
    // `'sinete'` numa fixture, como o conteúdo de um QR Code, não é módulo).
    const toNpm = (src: string): string =>
      src.replace(
        /((?:from|import)\s*\(?\s*)(['"])(@sinete\/[a-z0-9-]+|sinete)(\/[^'"]*)?\2/g,
        (_all, pre: string, q: string, name: string, sub = '') =>
          `${pre}${q}npm:${name}@${deps[name] ?? '*'}${sub}${q}`,
      );
    for (const n of names) {
      const dir = path.join(denoDir, n);
      await mkdir(dir, { recursive: true });
      for (const f of await readdir(path.join(fixtures, n))) {
        await Bun.write(path.join(dir, f), toNpm(await Bun.file(path.join(fixtures, n, f)).text()));
      }
      if (await Bun.file(path.join(dir, 'esm.mjs')).exists()) {
        const r = await $`deno run --quiet ${age} --allow-read --allow-env esm.mjs`
          .cwd(dir)
          .env(denoEnv)
          .nothrow()
          .quiet();
        checkJson(`deno run ${n}`, out(r));
      }
      if (await Bun.file(path.join(dir, 'typed.ts')).exists()) {
        const r = await $`deno check --quiet ${age} typed.ts`.cwd(dir).env(denoEnv).nothrow().quiet();
        record(`deno check ${n}`, r.exitCode === 0, r.exitCode === 0 ? 'exit 0' : out(r));
      }
    }

    // Peers opcionais do @sinete/emissor no Deno com `npm:` (ADR 0010). Sem o @sinete/da, o pdf() pede o pacote com
    // ConfigError, como no Node.
    const semDaDeno = path.join(denoDir, '_sem-da');
    await mkdir(semDaDeno, { recursive: true });
    await Bun.write(
      path.join(semDaDeno, 'curto.mjs'),
      toNpm(await Bun.file(path.join(fixtures, '_sem-da/curto.mjs')).text()),
    );
    const rSemDaDeno = await $`deno run --quiet ${age} --allow-read --allow-env curto.mjs`
      .cwd(semDaDeno)
      .env(denoEnv)
      .nothrow()
      .quiet();
    checkJson('deno emissor sem o @sinete/da', out(rSemDaDeno));
    // Sem node_modules, o Deno só materializa a peer opcional que está no grafo estático do app: o import estático
    // de `@sinete/emissor/nfe` sem `npm:@sinete/nfe` no app falha na resolução, com o nome do pacote na mensagem (medido
    // no Deno 2.9.1, documentado no README do emissor). Aceita os dois desfechos, mas não um terceiro: se o Deno passar
    // a instalar a peer sozinho, a verificação continua verde e o detalhe mostra que a regra do README pode sair.
    const semPeer = path.join(denoDir, '_sem-peer');
    await mkdir(semPeer, { recursive: true });
    await Bun.write(
      path.join(semPeer, 'main.mjs'),
      toNpm(`import { createNfeEmissor } from '@sinete/emissor/nfe';\nconsole.log(typeof createNfeEmissor);\n`),
    );
    const rSemPeer = await $`deno run --quiet ${age} main.mjs`.cwd(semPeer).env(denoEnv).nothrow().quiet();
    const textoSemPeer = out(rSemPeer);
    const resolvido = rSemPeer.exitCode === 0 && textoSemPeer.includes('function');
    const erroClaro = rSemPeer.exitCode !== 0 && textoSemPeer.includes("Could not find package '@sinete/nfe'");
    record(
      'deno emissor/nfe sem @sinete/nfe no grafo do app',
      resolvido || erroClaro,
      resolvido
        ? 'a peer foi resolvida sem import no app'
        : erroClaro
          ? 'erro de resolução com o nome do pacote'
          : textoSemPeer,
    );
  }

  // 7b. Subpath isolado (ADR 0008): o bundle de quem importa só `@sinete/da/mdfe` ou `@sinete/da/nfse`, com os pacotes publicados dentro,
  // não pode levar o layout nem o schema da NF-e. O `@sinete/da/nfe` serve de controle: as marcas existem nele.
  if (names.includes('da')) {
    const marcasNfe = [
      'DATA DE RECEBIMENTO',
      'MOC 7.0, Anexo II, 3.8.1',
      'DANFE SIMPLIFICADO',
      'FORMA PAGAMENTO',
      'vICMSDeson',
    ];
    const tamanho: Record<string, number> = {};
    const texto: Record<string, string> = {};
    for (const n of ['so-mdfe', 'so-nfe', 'so-nfse']) {
      const b = await Bun.build({
        entrypoints: [path.join(consumer, 'da', `${n}.mjs`)],
        target: 'browser',
        format: 'esm',
        minify: true,
      });
      texto[n] = b.success ? (await Promise.all(b.outputs.map((o) => o.text()))).join('') : '';
      tamanho[n] = texto[n]?.length ?? 0;
    }
    const mdfe = texto['so-mdfe'] ?? '';
    const nfe = texto['so-nfe'] ?? '';
    const nfse = texto['so-nfse'] ?? '';
    const vazou = marcasNfe.filter((m) => mdfe.includes(m));
    const vazouNfse = marcasNfe.filter((m) => nfse.includes(m));
    const controle = marcasNfe.filter((m) => !nfe.includes(m));
    record(
      'bundle de @sinete/da/mdfe sem o layout nem o schema da NF-e',
      mdfe.includes('CONTROLE DO FISCO') && vazou.length === 0 && controle.length === 0,
      `mdfe ${tamanho['so-mdfe']} bytes, nfe ${tamanho['so-nfe']} bytes (minificado); vazou [${vazou.join(', ')}]; ` +
        `faltou no controle [${controle.join(', ')}]`,
    );
    record(
      'bundle de @sinete/da/nfse sem o layout nem o schema da NF-e',
      nfse.includes('DANFSe v2.0') && vazouNfse.length === 0 && !nfse.includes('CONTROLE DO FISCO'),
      `nfse ${tamanho['so-nfse']} bytes (minificado); vazou [${vazouNfse.join(', ')}]`,
    );
  }

  // 8. Chromium real: bundle do consumidor com bun build --target=browser, servido pelo Bun.serve
  if (!skip.has('browser')) {
    const bundles = new Map<string, string>();
    for (const n of names) {
      const entry = path.join(consumer, n, 'browser.mjs');
      if (!(await Bun.file(entry).exists())) continue;
      const b = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'esm' });
      const js = b.success ? await (b.outputs[0]?.text() ?? '') : '';
      record(
        `bun build --target=browser ${n} sem node:`,
        b.success && !/["']node:/.test(js),
        b.success ? `${js.length} bytes` : b.logs.map(String).join('\n'),
      );
      bundles.set(n, js);
    }
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: (req): Response => {
        const url = new URL(req.url);
        const n = url.searchParams.get('pkg') ?? '';
        return url.pathname === '/bundle.js'
          ? new Response(bundles.get(n) ?? '', { headers: { 'content-type': 'text/javascript' } })
          : new Response(`<!doctype html><script type="module" src="/bundle.js?pkg=${n}"></script>`, {
              headers: { 'content-type': 'text/html' },
            });
      },
    });
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch();
      try {
        for (const n of bundles.keys()) {
          const page = await browser.newPage();
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(String(e)));
          await page.goto(`http://127.0.0.1:${server.port}/?pkg=${n}`);
          try {
            await page.waitForFunction(() => (globalThis as { __result?: unknown }).__result, null, {
              timeout: 10_000,
            });
            const res = await page.evaluate(() => (globalThis as { __result?: unknown }).__result);
            checkJson(`chromium ${browser.version()} ${n}`, JSON.stringify(res));
          } catch (e) {
            record(`chromium ${browser.version()} ${n}`, false, `${e} ${errors.join(' ')}`);
          }
          await page.close();
        }
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
