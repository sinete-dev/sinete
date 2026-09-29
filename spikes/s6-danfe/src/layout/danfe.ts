// DANFE retrato A4, folhas soltas (MOC 7.0 Anexo II, item 3.8.1 e Anexo III.02).
// Posições do cabeçalho seguem a tabela do MOC (em cm, origem no canto superior esquerdo), variante "Laser".
// Blocos abaixo do cabeçalho fluem de cima para baixo; o quadro de produtos ocupa a altura que sobra.
import { XMLParser } from "fast-xml-parser";
import { Canvas } from "../kit.ts";
import { type Doc, type Page, PT } from "../model.ts";
import { code128C } from "../code128.ts";
import * as f from "../format.ts";
import { ascentMm, widthMm } from "../text.ts";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", parseTagValue: false, trimValues: true });
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const X0 = 2.5, W = 205.7, PAGE_W = 210, PAGE_H = 297, BOTTOM = 294;
const ROW = 8.5, TITLE = 4.2;

export interface DanfeOptions { canhoto?: boolean; itemFontSize?: number; infFontSize?: number }

// colunas do quadro de produtos (MOC Obs 4: ordem fixa). Larguras escolhidas aqui; a descrição fica com o resto.
const COLS: { k: string; label: string; w: number; align: "l" | "c" | "r" }[] = [
  { k: "cProd", label: "CÓDIGO", w: 14, align: "l" },
  { k: "desc", label: "DESCRIÇÃO DOS PRODUTOS/SERVIÇOS", w: 0, align: "l" },
  { k: "NCM", label: "NCM/SH", w: 11, align: "c" },
  { k: "cst", label: "CST", w: 6.5, align: "c" },
  { k: "CFOP", label: "CFOP", w: 7, align: "c" },
  { k: "uCom", label: "UN", w: 7, align: "c" },
  { k: "qCom", label: "QUANT.", w: 12, align: "r" },
  { k: "vUnCom", label: "VALOR UNIT.", w: 15, align: "r" },
  { k: "vDesc", label: "DESC.", w: 10, align: "r" },
  { k: "vProd", label: "VALOR TOTAL", w: 13, align: "r" },
  { k: "vBC", label: "B.CÁLC. ICMS", w: 12, align: "r" },
  { k: "vICMS", label: "VALOR ICMS", w: 11, align: "r" },
  { k: "vIPI", label: "VALOR IPI", w: 10, align: "r" },
  { k: "pICMS", label: "ALÍQ. ICMS", w: 7.5, align: "r" },
  { k: "pIPI", label: "ALÍQ. IPI", w: 7, align: "r" },
];
COLS[1].w = W - COLS.reduce((a, c) => a + c.w, 0);

export function danfe(xml: string, opts: DanfeOptions = {}): Doc {
  const o = parser.parse(xml);
  const nfe = o.nfeProc?.NFe ?? o.NFe; const inf = nfe.infNFe; const prot = o.nfeProc?.protNFe?.infProt;
  const ide = inf.ide, emit = inf.emit, dest = inf.dest ?? {}, tot = inf.total.ICMSTot, transp = inf.transp ?? {};
  const chave: string = inf["@Id"].slice(3);
  const canhoto = opts.canhoto ?? true;
  const itemSize = opts.itemFontSize ?? 6.5, infSize = opts.infFontSize ?? 6.5;
  const stats = { shrunk: 0, clipped: 0, pages: 0, itemRows: 0, infLines: 0 };

  // itens como linhas de tabela
  const items = arr<any>(inf.det).map((d) => {
    const p = d.prod, imp = d.imposto ?? {};
    const icms: any = Object.values(imp.ICMS ?? {})[0] ?? {};
    const ipi = imp.IPI?.IPITrib ?? {};
    return {
      cProd: p.cProd, desc: p.xProd + (d.infAdProd ? ` ${d.infAdProd}` : ""), NCM: p.NCM, cst: `${icms.orig ?? ""}${icms.CST ?? icms.CSOSN ?? ""}`,
      CFOP: p.CFOP, uCom: p.uCom, qCom: f.num(p.qCom, 2, 4), vUnCom: f.num(p.vUnCom, 2, 10), vDesc: f.num(p.vDesc ?? "0"), vProd: f.num(p.vProd),
      vBC: f.num(icms.vBC ?? "0"), vICMS: f.num(icms.vICMS ?? "0"), vIPI: f.num(ipi.vIPI ?? "0"), pICMS: f.num(icms.pICMS ?? "0", 2), pIPI: f.num(ipi.pIPI ?? "0", 2),
    };
  });
  const probe = new Canvas();
  const descW = COLS[1].w - 1.2;
  const colW = (k: string) => COLS.find((c) => c.k === k)!.w - 0.8;
  // descrição, código e unidade quebram em linhas; números reduzem a fonte. Dado fiscal não é cortado.
  const rows = items.map((it) => ({ it, lines: probe.wrap(it.desc, probe.R, itemSize, descW), cp: probe.wrap(String(it.cProd ?? ""), probe.R, itemSize, colW("cProd")), un: probe.wrap(String(it.uCom ?? ""), probe.R, itemSize, colW("uCom")) }));
  const nOf = (r: { lines: string[]; cp: string[]; un: string[] }) => Math.max(r.lines.length, r.cp.length, r.un.length);
  const lh = itemSize * PT * 1.15;
  const PAD = 0.8; const rowH = (n: number) => n * lh + 2 * PAD - (lh - itemSize * PT);
  stats.itemRows = rows.length;

  // dados adicionais
  const infText = [inf.infAdic?.infAdFisco, inf.infAdic?.infCpl].filter(Boolean).join(" ");
  const INF_W = 129.5, FISCO_W = W - INF_W;
  const infLines = probe.wrap(infText, probe.R, infSize, INF_W - 1.2);
  stats.infLines = infLines.length;

  const dups = arr<any>(inf.cobr?.dup);
  const DUP_W = 34.28, DUP_PER_ROW = 6, DUP_H = 7.5;
  const dupRows = Math.ceil(dups.length / DUP_PER_ROW);
  const hasISSQN = !!inf.total.ISSQNtot;

  // alturas fixas da folha 1
  const headerTop1 = canhoto ? 25.4 : 4.2, headerTopN = 4.2, HEADER_H = 56.2;
  const destH = TITLE + 3 * ROW, fatH = dups.length ? TITLE + dupRows * DUP_H : 0, impH = TITLE + 2 * ROW, transpH = TITLE + 3 * ROW;
  const issqnH = hasISSQN ? TITLE + ROW : 0, adicH = TITLE + 30.7;
  const prodTop1 = headerTop1 + HEADER_H + destH + fatH + impH + transpH;
  const TH = 6; // cabeçalho da tabela
  const prodBottom1 = BOTTOM - adicH - issqnH;
  const infCap1 = Math.floor((30.7 - 1) / (infSize * PT * 1.15));

  // paginação em dois passos: primeiro distribui, depois desenha (o total de folhas vai no cabeçalho)
  type Chunk = { rows: typeof rows; inf: string[]; prodTop: number; prodBottom: number; infTop?: number };
  const pages: Chunk[] = [];
  let ri = 0;
  const take = (top: number, bottom: number) => {
    const out: typeof rows = []; let y = top + TITLE + TH;
    while (ri < rows.length && y + rowH(nOf(rows[ri])) <= bottom) { y += rowH(nOf(rows[ri])); out.push(rows[ri++]); }
    // item mais alto que a área inteira: corta as linhas (não acontece no corpus, mas não pode travar)
    if (!out.length && ri < rows.length) { const cap = Math.max(1, Math.floor((bottom - y - 1) / lh)); out.push({ ...rows[ri], lines: rows[ri].lines.slice(0, cap) }); rows[ri] = { ...rows[ri], lines: rows[ri].lines.slice(cap), cp: [], un: [] }; }
    return out;
  };
  pages.push({ rows: take(prodTop1, prodBottom1), inf: infLines.slice(0, infCap1), prodTop: prodTop1, prodBottom: prodBottom1 });
  let infRest = infLines.slice(infCap1);
  while (ri < rows.length || infRest.length) {
    const top = headerTopN + HEADER_H;
    const chunk: Chunk = { rows: [], inf: [], prodTop: top, prodBottom: BOTTOM };
    if (ri < rows.length) { chunk.rows = take(top, BOTTOM); chunk.prodBottom = top + TITLE + TH + chunk.rows.reduce((a, r) => a + rowH(nOf(r)), 0) + 1; }
    if (ri >= rows.length && infRest.length) {
      const infTop = chunk.rows.length ? chunk.prodBottom + 1 : top;
      const cap = Math.floor((BOTTOM - infTop - TITLE - 1) / (infSize * PT * 1.15));
      if (cap > 0) { chunk.inf = infRest.slice(0, cap); infRest = infRest.slice(cap); chunk.infTop = infTop; }
      if (!chunk.rows.length) chunk.prodBottom = top;
    }
    pages.push(chunk);
    if (pages.length > 500) throw new Error("paginação não converge");
  }
  const total = pages.length; stats.pages = total;

  const out: Page[] = pages.map((pg, pi) => {
    const c = new Canvas(true);
    const first = pi === 0;
    let y = first ? headerTop1 : headerTopN;
    if (first && canhoto) drawCanhoto(c);
    drawHeader(c, y, pi + 1, total);
    y += HEADER_H;
    if (first) {
      y = drawDest(c, y); if (dups.length) y = drawFat(c, y); y = drawImp(c, y); y = drawTransp(c, y);
    }
    if (pg.rows.length || first) drawProducts(c, pg.prodTop, pg.prodBottom, pg.rows);
    if (first) {
      let yb = BOTTOM - adicH - issqnH;
      if (hasISSQN) { drawISSQN(c, yb); yb += issqnH; }
      c.title("DADOS ADICIONAIS", X0, yb); yb += TITLE;
      c.rect(X0, yb, INF_W, 30.7); c.text("INFORMAÇÕES COMPLEMENTARES", X0 + 0.6, yb + 2.2, INF_W, { size: 5.5 });
      c.para(pg.inf, X0 + 0.6, yb + 3, 30.7 - 3.5, c.R, infSize);
      if (infLines.length > infCap1) c.text("CONTINUA NA PRÓXIMA FOLHA", X0 + 0.6, yb + 30.2, INF_W - 1.2, { font: c.B, size: 5.5, align: "r" });
      c.rect(X0 + INF_W, yb, FISCO_W, 30.7); c.text("RESERVADO AO FISCO", X0 + INF_W + 0.6, yb + 2.2, FISCO_W, { size: 5.5 });
    } else if (pg.inf.length) {
      const yt = pg.infTop!; c.title("DADOS ADICIONAIS (CONTINUAÇÃO)", X0, yt);
      const h = BOTTOM - yt - TITLE; c.rect(X0, yt + TITLE, INF_W, h); c.para(pg.inf, X0 + 0.6, yt + TITLE + 1, h - 1, c.R, infSize);
    }
    if (ide.tpAmb === "2") c.ops.push({ t: "text", x: 40, y: 190, s: "SEM VALOR FISCAL", font: "Times-Bold", size: 48, w: widthMm("SEM VALOR FISCAL", "Times-Bold", 48), gray: 0.8, rot: 30 });
    stats.shrunk += c.fit.shrunk; stats.clipped += c.fit.clipped;
    return { w: PAGE_W, h: PAGE_H, ops: c.ops };
  });
  return { title: `DANFE ${chave}`, pages: out, stats };

  // ---- blocos ----
  function drawCanhoto(c: Canvas) {
    const y = 4.2;
    c.rect(X0, y, 161, 8.5);
    const recebemos = `RECEBEMOS DE ${emit.xNome} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO. EMISSÃO: ${f.data(ide.dhEmi)} VALOR TOTAL: R$ ${f.num(tot.vNF)} DESTINATÁRIO: ${dest.xNome ?? ""}`;
    c.para(c.wrap(recebemos, c.R, 6, 159.8).slice(0, 3), X0 + 0.6, y + 0.6, 7.6, c.R, 6);
    c.field(X0, y + 8.5, 41, 8.5, "DATA DE RECEBIMENTO", "");
    c.field(X0 + 41, y + 8.5, 120, 8.5, "IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR", "");
    c.rect(X0 + 161, y, 44.7, 17);
    c.text("NF-e", X0 + 161, y + 5, 44.7, { font: c.B, size: 12, align: "c" });
    c.text(`Nº ${f.nNF(ide.nNF)}`, X0 + 161, y + 10, 44.7, { font: c.B, size: 10, align: "c" });
    c.text(`SÉRIE ${String(ide.serie).padStart(3, "0")}`, X0 + 161, y + 14.5, 44.7, { font: c.B, size: 10, align: "c" });
    c.line(X0, 23.3, X0 + W, 23.3, 0.2, 1);
  }
  function drawHeader(c: Canvas, y: number, folha: number, total: number) {
    // emitente
    c.rect(X0, y, 100, 39.2);
    c.text("IDENTIFICAÇÃO DO EMITENTE", X0 + 0.6, y + 2.5, 98.8, { size: 5.5 });
    const nome = c.wrap(emit.xFant && emit.xFant !== emit.xNome ? emit.xNome : emit.xNome, c.B, 12, 96).slice(0, 2);
    let yy = y + 9; for (const l of nome) { c.text(l, X0, yy, 100, { font: c.B, size: 12, align: "c", minSize: 9, tag: "emit.xNome" }); yy += 5; }
    const e = emit.enderEmit ?? {};
    const lines = [`${e.xLgr ?? ""}, ${e.nro ?? ""}${e.xCpl ? ` ${e.xCpl}` : ""}`, `${e.xBairro ?? ""} - ${f.cep(e.CEP)}`, `${e.xMun ?? ""} - ${e.UF ?? ""}`, e.fone ? `FONE: ${f.fone(e.fone)}` : ""].filter(Boolean).flatMap((l) => c.wrap(l, c.B, 8, 98)).slice(0, 7 - nome.length * 1);
    yy += nome.length > 1 ? 0 : 1; for (const l of lines) { c.text(l, X0 + 1, yy, 98, { font: c.B, size: 8, align: "c", minSize: 6.5, tag: "emit.ender" }); yy += 3.6; }
    // DANFE
    const dx = X0 + 100, dw = 25.4;
    c.rect(dx, y, dw, 39.2);
    c.text("DANFE", dx, y + 5.5, dw, { font: c.B, size: 12, align: "c" });
    let ly = y + 8.2; for (const l of c.wrap("DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA", c.R, 8, dw - 1.5)) { c.text(l, dx, ly, dw, { size: 8, align: "c" }); ly += 2.9; }
    c.text("0 - ENTRADA", dx + 0.8, y + 21.6, 17.7, { size: 8 });
    c.text("1 - SAÍDA", dx + 0.8, y + 24.8, 17.7, { size: 8 });
    c.rect(dx + 18.6, y + 19.3, 5.2, 6); c.text(String(ide.tpNF), dx + 18.6, y + 23.6, 5.2, { font: c.B, size: 10, align: "c" });
    c.text(`Nº ${f.nNF(ide.nNF)}`, dx, y + 29.6, dw, { font: c.B, size: 10, align: "c", minSize: 8 });
    c.text(`SÉRIE ${String(ide.serie).padStart(3, "0")}`, dx, y + 33.4, dw, { font: c.B, size: 10, align: "c" });
    c.text(`FOLHA ${folha}/${total}`, dx, y + 37.2, dw, { font: c.B, size: 10, align: "c" });
    // código de barras da chave
    const bx = X0 + 125.4, bw = W - 125.4;
    c.rect(bx, y, bw, 14.8);
    const widths = code128C(chave); const modules = widths.reduce((a, b) => a + b, 0);
    const module = Math.min(0.3, (bw - 6) / modules); // zona de silêncio de 10 módulos de cada lado cabe nas sobras
    c.ops.push({ t: "bars", x: bx + (bw - modules * module) / 2, y: y + 2.4, h: 10, module, widths });
    c.field(bx, y + 14.8, bw, 9.6, "CHAVE DE ACESSO", f.chave(chave), { bold: true, size: 9, align: "c", minSize: 8 });
    c.rect(bx, y + 24.4, bw, 14.8);
    c.para(["Consulta de autenticidade no portal nacional da NF-e", "www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora"], bx + 2, y + 29, 10, c.R, 8);
    // natureza e protocolo
    c.field(X0, y + 39.2, 125.4, ROW, "NATUREZA DA OPERAÇÃO", ide.natOp, { size: 10 });
    const protStr = prot ? `${prot.nProt} - ${f.data(prot.dhRecbto)} ${f.hora(prot.dhRecbto)}` : "";
    c.field(bx, y + 39.2, bw, ROW, "PROTOCOLO DE AUTORIZAÇÃO DE USO", protStr, { size: 10, bold: true, align: "c" });
    const w3 = W / 3;
    c.field(X0, y + 47.7, w3, ROW, "INSCRIÇÃO ESTADUAL", emit.IE ?? "", { size: 10 });
    c.field(X0 + w3, y + 47.7, w3, ROW, "INSC. ESTADUAL DO SUBST. TRIB.", emit.IEST ?? "", { size: 10 });
    c.field(X0 + 2 * w3, y + 47.7, w3, ROW, "CNPJ", f.cnpjCpf(emit.CNPJ ?? emit.CPF), { size: 10 });
  }
  function drawDest(c: Canvas, y: number) {
    c.title("DESTINATÁRIO/REMETENTE", X0, y); y += TITLE;
    const d = dest.enderDest ?? {};
    c.field(X0, y, 123.2, ROW, "NOME/RAZÃO SOCIAL", dest.xNome ?? "", { size: 10 });
    c.field(X0 + 123.2, y, 53.3, ROW, "CNPJ/CPF", f.cnpjCpf(dest.CNPJ ?? dest.CPF ?? dest.idEstrangeiro), { size: 10, bold: true, align: "c" });
    c.field(X0 + 176.5, y, 29.2, ROW, "DATA DA EMISSÃO", f.data(ide.dhEmi), { size: 10, align: "c" });
    y += ROW;
    c.field(X0, y, 101.6, ROW, "ENDEREÇO", `${d.xLgr ?? ""}, ${d.nro ?? ""}${d.xCpl ? ` ${d.xCpl}` : ""}`, { size: 10 });
    c.field(X0 + 101.6, y, 48.3, ROW, "BAIRRO/DISTRITO", d.xBairro ?? "", { size: 10 });
    c.field(X0 + 149.9, y, 26.6, ROW, "CEP", f.cep(d.CEP), { size: 10, align: "c" });
    c.field(X0 + 176.5, y, 29.2, ROW, "DATA DA SAÍDA/ENTRADA", f.data(ide.dhSaiEnt), { size: 10, bold: true, align: "c" });
    y += ROW;
    c.field(X0, y, 71.1, ROW, "MUNICÍPIO", d.xMun ?? "", { size: 10 });
    c.field(X0 + 71.1, y, 40.6, ROW, "FONE/FAX", f.fone(d.fone), { size: 10 });
    c.field(X0 + 111.7, y, 11.4, ROW, "UF", d.UF ?? "", { size: 10, align: "c" });
    c.field(X0 + 123.1, y, 53.4, ROW, "INSCRIÇÃO ESTADUAL", dest.IE ?? "", { size: 10 });
    c.field(X0 + 176.5, y, 29.2, ROW, "HORA DA SAÍDA/ENTRADA", f.hora(ide.dhSaiEnt), { size: 10, bold: true, align: "c" });
    return y + ROW;
  }
  function drawFat(c: Canvas, y: number) {
    c.title("FATURA/DUPLICATAS", X0, y); y += TITLE;
    dups.forEach((d, i) => {
      const x = X0 + (i % DUP_PER_ROW) * DUP_W, yy = y + Math.floor(i / DUP_PER_ROW) * DUP_H;
      c.rect(x, yy, DUP_W, DUP_H);
      c.text(`Nº ${d.nDup ?? ""}`, x + 0.6, yy + 2.3, DUP_W - 1.2, { size: 6.5 });
      c.text(`VENC. ${f.data(d.dVenc)}`, x + 0.6, yy + 4.6, DUP_W - 1.2, { size: 6.5 });
      c.text(`VALOR R$ ${f.num(d.vDup)}`, x + 0.6, yy + 6.9, DUP_W - 1.2, { size: 6.5 });
    });
    return y + dupRows * DUP_H;
  }
  function drawImp(c: Canvas, y: number) {
    c.title("CÁLCULO DO IMPOSTO", X0, y); y += TITLE;
    const r1: [string, string, number][] = [["BASE DE CÁLCULO DO ICMS", tot.vBC, 40.6], ["VALOR DO ICMS", tot.vICMS, 40.6], ["BASE DE CÁLC. ICMS S.T.", tot.vBCST, 40.6], ["VALOR DO ICMS SUBST.", tot.vST, 40.6], ["VALOR TOTAL DOS PRODUTOS", tot.vProd, 43.3]];
    const r2: [string, string, number][] = [["VALOR DO FRETE", tot.vFrete, 33], ["VALOR DO SEGURO", tot.vSeg, 33], ["DESCONTO", tot.vDesc, 33], ["OUTRAS DESPESAS", tot.vOutro, 33], ["VALOR TOTAL DO IPI", tot.vIPI, 33], ["VALOR TOTAL DA NOTA", tot.vNF, 41.7]];
    let x = X0; for (const [l, v, w] of r1) { c.field(x, y, w, ROW, l, f.num(v ?? "0"), { size: 10, align: "r" }); x += w; }
    x = X0; for (const [l, v, w] of r2) { c.field(x, y + ROW, w, ROW, l, f.num(v ?? "0"), { size: 10, align: "r", bold: l === "VALOR TOTAL DA NOTA" }); x += w; }
    return y + 2 * ROW;
  }
  function drawTransp(c: Canvas, y: number) {
    c.title("TRANSPORTADOR/VOLUMES TRANSPORTADOS", X0, y); y += TITLE;
    const t = transp.transporta ?? {}, v = transp.veicTransp ?? {}, vol = arr<any>(transp.vol)[0] ?? {};
    const mod: Record<string, string> = { "0": "0-Remetente", "1": "1-Destinatário", "2": "2-Terceiros", "3": "3-Próprio Rem.", "4": "4-Próprio Dest.", "9": "9-Sem Frete" };
    c.field(X0, y, 90.2, ROW, "NOME/RAZÃO SOCIAL", t.xNome ?? "", { size: 10 });
    c.field(X0 + 90.2, y, 27.9, ROW, "FRETE POR CONTA", mod[transp.modFrete] ?? "", { size: 8 });
    c.field(X0 + 118.1, y, 17.8, ROW, "CÓDIGO ANTT", v.RNTC ?? "", { size: 8 });
    c.field(X0 + 135.9, y, 22.9, ROW, "PLACA DO VEÍCULO", v.placa ?? "", { size: 10 });
    c.field(X0 + 158.8, y, 7.6, ROW, "UF", v.UF ?? "", { size: 10, align: "c" });
    c.field(X0 + 166.4, y, 39.3, ROW, "CNPJ/CPF", f.cnpjCpf(t.CNPJ ?? t.CPF), { size: 10 });
    y += ROW;
    c.field(X0, y, 90.2, ROW, "ENDEREÇO", t.xEnder ?? "", { size: 10 });
    c.field(X0 + 90.2, y, 68.6, ROW, "MUNICÍPIO", t.xMun ?? "", { size: 10 });
    c.field(X0 + 158.8, y, 7.6, ROW, "UF", t.UF ?? "", { size: 10, align: "c" });
    c.field(X0 + 166.4, y, 39.3, ROW, "INSCRIÇÃO ESTADUAL", t.IE ?? "", { size: 10 });
    y += ROW;
    const vw = [29.2, 30.5, 30.5, 48.3, 34.3, 33];
    const vv: [string, string][] = [["QUANTIDADE", vol.qVol ?? ""], ["ESPÉCIE", vol.esp ?? ""], ["MARCA", vol.marca ?? ""], ["NUMERAÇÃO", vol.nVol ?? ""], ["PESO BRUTO", vol.pesoB ? f.num(vol.pesoB, 3) : ""], ["PESO LÍQUIDO", vol.pesoL ? f.num(vol.pesoL, 3) : ""]];
    let x = X0; vv.forEach(([l, val], i) => { c.field(x, y, vw[i], ROW, l, val, { size: 10, align: i >= 4 || i === 0 ? "r" : "l" }); x += vw[i]; });
    return y + ROW;
  }
  function drawProducts(c: Canvas, top: number, bottom: number, rs: typeof rows) {
    c.title("DADOS DOS PRODUTOS/SERVIÇOS", X0, top);
    const y0 = top + TITLE;
    c.rect(X0, y0, W, bottom - y0);
    let x = X0;
    for (const col of COLS) {
      const ls = c.wrap(col.label, c.R, 5, col.w - 0.8).slice(0, 2);
      ls.forEach((l, i) => c.text(l, x + 0.4, y0 + 2.4 + i * 2.1 - (ls.length - 1) * 1.05 + 0.6, col.w - 0.8, { size: 5, align: "c", minSize: 4 }));
      if (x > X0) c.line(x, y0, x, bottom, 0.1);
      x += col.w;
    }
    c.line(X0, y0 + TH, X0 + W, y0 + TH, 0.1);
    let y = y0 + TH;
    for (const r of rs) {
      const h = rowH(nOf(r));
      let cx = X0;
      for (const col of COLS) {
        if (col.k === "desc") c.para(r.lines, cx + 0.6, y + PAD, h, c.R, itemSize);
        else if (col.k === "cProd" || col.k === "uCom") (col.k === "cProd" ? r.cp : r.un).forEach((l, i) => c.text(l, cx + 0.4, y + PAD + ascentMm(c.R, itemSize) + i * lh, col.w - 0.8, { size: itemSize, align: col.align, tag: `item.${col.k}` }));
        else c.text(String((r.it as any)[col.k] ?? ""), cx + 0.4, y + PAD + ascentMm(c.R, itemSize), col.w - 0.8, { size: itemSize, minSize: 5.5, align: col.align, tag: `item.${col.k}` });
        cx += col.w;
      }
      y += h;
      c.line(X0, y, X0 + W, y, 0.05, 0.5);
    }
  }
  function drawISSQN(c: Canvas, y: number) {
    c.title("CÁLCULO DO ISSQN", X0, y); y += TITLE;
    const iss = inf.total.ISSQNtot ?? {};
    const w = W / 4;
    c.field(X0, y, w, ROW, "INSCRIÇÃO MUNICIPAL", emit.IM ?? "", { size: 10 });
    c.field(X0 + w, y, w, ROW, "VALOR TOTAL DOS SERVIÇOS", f.num(iss.vServ ?? "0"), { size: 10, align: "r" });
    c.field(X0 + 2 * w, y, w, ROW, "BASE DE CÁLCULO DO ISSQN", f.num(iss.vBC ?? "0"), { size: 10, align: "r" });
    c.field(X0 + 3 * w, y, w, ROW, "VALOR TOTAL DO ISSQN", f.num(iss.vISS ?? "0"), { size: 10, align: "r" });
  }
}
