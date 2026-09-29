/**
 * A raiz do `@sinete/emissor` não importa nenhum pacote de documento, e cada subpath só importa o seu (ADR 0010,
 * decisão 2). Empacota cada entrada do fonte com o mesmo `Bun.build` do build real (pacotes externos) e confere os
 * especificadores que sobram no bundle. O `@sinete/da` só aparece como texto montado em runtime, nunca num import.
 */
import { describe, expect, test } from 'bun:test';
import path from 'node:path';

const src = path.join(import.meta.dir, '../src');

async function bundle(entry: string): Promise<string> {
  const r = await Bun.build({
    entrypoints: [path.join(src, entry)],
    format: 'esm',
    target: 'browser',
    packages: 'external',
    external: ['node:*'],
  });
  expect(r.success).toBe(true);
  return (await Promise.all(r.outputs.map((o) => o.text()))).join('\n');
}

const DOCUMENTOS = ['@sinete/nfe', '@sinete/mdfe', '@sinete/nfse'] as const;
const importa = (js: string, pacote: string): boolean => new RegExp(`from\\s*["']${pacote}(/[^"']*)?["']`).test(js);

const ESPERADO: Record<string, readonly string[]> = {
  'index.ts': [],
  'memoria.ts': [],
  'contrato.ts': [],
  'nfe.ts': ['@sinete/nfe'],
  'mdfe.ts': ['@sinete/mdfe'],
  'nfse.ts': ['@sinete/nfse'],
};

describe('subpaths isolados', () => {
  for (const [entry, docs] of Object.entries(ESPERADO)) {
    test(entry, async () => {
      const js = await bundle(entry);
      for (const d of DOCUMENTOS)
        expect({ entry, d, importa: importa(js, d) }).toEqual({ entry, d, importa: docs.includes(d) });
      expect({ entry, da: importa(js, '@sinete/da') }).toEqual({ entry, da: false });
    });
  }
});
