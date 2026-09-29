// Regressão visual (ADR 0006). Dois níveis, só com fixtures sintéticas:
//  1. sempre: o sha256 do PDF de cada caso bate com test/vr/golden/manifest.json (determinismo entre máquinas e
//     runtimes; pega qualquer mudança de layout sem depender de raster);
//  2. onde há pdftoppm na mesma versão do manifesto: PDF -> PNG (100 dpi, cinza, sem antialias) -> pixelmatch contra
//     as goldens, com zero pixel de diferença. Outra versão do poppler desenha glifos diferentes, então o nível 2 fica
//     de fora (e diz por quê) em vez de falhar.
// Atualizar: SINETE_VR_UPDATE=1 bun test packages/da/test/vr.test.ts (e revisar as PNGs na PR).
import { describe, expect, test } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { toPdf } from '../src/index.ts';
import { decodePng } from '../src/render/image.ts';
import { CASES } from './cases.ts';
import { encodeGrayPng } from './helpers/png.ts';

const GOLDEN = path.join(import.meta.dir, 'vr/golden');
const MANIFEST = path.join(GOLDEN, 'manifest.json');
const UPDATE = process.env.SINETE_VR_UPDATE === '1';
const DPI = 100;

interface Manifest {
  poppler: string;
  dpi: number;
  casos: Record<string, { sha256: string; paginas: number }>;
}

function popplerVersion(): string | undefined {
  const r = spawnSync('pdftoppm', ['-v']);
  if (r.error) return undefined;
  return /version (\S+)/.exec(`${r.stdout}${r.stderr}`)?.[1];
}

function sha256(b: Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(b).digest('hex');
}

function rgba(png: Uint8Array): { width: number; height: number; data: Uint8Array } {
  const d = decodePng(png);
  const data = new Uint8Array(d.width * d.height * 4);
  for (let i = 0; i < d.width * d.height; i++) {
    const g = d.channels === 1 ? (d.color[i] as number) : (d.color[i * 3] as number);
    data.set([g, g, g, 255], i * 4);
  }
  return { width: d.width, height: d.height, data };
}

const manifest: Manifest = existsSync(MANIFEST)
  ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest)
  : { poppler: '', dpi: DPI, casos: {} };
const pdfs = new Map(CASES.map((c) => [c.name, toPdf(c.doc())]));
const poppler = popplerVersion();

if (UPDATE) {
  if (!poppler) throw new Error('SINETE_VR_UPDATE exige pdftoppm');
  const next: Manifest = { poppler, dpi: DPI, casos: {} };
  for (const f of readdirSync(GOLDEN)) if (f.endsWith('.png')) rmSync(path.join(GOLDEN, f));
  const dir = mkdtempSync(path.join(tmpdir(), 'sinete-vr-'));
  for (const [name, pdf] of pdfs) {
    writeFileSync(path.join(dir, `${name}.pdf`), pdf);
    execFileSync('pdftoppm', [
      '-r',
      String(DPI),
      '-gray',
      '-png',
      '-aa',
      'no',
      '-aaVector',
      'no',
      path.join(dir, `${name}.pdf`),
      path.join(GOLDEN, name),
    ]);
    // Só as folhas deste caso: "cancelada-1.png", e não "cancelada-protocolo-1.png".
    const pages = readdirSync(GOLDEN).filter(
      (f) => f.startsWith(`${name}-`) && /^\d+\.png$/.test(f.slice(name.length + 1)),
    ).length;
    next.casos[name] = { sha256: sha256(pdf), paginas: pages };
  }
  rmSync(dir, { recursive: true, force: true });
  writeFileSync(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);
  Object.assign(manifest, next);
}

describe('regressão: bytes do PDF', () => {
  test('todo caso tem golden e nenhum sobrou', () => {
    expect(Object.keys(manifest.casos).sort()).toEqual([...pdfs.keys()].sort());
  });
  for (const [name, pdf] of pdfs) {
    test(`${name}: sha256 do PDF`, () => {
      expect(sha256(pdf)).toBe(manifest.casos[name]?.sha256 ?? '(sem golden)');
    });
  }
});

const sameRaster = poppler !== undefined && poppler === manifest.poppler;
describe.skipIf(!sameRaster)(`regressão: pixels (pdftoppm ${manifest.poppler})`, () => {
  for (const [name, pdf] of pdfs) {
    test(`${name}: zero pixel de diferença`, () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'sinete-vr-'));
      try {
        writeFileSync(path.join(dir, 'x.pdf'), pdf);
        execFileSync('pdftoppm', [
          '-r',
          String(DPI),
          '-gray',
          '-png',
          '-aa',
          'no',
          '-aaVector',
          'no',
          path.join(dir, 'x.pdf'),
          path.join(dir, 'p'),
        ]);
        const pages = readdirSync(dir)
          .filter((f) => f.startsWith('p-'))
          .sort();
        expect(pages.length).toBe(manifest.casos[name]?.paginas ?? -1);
        for (const [i, p] of pages.entries()) {
          const gold = path.join(GOLDEN, `${name}-${p.slice(2)}`);
          const a = rgba(readFileSync(gold));
          const b = rgba(readFileSync(path.join(dir, p)));
          expect([b.width, b.height]).toEqual([a.width, a.height]);
          const diff = new Uint8Array(a.data.length);
          const n = pixelmatch(a.data, b.data, diff, a.width, a.height, { threshold: 0.1 });
          if (n > 0) {
            // A diferença fica num diretório local (gitignored) para inspeção.
            const out = path.join(import.meta.dir, '../.local/vr');
            mkdirSync(out, { recursive: true });
            const gray = new Uint8Array(a.width * a.height).map((_, k) =>
              diff[k * 4] === 255 && diff[k * 4 + 1] === 0 ? 0 : 255,
            );
            writeFileSync(path.join(out, `${name}-${i + 1}.diff.png`), encodeGrayPng(a.width, a.height, gray));
          }
          expect(n).toBe(0);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
