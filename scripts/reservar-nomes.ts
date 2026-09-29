#!/usr/bin/env bun
/**
 * Reserva no npmjs os nomes de pacote que ainda não existem, com um marcador `0.0.0` (package.json e README).
 *
 * O trusted publisher do npm só pode ser configurado num pacote que já existe, então o primeiro release pelo
 * CI (OIDC) falharia para qualquer nome novo. Este script faz a primeira publicação à mão, com a conta dona do
 * escopo, do jeito que o `sinete` já foi reservado. Depois dele, configurar o trusted publisher de cada pacote
 * (docs/release.md) e nunca mais publicar à mão.
 *
 * Cobre os pacotes públicos do workspace e os do sinete-signer (`@sinete/signer` e um por plataforma), que saem
 * de outro workflow. O marcador `0.0.0` não conflita com o release: a primeira versão real é `0.1.0`.
 *
 * Uso: bun scripts/reservar-nomes.ts            lista o que falta, sem publicar
 *      bun scripts/reservar-nomes.ts --publicar publica os marcadores (pede o OTP do npm a cada pacote)
 */
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { STATIC_TARGETS } from '../helpers/signer-tls/scripts/build.ts';
import { npmPlatform } from '../helpers/signer-tls/scripts/npm.ts';
import { root, workspacePackages } from './lib/workspace.ts';

const NPMJS = 'https://registry.npmjs.org/';
const publicar = process.argv.includes('--publicar');
const outDir = path.join(root, '.reserva');

type Nome = { name: string; description: string };

async function existe(name: string): Promise<boolean> {
  const res = await fetch(`${NPMJS}${name.replace('/', '%2f')}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`${name}: registry respondeu ${res.status}`);
  return true;
}

const workspace: Nome[] = (await workspacePackages())
  .filter((p) => !p.manifest.private)
  .map((p) => ({ name: p.manifest.name, description: p.manifest.description ?? '' }));
const signer: Nome[] = [
  { name: '@sinete/signer', description: 'Lançador do sinete-signer, o assinador local para certificado A3.' },
  ...STATIC_TARGETS.map((t) => {
    const { os, cpu } = npmPlatform(t);
    return { name: `@sinete/signer-${os}-${cpu}`, description: `Binário do sinete-signer para ${os}/${cpu}.` };
  }),
];

const faltam: Nome[] = [];
for (const n of [...workspace, ...signer]) {
  if (!(await existe(n.name))) faltam.push(n);
}

if (faltam.length === 0) {
  console.log('todos os nomes já existem no npmjs');
  process.exit(0);
}
console.log(`sem reserva (${faltam.length}):`);
for (const n of faltam) console.log(`  ${n.name}`);
if (!publicar) {
  console.log('\nnada publicado; rode com --publicar para reservar');
  process.exit(0);
}
if (process.env.CI) throw new Error('reserva é manual, com a conta dona do escopo; não rode no CI');

await rm(outDir, { recursive: true, force: true });
for (const n of faltam) {
  const dir = path.join(outDir, n.name.replace('/', '__'));
  await mkdir(dir, { recursive: true });
  await Bun.write(
    path.join(dir, 'package.json'),
    `${JSON.stringify(
      {
        name: n.name,
        version: '0.0.0',
        description: `${n.description.replace(/\.?$/, '.')} Em breve.`,
        license: 'Apache-2.0',
      },
      null,
      2,
    )}\n`,
  );
  await Bun.write(path.join(dir, 'README.md'), `# ${n.name}\n\nEm breve.\n`);
  console.log(`\n== ${n.name}`);
  // Terminal herdado: o npm só pede OTP ou login no navegador com stdin e stdout em TTY. Registry fixo no
  // npmjs, inclusive o do escopo, para publicar onde a disponibilidade foi conferida.
  const proc = Bun.spawn(
    [
      'npm',
      'publish',
      '--access',
      'public',
      '--provenance=false',
      `--registry=${NPMJS}`,
      `--@sinete:registry=${NPMJS}`,
    ],
    { cwd: dir, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' },
  );
  if ((await proc.exited) !== 0) throw new Error(`${n.name}: npm publish saiu com ${proc.exitCode}`);
}
await rm(outDir, { recursive: true, force: true });
console.log('\nreservados; agora configure o trusted publisher de cada um (docs/release.md)');
