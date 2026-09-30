/**
 * Logotipo do emitente (MOC 7.0, Anexo II, 3.1.3: opcional, sem prejudicar as informações obrigatórias). JPEG entra
 * no PDF sem decodificar (DCTDecode), só com as dimensões lidas do SOF. PNG é decodificado aqui (PNG, W3C 2003:
 * filtros, entrelaçamento Adam7, paleta, transparência) em amostras de 8 bits, com o alfa separado para a SMask.
 */

import { unzlibSync } from 'fflate';
import { ErroDa } from '../errors.ts';
import type { ImagemDoDocumento } from '../model.ts';

/** Amostras de 8 bits prontas para o PDF: `color` em cinza (1 canal) ou RGB (3), `alpha` quando há transparência. */
export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  readonly channels: 1 | 3;
  readonly color: Uint8Array;
  readonly alpha?: Uint8Array;
}

export interface JpegInfo {
  readonly width: number;
  readonly height: number;
  readonly components: 1 | 3 | 4;
  /** Marcador APP14 da Adobe: CMYK gravado invertido. */
  readonly adobe: boolean;
}

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function fail(message: string, cause?: unknown): never {
  throw new ErroDa('imagem_invalida', message, cause === undefined ? {} : { cause });
}

function u32(b: Uint8Array, o: number): number {
  return (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0;
}

function u16(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
}

/** Identifica o formato e lê as dimensões; lança `imagem_invalida` para o que não for PNG nem JPEG. */
export function loadImage(bytes: Uint8Array): ImagemDoDocumento {
  if (PNG_SIG.every((v, i) => bytes[i] === v)) {
    const { width, height } = pngHeader(bytes);
    return { formato: 'png', bytes, largura: width, altura: height };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const { width, height } = jpegInfo(bytes);
    return { formato: 'jpeg', bytes, largura: width, altura: height };
  }
  return fail('logotipo precisa ser PNG ou JPEG');
}

function pngHeader(b: Uint8Array): { width: number; height: number } {
  if (b.length < 33 || String.fromCharCode(...b.subarray(12, 16)) !== 'IHDR') fail('PNG sem IHDR');
  const width = u32(b, 16);
  const height = u32(b, 20);
  if (width === 0 || height === 0) fail('PNG com dimensão zero');
  return { width, height };
}

/** Dimensões e componentes do quadro (SOF0 a SOF15, exceto DHT, JPG e DAC; ITU-T T.81, B.2.2). */
export function jpegInfo(b: Uint8Array): JpegInfo {
  let o = 2;
  let adobe = false;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) fail('JPEG com marcador inválido');
    const marker = b[o + 1] ?? 0;
    if (marker === 0xff) {
      o++;
      continue;
    }
    const len = u16(b, o + 2);
    if (marker === 0xee && String.fromCharCode(...b.subarray(o + 4, o + 9)) === 'Adobe') adobe = true;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = u16(b, o + 5);
      const width = u16(b, o + 7);
      const components = b[o + 9] ?? 0;
      if (width === 0 || height === 0) fail('JPEG com dimensão zero');
      if (components !== 1 && components !== 3 && components !== 4)
        fail('JPEG com número de componentes não suportado');
      return { width, height, components, adobe };
    }
    o += 2 + len;
  }
  return fail('JPEG sem quadro (SOF)');
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Desfaz os filtros de uma imagem (ou passo do Adam7) de `w` x `h` com `bpp` bytes por pixel. */
function unfilter(src: Uint8Array, at: number, w: number, h: number, bitsPerPixel: number): [Uint8Array, number] {
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const stride = Math.ceil((w * bitsPerPixel) / 8);
  const out = new Uint8Array(stride * h);
  let o = at;
  for (let y = 0; y < h; y++) {
    const type = src[o++];
    if (type === undefined || o + stride > src.length) fail('PNG truncado');
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw = src[o + x] ?? 0;
      const a = x >= bpp ? (out[row + x - bpp] ?? 0) : 0;
      const b = y > 0 ? (out[row - stride + x] ?? 0) : 0;
      const c = x >= bpp && y > 0 ? (out[row - stride + x - bpp] ?? 0) : 0;
      let v: number;
      if (type === 0) v = raw;
      else if (type === 1) v = raw + a;
      else if (type === 2) v = raw + b;
      else if (type === 3) v = raw + ((a + b) >> 1);
      else if (type === 4) v = raw + paeth(a, b, c);
      else fail('PNG com filtro desconhecido');
      out[row + x] = v & 0xff;
    }
    o += stride;
  }
  return [out, o];
}

/** Passos do entrelaçamento Adam7: início e passo em x e y. */
const ADAM7: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

/** Decodifica o PNG em amostras de 8 bits: cinza ou RGB, com alfa separado quando existe. */
export function decodePng(b: Uint8Array): DecodedPng {
  const { width, height } = pngHeader(b);
  const depth = b[24] ?? 0;
  const colorType = b[25] ?? 0;
  const interlace = b[28] ?? 0;
  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (channels === undefined || ![1, 2, 4, 8, 16].includes(depth))
    fail('PNG com tipo de cor ou profundidade inválidos');
  let palette: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  const idat: Uint8Array[] = [];
  for (let o = 8; o + 8 <= b.length; ) {
    const len = u32(b, o);
    const type = String.fromCharCode(...b.subarray(o + 4, o + 8));
    const data = b.subarray(o + 8, o + 8 + len);
    if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (idat.length === 0) fail('PNG sem IDAT');
  if (colorType === 3 && !palette) fail('PNG indexado sem paleta');
  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let k = 0;
  for (const c of idat) {
    joined.set(c, k);
    k += c.length;
  }
  let raw: Uint8Array;
  try {
    raw = unzlibSync(joined);
  } catch (e) {
    return fail('PNG com dados comprimidos inválidos', e);
  }
  const bitsPerPixel = channels * depth;
  // Amostras por pixel na profundidade original (até 16 bits), na ordem do arquivo, antes de aplicar paleta e
  // transparência: a cor-chave do tRNS compara com o valor inteiro e só a saída desce para 8 bits.
  const samples = new Uint16Array(width * height * channels);
  const read = (px: Uint8Array, stride: number, x: number, y: number, ch: number): number => {
    if (depth === 8) return px[y * stride + x * channels + ch] ?? 0;
    if (depth === 16) {
      const o = y * stride + (x * channels + ch) * 2;
      return ((px[o] ?? 0) << 8) | (px[o + 1] ?? 0);
    }
    const bit = (x * channels + ch) * depth;
    const byte = px[y * stride + (bit >> 3)] ?? 0;
    return (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  };
  const passes = interlace === 1 ? ADAM7 : ([[0, 0, 1, 1]] as const);
  let at = 0;
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.ceil((width - x0) / dx);
    const ph = Math.ceil((height - y0) / dy);
    if (pw <= 0 || ph <= 0) continue;
    const [px, next] = unfilter(raw, at, pw, ph, bitsPerPixel);
    at = next;
    const stride = Math.ceil((pw * bitsPerPixel) / 8);
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const dst = ((y0 + y * dy) * width + (x0 + x * dx)) * channels;
        for (let ch = 0; ch < channels; ch++) samples[dst + ch] = read(px, stride, x, y, ch);
      }
    }
  }
  const n = width * height;
  const scale = (v: number): number =>
    depth === 16 ? v >> 8 : depth === 8 ? v : Math.round((v * 255) / ((1 << depth) - 1));
  if (colorType === 3) {
    const color = new Uint8Array(n * 3);
    let alpha: Uint8Array | undefined;
    if (trns) alpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const idx = samples[i] ?? 0;
      color[i * 3] = palette?.[idx * 3] ?? 0;
      color[i * 3 + 1] = palette?.[idx * 3 + 1] ?? 0;
      color[i * 3 + 2] = palette?.[idx * 3 + 2] ?? 0;
      if (alpha) alpha[i] = trns?.[idx] ?? 255;
    }
    return alpha ? { width, height, channels: 3, color, alpha } : { width, height, channels: 3, color };
  }
  const colorChannels = colorType === 0 || colorType === 4 ? 1 : 3;
  const color = new Uint8Array(n * colorChannels);
  const hasAlpha = colorType === 4 || colorType === 6 || trns !== undefined;
  const alpha = hasAlpha ? new Uint8Array(n) : undefined;
  // tRNS em cinza ou RGB é uma cor-chave, comparada na profundidade original (PNG, 11.3.2.1).
  const key = trns ? Array.from({ length: colorChannels }, (_, c) => u16(trns ?? new Uint8Array(), c * 2)) : undefined;
  for (let i = 0; i < n; i++) {
    let transparent = key !== undefined;
    for (let c = 0; c < colorChannels; c++) {
      const v = samples[i * channels + c] ?? 0;
      color[i * colorChannels + c] = scale(v);
      if (key && v !== key[c]) transparent = false;
    }
    if (alpha)
      alpha[i] = channels > colorChannels ? scale(samples[i * channels + colorChannels] ?? 0) : transparent ? 0 : 255;
  }
  return alpha
    ? { width, height, channels: colorChannels, color, alpha }
    : { width, height, channels: colorChannels, color };
}
