#!/usr/bin/env bun
/**
 * Trava de segurança: falha se o git rastreia (ou tem no índice) material de certificado, chave privada, env ou
 * qualquer arquivo sob um diretório de corpus. Roda no `bun run check` e no CI, e serve como pre-commit
 * (`bun scripts/check-no-secrets.ts` no hook), porque olha o índice e não só o HEAD.
 *
 * Exceções só por caminho exato em `scripts/secrets-allowlist.txt`, uma por linha, com o motivo em comentário.
 */
import path from 'node:path';
import { $ } from 'bun';
import { root } from './lib/workspace.ts';

const files = (await $`git ls-files -z --cached`.cwd(root).text()).split('\0').filter(Boolean);
const allowText = await Bun.file(path.join(root, 'scripts/secrets-allowlist.txt'))
  .text()
  .catch(() => '');
const allow = new Set(
  allowText
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean),
);

const byPath: { re: RegExp; why: string }[] = [
  { re: /\.(pfx|p12|jks|p8|key)$/i, why: 'arquivo de certificado ou chave' },
  { re: /(^|\/)corpus\//i, why: 'arquivo sob diretório de corpus (dados reais ficam fora do repo)' },
  { re: /(^|\/)(results|\.local|secrets)\//i, why: 'diretório local de resultados ou segredos' },
  { re: /(^|\/)\.env(\.(?!example$)[^/]*)?$/i, why: 'arquivo de ambiente' },
  { re: /\.pem$/i, why: 'PEM fora de fixtures/public/' },
];
// Montado em partes para este arquivo não casar com a própria regra.
const privateKey = new RegExp(`-----BEGIN ((RSA|EC|DSA|OPENSSH|ENCRYPTED) )?${'PRIVATE'} KEY-----`);

const problems: string[] = [];
for (const f of files) {
  if (allow.has(f)) continue;
  for (const { re, why } of byPath) {
    if (re.test(f) && !(why.startsWith('PEM') && /(^|\/)fixtures\/public\//.test(f))) problems.push(`${f}: ${why}`);
  }
  // Lê o conteúdo do índice (o que vai para o commit), não o do disco: os dois podem divergir.
  const staged = await $`git show ${`:${f}`}`.cwd(root).quiet().nothrow();
  if (staged.exitCode !== 0 || staged.stdout.length > 5_000_000) continue;
  const bytes = new Uint8Array(staged.stdout);
  if (bytes.subarray(0, 8000).includes(0)) continue; // binário
  if (privateKey.test(new TextDecoder().decode(bytes))) problems.push(`${f}: contém chave privada em PEM no índice`);
  // O disco também é verificado, para pegar o arquivo antes de ele ser adicionado de novo.
  const file = Bun.file(path.join(root, f));
  if (!(await file.exists()) || file.size > 5_000_000) continue;
  const head = new Uint8Array(await file.slice(0, 8000).arrayBuffer());
  if (head.includes(0)) continue;
  if (privateKey.test(await file.text())) problems.push(`${f}: contém chave privada em PEM na cópia de trabalho`);
}

if (problems.length > 0) {
  console.error(`check-no-secrets: ${problems.length} problema(s):`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    'Remova do índice (git rm --cached) ou, se for fixture sintética, registre em scripts/secrets-allowlist.txt.',
  );
  process.exit(1);
}
console.log(`check-no-secrets: ${files.length} arquivos rastreados, nenhum segredo nem corpus`);
