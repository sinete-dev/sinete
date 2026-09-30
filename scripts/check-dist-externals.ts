#!/usr/bin/env bun
/**
 * Garante que nenhum pacote embute outro pacote do workspace no próprio `dist`. Um irmão embutido duplica classes
 * (duas `ErroSinete`) e quebra o `instanceof` entre pacotes. Causa conhecida: `paths` no tsconfig apontando para o
 * fonte do irmão, que o Bun.build respeita antes do `external`.
 *
 * Regra: para cada dependência `@sinete/*` declarada, o `dist` precisa importá-la pelo nome, e nenhum arquivo do
 * `dist` pode conter o marcador de classe de outro pacote (hoje, `class ErroSinete` só pode existir no core).
 */
import path from 'node:path';
import { Glob } from 'bun';
import { workspacePackages } from './lib/workspace.ts';

const markers: Record<string, string> = { '@sinete/core': 'class ErroSinete' };
const problems: string[] = [];

for (const { dir, manifest } of await workspacePackages()) {
  const deps = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }).filter((d) =>
    d.startsWith('@sinete/'),
  );
  const files = [...new Glob('dist/**/*.js').scanSync({ cwd: dir })];
  if (files.length === 0) continue;
  const read = (fs: string[]): Promise<string> =>
    Promise.all(fs.map((f) => Bun.file(path.join(dir, f)).text())).then((t) => t.join('\n'));
  const text = await read(files);
  // Dependência só de tipos aparece nos `.d.ts`, não no JS: vale como importada.
  const types = await read([...new Glob('dist/**/*.d.ts').scanSync({ cwd: dir })]);
  // Subpath (`@sinete/rejeicoes/nfse`) também conta: o irmão é importado pelo nome, não embutido.
  const imports = (t: string, dep: string): boolean =>
    [`"${dep}"`, `'${dep}'`, `"${dep}/`, `'${dep}/`].some((m) => t.includes(m));
  for (const dep of deps) {
    if (!imports(text, dep) && !imports(types, dep)) {
      problems.push(`${manifest.name}: dist não importa ${dep} (o irmão foi embutido?)`);
    }
  }
  for (const [pkg, marker] of Object.entries(markers)) {
    if (pkg !== manifest.name && text.includes(marker)) {
      problems.push(`${manifest.name}: dist contém "${marker}", que pertence a ${pkg}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`check-dist-externals: ${problems.length} problema(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exitCode = 1;
} else {
  console.log('check-dist-externals: nenhum pacote embute outro do workspace');
}
