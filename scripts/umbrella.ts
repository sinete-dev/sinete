#!/usr/bin/env bun
/**
 * Gera o pacote guarda-chuva `sinete` (packages/sinete) a partir do `exports` dos pacotes que ele cobre (ADR 0008).
 *
 * Regra: cada subpath `@sinete/<pacote>[/<sub>]` vira `sinete/<pacote>[/<sub>]`, com um arquivo em `src/` que só
 * reexporta o subpath correspondente. Não existe entrada raiz (`.`): quem quer tudo escolhe o que importa. Todo pacote
 * coberto entra em `dependencies` com `workspace:*`, que o `bun pm pack` troca pela versão exata: uma versão do
 * guarda-chuva corresponde a um conjunto de pacotes testado junto. O `bin` `sinete` aponta para a CLI.
 *
 * Subpath experimental (ADR 0016, seção 5): quando o comentário de módulo da fonte traz `@experimental`, o reexporto
 * herda a marca. A marca é lida da fonte, não de uma lista daqui. O README do `sinete` é escrito à mão; o `--check`
 * confere que a frase dos experimentais cita exatamente esses subpaths.
 *
 * Uso: bun scripts/umbrella.ts           (escreve)
 *      bun scripts/umbrella.ts --check   (falha se o pacote estiver fora de sincronia; roda no `bun run check`)
 */
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Glob } from 'bun';
import { divergenciasDoReadme, fonteDosTipos, moduloExperimental, tiposDoAlvo } from './lib/experimental.ts';
import type { Manifest } from './lib/workspace.ts';
import { root, workspacePackages } from './lib/workspace.ts';

/**
 * Pacotes cobertos. Ficam de fora o `@sinete/sefaz-sim`, que é ferramenta de teste e não deve entrar na instalação de
 * produção, e o `@sinete/cli`, que entra só como `bin` (o `rodarDoctor` programático continua no próprio pacote).
 */
const COBERTOS = [
  '@sinete/core',
  '@sinete/cert',
  '@sinete/transport',
  '@sinete/validators',
  '@sinete/rejeicoes',
  '@sinete/schemas',
  '@sinete/ibs-cbs-dados',
  '@sinete/ibs-cbs',
  '@sinete/nfe',
  '@sinete/mdfe',
  '@sinete/nfse',
  '@sinete/da',
  '@sinete/emissor',
] as const;
const CLI = '@sinete/cli';

const dir = path.join(root, 'packages/sinete');
const srcDir = path.join(dir, 'src');
const check = process.argv.includes('--check');

type Target = { readonly types: string; readonly default: string };

const pkgs = await workspacePackages();
const all = new Map(pkgs.map((p) => [p.manifest.name, p.manifest]));
const dirs = new Map(pkgs.map((p) => [p.manifest.name, p.dir]));
const get = (name: string): Manifest => {
  const m = all.get(name);
  if (!m) throw new Error(`umbrella: ${name} não é um pacote do workspace`);
  return m;
};

/** Se o comentário de módulo da fonte do subpath traz `@experimental`. */
async function experimental(name: string, sub: string): Promise<boolean> {
  const tipos = tiposDoAlvo(get(name).exports?.[sub]);
  const dir = dirs.get(name);
  if (tipos === undefined || dir === undefined) return false;
  const fonte = path.join(dir, fonteDosTipos(tipos));
  if (!(await Bun.file(fonte).exists()))
    throw new Error(`umbrella: fonte de ${name}${sub.slice(1)} não encontrada (${fonte})`);
  return moduloExperimental(await Bun.file(fonte).text());
}

// Subpaths do guarda-chuva: `./<pacote>` e `./<pacote>/<sub>`, cada um com o módulo que reexporta.
const files = new Map<string, string>();
const experimentais: string[] = [];
const exportsMap: Record<string, Target | string> = {};
for (const name of COBERTOS) {
  const m = get(name);
  const short = name.slice('@sinete/'.length);
  for (const sub of Object.keys(m.exports ?? {})) {
    if (sub === './package.json') continue;
    const spec = sub === '.' ? name : `${name}/${sub.slice(2)}`;
    const key = sub === '.' ? `./${short}` : `./${short}/${sub.slice(2)}`;
    // Raiz do pacote em `<pacote>/index`, para não colidir com o diretório dos subpaths do mesmo pacote.
    const file = sub === '.' ? `${short}/index` : key.slice(2);
    exportsMap[key] = { types: `./dist/${file}.d.ts`, default: `./dist/${file}.js` };
    const titulo = `\`sinete${key.slice(1)}\`: reexporta \`${spec}\`. Gerado por \`scripts/umbrella.ts\`; não edite.`;
    const exp = await experimental(name, sub);
    if (exp) experimentais.push(`sinete${key.slice(1)}`);
    const comentario = exp
      ? `/**\n * ${titulo}\n *\n * @experimental Herda a marca de \`${spec}\` (ADR 0016, seção 5).\n * Pode mudar em minor, sempre com changeset; o motivo e o que falta para sair estão no módulo de origem.\n */`
      : `/** ${titulo} */`;
    files.set(
      `${file}.ts`,
      `${comentario}\n\n` +
        `// biome-ignore lint/performance/noReExportAll: o guarda-chuva só reexporta o pacote correspondente.\n` +
        `export * from '${spec}';\n`,
    );
  }
}
exportsMap['./package.json'] = './package.json';
files.set(
  'cli.ts',
  `#!/usr/bin/env node\n/** Executável \`sinete\`: a CLI do \`${CLI}\`. Gerado por \`scripts/umbrella.ts\`; não edite. */\n` +
    `import '${CLI}/bin';\n`,
);

const manifestPath = path.join(dir, 'package.json');
const current = (await Bun.file(manifestPath).exists()) ? await Bun.file(manifestPath).json() : {};
const dependencies = Object.fromEntries([...COBERTOS, CLI].sort().map((n) => [n, 'workspace:*']));
const manifest = {
  name: 'sinete',
  version: current.version ?? '0.0.0',
  description:
    'Guarda-chuva do sinete, DF-e brasileiros em TypeScript: um pacote só, com um subpath por pacote @sinete/* (sinete/nfe, sinete/mdfe, sinete/nfse, sinete/da/nfe, sinete/ibs-cbs, sinete/core...) e o bin sinete, com as versões fixadas num conjunto testado junto',
  keywords: ['nfe', 'nfce', 'mdfe', 'nfse', 'dfe', 'sefaz', 'danfe', 'ibs', 'cbs', 'nota-fiscal', 'brasil'],
  license: 'Apache-2.0',
  type: 'module',
  sideEffects: ['./dist/cli.js'],
  engines: { node: '^20.19.0 || >=22.12.0' },
  bin: { sinete: './dist/cli.js' },
  exports: exportsMap,
  files: ['dist', 'src', 'docs', 'NOTICE'],
  repository: { type: 'git', url: 'git+https://github.com/sinete-dev/sinete.git', directory: 'packages/sinete' },
  homepage: 'https://github.com/sinete-dev/sinete/tree/main/packages/sinete#readme',
  bugs: 'https://github.com/sinete-dev/sinete/issues',
  scripts: { build: 'bun ../../scripts/build.ts .' },
  dependencies,
  publishConfig: { access: 'public' },
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;

const existing = new Set<string>();
try {
  for await (const f of new Glob('**/*.ts').scan({ cwd: srcDir })) existing.add(f);
} catch {
  // src/ ainda não existe: primeira geração.
}

const problems: string[] = [];
if (check) {
  // Compara o JSON, não o texto: o formatador pode quebrar as listas de outro jeito.
  if (!Bun.deepEquals(current, manifest)) problems.push('packages/sinete/package.json');
  for (const [f, text] of files) {
    const p = path.join(srcDir, f);
    if (!(await Bun.file(p).exists()) || (await Bun.file(p).text()) !== text) problems.push(`packages/sinete/src/${f}`);
  }
  for (const f of existing) if (!files.has(f)) problems.push(`packages/sinete/src/${f} (sobra)`);
  // A frase do README que declara os experimentais cita exatamente os subpaths marcados na fonte.
  const readme = await Bun.file(path.join(dir, 'README.md')).text();
  for (const d of divergenciasDoReadme(readme, experimentais)) problems.push(`packages/sinete/README.md: ${d}`);
  if (problems.length > 0) {
    console.error(`umbrella: fora de sincronia, rode \`bun scripts/umbrella.ts\`:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`umbrella: sinete em sincronia (${files.size - 1} subpaths)`);
} else {
  await Bun.write(manifestPath, manifestText);
  for (const f of existing) if (!files.has(f)) await rm(path.join(srcDir, f));
  for (const [f, text] of files) await Bun.write(path.join(srcDir, f), text);
  // Diretórios que ficaram vazios depois de remover as sobras.
  for (const d of (await readdir(srcDir, { recursive: true, withFileTypes: true })).filter((e) => e.isDirectory())) {
    const full = path.join(d.parentPath, d.name);
    if ((await readdir(full)).length === 0) await rm(full, { recursive: true });
  }
  console.log(`umbrella: ${files.size - 1} subpaths escritos em packages/sinete`);
}
