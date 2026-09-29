#!/usr/bin/env bun
/**
 * Roda localmente o mesmo que o job `check` do CI, na mesma ordem. Com --smoke, roda também a smoke dos tarballs
 * (job `smoke`), usando SMOKE_NODE_VERSIONS e VERDACCIO_BIN do ambiente.
 */
import { $ } from 'bun';
import { root } from './lib/workspace.ts';

const steps: [string, string[], string?][] = [
  ['segredos e corpus', ['bun', 'scripts/check-no-secrets.ts']],
  ['lockfile', ['bun', 'install', '--frozen-lockfile']],
  ['guarda-chuva sinete em sincronia', ['bun', 'scripts/umbrella.ts', '--check']],
  ['versão do verProc/verAplic em sincronia', ['bun', 'scripts/versao-gerada.ts', '--check']],
  ['lint (biome ci)', ['bun', 'run', 'lint']],
  ['build', ['bun', 'run', 'build']],
  ['pacotes irmãos externos no dist', ['bun', 'scripts/check-dist-externals.ts']],
  // Depois do build: o gerador lê os dados de endpoints e do bundle ICP pelos pacotes.
  ['helper sinete-signer: dados compilados, go vet e go test', ['bun', 'helpers/signer-tls/scripts/check.ts']],
  ['typecheck', ['bun', 'run', 'typecheck']],
  [
    'doc embarcada: referência, índice dos erros e bloco do AGENTS.md em sincronia',
    ['bun', 'scripts/docs-gerados.ts', '--check'],
  ],
  ['doc embarcada: páginas de erro, links e conteúdo', ['bun', 'scripts/check-docs.ts']],
  ['exemplos dos READMEs e da doc embarcada compilam', ['bun', 'scripts/check-readme.ts']],
  ['testes', ['bun', 'run', 'test']],
  // O bunfig da raiz limita o `bun test` a `packages/`; ferramentas com teste rodam no próprio diretório.
  ['testes das ferramentas', ['bun', 'test'], 'tools/homologacao'],
  ['testes das checagens do repositório', ['bun', 'test'], 'scripts'],
  ['testes do verificador de corpus do DANFE', ['bun', 'test'], 'tools/danfe-corpus'],
  ['testes do vigia das fontes oficiais', ['bun', 'test'], 'tools/fontes-oficiais'],
  ['publint e attw nos tarballs', ['bun', 'scripts/check-pack.ts']],
  ['slow types do JSR', ['bun', 'scripts/check-jsr.ts']],
];
if (process.argv.includes('--smoke')) steps.push(['smoke dos tarballs', ['bun', 'smoke/run.ts']]);

for (const [label, cmd, cwd] of steps) {
  const started = performance.now();
  console.log(`\n=== ${label}`);
  const r = await $`${cmd}`.cwd(cwd ? `${root}/${cwd}` : root).nothrow();
  const secs = ((performance.now() - started) / 1000).toFixed(1);
  if (r.exitCode !== 0) {
    console.error(`\nFALHOU: ${label} (${secs} s)`);
    process.exit(r.exitCode);
  }
  console.log(`--- ok: ${label} (${secs} s)`);
}
console.log(`\ncheck ok: ${steps.length} etapas`);
