/**
 * QR Code (ISO/IEC 18004:2015) em modo byte, versões 1 a 40, escrito da norma: codificação, Reed-Solomon sobre
 * GF(256) com o polinômio 0x11D, padrões de função, posicionamento em zigue-zague, as oito máscaras com a penalidade
 * da seção 7.8.3 e as informações de formato e de versão com BCH.
 *
 * O texto vai em UTF-8, como pedem o DAMDFE (MOC MDF-e 3.00b, 9.3.3) e o DANFE NFC-e/Simplificado Tipo 2 (NT 2026.003,
 * 4.4.3). O nível de correção padrão é M (MOC MDF-e 3.00b, 9.3.2).
 */

import { ErroDa } from '../errors.ts';

export type NivelCorrecaoQr = 'L' | 'M' | 'Q' | 'H';

/** Codewords de correção por bloco, por nível e versão (ISO/IEC 18004, tabela 9). Índice 0 não é usado. */
const ECC_PER_BLOCK: Readonly<Record<NivelCorrecaoQr, readonly number[]>> = {
  L: [
    0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  M: [
    0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  Q: [
    0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  H: [
    0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
};

/** Número de blocos de correção, por nível e versão (ISO/IEC 18004, tabela 9). */
const BLOCKS: Readonly<Record<NivelCorrecaoQr, readonly number[]>> = {
  L: [
    0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19,
    19, 20, 21, 22, 24, 25,
  ],
  M: [
    0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33,
    35, 37, 38, 40, 43, 45, 47, 49,
  ],
  Q: [
    0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43,
    45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  H: [
    0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51,
    54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
};

/** Indicador de nível na informação de formato (ISO/IEC 18004, tabela 12). */
const ECC_BITS: Readonly<Record<NivelCorrecaoQr, number>> = { L: 1, M: 0, Q: 3, H: 2 };

/** Módulos disponíveis para dados e correção numa versão (total menos padrões de função e informações). */
function rawModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

function dataCodewords(ver: number, ecc: NivelCorrecaoQr): number {
  return Math.floor(rawModules(ver) / 8) - (ECC_PER_BLOCK[ecc][ver] ?? 0) * (BLOCKS[ecc][ver] ?? 0);
}

/** Centros dos padrões de alinhamento (ISO/IEC 18004, anexo E). */
function alignmentCenters(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// GF(256) com o polinômio primitivo x^8 + x^4 + x^3 + x^2 + 1 (0x11D).
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] ?? 0;
}

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : (EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0);
}

/** Coeficientes do polinômio gerador de grau `degree`, sem o termo líder. */
function generator(degree: number): Uint8Array {
  const g = new Uint8Array(degree);
  g[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      g[j] = gfMul(g[j] ?? 0, root) ^ (g[j + 1] ?? 0);
    }
    root = gfMul(root, 2);
  }
  return g;
}

function remainder(data: Uint8Array, gen: Uint8Array): Uint8Array {
  const r = new Uint8Array(gen.length);
  for (const b of data) {
    const factor = b ^ (r[0] ?? 0);
    r.copyWithin(0, 1);
    r[r.length - 1] = 0;
    for (let i = 0; i < gen.length; i++) r[i] = (r[i] ?? 0) ^ gfMul(gen[i] ?? 0, factor);
  }
  return r;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Bits do segmento em modo byte, com terminador e preenchimento, em codewords. */
function encodeData(bytes: Uint8Array, ver: number, ecc: NivelCorrecaoQr): Uint8Array {
  const cap = dataCodewords(ver, ecc);
  const bits: number[] = [];
  const put = (v: number, n: number): void => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap * 8 - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const out = new Uint8Array(cap);
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | (bits[i + j] ?? 0);
    out[i / 8] = v;
  }
  for (let i = bits.length / 8, pad = 0xec; i < cap; i++, pad ^= 0xec ^ 0x11) out[i] = pad;
  return out;
}

/** Divide em blocos, calcula a correção de cada um e intercala (ISO/IEC 18004, 7.6). */
function interleave(data: Uint8Array, ver: number, ecc: NivelCorrecaoQr): Uint8Array {
  const nBlocks = BLOCKS[ecc][ver] ?? 1;
  const eccLen = ECC_PER_BLOCK[ecc][ver] ?? 0;
  const raw = Math.floor(rawModules(ver) / 8);
  const nShort = nBlocks - (raw % nBlocks);
  const shortLen = Math.floor(raw / nBlocks);
  const gen = generator(eccLen);
  const blocks: { d: Uint8Array; e: Uint8Array }[] = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const len = shortLen - eccLen + (i < nShort ? 0 : 1);
    const d = data.subarray(k, k + len);
    k += len;
    blocks.push({ d, e: remainder(d, gen) });
  }
  const out: number[] = [];
  for (let i = 0; i <= shortLen - eccLen; i++) {
    for (const b of blocks) if (i < b.d.length) out.push(b.d[i] ?? 0);
  }
  for (let i = 0; i < eccLen; i++) for (const b of blocks) out.push(b.e[i] ?? 0);
  return Uint8Array.from(out);
}

class Matrix {
  readonly ver: number;
  readonly size: number;
  readonly dark: boolean[][];
  readonly fn: boolean[][];

  constructor(ver: number) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fn = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  set(x: number, y: number, on: boolean): void {
    const row = this.dark[y];
    const f = this.fn[y];
    if (!row || !f) return;
    row[x] = on;
    f[x] = true;
  }

  finder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        this.set(x, y, d !== 2 && d !== 4);
      }
    }
  }

  functionPatterns(): void {
    for (let i = 0; i < this.size; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(this.size - 4, 3);
    this.finder(3, this.size - 4);
    const centers = alignmentCenters(this.ver);
    const last = centers.length - 1;
    for (let i = 0; i < centers.length; i++) {
      for (let j = 0; j < centers.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        const cx = centers[i] ?? 0;
        const cy = centers[j] ?? 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
    this.format(0, 0); // reserva as posições; o valor real entra depois da máscara
    this.version();
  }

  /** Informação de formato com BCH(15,5) e a máscara fixa 0x5412 (ISO/IEC 18004, 7.9). */
  format(eccBits: number, mask: number): void {
    const d = (eccBits << 3) | mask;
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const bits = ((d << 10) | r) ^ 0x5412;
    const bit = (i: number): boolean => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i));
    this.set(8, 7, bit(6));
    this.set(8, 8, bit(7));
    this.set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.set(this.size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.set(8, this.size - 15 + i, bit(i));
    this.set(8, this.size - 8, true);
  }

  /** Informação de versão com BCH(18,6), a partir da versão 7 (ISO/IEC 18004, 7.10). */
  version(): void {
    if (this.ver < 7) return;
    let r = this.ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const bits = (this.ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, on);
      this.set(b, a, on);
    }
  }

  /** Posiciona os codewords em zigue-zague, de baixo para cima, em pares de colunas da direita para a esquerda. */
  place(codewords: Uint8Array): void {
    let i = 0;
    const total = codewords.length * 8;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < this.size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vert : vert;
          const row = this.dark[y];
          if (!row || this.fn[y]?.[x] || i >= total) continue;
          row[x] = (((codewords[i >>> 3] ?? 0) >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }

  /** Aplica (ou desfaz, é XOR) a máscara `mask` nos módulos de dados (ISO/IEC 18004, tabela 10). */
  mask(mask: number): void {
    for (let y = 0; y < this.size; y++) {
      const row = this.dark[y];
      const f = this.fn[y];
      if (!row || !f) continue;
      for (let x = 0; x < this.size; x++) {
        if (f[x]) continue;
        let inv: boolean;
        switch (mask) {
          case 0:
            inv = (x + y) % 2 === 0;
            break;
          case 1:
            inv = y % 2 === 0;
            break;
          case 2:
            inv = x % 3 === 0;
            break;
          case 3:
            inv = (x + y) % 3 === 0;
            break;
          case 4:
            inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            inv = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (inv) row[x] = !row[x];
      }
    }
  }

  /** Penalidade N1 a N4 (ISO/IEC 18004, 7.8.3.1), com N1 = 3, N2 = 3, N3 = 40 e N4 = 10. */
  penalty(): number {
    const n = this.size;
    const at = (x: number, y: number): boolean => this.dark[y]?.[x] ?? false;
    let p = 0;
    const line = (get: (i: number) => boolean): void => {
      let run = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && get(i) === get(i - 1)) run++;
        else {
          if (run >= 5) p += 3 + (run - 5);
          run = 1;
        }
      }
      // Padrão 1:1:3:1:1 com quatro módulos claros de um dos lados (dentro da matriz ou na zona de silêncio).
      for (let i = -4; i < n; i++) {
        const v = (k: number): boolean => (k < 0 || k >= n ? false : get(k));
        const core = v(i + 4) && !v(i + 5) && v(i + 6) && v(i + 7) && v(i + 8) && !v(i + 9) && v(i + 10);
        if (!core) continue;
        const before = !v(i) && !v(i + 1) && !v(i + 2) && !v(i + 3);
        const after = !v(i + 11) && !v(i + 12) && !v(i + 13) && !v(i + 14);
        if (before || after) p += 40;
      }
    };
    for (let y = 0; y < n; y++) line((i) => at(i, y));
    for (let x = 0; x < n; x++) line((i) => at(x, i));
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = at(x, y);
        if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) p += 3;
      }
    }
    let dark = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (at(x, y)) dark++;
    const k = Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n));
    return p + k * 10;
  }
}

export interface QrOpcoes {
  readonly nivelDeCorrecao?: NivelCorrecaoQr;
  /** Máscara fixa (0 a 7); sem ela, a de menor penalidade. */
  readonly mascara?: number;
}

/** Matriz de módulos do QR Code de `texto` (true = escuro), sem a zona de silêncio. */
export function matrizQr(texto: string, opcoes: QrOpcoes = {}): boolean[][] {
  const ecc = opcoes.nivelDeCorrecao ?? 'M';
  const bytes = utf8(texto);
  let ver = 1;
  const header = (v: number): number => 4 + (v < 10 ? 8 : 16);
  while (ver <= 40 && Math.ceil((header(ver) + bytes.length * 8) / 8) > dataCodewords(ver, ecc)) ver++;
  if (ver > 40) {
    throw new ErroDa('codigo_barras_invalido', 'conteúdo grande demais para um QR Code', {
      detalhes: { bytes: bytes.length, nivelDeCorrecao: ecc },
    });
  }
  const m = new Matrix(ver);
  m.functionPatterns();
  m.place(interleave(encodeData(bytes, ver, ecc), ver, ecc));
  let mask = opcoes.mascara;
  if (mask === undefined) {
    let best = Number.POSITIVE_INFINITY;
    for (let k = 0; k < 8; k++) {
      m.mask(k);
      m.format(ECC_BITS[ecc], k);
      const p = m.penalty();
      if (p < best) {
        best = p;
        mask = k;
      }
      m.mask(k);
    }
  }
  const chosen = mask ?? 0;
  m.mask(chosen);
  m.format(ECC_BITS[ecc], chosen);
  return m.dark;
}
