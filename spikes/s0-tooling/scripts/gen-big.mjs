// Gera um pacote sintético grande (simula @sinete/schemas gerado de XSD).
import { mkdirSync, writeFileSync } from 'node:fs';
const [dir, nFiles = '400', nTypes = '40'] = process.argv.slice(2);
mkdirSync(`${dir}/src/gen`, { recursive: true });
const idx = [];
for (let f = 0; f < +nFiles; f++) {
  let s = '';
  for (let t = 0; t < +nTypes; t++) {
    s += `export interface T${f}_${t} {\n  readonly cod: string;\n  readonly valor?: number;\n  readonly itens: readonly { nItem: number; xProd: string; vUnCom: string }[];\n  readonly choice: { tipo: 'a'; a: string } | { tipo: 'b'; b: number };\n}\n`;
    s += `export function parseT${f}_${t}(o: Record<string, unknown>): T${f}_${t} {\n  const cod = String(o['cod'] ?? '');\n  if (cod.length > 60) throw new Error('cod ${f}_${t}');\n  return { cod, itens: [], choice: { tipo: 'a', a: cod } };\n}\n`;
  }
  writeFileSync(`${dir}/src/gen/m${f}.ts`, s);
  idx.push(`export * from './gen/m${f}.ts';`);
}
writeFileSync(`${dir}/src/index.ts`, idx.join('\n') + '\n');
