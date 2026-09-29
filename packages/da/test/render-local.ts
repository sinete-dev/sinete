// Renderiza os casos sintéticos em PDF, HTML e PNG num diretório local, para inspeção visual.
// Uso: bun packages/da/test/render-local.ts <dir-de-saida>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { toHtml, toPdf } from '../src/index.ts';
import { CASES } from './cases.ts';

const out = process.argv[2] ?? '.local/render';
mkdirSync(out, { recursive: true });
for (const c of CASES) {
  const doc = c.doc();
  writeFileSync(`${out}/${c.name}.pdf`, toPdf(doc));
  writeFileSync(`${out}/${c.name}.html`, toHtml(doc));
  execFileSync('pdftoppm', ['-r', '80', '-png', `${out}/${c.name}.pdf`, `${out}/${c.name}`]);
  console.log(c.name, doc.pages.length, JSON.stringify(doc.stats));
}
