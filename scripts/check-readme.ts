#!/usr/bin/env bun
/**
 * Os exemplos em TypeScript dos READMEs e da documentação embarcada (`docs/guia/`) compilam contra a API atual. Cada
 * bloco ```ts vira um módulo em `.work/readme/`, e o tsc confere contra os `.d.ts` de `dist` (rode `bun run build`
 * antes).
 *
 * Exemplo é trecho, não programa: variáveis de contexto (`nota`, `pfx`, `store`) não precisam estar declaradas, e o
 * nome não encontrado é ignorado (TS2304 e afins). O resto vale: import de nome que não existe, método ou opção que não
 * existe, argumento do tipo errado. Marcas na linha de abertura do bloco:
 *
 * - ```ts sem-checagem: não compila (pseudocódigo, Deno com `npm:`, saída de exemplo);
 * - ```ts continua: junta-se ao módulo do bloco ```ts anterior do mesmo arquivo (um programa contado em passos, como o
 *   tutorial);
 * - ```ts completo: o módulo não tem contexto implícito, então nenhum erro é ignorado.
 */
import { mkdir, readdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';
import { blocosDeCodigo, GUIA, paginasDoGuia } from './lib/docs.ts';
import { rel, root, workspacePackages } from './lib/workspace.ts';

/** Nome não encontrado (o contexto do trecho) e o `any` implícito que decorre dele. */
const IGNORADOS = new Set([2304, 2552, 2582, 2593, 18004, 7005, 7006, 7031, 7034]);

const work = path.join(root, '.work/readme');
await rm(work, { recursive: true, force: true });
await mkdir(path.join(work, 'node_modules/@sinete'), { recursive: true });
// Os exemplos importam os pacotes pelo nome, como quem instalou do npm: um node_modules com links para o workspace.
for (const { dir, manifest } of await workspacePackages()) {
  if (manifest.private) continue;
  await symlink(dir, path.join(work, 'node_modules', manifest.name), 'dir');
}

const readmes = [path.join(root, 'README.md')];
for (const d of await readdir(path.join(root, 'packages'))) {
  const f = path.join(root, 'packages', d, 'README.md');
  if (await Bun.file(f).exists()) readmes.push(f);
}
const guia = (await paginasDoGuia()).map((f) => path.join(GUIA, f));

/** Um módulo gerado: as linhas e, para cada uma, o Markdown e a linha de onde veio. */
type Modulo = { nome: string; linhas: string[]; origem: { md: string; linha: number }[]; completo: boolean };
const modulos: Modulo[] = [];
let blocos = 0;
for (const md of [...readmes, ...guia]) {
  const base = path.relative(root, md).replaceAll('/', '-').replace(/\.md$/, '');
  let anterior: Modulo | undefined;
  for (const b of blocosDeCodigo(await Bun.file(md).text())) {
    if (!['ts', 'typescript'].includes(b.lang) || b.marcas.includes('sem-checagem')) continue;
    blocos++;
    let m = b.marcas.includes('continua') ? anterior : undefined;
    if (m === undefined) {
      if (b.marcas.includes('continua')) throw new Error(`${rel(md)}:${b.inicio - 1}: \`continua\` sem bloco anterior`);
      m = { nome: `${base}-${b.inicio}.ts`, linhas: [], origem: [], completo: b.marcas.includes('completo') };
      modulos.push(m);
    }
    for (const [i, l] of b.corpo.entries()) {
      m.linhas.push(l);
      m.origem.push({ md, linha: b.inicio + i });
    }
    anterior = m;
  }
}
for (const m of modulos) await Bun.write(path.join(work, m.nome), `${m.linhas.join('\n')}\nexport {};\n`);
const porNome = new Map(modulos.map((m) => [m.nome, m]));

await Bun.write(
  path.join(work, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'es2022',
      lib: ['es2023', 'dom'],
      types: ['bun'],
      typeRoots: [path.join(root, 'node_modules/@types')],
      module: 'preserve',
      moduleResolution: 'bundler',
      // Os exemplos rodam no servidor: a condição node dá as entradas de runtime (createNodeTransport, startSimServer).
      customConditions: ['node'],
      strict: true,
      exactOptionalPropertyTypes: true,
      noEmit: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
    },
    include: ['*.ts'],
  }),
);

const tsc = path.join(root, 'node_modules/.bin/tsc');
const r = await $`${tsc} -p tsconfig.json --pretty false`.cwd(work).nothrow().quiet();
const erros = r.stdout
  .toString()
  .split('\n')
  .flatMap((l) => {
    const m = /^([^(]+)\((\d+),(\d+)\): error TS(\d+): (.*)$/.exec(l);
    if (!m) return [];
    const [, arquivo = '', linha = '0', , codigo = '0', msg = ''] = m;
    const mod = porNome.get(path.basename(arquivo));
    if (IGNORADOS.has(Number(codigo)) && !mod?.completo) return [];
    const o = mod?.origem[Number(linha) - 1];
    const onde = o ? `${rel(o.md)}:${o.linha}` : arquivo;
    return [`${onde}: TS${codigo} ${msg}`];
  });
for (const e of erros) console.error(e);
if (r.exitCode !== 0 && erros.length === 0 && !/error TS/.test(r.stdout.toString())) {
  console.error(r.stdout.toString() + r.stderr.toString());
  process.exit(1);
}
console.log(
  `${blocos} exemplo(s) em ${readmes.length} README(s) e ${guia.length} página(s) do guia, ${modulos.length} módulo(s); ${erros.length} erro(s)`,
);
process.exit(erros.length ? 1 : 0);
