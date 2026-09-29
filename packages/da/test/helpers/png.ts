// Codificador PNG mínimo para os testes: gera imagens de cada tipo de cor, profundidade, filtro e entrelaçamento.
import { zlibSync } from 'fflate';

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of b) c = (CRC[(c ^ x) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export interface PngSpec {
  width: number;
  height: number;
  colorType: 0 | 2 | 3 | 4 | 6;
  depth: 1 | 2 | 4 | 8 | 16;
  /** Amostra de cada canal do pixel (x, y), já na profundidade da imagem. */
  sample: (x: number, y: number, ch: number) => number;
  palette?: number[];
  trns?: number[];
  interlace?: boolean;
  /** Filtro de cada linha (0 a 4); padrão alterna pelos cinco. */
  filter?: (y: number) => number;
  splitIdat?: boolean;
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as const;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function encodePass(spec: PngSpec, xs: number[], ys: number[], out: number[]): void {
  const ch = CHANNELS[spec.colorType];
  const bits = ch * spec.depth;
  const bpp = Math.max(1, bits >> 3);
  const stride = Math.ceil((xs.length * bits) / 8);
  let prev = new Uint8Array(stride);
  ys.forEach((y, row) => {
    const raw = new Uint8Array(stride);
    let bit = 0;
    for (const x of xs) {
      for (let c = 0; c < ch; c++) {
        const v = spec.sample(x, y, c);
        if (spec.depth === 16) {
          raw[bit >> 3] = v >> 8;
          raw[(bit >> 3) + 1] = v & 0xff;
        } else if (spec.depth === 8) raw[bit >> 3] = v;
        else raw[bit >> 3] = (raw[bit >> 3] as number) | (v << (8 - spec.depth - (bit & 7)));
        bit += spec.depth;
      }
    }
    const type = spec.filter ? spec.filter(row) : row % 5;
    out.push(type);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? (raw[i - bpp] as number) : 0;
      const b = prev[i] as number;
      const c = i >= bpp ? (prev[i - bpp] as number) : 0;
      const pred = type === 0 ? 0 : type === 1 ? a : type === 2 ? b : type === 3 ? (a + b) >> 1 : paeth(a, b, c);
      out.push(((raw[i] as number) - pred) & 0xff);
    }
    prev = raw;
  });
}

const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;

export function encodePng(spec: PngSpec): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, spec.width);
  dv.setUint32(4, spec.height);
  ihdr[8] = spec.depth;
  ihdr[9] = spec.colorType;
  ihdr[12] = spec.interlace ? 1 : 0;
  const raw: number[] = [];
  const range = (a: number, n: number, s: number): number[] => {
    const r: number[] = [];
    for (let i = a; i < n; i += s) r.push(i);
    return r;
  };
  if (spec.interlace) {
    for (const [x0, y0, dx, dy] of ADAM7) {
      const xs = range(x0, spec.width, dx);
      const ys = range(y0, spec.height, dy);
      if (xs.length && ys.length) encodePass(spec, xs, ys, raw);
    }
  } else encodePass(spec, range(0, spec.width, 1), range(0, spec.height, 1), raw);
  const z = zlibSync(Uint8Array.from(raw));
  const idat = spec.splitIdat
    ? [chunk('IDAT', z.subarray(0, z.length >> 1)), chunk('IDAT', z.subarray(z.length >> 1))]
    : [chunk('IDAT', z)];
  return concat([
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    ...(spec.palette ? [chunk('PLTE', Uint8Array.from(spec.palette))] : []),
    ...(spec.trns ? [chunk('tRNS', Uint8Array.from(spec.trns))] : []),
    chunk('tEXt', new TextEncoder().encode('Comment\0sintetico')),
    ...idat,
    chunk('IEND', new Uint8Array()),
  ]);
}

/** JPEG mínimo com SOF0 (só cabeçalho; o PDF não decodifica). */
export function fakeJpeg(width: number, height: number, components: 1 | 3 | 4, adobe = false): Uint8Array {
  const app14 = adobe ? [0xff, 0xee, 0x00, 0x0e, 0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, 0] : [];
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x00,
    0x00,
    ...app14,
    0xff,
    0xc0,
    0x00,
    8 + 3 * components,
    8,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    components,
    ...Array.from({ length: components * 3 }, () => 0),
    0xff,
    0xd9,
  ]);
}

/** PNG RGBA de 8 bits a partir de amostras cinza (para o diff de imagens). */
export function encodeGrayPng(width: number, height: number, gray: Uint8Array): Uint8Array {
  return encodePng({
    width,
    height,
    colorType: 0,
    depth: 8,
    sample: (x, y) => gray[y * width + x] as number,
    filter: () => 0,
  });
}
