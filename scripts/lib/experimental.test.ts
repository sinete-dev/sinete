/**
 * A marca de experimental do guarda-chuva vem do comentário de módulo da fonte, e o README do `sinete` cita exatamente
 * os subpaths marcados; o repositório versionado está assim hoje.
 */
import { expect, test } from 'bun:test';
import path from 'node:path';
import {
  divergenciasDoReadme,
  FRASE_EXPERIMENTAIS,
  fonteDosTipos,
  moduloExperimental,
  tiposDoAlvo,
} from './experimental.ts';
import { root } from './workspace.ts';

test('o tipo do alvo vem da condição types, ou da do default', () => {
  expect(tiposDoAlvo({ types: './dist/perfil.d.ts', default: './dist/perfil.js' })).toBe('./dist/perfil.d.ts');
  expect(
    tiposDoAlvo({
      node: { types: './dist/signer.node.d.ts', default: './dist/signer.node.js' },
      default: { types: './dist/signer.d.ts', default: './dist/signer.js' },
    }),
  ).toBe('./dist/signer.d.ts');
  expect(tiposDoAlvo('./package.json')).toBeUndefined();
  expect(tiposDoAlvo(undefined)).toBeUndefined();
  expect(fonteDosTipos('./dist/nfe/ibs-cbs.d.ts')).toBe('src/nfe/ibs-cbs.ts');
});

test('só o comentário de módulo conta: @experimental numa função não marca o módulo', () => {
  expect(moduloExperimental('/**\n * Perfil.\n *\n * @experimental falta X.\n */\nexport {};')).toBe(true);
  expect(moduloExperimental('/** Emissor. */\n\n/**\n * @experimental\n */\nexport function perfilNfe() {}')).toBe(
    false,
  );
  expect(moduloExperimental('/** @experimentalmente não. */')).toBe(false);
  expect(moduloExperimental('export {};')).toBe(false);
});

test('a frase do README precisa citar exatamente os experimentais', () => {
  const readme = (...s: string[]) =>
    `# sinete\n\n${FRASE_EXPERIMENTAIS} dos pacotes cobertos (${s.map((x) => `\`${x}\``).join(', ')}) são experimentais aqui também.\n`;
  const exp = ['sinete/emissor/perfil', 'sinete/nfe/ibs-cbs'];
  expect(divergenciasDoReadme(readme(...exp), exp)).toEqual([]);
  expect(divergenciasDoReadme(readme('sinete/nfe/ibs-cbs'), exp)).toEqual([
    'falta sinete/emissor/perfil entre os experimentais',
  ]);
  expect(divergenciasDoReadme(readme(...exp, 'sinete/transport/signer'), exp)).toEqual([
    'sinete/transport/signer não é experimental (sobra)',
  ]);
  expect(divergenciasDoReadme('# sinete\n', exp)).toHaveLength(2);
});

test('no repositório, os três reexports experimentais têm a marca e o README cita os três', async () => {
  const src = path.join(root, 'packages/sinete/src');
  const marcados: string[] = [];
  for await (const f of new Bun.Glob('**/*.ts').scan({ cwd: src })) {
    if (moduloExperimental(await Bun.file(path.join(src, f)).text())) marcados.push(`sinete/${f.replace(/\.ts$/, '')}`);
  }
  expect(marcados.sort()).toEqual(['sinete/emissor/perfil', 'sinete/nfe/ibs-cbs', 'sinete/transport/signer']);
  const readme = await Bun.file(path.join(root, 'packages/sinete/README.md')).text();
  expect(divergenciasDoReadme(readme, marcados)).toEqual([]);
});
