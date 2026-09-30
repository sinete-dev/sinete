import { describe, expect, test } from 'bun:test';
import { unzlibSync } from 'fflate';
import type { Documento } from '../src/model.ts';
import { Canvas, fit, lineHeight } from '../src/render/canvas.ts';
import { gerarHtml, gerarSvg } from '../src/render/html.ts';
import { decodePng, jpegInfo, loadImage } from '../src/render/image.ts';
import { gerarPdf } from '../src/render/pdf.ts';
import { ascentMm, ellipsis, shrinkToFit, toWinAnsi, widthMm, winAnsiCode, wrap } from '../src/render/text.ts';
import { encodePng, fakeJpeg } from './helpers/png.ts';

describe('texto', () => {
  test('toWinAnsi mantém o CP1252, tira diacrítico fora dele e troca o resto por ?', () => {
    expect(toWinAnsi('AÇÚCAR – “x” € • …')).toBe('AÇÚCAR – “x” € • …');
    expect(toWinAnsi('Ő✓日😀')).toBe('O???');
    expect(toWinAnsi('a\nb\tc\r\nd')).toBe('a b c d');
    expect(toWinAnsi('x\u0001y\u0085z')).toBe('x y z');
  });
  test('código WinAnsi e larguras AFM', () => {
    expect(winAnsiCode('€')).toBe(128);
    expect(winAnsiCode('A')).toBe(65);
    expect(winAnsiCode('日')).toBe(63);
    // Times-Roman: A = 722/1000 em; 10 pt
    expect(widthMm('A', 'Times-Roman', 10)).toBeCloseTo(0.722 * 10 * (25.4 / 72), 6);
    expect(widthMm('\u0081', 'Helvetica', 10)).toBeCloseTo(0.5 * 10 * (25.4 / 72), 6);
    expect(ascentMm('Helvetica', 10)).toBeCloseTo(0.718 * 10 * (25.4 / 72), 6);
  });
  test('wrap quebra por palavra e corta palavra maior que a linha', () => {
    const w = widthMm('AAAA', 'Times-Roman', 10);
    expect(wrap('AA AA AA', 'Times-Roman', 10, w)).toEqual(['AA', 'AA', 'AA']);
    expect(wrap('AAAAAAAAAA', 'Times-Roman', 10, w)).toEqual(['AAAA', 'AAAA', 'AA']);
    expect(wrap('', 'Times-Roman', 10, w)).toEqual(['']);
    expect(wrap('A  B', 'Times-Roman', 10, 100)).toEqual(['A B']);
  });
  test('shrinkToFit e ellipsis', () => {
    const w = widthMm('ABCDEF', 'Times-Roman', 8);
    expect(shrinkToFit('ABCDEF', 'Times-Roman', 10, 6, w)).toBeLessThanOrEqual(8);
    expect(shrinkToFit('ABCDEF', 'Times-Roman', 10, 9, w)).toBe(9);
    expect(ellipsis('AB', 'Times-Roman', 10, 100)).toBe('AB');
    expect(ellipsis('ABCDEFGH', 'Times-Roman', 10, widthMm('ABC...', 'Times-Roman', 10))).toBe('ABC...');
  });
});

describe('encaixe (ADR 0006, decisão 7)', () => {
  test('cabe no nominal', () => {
    const r = fit('CURTO', 'Times-Roman', 10, 100);
    expect(r).toEqual({ size: 10, lines: ['CURTO'], reduzido: false, quebrado: false, cortado: false });
  });
  test('reduz até 6 pt antes de quebrar', () => {
    const w = widthMm('TEXTO MEDIO AQUI', 'Times-Roman', 7);
    const r = fit('TEXTO MEDIO AQUI', 'Times-Roman', 10, w, 2);
    expect(r.size).toBeLessThanOrEqual(7);
    expect(r.size).toBeGreaterThanOrEqual(6);
    expect(r.lines).toHaveLength(1);
    expect(r.reduzido).toBe(true);
  });
  test('no mínimo e sem caber, quebra; sem linhas suficientes, corta com reticências', () => {
    const s = 'PALAVRA '.repeat(10).trim();
    const w = widthMm('PALAVRA PALAVRA', 'Times-Roman', 6);
    const q = fit(s, 'Times-Roman', 10, w, 10);
    expect(q.size).toBe(6);
    expect(q.quebrado).toBe(true);
    expect(q.cortado).toBe(false);
    const c = fit(s, 'Times-Roman', 10, w, 2);
    expect(c.lines).toHaveLength(2);
    expect(c.cortado).toBe(true);
    expect(c.lines[1]?.endsWith('...')).toBe(true);
  });
  test('nominal abaixo do mínimo não sobe', () => {
    expect(fit('X', 'Times-Roman', 5, 100, 1).size).toBe(5);
  });
});

describe('canvas', () => {
  test('primitivas, campo em várias linhas e contadores', () => {
    const c = new Canvas('Times-Roman', 'Times-Bold');
    c.rect(0, 0, 10, 10);
    c.rect(0, 0, 10, 10, 0.1, 0.5);
    c.line(0, 0, 1, 1);
    c.line(0, 0, 1, 1, 0.1, 0.5);
    expect(c.raw('', 0, 0, 'Times-Roman', 10)).toBe(0);
    c.field(0, 0, 20, 8.5, 'RÓTULO', '');
    c.field(0, 0, 20, 8.5, 'RÓTULO', 'VALOR MUITO LONGO QUE NAO CABE DE JEITO NENHUM NA LARGURA', {
      bold: true,
      noBorder: true,
    });
    c.title('TÍTULO', 0, 0, 50);
    const rest = c.para(['a', 'b', 'c'], 0, 0, lineHeight(10) * 2, 'Times-Roman', 10);
    expect(rest).toEqual(['c']);
    expect(c.block('uma frase bem comprida para quebrar', 0, 0, 10, 50, { size: 10 })).toBeGreaterThan(0);
    expect(c.stats.quebrados).toBeGreaterThan(0);
    expect(c.ops.some((o) => o.t === 'texto' && o.s === 'RÓTULO')).toBe(true);
  });
});

describe('imagens', () => {
  const grad = (x: number, y: number, ch: number, max: number): number => (x * 7 + y * 3 + ch * 5) % (max + 1);
  const cases: [string, Parameters<typeof encodePng>[0]][] = [
    ['cinza 8', { width: 9, height: 7, colorType: 0, depth: 8, sample: (x, y, c) => grad(x, y, c, 255) }],
    ['cinza 1', { width: 11, height: 5, colorType: 0, depth: 1, sample: (x, y) => (x + y) % 2 }],
    ['cinza 16', { width: 5, height: 5, colorType: 0, depth: 16, sample: (x, y) => (x * 1000 + y * 30) & 0xffff }],
    [
      'rgb 8 entrelaçado',
      { width: 13, height: 11, colorType: 2, depth: 8, sample: (x, y, c) => grad(x, y, c, 255), interlace: true },
    ],
    ['rgb 16', { width: 4, height: 3, colorType: 2, depth: 16, sample: (x, y, c) => grad(x, y, c, 65535) }],
    ['cinza+alfa', { width: 6, height: 4, colorType: 4, depth: 8, sample: (x, y, c) => grad(x, y, c, 255) }],
    ['rgba', { width: 6, height: 6, colorType: 6, depth: 8, sample: (x, y, c) => grad(x, y, c, 255), splitIdat: true }],
    [
      'paleta 4 com tRNS',
      {
        width: 7,
        height: 3,
        colorType: 3,
        depth: 4,
        sample: (x) => x % 3,
        palette: [255, 0, 0, 0, 255, 0, 0, 0, 255],
        trns: [0, 128],
      },
    ],
    [
      'paleta 2 sem tRNS',
      { width: 5, height: 2, colorType: 3, depth: 2, sample: (x) => x % 2, palette: [1, 2, 3, 4, 5, 6] },
    ],
    ['cinza 8 com cor-chave', { width: 3, height: 2, colorType: 0, depth: 8, sample: (x) => x * 10, trns: [0, 10] }],
    [
      'cinza 16 com cor-chave no byte baixo',
      { width: 2, height: 1, colorType: 0, depth: 16, sample: (x) => 0x1200 + x, trns: [0x12, 0x00] },
    ],
    [
      'rgb 16 com cor-chave',
      { width: 2, height: 1, colorType: 2, depth: 16, sample: (x) => x * 256, trns: [0, 0, 0, 0, 0, 0] },
    ],
  ];
  for (const [name, spec] of cases) {
    test(`PNG ${name}`, () => {
      const png = decodePng(encodePng(spec));
      expect(png.width).toBe(spec.width);
      expect(png.height).toBe(spec.height);
      const ch = png.channels;
      const max = spec.depth === 16 ? 65535 : (1 << spec.depth) - 1;
      for (let y = 0; y < spec.height; y++) {
        for (let x = 0; x < spec.width; x++) {
          const i = y * spec.width + x;
          if (spec.colorType === 3) {
            const idx = spec.sample(x, y, 0);
            expect(png.color[i * 3]).toBe(spec.palette?.[idx * 3] as number);
            if (spec.trns) expect(png.alpha?.[i]).toBe(spec.trns[idx] ?? 255);
            continue;
          }
          const colorCh = spec.colorType === 0 || spec.colorType === 4 ? 1 : 3;
          expect(ch).toBe(colorCh);
          for (let c = 0; c < colorCh; c++) {
            const v = spec.sample(x, y, c);
            const want = spec.depth === 16 ? v >> 8 : spec.depth === 8 ? v : Math.round((v * 255) / max);
            expect(png.color[i * colorCh + c]).toBe(want);
          }
          if (spec.colorType === 4 || spec.colorType === 6) expect(png.alpha?.[i]).toBe(spec.sample(x, y, colorCh));
        }
      }
      if (name === 'cinza 8 com cor-chave') expect(Array.from(png.alpha ?? [])).toEqual([255, 0, 255, 255, 0, 255]);
      if (name === 'cinza 16 com cor-chave no byte baixo') expect(Array.from(png.alpha ?? [])).toEqual([0, 255]);
      if (name === 'rgb 16 com cor-chave') expect(Array.from(png.alpha ?? [])).toEqual([0, 255]);
    });
  }
  test('JPEG: dimensões e componentes', () => {
    expect(jpegInfo(fakeJpeg(40, 30, 3))).toEqual({ width: 40, height: 30, components: 3, adobe: false });
    expect(jpegInfo(fakeJpeg(1, 2, 4, true)).adobe).toBe(true);
    expect(loadImage(fakeJpeg(5, 6, 1))).toMatchObject({ formato: 'jpeg', largura: 5, altura: 6 });
  });
  test('formatos inválidos viram imagem_invalida', () => {
    const bad: Uint8Array[] = [
      Uint8Array.from([1, 2, 3]),
      Uint8Array.from([0xff, 0xd8, 0x00, 0x00, 0x00, 0x00]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 0, 0, 1, 1, 0, 0, 0]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 1, 0, 1, 2, 0, 0, 0]),
      Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]),
    ];
    for (const b of bad) expect(() => loadImage(b)).toThrow(expect.objectContaining({ code: 'imagem_invalida' }));
    const ok = encodePng({ width: 2, height: 2, colorType: 0, depth: 8, sample: () => 1 });
    const zero = ok.slice();
    zero.set([0, 0, 0, 0], 16);
    expect(() => loadImage(zero)).toThrow(expect.objectContaining({ code: 'imagem_invalida' }));
    const badType = ok.slice();
    badType[25] = 5;
    expect(() => decodePng(badType)).toThrow(expect.objectContaining({ code: 'imagem_invalida' }));
    const noIdat = ok.slice(0, 33);
    expect(() => decodePng(noIdat)).toThrow(expect.objectContaining({ code: 'imagem_invalida' }));
    const pal = encodePng({ width: 2, height: 1, colorType: 3, depth: 8, sample: () => 0 });
    expect(() => decodePng(pal)).toThrow(expect.objectContaining({ code: 'imagem_invalida' }));
    // IDAT corrompido e filtro desconhecido
    const corrupt = ok.slice();
    const at = corrupt.findIndex((_, i) => String.fromCharCode(...corrupt.subarray(i, i + 4)) === 'IDAT');
    corrupt[at + 4] = 0xff;
    corrupt[at + 5] = 0xff;
    expect(() => decodePng(corrupt)).toThrow(expect.objectContaining({ code: 'imagem_invalida' }));
    const filt = encodePng({ width: 2, height: 2, colorType: 0, depth: 8, sample: () => 1, filter: () => 7 });
    expect(() => decodePng(filt)).toThrow(expect.objectContaining({ code: 'imagem_invalida' }));
    const trunc = encodePng({ width: 64, height: 64, colorType: 0, depth: 8, sample: () => 1, filter: () => 0 });
    const short = trunc.slice();
    // IHDR declara mais linhas do que os dados trazem
    new DataView(short.buffer).setUint32(20, 128);
    expect(() => decodePng(short)).toThrow(expect.objectContaining({ code: 'imagem_invalida' }));
  });
});

function sample(): Documento {
  const c = new Canvas('Helvetica', 'Helvetica-Bold');
  c.rect(1, 1, 10, 5, 0.2, 0.5);
  c.rect(1, 1, 10, 5, 0.2);
  c.ops.push({ t: 'retangulo', x: 0, y: 0, w: 1, h: 1, contorno: 0.1, tracejado: 0.5 });
  c.line(0, 0, 10, 10, 0.3, 1);
  c.ops.push({ t: 'linha', x1: 0, y1: 0, x2: 1, y2: 1, w: 0.3, cinza: 0.5 });
  c.raw('Texto (com) \\ e ç', 5, 5, 'Helvetica', 10);
  c.raw('<cinza & "girado">', 5, 5, 'Helvetica-Bold', 10, 0.5, 30);
  c.bars({ x: 0, y: 0, h: 5, modulo: 0.3, larguras: [2, 1, 1, 2] });
  c.bars({ x: 0, y: 0, h: 5, modulo: 0.3, larguras: [2, 1, 1, 2], vertical: true });
  c.qr({
    x: 0,
    y: 0,
    tamanho: 5,
    modulos: [
      [true, true, false],
      [false, true, true],
      [true, false, true],
    ],
  });
  c.image('png', 0, 0, 10, 10);
  c.image('jpeg', 0, 0, 10, 10);
  c.image('cmyk', 0, 0, 10, 10);
  c.image('faltando', 0, 0, 10, 10);
  return {
    titulo: 'Teste (1)',
    paginas: [
      { w: 50, h: 40, ops: c.ops },
      { w: 40, h: 50, ops: [] },
    ],
    imagens: {
      png: loadImage(
        encodePng({ width: 2, height: 2, colorType: 6, depth: 8, sample: (x, y, ch) => x * 100 + y + ch }),
      ),
      jpeg: loadImage(fakeJpeg(3, 3, 1)),
      cmyk: loadImage(fakeJpeg(3, 3, 4, true)),
      gray: loadImage(encodePng({ width: 2, height: 2, colorType: 0, depth: 8, sample: () => 3 })),
    },
    estatisticas: { reduzidos: 0, quebrados: 0, cortados: 0 },
  };
}

function latin1(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return s;
}

describe('PDF', () => {
  test('estrutura válida: xref com offsets reais, imagens, SMask e determinismo', () => {
    const doc = sample();
    const pdf = gerarPdf(doc);
    expect(gerarPdf(doc)).toEqual(pdf);
    const s = latin1(pdf);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    const xref = Number(/startxref\n(\d+)/.exec(s)?.[1]);
    expect(s.slice(xref, xref + 4)).toBe('xref');
    const entries = [...s.slice(xref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    for (const [i, off] of entries.entries()) expect(s.slice(off).startsWith(`${i + 1} 0 obj`)).toBe(true);
    expect(s).toContain('/SMask');
    expect(s).toContain('/DCTDecode');
    expect(s).toContain('/Decode [1 0 1 0 1 0 1 0]');
    expect(s).toContain('/DeviceGray');
    expect(s).toContain('/Title (Teste \\(1\\))');
    expect(s).not.toContain('CreationDate');
  });
  test('sem compressão, o conteúdo aparece legível', () => {
    const s = latin1(gerarPdf(sample(), { comprimir: false, informacoes: { Author: 'sinete' } }));
    expect(s).toContain('(Texto \\(com\\) \\\\ e \\347) Tj');
    expect(s).toContain('Tm');
    expect(s).toContain('/Author (sinete)');
    expect(s).toContain('[2.835 2.835] 0 d');
    expect(s).toContain('0.5 G');
  });
  test('fluxo comprimido é zlib válido', () => {
    const s = latin1(gerarPdf(sample()));
    const m = /\/Filter \/FlateDecode \/Length (\d+) >>\nstream\n/.exec(s.slice(s.indexOf('/Contents')));
    expect(m).not.toBeNull();
    const start = s.indexOf(m?.[0] ?? '', s.indexOf('/Contents')) + (m?.[0].length ?? 0);
    const bytes = Uint8Array.from(s.slice(start, start + Number(m?.[1])), (ch) => ch.charCodeAt(0));
    expect(latin1(unzlibSync(bytes))).toContain(' re');
  });
});

describe('HTML e SVG', () => {
  test('uma svg por página, textLength e imagem como data URI', () => {
    const doc = sample();
    const html = gerarHtml(doc);
    expect(html.match(/<svg /g)).toHaveLength(2);
    expect(html).toContain('textLength=');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('data:image/jpeg;base64,');
    expect(html).toContain('&lt;cinza &amp; &quot;girado&quot;&gt;');
    expect(html).toContain('rotate(-30');
    expect(html).toContain('@page{size:50mm 40mm');
    const svg = gerarSvg(doc.paginas[0] as Documento['paginas'][number]);
    expect(svg).not.toContain('<image');
    expect(gerarSvg(doc.paginas[0] as Documento['paginas'][number], doc)).toContain('<image');
    expect(gerarHtml({ ...doc, paginas: [] })).toContain('@page{size:A4');
  });
});

test('página acima de 14.400 pt usa /UserUnit (PDF 1.6); abaixo, PDF 1.4 sem mudança', () => {
  const longa = gerarPdf(
    {
      titulo: 't',
      paginas: [{ w: 80, h: 6000, ops: [] }],
      imagens: {},
      estatisticas: { reduzidos: 0, quebrados: 0, cortados: 0 },
    },
    { comprimir: false },
  );
  const s = new TextDecoder('latin1').decode(longa);
  expect(s.startsWith('%PDF-1.6')).toBe(true);
  expect(s).toContain('/MediaBox [0 0 113.386 8503.937] /UserUnit 2');
  expect(s).toContain('0.500000 0 0 0.500000 0 0 cm');
  const curta = new TextDecoder('latin1').decode(
    gerarPdf({
      titulo: 't',
      paginas: [{ w: 80, h: 200, ops: [] }],
      imagens: {},
      estatisticas: { reduzidos: 0, quebrados: 0, cortados: 0 },
    }),
  );
  expect(curta.startsWith('%PDF-1.4')).toBe(true);
  expect(curta).not.toContain('/UserUnit');
});
