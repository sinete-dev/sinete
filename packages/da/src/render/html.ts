/**
 * Backend HTML/SVG (ADR 0006, decisão 1): uma `<svg>` por página, em mm, com `@page` do tamanho do papel. Cada texto
 * leva `textLength` com a largura AFM, então a posição não depende da fonte que o browser encontrar (Times New Roman,
 * Tinos, Liberation Serif). Serve para pré-visualizar e imprimir no cliente com `window.print()`.
 */

import { codificarBase64 } from '@sinete/core/xml';
import type { Doc, Op, Page } from '../model.ts';
import { PT } from '../model.ts';

function n(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gray(v: number): string {
  const c = Math.round(v * 255);
  return `rgb(${c},${c},${c})`;
}

const FAMILY: Readonly<Record<string, string>> = {
  'Times-Roman': 'ft',
  'Times-Bold': 'ft b',
  Helvetica: 'fh',
  'Helvetica-Bold': 'fh b',
};

function opSvg(op: Op, doc: Doc | undefined): string {
  switch (op.t) {
    case 'rect': {
      const fill = op.fill === undefined ? 'none' : gray(op.fill);
      const stroke = op.stroke ? ` stroke="#000" stroke-width="${n(op.stroke)}"` : '';
      const dash = op.dash ? ` stroke-dasharray="${n(op.dash)}"` : '';
      return `<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" fill="${fill}"${stroke}${dash}/>`;
    }
    case 'line': {
      const dash = op.dash ? ` stroke-dasharray="${n(op.dash)}"` : '';
      const color = op.gray ? gray(op.gray) : '#000';
      return `<line x1="${n(op.x1)}" y1="${n(op.y1)}" x2="${n(op.x2)}" y2="${n(op.y2)}" stroke="${color}" stroke-width="${n(op.w)}"${dash}/>`;
    }
    case 'text': {
      const fill = op.rgb
        ? ` fill="rgb(${op.rgb.map((v) => Math.round(v * 255)).join(',')})"`
        : op.gray === undefined
          ? ''
          : ` fill="${gray(op.gray)}"`;
      const tr = op.rot ? ` transform="rotate(${n(-op.rot)} ${n(op.x)} ${n(op.y)})"` : '';
      return `<text class="${FAMILY[op.font]}" x="${n(op.x)}" y="${n(op.y)}" font-size="${n(op.size * PT)}" textLength="${n(op.w)}" lengthAdjust="spacingAndGlyphs"${fill}${tr}>${esc(op.s)}</text>`;
    }
    case 'bars': {
      let pos = 0;
      let d = '';
      op.widths.forEach((w, i) => {
        const len = w * op.module;
        if (i % 2 === 0) {
          d += op.vertical
            ? `M${n(op.x)} ${n(op.y + pos)}h${n(op.h)}v${n(len)}h${n(-op.h)}z`
            : `M${n(op.x + pos)} ${n(op.y)}h${n(len)}v${n(op.h)}h${n(-len)}z`;
        }
        pos += len;
      });
      return `<path d="${d}" shape-rendering="crispEdges"/>`;
    }
    case 'qr': {
      const m = op.size / op.modules.length;
      let d = '';
      op.modules.forEach((row, r) => {
        row.forEach((on, c) => {
          if (on) d += `M${n(op.x + c * m)} ${n(op.y + r * m)}h${n(m)}v${n(m)}h${n(-m)}z`;
        });
      });
      return `<path d="${d}" shape-rendering="crispEdges"/>`;
    }
    case 'image': {
      const img = doc?.images[op.ref];
      if (!img) return '';
      const mime = img.format === 'png' ? 'image/png' : 'image/jpeg';
      return `<image x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" preserveAspectRatio="none" href="data:${mime};base64,${codificarBase64(img.bytes)}"/>`;
    }
  }
}

/** Uma página como SVG autocontido, em mm. Passe o `doc` para que os logotipos entrem como data URI. */
export function toSvg(page: Page, doc?: Doc): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(page.w)} ${n(page.h)}" width="${n(page.w)}mm" height="${n(page.h)}mm">${STYLE_SVG}${page.ops.map((op) => opSvg(op, doc)).join('')}</svg>`;
}

const FONT_CSS =
  '.ft{font-family:"Times New Roman",Tinos,"Liberation Serif",Times,serif}' +
  '.fh{font-family:Arial,Helvetica,Arimo,"Liberation Sans",sans-serif}.b{font-weight:bold}';

const STYLE_SVG = `<style>${FONT_CSS}</style>`;

/** Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. */
export function toHtml(doc: Doc): string {
  const p0 = doc.pages[0];
  const size = p0 ? `${n(p0.w)}mm ${n(p0.h)}mm` : 'A4';
  const pages = doc.pages
    .map(
      (p) =>
        `<svg class="pg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(p.w)} ${n(p.h)}" width="${n(p.w)}mm" height="${n(p.h)}mm">${p.ops.map((op) => opSvg(op, doc)).join('')}</svg>`,
    )
    .join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(doc.title)}</title><style>
@page{size:${size};margin:0}html,body{margin:0;background:#888}
.pg{display:block;margin:8mm auto;background:#fff;box-shadow:0 1px 4px #0006;max-width:100%;height:auto}
@media print{html,body{background:#fff}.pg{margin:0;box-shadow:none;break-after:page}}
${FONT_CSS}
</style></head><body>
${pages}
</body></html>`;
}
