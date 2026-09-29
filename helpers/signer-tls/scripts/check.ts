#!/usr/bin/env bun
/**
 * Checagem do helper `sinete-signer`, chamada pelo `bun run check`: os dados compilados em sincronia com os do
 * repositório (sempre) e, quando há Go, gofmt, go vet e go test nos dois sabores (cgo e estático), mais a compilação
 * cruzada para o Windows, que pega código que só existe em Unix. Sem Go, só os dados são conferidos e o script avisa.
 */
import path from 'node:path';
import { $ } from 'bun';
import { findGo, HELPER_DIR } from './build.ts';

const steps: [string, string[], Record<string, string>?][] = [];
const r0 = await $`bun ${path.join(HELPER_DIR, 'scripts/gen-data.ts')} --check`.nothrow();
if (r0.exitCode !== 0) process.exit(r0.exitCode);

const go = findGo();
if (!go) {
  console.log('check do helper: Go ausente, testes Go pulados (instale Go ou defina GO)');
  process.exit(0);
}
steps.push(
  ['gofmt', [path.join(path.dirname(go), 'gofmt'), '-l', '.']],
  ['go vet (cgo)', [go, 'vet', './...'], { CGO_ENABLED: '1' }],
  ['go vet (estático)', [go, 'vet', './...'], { CGO_ENABLED: '0' }],
  [
    'build windows/amd64 (estático)',
    [go, 'build', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', './cmd/sinete-signer'],
    { CGO_ENABLED: '0', GOOS: 'windows', GOARCH: 'amd64' },
  ],
  ['go test (cgo, com SoftHSM se houver)', [go, 'test', './...'], { CGO_ENABLED: '1' }],
  ['go test (estático)', [go, 'test', './...'], { CGO_ENABLED: '0' }],
);
for (const [label, cmd, env] of steps) {
  const r = await $`${cmd}`
    .cwd(HELPER_DIR)
    .env({ ...(process.env as Record<string, string>), ...env })
    .nothrow()
    .quiet();
  const out = `${r.stdout.toString()}${r.stderr.toString()}`.trim();
  if (r.exitCode !== 0 || (label === 'gofmt' && out !== '')) {
    console.error(`FALHOU: ${label}\n${out}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}
