/**
 * Os pacotes npm do helper (ADR 0014), montados por `helpers/signer-tls/scripts/npm.ts` a partir de um build de
 * verdade: o pacote da plataforma leva o binário com `os` e `cpu`, e o lançador `@sinete/signer` acha o binário pelo
 * resolvedor do Node e sobe o helper. Sem Go, a suíte é pulada.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findGo, HELPER_DIR } from '../../../helpers/signer-tls/scripts/build.ts';
import { stage } from '../../../helpers/signer-tls/scripts/npm.ts';

const go = findGo();

describe.skipIf(!go)('pacotes npm do sinete-signer', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sinete-signer-npm-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('o pacote da plataforma e o lançador sobem o helper pelo resolvedor do Node', async () => {
    const dist = path.join(dir, 'dist');
    const b = Bun.spawnSync(['bun', path.join(HELPER_DIR, 'scripts/build.ts'), '--only', 'host', '--out', dist]);
    expect(b.exitCode).toBe(0);
    const out = path.join(dir, 'npm');
    const staged = await stage(dist, out);
    const plataforma = `@sinete/signer-${process.platform}-${process.arch}`;
    expect(staged).toEqual([plataforma, '@sinete/signer']);
    const pkg = (await Bun.file(path.join(out, `signer-${process.platform}-${process.arch}/package.json`)).json()) as {
      os: string[];
      cpu: string[];
      files: string[];
    };
    expect(pkg).toMatchObject({ os: [process.platform], cpu: [process.arch], files: ['bin', 'LICENSE', 'NOTICE'] });
    const launcher = (await Bun.file(path.join(out, 'signer/package.json')).json()) as {
      optionalDependencies: Record<string, string>;
    };
    expect(Object.keys(launcher.optionalDependencies)).toEqual([plataforma]);

    // Um projeto consumidor com os dois pacotes instalados e o @sinete/transport do workspace.
    const app = path.join(dir, 'app');
    const nm = path.join(app, 'node_modules/@sinete');
    mkdirSync(nm, { recursive: true });
    cpSync(path.join(out, 'signer'), path.join(nm, 'signer'), { recursive: true });
    cpSync(
      path.join(out, `signer-${process.platform}-${process.arch}`),
      path.join(nm, `signer-${process.platform}-${process.arch}`),
      {
        recursive: true,
      },
    );
    symlinkSync(path.resolve(import.meta.dir, '..'), path.join(nm, 'transport'), 'dir');
    writeFileSync(
      path.join(app, 'uso.mjs'),
      [
        "import { binarioDoSigner, iniciarSigner } from '@sinete/signer';",
        'const s = await iniciarSigner({ lab: true });',
        'console.log(JSON.stringify({ bin: binarioDoSigner(), helper: s.hello.helper, backends: s.hello.backends }));',
        'await s.fechar();',
      ].join('\n'),
    );
    const runtime = Bun.which('node') ?? 'bun';
    const r = Bun.spawnSync([runtime, 'uso.mjs'], { cwd: app, stderr: 'pipe' });
    expect(r.stderr.toString()).toBe('');
    const res = JSON.parse(r.stdout.toString()) as { bin: string; helper: string; backends: string[] };
    expect(res.bin).toContain(
      path.join('node_modules', '@sinete', `signer-${process.platform}-${process.arch}`, 'bin'),
    );
    expect(res.helper).toMatch(/^sinete-signer\//);
    expect(res.backends).toEqual(['remote']);

    // Sem o pacote da plataforma (--omit=optional), a variável do sabor aponta o binário da release.
    const semOpcional = path.join(dir, 'sem-opcional');
    const nm2 = path.join(semOpcional, 'node_modules/@sinete');
    mkdirSync(nm2, { recursive: true });
    cpSync(path.join(out, 'signer'), path.join(nm2, 'signer'), { recursive: true });
    symlinkSync(path.resolve(import.meta.dir, '..'), path.join(nm2, 'transport'), 'dir');
    writeFileSync(
      path.join(semOpcional, 'uso.mjs'),
      [
        "import { iniciarSigner } from '@sinete/signer';",
        'const s = await iniciarSigner({ lab: true });',
        'console.log(JSON.stringify({ helper: s.hello.helper }));',
        'await s.fechar();',
      ].join('\n'),
    );
    const semEnv = Bun.spawnSync([runtime, 'uso.mjs'], {
      cwd: semOpcional,
      stderr: 'pipe',
      env: { PATH: process.env.PATH ?? '' },
    });
    expect(semEnv.exitCode).not.toBe(0);
    expect(semEnv.stderr.toString()).toContain('SINETE_SIGNER_BIN');
    const comEnv = Bun.spawnSync([runtime, 'uso.mjs'], {
      cwd: semOpcional,
      stderr: 'pipe',
      env: { PATH: process.env.PATH ?? '', SINETE_SIGNER_BIN: res.bin },
    });
    expect(comEnv.stderr.toString()).toBe('');
    expect((JSON.parse(comEnv.stdout.toString()) as { helper: string }).helper).toMatch(/^sinete-signer\//);
  }, 120_000);
});
