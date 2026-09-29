/**
 * Modelo declarativo do documento (ADR 0006): páginas com operações já posicionadas, em milímetros, com origem no
 * canto superior esquerdo (a convenção das tabelas do MOC, Anexo II, 3.8). O layout produz um `Doc`; os backends
 * (PDF e HTML/SVG) só desenham, sem decidir nada de posição, quebra ou tamanho.
 */

/** Fontes padrão do PDF (Adobe Core 14), usadas com `WinAnsiEncoding` e sem embutir. */
export type FontName = 'Times-Roman' | 'Times-Bold' | 'Helvetica' | 'Helvetica-Bold';

/** Retângulo: contorno com `stroke` (espessura em mm) e/ou preenchimento em cinza (`fill`, 0 = preto, 1 = branco). */
export interface RectOp {
  readonly t: 'rect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly stroke?: number;
  readonly fill?: number;
  /** Tracejado: comprimento do traço e do vão, em mm. */
  readonly dash?: number;
}

export interface LineOp {
  readonly t: 'line';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** Espessura em mm. */
  readonly w: number;
  readonly dash?: number;
  /** Cinza do traço (0 = preto). */
  readonly gray?: number;
}

/**
 * Texto de uma linha já medido. `y` é a linha de base; `w` é a largura calculada pelas métricas AFM (o HTML usa em
 * `textLength`, então a posição não depende da fonte que o browser encontrar). `rot` gira em graus, anti-horário,
 * em torno de (`x`, `y`).
 */
export interface TextOp {
  readonly t: 'text';
  readonly x: number;
  readonly y: number;
  readonly s: string;
  readonly font: FontName;
  /** Tamanho em pontos. */
  readonly size: number;
  readonly w: number;
  readonly gray?: number;
  /** Cor RGB (0 a 1 por canal), no lugar do cinza; só onde a norma pede cor (NT 008/2026, 2.4.3: vermelho sólido). */
  readonly rgb?: readonly [number, number, number];
  readonly rot?: number;
}

/**
 * Código de barras: larguras alternadas barra/espaço, em módulos, começando por barra. Horizontal por padrão, com
 * barras de altura `h` a partir de (`x`, `y`); `vertical` empilha as barras de cima para baixo, com comprimento `h`.
 */
export interface BarsOp {
  readonly t: 'bars';
  readonly x: number;
  readonly y: number;
  readonly h: number;
  readonly module: number;
  readonly widths: readonly number[];
  readonly vertical?: boolean;
}

/** QR Code: matriz de módulos escuros, desenhada num quadrado de lado `size` (sem a zona de silêncio). */
export interface QrOp {
  readonly t: 'qr';
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly modules: readonly (readonly boolean[])[];
}

/** Imagem (logotipo) já encaixada no retângulo; `ref` aponta para `Doc.images`. */
export interface ImageOp {
  readonly t: 'image';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly ref: string;
}

export type Op = RectOp | LineOp | TextOp | BarsOp | QrOp | ImageOp;

export interface Page {
  /** Largura e altura em mm. */
  readonly w: number;
  readonly h: number;
  readonly ops: readonly Op[];
}

/** Imagem decodificada o bastante para os backends: JPEG vai inteiro (DCTDecode), PNG vai em amostras. */
export interface DocImage {
  readonly format: 'jpeg' | 'png';
  /** Bytes originais do arquivo (o HTML usa como data URI). */
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** Contadores de encaixe de texto de um documento, para medir o layout no corpus. */
export interface FitStats {
  /** Textos que precisaram de fonte menor que a nominal para caber. */
  readonly reduzidos: number;
  /** Textos quebrados em mais linhas no tamanho mínimo. */
  readonly quebrados: number;
  /** Textos cortados com reticências (nem quebrando couberam na área). */
  readonly cortados: number;
}

export interface Doc {
  readonly title: string;
  readonly pages: readonly Page[];
  readonly images: Readonly<Record<string, DocImage>>;
  readonly stats: FitStats;
}

/** Milímetros por ponto tipográfico. */
export const PT: number = 25.4 / 72;
