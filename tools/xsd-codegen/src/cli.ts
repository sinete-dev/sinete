#!/usr/bin/env bun
/**
 * `bun src/cli.ts`: regenera IR, módulos TS e exports do @sinete/schemas.
 * `bun src/cli.ts --check`: não grava; falha se algo regenerado difere do versionado (é o que o teste do
 * @sinete/schemas roda, para o CI garantir que a saída versionada é a do gerador).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateAll, repoRoot } from './generate.ts';

const check = process.argv.includes('--check');
const { files, stats } = generateAll();
const stale: string[] = [];
for (const [file, content] of files) {
  const current = await readFile(file, 'utf8').catch(() => undefined);
  if (current === content) continue;
  if (check) stale.push(path.relative(repoRoot, file));
  else {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
}
if (!check) for (const s of stats) console.log(JSON.stringify(s));
if (stale.length > 0) {
  console.error(`xsd-codegen: ${stale.length} arquivo(s) diferem da saída do gerador:\n  ${stale.join('\n  ')}`);
  console.error('Rode `bun run --cwd tools/xsd-codegen gen` e revise o diff.');
  process.exit(1);
}
console.log(`xsd-codegen: ${files.size} arquivos ${check ? 'conferidos' : 'gerados'}`);
