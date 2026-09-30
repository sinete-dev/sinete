/**
 * Modelo declarativo do documento (ADR 0006): páginas com operações já posicionadas, em milímetros, com origem no
 * canto superior esquerdo (a convenção das tabelas do MOC, Anexo II, 3.8). O layout produz um `Documento`; os backends
 * (PDF e HTML/SVG) só desenham, sem decidir nada de posição, quebra ou tamanho.
 */

/** Fontes padrão do PDF (Adobe Core 14), usadas com `WinAnsiEncoding` e sem embutir. */
export type NomeDaFonte = 'Times-Roman' | 'Times-Bold' | 'Helvetica' | 'Helvetica-Bold';

/** Retângulo: contorno com `contorno` (espessura em mm) e/ou preenchimento em cinza (`preenchimento`, 0 = preto, 1 = branco). */
export interface OpRetangulo {
  readonly t: 'retangulo';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly contorno?: number;
  readonly preenchimento?: number;
  /** Tracejado: comprimento do traço e do vão, em mm. */
  readonly tracejado?: number;
}

export interface OpLinha {
  readonly t: 'linha';
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  /** Espessura em mm. */
  readonly w: number;
  readonly tracejado?: number;
  /** Cinza do traço (0 = preto). */
  readonly cinza?: number;
}

/**
 * Texto de uma linha já medido. `y` é a linha de base; `w` é a largura calculada pelas métricas AFM (o HTML usa em
 * `textLength`, então a posição não depende da fonte que o browser encontrar). `rotacao` gira em graus, anti-horário,
 * em torno de (`x`, `y`).
 */
export interface OpTexto {
  readonly t: 'texto';
  readonly x: number;
  readonly y: number;
  readonly s: string;
  readonly fonte: NomeDaFonte;
  /** Tamanho em pontos. */
  readonly tamanho: number;
  readonly w: number;
  readonly cinza?: number;
  /** Cor RGB (0 a 1 por canal), no lugar do cinza; só onde a norma pede cor (NT 008/2026, 2.4.3: vermelho sólido). */
  readonly rgb?: readonly [number, number, number];
  readonly rotacao?: number;
}

/**
 * Código de barras: larguras alternadas barra/espaço, em módulos, começando por barra. Horizontal por padrão, com
 * barras de altura `h` a partir de (`x`, `y`); `vertical` empilha as barras de cima para baixo, com comprimento `h`.
 */
export interface OpBarras {
  readonly t: 'barras';
  readonly x: number;
  readonly y: number;
  readonly h: number;
  readonly modulo: number;
  readonly larguras: readonly number[];
  readonly vertical?: boolean;
}

/** QR Code: matriz de módulos escuros, desenhada num quadrado de lado `tamanho` (sem a zona de silêncio). */
export interface OpQr {
  readonly t: 'qr';
  readonly x: number;
  readonly y: number;
  readonly tamanho: number;
  readonly modulos: readonly (readonly boolean[])[];
}

/** Imagem (logotipo) já encaixada no retângulo; `imagem` aponta para `Documento.imagens`. */
export interface OpImagem {
  readonly t: 'imagem';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly imagem: string;
}

export type Op = OpRetangulo | OpLinha | OpTexto | OpBarras | OpQr | OpImagem;

export interface Pagina {
  /** Largura e altura em mm. */
  readonly w: number;
  readonly h: number;
  readonly ops: readonly Op[];
}

/** Imagem decodificada o bastante para os backends: JPEG vai inteiro (DCTDecode), PNG vai em amostras. */
export interface ImagemDoDocumento {
  readonly formato: 'jpeg' | 'png';
  /** Bytes originais do arquivo (o HTML usa como data URI). */
  readonly bytes: Uint8Array;
  readonly largura: number;
  readonly altura: number;
}

/** Contadores de encaixe de texto de um documento, para medir o layout no corpus. */
export interface EstatisticasDeEncaixe {
  /** Textos que precisaram de fonte menor que a nominal para caber. */
  readonly reduzidos: number;
  /** Textos quebrados em mais linhas no tamanho mínimo. */
  readonly quebrados: number;
  /** Textos cortados com reticências (nem quebrando couberam na área). */
  readonly cortados: number;
}

export interface Documento {
  readonly titulo: string;
  readonly paginas: readonly Pagina[];
  readonly imagens: Readonly<Record<string, ImagemDoDocumento>>;
  readonly estatisticas: EstatisticasDeEncaixe;
}

/** Milímetros por ponto tipográfico. */
export const PT: number = 25.4 / 72;
