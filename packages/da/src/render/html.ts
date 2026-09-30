/**
 * Backend HTML/SVG (ADR 0006, decisão 1): uma `<svg>` por página, em mm, com `@page` do tamanho do papel. Cada texto
 * leva `textLength` com a largura AFM, então a posição não depende da fonte que o browser encontrar (Times New Roman,
 * Tinos, Liberation Serif). Serve para pré-visualizar e imprimir no cliente com `window.print()`.
 */

import { codificarBase64 } from '@sinete/core/xml';
import type { Documento, Op, Pagina } from '../model.ts';
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

function opSvg(op: Op, doc: Documento | undefined): string {
  switch (op.t) {
    case 'retangulo': {
      const fill = op.preenchimento === undefined ? 'none' : gray(op.preenchimento);
      const stroke = op.contorno ? ` stroke="#000" stroke-width="${n(op.contorno)}"` : '';
      const dash = op.tracejado ? ` stroke-dasharray="${n(op.tracejado)}"` : '';
      return `<rect x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" fill="${fill}"${stroke}${dash}/>`;
    }
    case 'linha': {
      const dash = op.tracejado ? ` stroke-dasharray="${n(op.tracejado)}"` : '';
      const color = op.cinza ? gray(op.cinza) : '#000';
      return `<line x1="${n(op.x1)}" y1="${n(op.y1)}" x2="${n(op.x2)}" y2="${n(op.y2)}" stroke="${color}" stroke-width="${n(op.w)}"${dash}/>`;
    }
    case 'texto': {
      const fill = op.rgb
        ? ` fill="rgb(${op.rgb.map((v) => Math.round(v * 255)).join(',')})"`
        : op.cinza === undefined
          ? ''
          : ` fill="${gray(op.cinza)}"`;
      const tr = op.rotacao ? ` transform="rotate(${n(-op.rotacao)} ${n(op.x)} ${n(op.y)})"` : '';
      return `<text class="${FAMILY[op.fonte]}" x="${n(op.x)}" y="${n(op.y)}" font-size="${n(op.tamanho * PT)}" textLength="${n(op.w)}" lengthAdjust="spacingAndGlyphs"${fill}${tr}>${esc(op.s)}</text>`;
    }
    case 'barras': {
      let pos = 0;
      let d = '';
      op.larguras.forEach((w, i) => {
        const len = w * op.modulo;
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
      const m = op.tamanho / op.modulos.length;
      let d = '';
      op.modulos.forEach((row, r) => {
        row.forEach((on, c) => {
          if (on) d += `M${n(op.x + c * m)} ${n(op.y + r * m)}h${n(m)}v${n(m)}h${n(-m)}z`;
        });
      });
      return `<path d="${d}" shape-rendering="crispEdges"/>`;
    }
    case 'imagem': {
      const img = doc?.imagens[op.imagem];
      if (!img) return '';
      const mime = img.formato === 'png' ? 'image/png' : 'image/jpeg';
      return `<image x="${n(op.x)}" y="${n(op.y)}" width="${n(op.w)}" height="${n(op.h)}" preserveAspectRatio="none" href="data:${mime};base64,${codificarBase64(img.bytes)}"/>`;
    }
  }
}

/** Uma página como SVG autocontido, em mm. Passe o `documento` para que os logotipos entrem como data URI. */
export function gerarSvg(pagina: Pagina, documento?: Documento): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(pagina.w)} ${n(pagina.h)}" width="${n(pagina.w)}mm" height="${n(pagina.h)}mm">${STYLE_SVG}${pagina.ops.map((op) => opSvg(op, documento)).join('')}</svg>`;
}

const FONT_CSS =
  '.ft{font-family:"Times New Roman",Tinos,"Liberation Serif",Times,serif}' +
  '.fh{font-family:Arial,Helvetica,Arimo,"Liberation Sans",sans-serif}.b{font-weight:bold}';

const STYLE_SVG = `<style>${FONT_CSS}</style>`;

/** Documento HTML com uma `<svg>` por página, pronto para visualizar ou imprimir. */
export function gerarHtml(documento: Documento): string {
  const p0 = documento.paginas[0];
  const size = p0 ? `${n(p0.w)}mm ${n(p0.h)}mm` : 'A4';
  const pages = documento.paginas
    .map(
      (p) =>
        `<svg class="pg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(p.w)} ${n(p.h)}" width="${n(p.w)}mm" height="${n(p.h)}mm">${p.ops.map((op) => opSvg(op, documento)).join('')}</svg>`,
    )
    .join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(documento.titulo)}</title><style>
@page{size:${size};margin:0}html,body{margin:0;background:#888}
.pg{display:block;margin:8mm auto;background:#fff;box-shadow:0 1px 4px #0006;max-width:100%;height:auto}
@media print{html,body{background:#fff}.pg{margin:0;box-shadow:none;break-after:page}}
${FONT_CSS}
</style></head><body>
${pages}
</body></html>`;
}
