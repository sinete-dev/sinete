/**
 * Escritor PDF 1.4 próprio (ADR 0006, decisão 1). Fontes padrão Type1 com `WinAnsiEncoding`, sem embutir: o leitor
 * usa a própria fonte métrica-compatível (Times atende o MOC 7.0, Anexo II, 3.7). Conteúdo comprimido com o deflate
 * do `fflate`, em JS puro, com a mesma saída em qualquer runtime. Sem data de criação e sem `/ID`: os bytes dependem
 * só do `Doc`, então a mesma entrada gera o mesmo arquivo em Node, Bun, Deno e no browser.
 */

import { zlibSync } from 'fflate';
import type { Doc, DocImage, FontName, Op } from '../model.ts';
import { decodePng, jpegInfo } from './image.ts';
import { winAnsiCode } from './text.ts';

const K = 72 / 25.4;
/** Maior lado de página do PDF, em pt (ISO 32000-1, anexo C). */
const MAX_PT = 14400;

/** Número com até três casas, sem `-0` nem notação exponencial. */
function n(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) || r === 0 ? '0' : String(r);
}

/** String literal do PDF em WinAnsi, com escape de parênteses, barra e bytes fora do ASCII visível. */
function pdfString(s: string): string {
  let o = '(';
  for (const ch of s) {
    const c = winAnsiCode(ch);
    if (c === 40 || c === 41 || c === 92) o += `\\${String.fromCharCode(c)}`;
    else if (c < 32 || c > 126) o += `\\${c.toString(8).padStart(3, '0')}`;
    else o += String.fromCharCode(c);
  }
  return `${o})`;
}

const FONTS: readonly FontName[] = ['Times-Roman', 'Times-Bold', 'Helvetica', 'Helvetica-Bold'];

function content(ops: readonly Op[], pageH: number, imageNames: ReadonlyMap<string, string>): string {
  const out: string[] = [];
  const X = (x: number): string => n(x * K);
  const Y = (y: number): string => n((pageH - y) * K);
  let lw = -1;
  let dash = -1;
  let strokeGray = 0;
  const stroke = (w: number, d: number | undefined, gray = 0): void => {
    if (w !== lw) {
      out.push(`${n(w * K)} w`);
      lw = w;
    }
    const dd = d ?? 0;
    if (dd !== dash) {
      out.push(dd ? `[${n(dd * K)} ${n(dd * K)}] 0 d` : '[] 0 d');
      dash = dd;
    }
    if (gray !== strokeGray) {
      out.push(`${n(gray)} G`);
      strokeGray = gray;
    }
  };
  for (const op of ops) {
    switch (op.t) {
      case 'rect':
        if (op.fill !== undefined)
          out.push(`${n(op.fill)} g ${X(op.x)} ${Y(op.y + op.h)} ${n(op.w * K)} ${n(op.h * K)} re f 0 g`);
        if (op.stroke) {
          stroke(op.stroke, op.dash);
          out.push(`${X(op.x)} ${Y(op.y + op.h)} ${n(op.w * K)} ${n(op.h * K)} re S`);
        }
        break;
      case 'line':
        stroke(op.w, op.dash, op.gray);
        out.push(`${X(op.x1)} ${Y(op.y1)} m ${X(op.x2)} ${Y(op.y2)} l S`);
        break;
      case 'text': {
        const f = `/F${FONTS.indexOf(op.font) + 1} ${n(op.size)} Tf`;
        const g = op.rgb ? `${op.rgb.map(n).join(' ')} rg ` : op.gray === undefined ? '' : `${n(op.gray)} g `;
        const reset = g ? ' 0 g' : '';
        if (op.rot) {
          const a = (op.rot * Math.PI) / 180;
          const c = Math.cos(a);
          const s = Math.sin(a);
          out.push(
            `${g}BT ${f} ${n(c)} ${n(s)} ${n(-s)} ${n(c)} ${X(op.x)} ${Y(op.y)} Tm ${pdfString(op.s)} Tj ET${reset}`,
          );
        } else out.push(`${g}BT ${f} ${X(op.x)} ${Y(op.y)} Td ${pdfString(op.s)} Tj ET${reset}`);
        break;
      }
      case 'bars': {
        const parts: string[] = [];
        let pos = 0;
        op.widths.forEach((w, i) => {
          const len = w * op.module;
          if (i % 2 === 0) {
            parts.push(
              op.vertical
                ? `${X(op.x)} ${Y(op.y + pos + len)} ${n(op.h * K)} ${n(len * K)} re`
                : `${X(op.x + pos)} ${Y(op.y + op.h)} ${n(len * K)} ${n(op.h * K)} re`,
            );
          }
          pos += len;
        });
        out.push(`${parts.join(' ')} f`);
        break;
      }
      case 'qr': {
        const m = op.size / op.modules.length;
        const parts: string[] = [];
        op.modules.forEach((row, r) => {
          // Módulos escuros contíguos da linha viram um retângulo só.
          let c = 0;
          while (c < row.length) {
            if (!row[c]) {
              c++;
              continue;
            }
            let e = c;
            while (e < row.length && row[e]) e++;
            parts.push(`${X(op.x + c * m)} ${Y(op.y + (r + 1) * m)} ${n((e - c) * m * K)} ${n(m * K)} re`);
            c = e;
          }
        });
        out.push(`${parts.join(' ')} f`);
        break;
      }
      case 'image': {
        const name = imageNames.get(op.ref);
        if (name) out.push(`q ${n(op.w * K)} 0 0 ${n(op.h * K)} ${X(op.x)} ${Y(op.y + op.h)} cm /${name} Do Q`);
        break;
      }
    }
  }
  return out.join('\n');
}

function latin1(s: string): Uint8Array {
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff;
  return u;
}

export interface PdfOptions {
  /** Comprime os fluxos de conteúdo (padrão: sim). Sem compressão serve para inspecionar o PDF. */
  readonly compress?: boolean;
  /** Entradas extras no dicionário `/Info` (ex.: `Author`). Nunca grave data aqui se quiser saída determinística. */
  readonly info?: Readonly<Record<string, string>>;
}

interface ImageObjects {
  readonly dict: string;
  readonly data: Uint8Array;
  readonly smask?: { readonly dict: string; readonly data: Uint8Array };
}

function imageObjects(img: DocImage, compress: boolean): ImageObjects {
  if (img.format === 'jpeg') {
    const info = jpegInfo(img.bytes);
    const cs = info.components === 1 ? '/DeviceGray' : info.components === 3 ? '/DeviceRGB' : '/DeviceCMYK';
    const decode = info.components === 4 && info.adobe ? ' /Decode [1 0 1 0 1 0 1 0]' : '';
    return {
      dict: `/Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode${decode}`,
      data: img.bytes,
    };
  }
  const png = decodePng(img.bytes);
  const pack = (d: Uint8Array): Uint8Array => (compress ? zlibSync(d, { level: 6 }) : d);
  const filter = compress ? ' /Filter /FlateDecode' : '';
  const cs = png.channels === 1 ? '/DeviceGray' : '/DeviceRGB';
  const base = `/Type /XObject /Subtype /Image /Width ${png.width} /Height ${png.height} /BitsPerComponent 8`;
  return {
    dict: `${base} /ColorSpace ${cs}${filter}`,
    data: pack(png.color),
    ...(png.alpha ? { smask: { dict: `${base} /ColorSpace /DeviceGray${filter}`, data: pack(png.alpha) } } : {}),
  };
}

/** Serializa o `Doc` num PDF 1.4. */
export function toPdf(doc: Doc, options: PdfOptions = {}): Uint8Array {
  const compress = options.compress ?? true;
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (b: Uint8Array | string): void => {
    const u = typeof b === 'string' ? latin1(b) : b;
    chunks.push(u);
    pos += u.length;
  };
  let next = 1;
  const alloc = (): number => next++;
  const writeObj = (id: number, dict: string, stream?: Uint8Array): void => {
    offsets[id] = pos;
    if (stream) {
      push(`${id} 0 obj\n<< ${dict} /Length ${stream.length} >>\nstream\n`);
      push(stream);
      push('\nendstream\nendobj\n');
    } else push(`${id} 0 obj\n${dict}\nendobj\n`);
  };

  const catalog = alloc();
  const pagesId = alloc();
  const fontIds = FONTS.map(() => alloc());
  const infoId = alloc();
  // Imagens em ordem estável de chave, cada uma com a SMask logo depois.
  const imageNames = new Map<string, string>();
  const imageIds: { id: number; name: string; objs: ImageObjects; smaskId?: number }[] = [];
  for (const [i, key] of Object.keys(doc.images).sort().entries()) {
    const img = doc.images[key];
    if (!img) continue;
    const objs = imageObjects(img, compress);
    const id = alloc();
    const name = `Im${i + 1}`;
    imageNames.set(key, name);
    imageIds.push(objs.smask ? { id, name, objs, smaskId: alloc() } : { id, name, objs });
  }
  const pageIds = doc.pages.map(() => [alloc(), alloc()] as const);
  // O PDF limita a página a 14.400 pt (5.080 mm; ISO 32000-1, anexo C). A bobina não tem limite de altura: acima disso a
  // página usa `/UserUnit` (PDF 1.6), com a MediaBox e o conteúdo divididos pelo mesmo fator. Abaixo, nada muda. Leitor
  // que ignora o `/UserUnit` (o poppler, por exemplo) mostra a página inteira em escala menor, sem cortar.
  const units = doc.pages.map((p) => Math.max(1, Math.ceil((Math.max(p.w, p.h) * K) / MAX_PT)));
  const version = units.some((u) => u > 1) ? '1.6' : '1.4';

  push(`%PDF-${version}\n%\xe2\xe3\xcf\xd3\n`);
  writeObj(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  writeObj(
    pagesId,
    `<< /Type /Pages /Count ${doc.pages.length} /Kids [${pageIds.map(([p]) => `${p} 0 R`).join(' ')}] >>`,
  );
  FONTS.forEach((f, i) => {
    writeObj(fontIds[i] ?? 0, `<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`);
  });
  const info: Record<string, string> = { Title: doc.title, Producer: 'sinete', ...options.info };
  writeObj(
    infoId,
    `<< ${Object.entries(info)
      .map(([k, v]) => `/${k} ${pdfString(v)}`)
      .join(' ')} >>`,
  );
  for (const im of imageIds) {
    const filterless = im.objs.dict;
    writeObj(im.id, `${filterless}${im.smaskId ? ` /SMask ${im.smaskId} 0 R` : ''}`, im.objs.data);
    if (im.smaskId && im.objs.smask) writeObj(im.smaskId, im.objs.smask.dict, im.objs.smask.data);
  }
  const fontRes = `/Font << ${FONTS.map((_, i) => `/F${i + 1} ${fontIds[i]} 0 R`).join(' ')} >>`;
  const xobj = imageIds.length ? ` /XObject << ${imageIds.map((im) => `/${im.name} ${im.id} 0 R`).join(' ')} >>` : '';
  doc.pages.forEach((p, i) => {
    const [pid, cid] = pageIds[i] ?? [0, 0];
    const u = units[i] ?? 1;
    const unit = u > 1 ? ` /UserUnit ${u}` : '';
    writeObj(
      pid,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n((p.w * K) / u)} ${n((p.h * K) / u)}]${unit} /Resources << ${fontRes}${xobj} >> /Contents ${cid} 0 R >>`,
    );
    const scale = u > 1 ? `${(1 / u).toFixed(6)} 0 0 ${(1 / u).toFixed(6)} 0 0 cm\n` : '';
    const raw = latin1(scale + content(p.ops, p.h, imageNames));
    writeObj(cid, compress ? '/Filter /FlateDecode' : '', compress ? zlibSync(raw, { level: 6 }) : raw);
  });
  const size = next;
  const xref = pos;
  let x = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) x += `${String(offsets[i] ?? 0).padStart(10, '0')} 00000 n \n`;
  push(`${x}trailer\n<< /Size ${size} /Root ${catalog} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
