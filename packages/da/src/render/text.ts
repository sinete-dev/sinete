/**
 * Texto nas fontes padrão do PDF: repertório WinAnsi (CP1252), medida pelas larguras AFM e quebra de linha. Tudo em
 * milímetros e pontos, sem depender de fonte instalada: o mesmo texto mede o mesmo em qualquer runtime.
 */

import type { FontName } from '../model.ts';
import { PT } from '../model.ts';
import { ASCENT, WIDTHS, WINANSI_EXTRA } from './metrics.ts';

const COMBINING = /[̀-ͯ]/g;

/**
 * Leva o texto para o repertório WinAnsi das fontes padrão. Quebras e tabulações viram espaço. Fora do CP1252, tira
 * o diacrítico quando a letra base cabe (Ő vira O); o resto vira `?` (emoji, CJK, símbolos).
 */
export function toWinAnsi(s: string): string {
  let out = '';
  for (const ch of s.replace(/[\r\n\t]+/g, ' ')) {
    const cp = ch.codePointAt(0) ?? 63;
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WINANSI_EXTRA[cp] !== undefined) {
      out += ch;
      continue;
    }
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) {
      out += ' ';
      continue;
    }
    const base = ch.normalize('NFD').replace(COMBINING, '');
    out += base !== ch && [...base].every((c) => (c.codePointAt(0) ?? 0x100) < 0x100) ? base : '?';
  }
  return out;
}

/** Código WinAnsi de um caractere já convertido por `toWinAnsi`. */
export function winAnsiCode(ch: string): number {
  const cp = ch.codePointAt(0) ?? 63;
  return cp < 0x100 ? cp : (WINANSI_EXTRA[cp] ?? 63);
}

/** Largura do texto (já em WinAnsi) em mm. */
export function widthMm(s: string, font: FontName, size: number): number {
  const w = WIDTHS[font];
  let u = 0;
  for (const ch of s) u += w[winAnsiCode(ch)] || 500;
  return (u / 1000) * size * PT;
}

/** Altura do ascendente em mm: da linha de base ao topo das maiúsculas acentuadas. */
export function ascentMm(font: FontName, size: number): number {
  return (ASCENT[font] / 1000) * size * PT;
}

/** Corta uma palavra maior que a linha por caractere; devolve os pedaços. */
function breakWord(word: string, font: FontName, size: number, maxW: number): string[] {
  const parts: string[] = [];
  let part = '';
  for (const ch of word) {
    if (part && widthMm(part + ch, font, size) > maxW) {
      parts.push(part);
      part = '';
    }
    part += ch;
  }
  parts.push(part);
  return parts;
}

/**
 * Quebra por palavra na largura `maxW`; palavra maior que a linha é cortada por caractere. O texto de entrada já deve
 * estar em WinAnsi. Sempre devolve ao menos uma linha.
 */
export function wrap(s: string, font: FontName, size: number, maxW: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of s.split(' ')) {
    if (!word) continue;
    const cand = cur ? `${cur} ${word}` : word;
    if (widthMm(cand, font, size) <= maxW) {
      cur = cand;
      continue;
    }
    if (cur) lines.push(cur);
    const parts = breakWord(word, font, size, maxW);
    cur = parts.pop() ?? '';
    lines.push(...parts);
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [''];
}

/** Maior tamanho, de `size` para baixo em passos de 0,25 pt até `min`, em que o texto cabe em `maxW`. */
export function shrinkToFit(s: string, font: FontName, size: number, min: number, maxW: number): number {
  let z = size;
  while (z > min && widthMm(s, font, z) > maxW) z = Math.max(min, z - 0.25);
  return z;
}

/** Corta o texto e acrescenta reticências até caber em `maxW`. */
export function ellipsis(s: string, font: FontName, size: number, maxW: number): string {
  if (widthMm(s, font, size) <= maxW) return s;
  let str = s;
  while (str && widthMm(`${str}...`, font, size) > maxW) str = str.slice(0, -1);
  return `${str}...`;
}
