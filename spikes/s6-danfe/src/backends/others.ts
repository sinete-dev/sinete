// O mesmo Doc reproduzido em bibliotecas de PDF de terceiros, para comparar custo, tamanho e determinismo.
import type { Doc } from "../model.ts";
import { toWinAnsi } from "../text.ts";
const K = 72 / 25.4;
type PL = typeof import("pdf-lib");
export async function toPdfLib(doc: Doc, lib: PL, fixedDate = true): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = lib;
  const pdf = await PDFDocument.create({ updateMetadata: !fixedDate });
  const map: Record<string, any> = {
    "Times-Roman": await pdf.embedFont(StandardFonts.TimesRoman), "Times-Bold": await pdf.embedFont(StandardFonts.TimesRomanBold),
    Helvetica: await pdf.embedFont(StandardFonts.Helvetica), "Helvetica-Bold": await pdf.embedFont(StandardFonts.HelveticaBold), Courier: await pdf.embedFont(StandardFonts.Courier),
  };
  for (const p of doc.pages) {
    const page = pdf.addPage([p.w * K, p.h * K]); const H = p.h;
    for (const op of p.ops) {
      if (op.t === "rect") page.drawRectangle({ x: op.x * K, y: (H - op.y - op.h) * K, width: op.w * K, height: op.h * K, borderWidth: (op.stroke ?? 0) * K, borderColor: op.stroke ? rgb(0, 0, 0) : undefined, color: op.fill !== undefined ? rgb(op.fill, op.fill, op.fill) : undefined });
      else if (op.t === "line") page.drawLine({ start: { x: op.x1 * K, y: (H - op.y1) * K }, end: { x: op.x2 * K, y: (H - op.y2) * K }, thickness: op.w * K, dashArray: op.dash ? [op.dash * K] : undefined });
      else if (op.t === "text") page.drawText(toWinAnsi(op.s), { x: op.x * K, y: (H - op.y) * K, size: op.size, font: map[op.font], color: op.gray !== undefined ? rgb(op.gray, op.gray, op.gray) : undefined, rotate: op.rot ? degrees(op.rot) : undefined });
      else if (op.t === "bars") { let x = op.x; op.widths.forEach((w, i) => { if (i % 2 === 0) page.drawRectangle({ x: x * K, y: (H - op.y - op.h) * K, width: w * op.module * K, height: op.h * K, color: rgb(0, 0, 0) }); x += w * op.module; }); }
      else if (op.t === "qr") { const m = op.size / op.modules.length; op.modules.forEach((row, r) => row.forEach((on, c) => { if (on) page.drawRectangle({ x: (op.x + c * m) * K, y: (H - op.y - (r + 1) * m) * K, width: m * K, height: m * K, color: rgb(0, 0, 0) }); })); }
    }
  }
  if (fixedDate) { pdf.setCreationDate(new Date(0)); pdf.setModificationDate(new Date(0)); pdf.setProducer("sinete s6"); pdf.setCreator("sinete s6"); }
  pdf.setTitle(doc.title);
  return pdf.save({ useObjectStreams: true });
}
export async function toPdfKit(doc: Doc, PDFDocument: any): Promise<Uint8Array> {
  const d = new PDFDocument({ autoFirstPage: false, compress: true, info: { Title: doc.title, Producer: "sinete s6", Creator: "sinete s6", CreationDate: new Date(0), ModDate: new Date(0) } });
  const chunks: Uint8Array[] = []; d.on("data", (c: Uint8Array) => chunks.push(c));
  const done = new Promise<void>((r) => d.on("end", () => r()));
  const fm: Record<string, string> = { "Times-Roman": "Times-Roman", "Times-Bold": "Times-Bold", Helvetica: "Helvetica", "Helvetica-Bold": "Helvetica-Bold", Courier: "Courier" };
  for (const p of doc.pages) {
    d.addPage({ size: [p.w * K, p.h * K], margin: 0 });
    for (const op of p.ops) {
      if (op.t === "rect") { if (op.fill !== undefined) d.rect(op.x * K, op.y * K, op.w * K, op.h * K).fill([op.fill * 255, op.fill * 255, op.fill * 255]); if (op.stroke) d.lineWidth(op.stroke * K).rect(op.x * K, op.y * K, op.w * K, op.h * K).stroke("black"); }
      else if (op.t === "line") { d.save(); d.lineWidth(op.w * K); if (op.dash) d.dash(op.dash * K); d.moveTo(op.x1 * K, op.y1 * K).lineTo(op.x2 * K, op.y2 * K).stroke(); d.restore(); }
      else if (op.t === "text") { d.save(); d.font(fm[op.font]).fontSize(op.size).fillColor(op.gray !== undefined ? [op.gray * 255, op.gray * 255, op.gray * 255] : "black"); if (op.rot) d.rotate(-op.rot, { origin: [op.x * K, op.y * K] }); d.text(toWinAnsi(op.s), op.x * K, op.y * K, { lineBreak: false, baseline: "alphabetic" }); d.restore(); }
      else if (op.t === "bars") { let x = op.x; op.widths.forEach((w, i) => { if (i % 2 === 0) d.rect(x * K, op.y * K, w * op.module * K, op.h * K); x += w * op.module; }); d.fill("black"); }
      else if (op.t === "qr") { const m = op.size / op.modules.length; op.modules.forEach((row, r) => row.forEach((on, c) => { if (on) d.rect((op.x + c * m) * K, (op.y + r * m) * K, m * K, m * K); })); d.fill("black"); }
    }
  }
  d.end(); await done;
  const n = chunks.reduce((a, c) => a + c.length, 0); const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
}
export function toJsPdf(doc: Doc, jsPDF: any): Uint8Array {
  const p0 = doc.pages[0];
  const d = new jsPDF({ unit: "mm", format: [p0.w, p0.h], compress: true, putOnlyUsedFonts: true });
  d.setCreationDate(new Date(0)); d.setFileId("00000000000000000000000000000000"); d.setProperties({ title: doc.title, creator: "sinete s6" });
  const fm: Record<string, [string, string]> = { "Times-Roman": ["times", "normal"], "Times-Bold": ["times", "bold"], Helvetica: ["helvetica", "normal"], "Helvetica-Bold": ["helvetica", "bold"], Courier: ["courier", "normal"] };
  doc.pages.forEach((p, i) => {
    if (i) d.addPage([p.w, p.h]);
    for (const op of p.ops) {
      if (op.t === "rect") { if (op.fill !== undefined) { d.setFillColor(op.fill * 255); d.rect(op.x, op.y, op.w, op.h, "F"); } if (op.stroke) { d.setLineWidth(op.stroke); d.rect(op.x, op.y, op.w, op.h, "S"); } }
      else if (op.t === "line") { d.setLineWidth(op.w); d.setLineDashPattern(op.dash ? [op.dash, op.dash] : [], 0); d.line(op.x1, op.y1, op.x2, op.y2); d.setLineDashPattern([], 0); }
      else if (op.t === "text") { d.setFont(...fm[op.font]); d.setFontSize(op.size); d.setTextColor(op.gray !== undefined ? op.gray * 255 : 0); d.text(toWinAnsi(op.s), op.x, op.y, op.rot ? { angle: op.rot } : undefined); }
      else if (op.t === "bars") { d.setFillColor(0); let x = op.x; op.widths.forEach((w, j) => { if (j % 2 === 0) d.rect(x, op.y, w * op.module, op.h, "F"); x += w * op.module; }); }
      else if (op.t === "qr") { d.setFillColor(0); const m = op.size / op.modules.length; op.modules.forEach((row, r) => row.forEach((on, c) => { if (on) d.rect(op.x + c * m, op.y + r * m, m, m, "F"); })); }
    }
  });
  return new Uint8Array(d.output("arraybuffer"));
}
