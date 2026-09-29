/**
 * O tutorial da documentação embarcada (`docs/guia/tutorial/primeira-nfe.md`) roda do começo ao fim. O
 * `check-readme.ts` já confere que ele compila; aqui o programa que os blocos formam (o ```ts completo e os ```ts
 * continua seguintes) roda de verdade contra o simulador, importando `sinete` e `@sinete/sefaz-sim` pelo nome, como
 * quem instalou do npm. Resolve pelo `dist` dos pacotes, como os outros testes que importam irmãos do workspace.
 */
import { afterAll, expect, test } from 'bun:test';
import { mkdir, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';

const raiz = path.resolve(import.meta.dir, '../../..');
const tutorial = path.join(raiz, 'docs/guia/tutorial/primeira-nfe.md');
const work = path.join(raiz, '.work/tutorial');

/** O corpo do bloco ```ts completo e dos ```ts continua que vêm depois dele. */
function programa(md: string): string {
  const linhas: string[] = [];
  let dentro = false;
  let pegar = false;
  for (const l of md.split('\n')) {
    if (!dentro) {
      const m = /^```ts\b(.*)$/.exec(l);
      if (!m) continue;
      dentro = true;
      const marcas = (m[1] ?? '').trim().split(/\s+/);
      pegar = marcas.includes('completo') || (marcas.includes('continua') && linhas.length > 0);
      continue;
    }
    if (l.startsWith('```')) {
      dentro = false;
      continue;
    }
    if (pegar) linhas.push(l);
  }
  return `${linhas.join('\n')}\nexport {};\n`;
}

afterAll(async () => {
  await rm(work, { recursive: true, force: true });
});

test('o tutorial emite, sobrevive à queda da conexão e gera o DANFE', async () => {
  await rm(work, { recursive: true, force: true });
  await mkdir(path.join(work, 'node_modules/@sinete'), { recursive: true });
  await symlink(path.join(raiz, 'packages/sinete'), path.join(work, 'node_modules/sinete'), 'dir');
  await symlink(path.join(raiz, 'packages/sefaz-sim'), path.join(work, 'node_modules/@sinete/sefaz-sim'), 'dir');
  const arquivo = path.join(work, 'tutorial.ts');
  await Bun.write(arquivo, programa(await Bun.file(tutorial).text()));

  const saida: string[] = [];
  const log = console.log;
  const cwd = process.cwd();
  console.log = (...args: unknown[]): void => {
    saida.push(args.map(String).join(' '));
  };
  process.chdir(work);
  try {
    await import(arquivo);
  } finally {
    process.chdir(cwd);
    console.log = log;
  }

  expect(saida).toHaveLength(2);
  expect(saida[0]).toMatch(/^autorizada \d{44} 100 guardada: true$/);
  expect(saida[1]).toBe('autorizado true');
  const pdf = await readFile(path.join(work, 'danfe-pedido-1.pdf'));
  expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
}, 60_000);
