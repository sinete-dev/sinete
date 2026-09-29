// Escritor PDF 1.4 mínimo, sem dependências além do fflate (deflate em JS puro, igual em toda runtime).
// Fontes padrão (Times, Helvetica, Courier) com WinAnsiEncoding: nada embutido; o leitor usa a própria fonte métrica-compatível.
// Determinístico: sem data, sem /ID; os bytes dependem só do Doc.
import { zlibSync } from "fflate";
import type { Doc, FontName, Op } from "../model.ts";
import { code } from "../text.ts";
const K = 72 / 25.4;
const n = (v: number) => { const r = Math.round(v * 1000) / 1000; return Object.is(r, -0) ? "0" : String(r); };
function pdfStr(s: string) {
  let o = "(";
  for (const ch of s) { const c = code(ch); o += c === 40 || c === 41 || c === 92 ? "\\" + ch : c < 32 || c > 126 ? "\\" + c.toString(8).padStart(3, "0") : ch; }
  return o + ")";
}
const FONTS: FontName[] = ["Times-Roman", "Times-Bold", "Helvetica", "Helvetica-Bold", "Courier"];
function content(ops: Op[], H: number): string {
  const out: string[] = [];
  const Y = (y: number) => n((H - y) * K), X = (x: number) => n(x * K);
  let lw = -1, dash = -2;
  const setLw = (w: number, d?: number) => { if (w !== lw) { out.push(`${n(w * K)} w`); lw = w; } const dd = d ?? 0; if (dd !== dash) { out.push(dd ? `[${n(dd * K)} ${n(dd * K)}] 0 d` : "[] 0 d"); dash = dd; } };
  for (const op of ops) {
    switch (op.t) {
      case "rect":
        if (op.fill !== undefined) out.push(`${n(op.fill)} g ${X(op.x)} ${Y(op.y + op.h)} ${n(op.w * K)} ${n(op.h * K)} re f 0 g`);
        if (op.stroke) { setLw(op.stroke, op.dash); out.push(`${X(op.x)} ${Y(op.y + op.h)} ${n(op.w * K)} ${n(op.h * K)} re S`); }
        break;
      case "line": setLw(op.w, op.dash); out.push(`${X(op.x1)} ${Y(op.y1)} m ${X(op.x2)} ${Y(op.y2)} l S`); break;
      case "text": {
        const f = `/F${FONTS.indexOf(op.font) + 1} ${n(op.size)} Tf`;
        const g = op.gray !== undefined ? `${n(op.gray)} g ` : "";
        if (op.rot) { const a = (op.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); out.push(`${g}BT ${f} ${n(c)} ${n(s)} ${n(-s)} ${n(c)} ${X(op.x)} ${Y(op.y)} Tm ${pdfStr(op.s)} Tj ET${g ? " 0 g" : ""}`); }
        else out.push(`${g}BT ${f} ${X(op.x)} ${Y(op.y)} Td ${pdfStr(op.s)} Tj ET${g ? " 0 g" : ""}`);
        break;
      }
      case "bars": {
        let x = op.x; const parts: string[] = [];
        op.widths.forEach((w, i) => { if (i % 2 === 0) parts.push(`${X(x)} ${Y(op.y + op.h)} ${n(w * op.module * K)} ${n(op.h * K)} re`); x += w * op.module; });
        out.push(parts.join(" ") + " f"); break;
      }
      case "qr": {
        const m = op.size / op.modules.length; const parts: string[] = [];
        op.modules.forEach((row, r) => { let c = 0; while (c < row.length) { if (!row[c]) { c++; continue; } let e = c; while (e < row.length && row[e]) e++; parts.push(`${X(op.x + c * m)} ${Y(op.y + (r + 1) * m)} ${n((e - c) * m * K)} ${n(m * K)} re`); c = e; } });
        out.push(parts.join(" ") + " f"); break;
      }
    }
  }
  return out.join("\n");
}
export function toPdfRaw(doc: Doc, o: { compress?: boolean; info?: Record<string, string> } = {}): Uint8Array {
  const compress = o.compress ?? true;
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = []; const offsets: number[] = []; let pos = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === "string" ? latin1(b) : b; chunks.push(u); pos += u.length; };
  const latin1 = (s: string) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };
  const nPages = doc.pages.length;
  // numeração: 1 catálogo, 2 páginas, 3..7 fontes, 8 info, depois (página, conteúdo) por página
  const pageId = (i: number) => 9 + i * 2, contId = (i: number) => 10 + i * 2;
  const obj = (id: number, body: string | Uint8Array[], ) => { offsets[id] = pos; push(`${id} 0 obj\n`); if (typeof body === "string") push(body); else body.forEach(push); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Count ${nPages} /Kids [${doc.pages.map((_, i) => `${pageId(i)} 0 R`).join(" ")}] >>`);
  FONTS.forEach((f, i) => obj(3 + i, `<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`));
  const info = { Title: doc.title, Producer: "sinete s6", ...o.info };
  obj(8, `<< ${Object.entries(info).map(([k, v]) => `/${k} ${pdfStr(v)}`).join(" ")} >>`);
  const fontRes = `/Font << ${FONTS.map((_, i) => `/F${i + 1} ${3 + i} 0 R`).join(" ")} >>`;
  doc.pages.forEach((p, i) => {
    obj(pageId(i), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(p.w * K)} ${n(p.h * K)}] /Resources << ${fontRes} >> /Contents ${contId(i)} 0 R >>`);
    let data = latin1(content(p.ops, p.h));
    if (compress) data = zlibSync(data, { level: 6 });
    obj(contId(i), [latin1(`<< /Length ${data.length}${compress ? " /Filter /FlateDecode" : ""} >>\nstream\n`), data, latin1("\nendstream")]);
  });
  const size = 9 + nPages * 2; const xref = pos;
  let x = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) x += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(x + `trailer\n<< /Size ${size} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  void enc;
  const out = new Uint8Array(pos); let o2 = 0; for (const c of chunks) { out.set(c, o2); o2 += c.length; } return out;
}
