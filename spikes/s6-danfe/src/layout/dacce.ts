// DACCE: não há leiaute oficial no MOC para a CC-e; segue a convenção de mercado (cabeçalho, chave com código de
// barras, dados do evento, texto da correção e condição de uso). O nome do emitente não está no XML do evento:
// vem da NF-e se ela for passada.
import { XMLParser } from "fast-xml-parser";
import { Canvas } from "../kit.ts";
import type { Doc } from "../model.ts";
import { code128C } from "../code128.ts";
import * as f from "../format.ts";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", parseTagValue: false, trimValues: true });
const X0 = 8, W = 194, ROW = 8.5;
export function dacce(xmlEvento: string, xmlNfe?: string): Doc {
  const o = parser.parse(xmlEvento);
  const ev = (o.procEventoNFe?.evento ?? o.evento).infEvento; const ret = o.procEventoNFe?.retEvento?.infEvento;
  const nfe = xmlNfe ? parser.parse(xmlNfe) : undefined; const emit = (nfe?.nfeProc?.NFe ?? nfe?.NFe)?.infNFe?.emit;
  const c = new Canvas(true); const stats = { shrunk: 0, clipped: 0 };
  let y = 8;
  c.rect(X0, y, W, 22);
  c.text("CARTA DE CORREÇÃO ELETRÔNICA", X0, y + 7, W, { font: c.B, size: 14, align: "c" });
  c.text(emit?.xNome ?? `CNPJ/CPF DO AUTOR: ${f.cnpjCpf(ev.CNPJ ?? ev.CPF)}`, X0, y + 13, W, { font: c.B, size: 10, align: "c", minSize: 7 });
  c.text("Não possui valor fiscal, simples representação do evento indicado abaixo. Consulte a autenticidade no portal da NF-e.", X0, y + 18.5, W, { size: 8, align: "c", minSize: 6 });
  y += 24;
  const widths = code128C(ev.chNFe); const mods = widths.reduce((a, b) => a + b, 0), module = Math.min(0.3, 110 / mods);
  c.rect(X0, y, W, 14); c.ops.push({ t: "bars", x: X0 + (W - mods * module) / 2, y: y + 2, h: 10, module, widths }); y += 14;
  c.field(X0, y, W, ROW, "CHAVE DE ACESSO DA NF-e", f.chave(ev.chNFe), { bold: true, size: 10, align: "c" }); y += ROW;
  const w4 = W / 4;
  c.field(X0, y, w4, ROW, "ÓRGÃO", String(ev.cOrgao), { size: 10 });
  c.field(X0 + w4, y, w4, ROW, "AMBIENTE", ev.tpAmb === "1" ? "1 - PRODUÇÃO" : "2 - HOMOLOGAÇÃO", { size: 10 });
  c.field(X0 + 2 * w4, y, w4, ROW, "CNPJ/CPF DO AUTOR", f.cnpjCpf(ev.CNPJ ?? ev.CPF), { size: 10 });
  c.field(X0 + 3 * w4, y, w4, ROW, "DATA E HORA DO EVENTO", `${f.data(ev.dhEvento)} ${f.hora(ev.dhEvento)}`, { size: 10 }); y += ROW;
  c.field(X0, y, w4, ROW, "CÓDIGO DO EVENTO", String(ev.tpEvento), { size: 10 });
  c.field(X0 + w4, y, w4, ROW, "SEQUÊNCIA DO EVENTO", String(ev.nSeqEvento), { size: 10 });
  c.field(X0 + 2 * w4, y, w4, ROW, "PROTOCOLO", ret ? `${ret.nProt ?? ""}` : "", { size: 10, bold: true });
  c.field(X0 + 3 * w4, y, w4, ROW, "DATA E HORA DO REGISTRO", ret?.dhRegEvento ? `${f.data(ret.dhRegEvento)} ${f.hora(ret.dhRegEvento)}` : "", { size: 10 }); y += ROW;
  c.field(X0, y, W, ROW, "STATUS", ret ? `${ret.cStat} - ${ret.xMotivo}` : "", { size: 10 }); y += ROW + 3;
  const box = (title: string, text: string, size: number, h?: number) => {
    const lines = c.wrap(text, c.R, size, W - 3);
    const hh = h ?? Math.max(20, lines.length * size * 0.4064 + 6);
    c.title(title, X0, y); y += 4.2; c.rect(X0, y, W, hh); const rest = c.para(lines, X0 + 1.5, y + 1.5, hh - 2, c.R, size); y += hh + 3;
    if (rest.length) stats.clipped++;
  };
  box("CORREÇÃO", ev.detEvento?.xCorrecao ?? "", 10);
  box("CONDIÇÕES DE USO", ev.detEvento?.xCondUso ?? "", 7);
  stats.shrunk += c.fit.shrunk; stats.clipped += c.fit.clipped;
  return { title: `DACCE ${ev.chNFe}`, pages: [{ w: 210, h: 297, ops: c.ops }], stats };
}
