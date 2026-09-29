/**
 * Cada subpath do `@sinete/da` leva ao bundle só o próprio documento (ADR 0008). Empacota cada entrada do fonte com o
 * mesmo `Bun.build` do build real (pacotes externos) e procura marcas de texto que só existem num layout. A smoke
 * repete a conferência sobre o tarball publicado, com o `@sinete/schemas` dentro do bundle.
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

/** Marcas de cada layout e dos dados de cada documento. */
const MARCA = {
  a4: 'DATA DE RECEBIMENTO',
  leiauteA4: 'MOC 7.0, Anexo II, 3.8.1',
  simplificado: 'DANFE SIMPLIFICADO',
  bobina: 'FORMA PAGAMENTO',
  damdfe: 'CONTROLE DO FISCO',
  danfse: 'DANFSe v2.0',
  schemaNfe: '@sinete/schemas/nfe/',
  schemaMdfe: '@sinete/schemas/mdfe/',
  schemaNfse: '@sinete/schemas/nfse/',
} as const;
type Marca = keyof typeof MARCA;

const ESPERADO: Record<string, { tem: Marca[]; naoTem: Marca[] }> = {
  'nfe.ts': {
    tem: ['a4', 'leiauteA4', 'simplificado', 'bobina', 'schemaNfe'],
    naoTem: ['damdfe', 'danfse', 'schemaMdfe', 'schemaNfse'],
  },
  'nfce.ts': {
    tem: ['bobina', 'schemaNfe'],
    naoTem: ['a4', 'leiauteA4', 'simplificado', 'damdfe', 'danfse', 'schemaMdfe', 'schemaNfse'],
  },
  'mdfe.ts': {
    tem: ['damdfe', 'schemaMdfe'],
    naoTem: ['a4', 'leiauteA4', 'simplificado', 'bobina', 'danfse', 'schemaNfe', 'schemaNfse'],
  },
  'cce.ts': {
    tem: ['schemaNfe'],
    naoTem: ['a4', 'leiauteA4', 'simplificado', 'bobina', 'damdfe', 'danfse', 'schemaMdfe', 'schemaNfse'],
  },
  'nfse.ts': {
    tem: ['danfse', 'schemaNfse'],
    naoTem: ['a4', 'leiauteA4', 'simplificado', 'bobina', 'damdfe', 'schemaNfe', 'schemaMdfe'],
  },
  'index.ts': {
    tem: [],
    naoTem: ['a4', 'leiauteA4', 'simplificado', 'bobina', 'damdfe', 'danfse', 'schemaNfe', 'schemaMdfe', 'schemaNfse'],
  },
};

describe('subpaths isolados', () => {
  for (const [entry, { tem, naoTem }] of Object.entries(ESPERADO)) {
    test(entry, async () => {
      const js = await bundle(entry);
      for (const m of tem)
        expect({ entry, marca: m, presente: js.includes(MARCA[m]) }).toMatchObject({ presente: true });
      for (const m of naoTem) {
        expect({ entry, marca: m, presente: js.includes(MARCA[m]) }).toMatchObject({ presente: false });
      }
    });
  }
});
