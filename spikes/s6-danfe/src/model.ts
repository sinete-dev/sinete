// Modelo declarativo: páginas com operações já posicionadas, em milímetros, origem no canto superior esquerdo
// (mesma convenção do MOC Anexo II). Os backends (PDF, SVG/HTML) só desenham isto; não fazem layout.
export type FontName = "Times-Roman" | "Times-Bold" | "Helvetica" | "Helvetica-Bold" | "Courier";
export type Op =
  | { t: "rect"; x: number; y: number; w: number; h: number; stroke?: number; fill?: number; dash?: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; w: number; dash?: number }
  // texto de uma linha; y é a linha de base; w é a largura calculada pelas métricas AFM (o SVG usa em textLength)
  | { t: "text"; x: number; y: number; s: string; font: FontName; size: number; w: number; gray?: number; rot?: number }
  // código de barras: larguras alternadas barra/espaço em módulos, começando por barra
  | { t: "bars"; x: number; y: number; h: number; module: number; widths: number[] }
  // QR: matriz de módulos escuros
  | { t: "qr"; x: number; y: number; size: number; modules: boolean[][] };
export interface Page { w: number; h: number; ops: Op[] }
export interface Doc { title: string; pages: Page[]; stats?: Record<string, number> }
export const PT = 25.4 / 72; // mm por ponto
