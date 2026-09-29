#!/usr/bin/env bun
/**
 * Gera `src/versao-gerada.ts` nos pacotes que embutem a própria versão no padrão de `verProc`/`verAplic`
 * (`formatarVerProc` do `@sinete/core`), lida do `version` de cada `package.json`. Existe para nunca ler
 * `package.json` em runtime: o pacote precisa rodar em Node, Deno e no browser, sem `fs`.
 *
 * Uso: bun scripts/versao-gerada.ts           (escreve)
 *      bun scripts/versao-gerada.ts --check   (falha se algum pacote estiver fora de sincronia; roda no `bun run check`)
 */
import path from 'node:path';
import { root, workspacePackages } from './lib/workspace.ts';

/** Pacotes que embutem a própria versão no padrão de `verProc`/`verAplic`. */
const PACOTES = ['@sinete/nfe', '@sinete/mdfe', '@sinete/nfse'] as const;
const check = process.argv.includes('--check');

function conteudo(nome: string, versao: string): string {
  // Aspas simples (quoteStyle do biome.jsonc): `JSON.stringify` geraria aspas duplas e o `format` reescreveria o
  // arquivo, tirando-o de sincronia com este script.
  return (
    `// GERADO por scripts/versao-gerada.ts a partir do package.json. Não edite: rode \`bun scripts/versao-gerada.ts\`.\n` +
    `/** Versão de \`${nome}\`, para o padrão de \`verProc\`/\`verAplic\` (\`formatarVerProc\` do @sinete/core). */\n` +
    `export const VERSAO_PACOTE = '${versao.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}';\n`
  );
}

const all = new Map((await workspacePackages()).map((p) => [p.manifest.name, p]));
const problems: string[] = [];
for (const nome of PACOTES) {
  const pkg = all.get(nome);
  if (!pkg) throw new Error(`versao-gerada: ${nome} não é um pacote do workspace`);
  const file = path.join(pkg.dir, 'src/versao-gerada.ts');
  const text = conteudo(nome, pkg.manifest.version);
  if (check) {
    const atual = (await Bun.file(file).exists()) ? await Bun.file(file).text() : undefined;
    if (atual !== text) problems.push(path.relative(root, file));
  } else {
    await Bun.write(file, text);
  }
}
if (check) {
  if (problems.length > 0) {
    console.error(
      `versao-gerada: fora de sincronia, rode \`bun scripts/versao-gerada.ts\`:\n  ${problems.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log(`versao-gerada: ${PACOTES.length} pacote(s) em sincronia`);
} else {
  console.log(`versao-gerada: ${PACOTES.length} pacote(s) escrito(s)`);
}
