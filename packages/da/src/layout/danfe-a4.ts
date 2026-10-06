/**
 * DANFE em A4, retrato (MOC 7.0, Anexo II, 3.8.1 e Anexo III.02) e paisagem (3.8.2 e Anexo III.04), folhas soltas.
 * Um layout só, parametrizado pelas medidas de `data/leiaute-a4.ts`: no retrato o título de cada quadro fica acima dele;
 * na paisagem, numa faixa vertical à esquerda, e o canhoto fica na lateral.
 *
 * Paginação em dois passos (ADR 0006): primeiro os itens e as informações complementares são distribuídos pelas
 * folhas, depois cada folha é desenhada, porque o total de folhas sai no cabeçalho de todas (3.10.2). As folhas
 * adicionais repetem o cabeçalho e usam o resto só para itens e informações complementares, com as mesmas colunas
 * (3.5).
 */

import type { FormatoA4, Linha } from '../data/leiaute-a4.ts';
import { CONSULTA_NFE, FONTES, FORMA_EMISSAO, MOD_FRETE, QUADRO_IBSCBS, REGIME } from '../data/leiaute-a4.ts';
import * as f from '../format.ts';
import type { ItemView, NotaView } from '../input/nfe.ts';
import type { Documento } from '../model.ts';
import type { Align } from '../render/canvas.ts';
import { Canvas, fit, lineHeight, MIN_SIZE } from '../render/canvas.ts';
import { ascentMm, toWinAnsi, widthMm, wrap } from '../render/text.ts';
import type { DaOpcoes } from './common.ts';
import { barcode, DocBuilder, drawLogo } from './common.ts';
import { dadosNfe } from './contingencia.ts';
import type { Cancelamento, Situacao } from './marcas.ts';
import { avisoSituacao, marcas, protocoloDeUso } from './marcas.ts';

export interface DanfeA4Opcoes extends DaOpcoes {
  /** Bloco de canhoto (padrão: sim; MOC 3.3.1 permite suprimir). */
  readonly canhoto?: boolean;
  /**
   * Bloco "Total do IBS/CBS/IS" da NT 2026.010 (padrão: quando a NF-e tem `IBSCBSTot` ou `ISTot`); `false` suprime o
   * bloco.
   */
  readonly ibsCbs?: boolean;
  /** Colunas de ICMS ST no quadro de produtos (padrão: quando algum item tem ST). */
  readonly colunasSt?: boolean;
  /**
   * Protocolo do EPEC para o campo 2 (MOC 3.9.3), quando `tpEmis` = 4. Sem ele, a NF-e em EPEC sem `protNFe` sai
   * como sem valor fiscal: o DANFE só pode ser impresso depois do registro do evento.
   */
  readonly epec?: { readonly nProt: string; readonly dhRegEvento: string };
  /**
   * Tamanho da fonte dos itens e das informações complementares, em pt (padrão 6,5; mínimo 6, MOC 3.7.7; máximo 12, o
   * maior tamanho do MOC). Fora da faixa, vale o limite mais próximo.
   */
  readonly fonteItens?: number;
}

/** Maior tamanho de fonte dos itens: o maior do MOC (3.7.6). Garante que toda folha adicional comporte uma linha. */
const FONTE_ITENS_MAX = 12;

interface Col {
  readonly k: keyof ItemView | 'desc';
  readonly label: string;
  readonly w: number;
  readonly align: Align;
}

/** Colunas do quadro de produtos na ordem do MOC (3.8.1, Obs 4); a descrição fica com a largura que sobrar. */
function columns(total: number, st: boolean, scale: number): Col[] {
  const base: Col[] = [
    { k: 'cProd', label: 'CÓDIGO', w: 14, align: 'l' },
    { k: 'desc', label: 'DESCRIÇÃO DOS PRODUTOS/SERVIÇOS', w: 0, align: 'l' },
    { k: 'NCM', label: 'NCM/SH', w: 11, align: 'c' },
    { k: 'cst', label: 'CST', w: 6.5, align: 'c' },
    { k: 'CFOP', label: 'CFOP', w: 7, align: 'c' },
    { k: 'uCom', label: 'UN', w: 7, align: 'c' },
    { k: 'qCom', label: 'QUANT.', w: 12, align: 'r' },
    { k: 'vUnCom', label: 'VALOR UNIT.', w: 14, align: 'r' },
    { k: 'vDesc', label: 'DESC.', w: 10, align: 'r' },
    { k: 'vProd', label: 'VALOR TOTAL', w: 13, align: 'r' },
    { k: 'vBC', label: 'B.CÁLC. ICMS', w: 12, align: 'r' },
    ...(st ? [{ k: 'vBCST', label: 'B.CÁLC. ICMS ST', w: 12, align: 'r' } as const] : []),
    { k: 'vICMS', label: 'VALOR ICMS', w: 11, align: 'r' },
    ...(st ? [{ k: 'vICMSST', label: 'VALOR ICMS ST', w: 11, align: 'r' } as const] : []),
    { k: 'vIPI', label: 'VALOR IPI', w: 10, align: 'r' },
    { k: 'pICMS', label: 'ALÍQ. ICMS', w: 7.5, align: 'r' },
    { k: 'pIPI', label: 'ALÍQ. IPI', w: 7, align: 'r' },
  ];
  const cols = base.map((c) => ({ ...c, w: c.w * scale }));
  const used = cols.reduce((a, c) => a + c.w, 0);
  return cols.map((c) => (c.k === 'desc' ? { ...c, w: total - used } : c));
}

function cellValue(it: ItemView, k: Col['k']): string {
  switch (k) {
    case 'qCom':
      return f.num(it.qCom, 2, 4);
    case 'vUnCom':
      return f.num(it.vUnCom, 2, 10);
    case 'pICMS':
    case 'pIPI':
      return f.num(it[k] || '0', 2, 4);
    case 'vDesc':
    case 'vProd':
    case 'vBC':
    case 'vICMS':
    case 'vBCST':
    case 'vICMSST':
    case 'vIPI':
      return f.num(it[k] || '0');
    case 'desc':
      return it.xProd;
    default: {
      const v = it[k];
      return typeof v === 'string' ? v : '';
    }
  }
}

interface Row {
  readonly cells: readonly (readonly string[])[];
  /** Tamanho de cada célula depois do encaixe: a nominal, a reduzida numa linha ou 6 pt quando quebra. */
  readonly sizes: readonly number[];
  readonly size: number;
  readonly lines: number;
}

/** Espaço que não quebra: mantém rótulo, alíquota e valor de um tributo na mesma linha. */
const NB = '\u00a0';

/**
 * Linha de IBS, CBS e IS do item, só com o que o XML traz (NT 2026.010, 4.3 e 4.4): classificação tributária, base do
 * IBS/CBS, alíquota e valor do IBS UF, do IBS municipal e da CBS (a efetiva, com redução) e base, alíquota e valor do IS.
 */
function tributosDoItem(it: ItemView): string | undefined {
  const g = it.ibscbs;
  const is = it.is;
  if (g === undefined && is === undefined) return undefined;
  const junto = (...p: string[]): string => p.filter(Boolean).join(NB);
  const pct = (s: string): string => (s ? `${f.num(s, 2, 4)}%` : '');
  const trib = (rotulo: string, p: string, v: string): string =>
    p || v ? junto(rotulo, pct(p), v ? f.num(v) : '') : '';
  const partes = [
    g?.cClassTrib ? junto('cClassTrib', g.cClassTrib) : '',
    g?.vBC ? junto('BC', 'IBS/CBS', f.num(g.vBC)) : '',
    g ? trib(`IBS${NB}UF`, g.pIBSUF, g.vIBSUF) : '',
    g ? trib(`IBS${NB}MUN`, g.pIBSMun, g.vIBSMun) : '',
    g ? trib('CBS', g.pCBS, g.vCBS) : '',
    is && (is.vBCIS || is.pIS || is.vIS)
      ? junto('IS', is.vBCIS ? junto('BC', f.num(is.vBCIS)) : '', pct(is.pIS), is.vIS ? f.num(is.vIS) : '')
      : '',
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' ') : undefined;
}

function ender(e: NotaView['emit']['ender']): string {
  return [e.xLgr, e.nro].filter(Boolean).join(', ') + (e.xCpl ? ` ${e.xCpl}` : '');
}

export function danfeA4(
  nota: NotaView,
  fmt: FormatoA4,
  options: DanfeA4Opcoes,
  situacao: Situacao,
  cancel?: Cancelamento,
): Documento {
  const b = new DocBuilder(options);
  const paisagem = fmt.faixa > 0;
  const X = fmt.x;
  const W = fmt.w;
  const BX = X + fmt.faixa;
  const BW = W - fmt.faixa;
  const RH = fmt.linha;
  const TITLE = paisagem ? 0 : 4.2;
  const canhoto = options.canhoto ?? true;
  const size = Math.min(FONTE_ITENS_MAX, Math.max(MIN_SIZE, options.fonteItens ?? FONTES.conteudo));
  const lh = lineHeight(size);
  const PAD = 0.7;
  const probe = new Canvas('Times-Roman', 'Times-Bold');

  // ---- itens: células já quebradas, com a regra de redução até 6 pt e depois quebra (ADR 0006, decisão 7)
  const st = options.colunasSt ?? nota.itens.some((it) => f.positivo(it.vBCST) || f.positivo(it.vICMSST));
  const cols = columns(BW, st, paisagem ? 1.15 : 1);
  const rows: Row[] = nota.itens.map((it) => {
    const sizes: number[] = [];
    const cells = cols.map((col) => {
      const w = col.w - (col.k === 'desc' ? 1.2 : 0.8);
      if (col.k === 'desc') {
        const extra: string[] = [];
        // Unidade tributável diferente da comercial: as duas no DANFE (MOC 3.1.7), numa linha adicional.
        if (
          (it.uTrib && it.uTrib !== it.uCom) ||
          (it.vUnTrib && f.num(it.vUnTrib, 2, 10) !== f.num(it.vUnCom, 2, 10))
        ) {
          extra.push(`TRIB.: ${f.num(it.qTrib, 2, 4)} ${it.uTrib} X ${f.num(it.vUnTrib, 2, 10)}`);
        }
        // Informações adicionais do produto logo abaixo do item (MOC 3.1.7).
        if (it.infAdProd) extra.push(it.infAdProd);
        // IBS, CBS e IS do item (NT 2026.010, 4.3), cada tributo com rótulo, alíquota e valor juntos.
        const trib = tributosDoItem(it);
        if (trib) extra.push(trib);
        sizes.push(size);
        return [it.xProd, ...extra].flatMap((s) => wrap(toWinAnsi(s), 'Times-Roman', size, w));
      }
      // Quatro linhas de 6 pt no máximo; o valor numérico cortado com reticências conta em `cortados`.
      const r = fit(cellValue(it, col.k), 'Times-Roman', size, w, 4);
      probe.count(r);
      sizes.push(r.size);
      return r.lines;
    });
    return { cells, sizes, size, lines: Math.max(1, ...cells.map((c) => c.length)) };
  });
  const rowH = (r: Row): number => r.lines * lh + 2 * PAD - (lh - size * 0.3528);

  // ---- alturas da folha 1
  const ibs = (options.ibsCbs ?? true) && nota.ibscbs !== undefined;
  const header1 = canhoto && !paisagem ? 25.4 : fmt.topo;
  // Natureza e protocolo; IE, IE ST e CNPJ; CRT e regime de apuração do IBS/CBS (NT 2026.010, 4.2).
  const HEADER_H = fmt.cabecalho.altura + 3 * RH;
  const locais = [nota.retirada ? 1 : 0, nota.entrega ? 1 : 0].reduce((a, v) => a + v, 0);
  const issH = nota.issqn ? TITLE + RH : 0;
  const adicH = TITLE + fmt.adicionais.altura;
  const prodBottom1 = fmt.base - adicH - issH;
  const TH = 6;
  // Tudo acima dos produtos, menos a fatura, que se ajusta ao espaço.
  const semFatura =
    header1 +
    HEADER_H +
    (TITLE + 3 * RH) +
    locais * (TITLE + 2 * RH) +
    (TITLE + 2 * RH) +
    (ibs ? TITLE + 2 * RH : 0) +
    (TITLE + 3 * RH);
  // Espaço mínimo do quadro de produtos na folha 1: título, cabeçalho das colunas e uma linha de item.
  const PROD_MIN = TITLE + TH + lh + 2 * PAD + 3;

  // ---- duplicatas: a grade da folha 1 tem até três linhas (o XML admite 120 duplicatas) e perde linhas, até uma, se
  // a folha 1 não tiver espaço para ao menos uma linha de item. Com mais duplicatas que a grade comporta, a última
  // célula avisa e as demais vão para as informações complementares, que continuam nas folhas adicionais. O MOC (3.1.6
  // e 3.3.2) não trata o excesso; a grade que cresce sem limite empurraria o resto da folha para fora do papel.
  const hasFat = nota.dup.length > 0 || nota.fat !== undefined;
  const dupPerRow = paisagem ? 8 : 6;
  const DUP_H = 7.5;
  const fatHeight = (rows: number): number => (hasFat ? TITLE + (nota.fat ? RH * 0.75 : 0) + rows * DUP_H : 0);
  const dupRowsNeeded = Math.ceil(nota.dup.length / dupPerRow);
  let dupMaxRows = Math.min(3, dupRowsNeeded);
  while (dupMaxRows > 1 && semFatura + fatHeight(dupMaxRows) + PROD_MIN > prodBottom1) dupMaxRows--;
  // Na folha mais cheia (canhoto, dois locais, IBS/CBS e ISSQN) nem uma linha da grade cabe sem invadir o quadro de
  // produtos: as duplicatas vão todas para as informações complementares, e a linha da fatura também, se não couber.
  const cabe = (h: number): boolean => semFatura + h + TITLE + TH <= prodBottom1;
  if (dupMaxRows > 0 && !cabe(fatHeight(dupMaxRows))) dupMaxRows = 0;
  const dupCap = dupPerRow * dupMaxRows;
  const dupGrade = nota.dup.length > dupCap ? nota.dup.slice(0, Math.max(0, dupCap - 1)) : nota.dup;
  const dupResto = nota.dup.slice(dupGrade.length);
  const dupRows = dupCap === 0 ? 0 : Math.ceil((dupGrade.length + (dupResto.length > 0 ? 1 : 0)) / dupPerRow);
  const quadroFat = hasFat && (dupRows > 0 || (nota.fat !== undefined && cabe(fatHeight(0))));
  const fatH = quadroFat ? fatHeight(dupRows) : 0;
  const fatTexto =
    nota.fat !== undefined && !quadroFat
      ? `FATURA Nº ${nota.fat.nFat} VALOR ORIGINAL R$ ${f.num(nota.fat.vOrig)} DESCONTO R$ ${f.num(nota.fat.vDesc || '0')} VALOR LÍQUIDO R$ ${f.num(nota.fat.vLiq)}.`
      : '';
  const dupTexto = dupResto.length
    ? `${dupGrade.length > 0 ? 'DEMAIS DUPLICATAS' : 'DUPLICATAS'}: ${dupResto.map((d) => `Nº ${d.nDup} VENC. ${f.data(d.dVenc)} R$ ${f.num(d.vDup)}`).join('; ')}.`
    : '';
  const firstTop = semFatura + fatH;

  // ---- informações complementares: situação, contingência e fisco antes do contribuinte (MOC 3.1.8); o "SEM VALOR
  // FISCAL" vai aqui e na marca d'água (MOC 3).
  const cont = FORMA_EMISSAO.valores[nota.tpEmis];
  const pendente = situacao.tipo === 'contingencia' || situacao.tipo === 'sem-protocolo';
  const aviso = avisoSituacao(situacao);
  const infParts = [
    aviso ? `${aviso}.` : '',
    cont && pendente ? `DANFE EMITIDO EM ${cont}.` : '',
    nota.tpAmb === '2' ? 'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL.' : '',
    nota.infAdFisco,
    fatTexto,
    dupTexto,
    nota.infCpl,
  ].filter(Boolean);
  const infW = (paisagem ? fmt.adicionais.complementares : fmt.adicionais.complementares) - 1.2;
  const infLines = wrap(toWinAnsi(infParts.join(' ')), 'Times-Roman', size, infW).filter((l, i) => l || i === 0);
  const infFits = Math.max(1, Math.floor((fmt.adicionais.altura - 3.2) / lh));
  // Com continuação, a última linha do quadro fica para o aviso "CONTINUA NA PRÓXIMA FOLHA".
  const infCap1 = infLines.length > infFits ? infFits - 1 : infFits;

  // ---- paginação
  type Chunk = { rows: Row[]; inf: string[]; top: number; bottom: number; infTop: number };
  const chunks: Chunk[] = [];
  let ri = 0;
  const pending = [...rows];
  const take = (top: number, bottom: number): Row[] => {
    const out: Row[] = [];
    let y = top + TITLE + TH;
    while (ri < pending.length) {
      const r = pending[ri] as Row;
      if (y + rowH(r) > bottom - 3) break;
      y += rowH(r);
      out.push(r);
      ri++;
    }
    // Item mais alto que a área inteira: divide as linhas dele entre as folhas, em vez de travar.
    // Na folha 1 sem espaço nem para uma linha, os itens começam na folha 2.
    const r = pending[ri];
    const room = Math.floor((bottom - 3 - y - 2 * PAD) / lh);
    if (out.length === 0 && r && room >= 1) {
      const cap = room;
      out.push({ ...r, cells: r.cells.map((c) => c.slice(0, cap)), lines: cap });
      pending[ri] = { ...r, cells: r.cells.map((c) => c.slice(cap)), lines: r.lines - cap };
    }
    return out;
  };
  chunks.push({
    rows: take(firstTop, prodBottom1),
    inf: infLines.slice(0, infCap1),
    top: firstTop,
    bottom: prodBottom1,
    infTop: 0,
  });
  let infRest = infLines.slice(infCap1);
  const topN = fmt.topo + HEADER_H;
  while (ri < pending.length || infRest.length > 0) {
    const chunk: Chunk = { rows: [], inf: [], top: topN, bottom: topN, infTop: topN };
    if (ri < pending.length) {
      chunk.rows = take(topN, fmt.base);
      chunk.bottom = Math.min(fmt.base, topN + TITLE + TH + chunk.rows.reduce((a, r) => a + rowH(r), 0) + 1);
      chunk.infTop = chunk.bottom + 1;
    }
    if (ri >= pending.length && infRest.length > 0) {
      const cap = Math.floor((fmt.base - chunk.infTop - TITLE - 2) / lh);
      if (cap > 0) {
        chunk.inf = infRest.slice(0, cap);
        infRest = infRest.slice(cap);
      }
    }
    chunks.push(chunk);
  }
  const total = chunks.length;
  const itensContinuam = (i: number): boolean => chunks.slice(i + 1).some((c) => c.rows.length > 0);

  // ---- desenho
  chunks.forEach((chunk, pi) => {
    const c = new Canvas('Times-Roman', 'Times-Bold');
    const first = pi === 0;
    marcas(c, fmt.pagina.w, fmt.pagina.h, nota.tpAmb, situacao, cancel);
    let y = first ? header1 : fmt.topo;
    if (first && canhoto) (paisagem ? canhotoPaisagem : canhotoRetrato)(c);
    header(c, y, pi + 1, total);
    y += HEADER_H;
    if (first) {
      y = destinatario(c, y);
      if (nota.retirada) y = local(c, y, 'INFORMAÇÕES DO LOCAL DE RETIRADA', nota.retirada);
      if (nota.entrega) y = local(c, y, 'INFORMAÇÕES DO LOCAL DE ENTREGA', nota.entrega);
      if (quadroFat) y = fatura(c, y);
      y = imposto(c, y);
      if (ibs) y = ibsCbs(c, y);
      y = transportador(c, y);
    }
    if (chunk.rows.length > 0 || (first && chunk.bottom - chunk.top >= TITLE + TH + 1)) {
      produtos(c, chunk.top, chunk.bottom, chunk.rows, itensContinuam(pi));
    }
    if (first) {
      let yb = prodBottom1;
      if (nota.issqn) yb = issqn(c, yb);
      adicionais(c, yb, chunk.inf, infLines.length > infCap1);
    } else if (chunk.inf.length > 0) {
      const h = fmt.base - chunk.infTop - TITLE;
      frame(c, 'DADOS ADICIONAIS (CONTINUAÇÃO)', chunk.infTop, h);
      c.rect(BX, chunk.infTop + TITLE, fmt.adicionais.complementares, h);
      c.para(chunk.inf, BX + 0.6, chunk.infTop + TITLE + 0.8, h - 1, 'Times-Roman', size);
    }
    b.page(fmt.pagina.w, fmt.pagina.h, c);
  });
  const doc = b.build(`DANFE ${nota.chave}`);
  const extra = probe.stats;
  return {
    ...doc,
    estatisticas: {
      reduzidos: doc.estatisticas.reduzidos + extra.reduzidos,
      quebrados: doc.estatisticas.quebrados + extra.quebrados,
      cortados: doc.estatisticas.cortados + extra.cortados,
    },
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Título do quadro: acima dele no retrato, faixa vertical preta à esquerda na paisagem.
  function frame(c: Canvas, title: string, y: number, h: number): void {
    if (!paisagem) {
      c.title(title, X, y, W);
      return;
    }
    c.fillRect(X, y, fmt.faixa, h, 0);
    // Na faixa vertical, a barra vira espaço para o título quebrar em até duas linhas por palavra.
    const words = toWinAnsi(title.replace(/\//g, ' '));
    const r = fit(words, 'Times-Bold', 5.5, h - 0.8, 2, 5);
    const lh2 = lineHeight(r.size, 1);
    const x0 = X + fmt.faixa / 2 + (ascentMm('Times-Bold', r.size) - (r.lines.length - 1) * lh2) / 2 - 0.3;
    r.lines.forEach((l, i) => {
      const tw = widthMm(l, 'Times-Bold', r.size);
      c.raw(l, x0 + i * lh2, y + h - (h - tw) / 2, 'Times-Bold', r.size, 1, 90);
    });
  }

  function fields(c: Canvas, y: number, linha: Linha, values: readonly FieldValue[], rh = RH): void {
    const sum = linha.reduce((a, [, w]) => a + w, 0);
    let x = BX;
    linha.forEach(([label, w], i) => {
      const ww = i === linha.length - 1 ? BX + BW - x : (w * BW) / sum;
      const v = values[i] ?? { v: '' };
      c.field(x, y, ww, rh, label, v.v, {
        size: v.size ?? FONTES.demais,
        ...(v.align ? { align: v.align } : {}),
        ...(v.bold ? { bold: true } : {}),
      });
      x += ww;
    });
  }

  function canhotoRetrato(c: Canvas): void {
    const y = fmt.topo;
    const wr = 161;
    c.rect(X, y, wr, 8.5);
    const recebemos = `RECEBEMOS DE ${nota.emit.xNome} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO. EMISSÃO: ${f.data(nota.dhEmi)} VALOR TOTAL: R$ ${f.num(nota.tot.vNF)} DESTINATÁRIO: ${nota.dest?.xNome ?? ''}`;
    c.block(recebemos, X + 0.6, y + 0.6, wr - 1.2, 7.4, { size: 6, fixo: true });
    c.field(X, y + 8.5, 41, 8.5, 'DATA DE RECEBIMENTO', '');
    c.field(X + 41, y + 8.5, wr - 41, 8.5, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', '');
    c.rect(X + wr, y, W - wr, 17);
    c.text('NF-e', X + wr, y + 5, W - wr, { font: c.bold, size: 12, align: 'c' });
    c.text(`Nº ${f.numero(nota.nNF)}`, X + wr, y + 10, W - wr, { font: c.bold, size: 10, align: 'c' });
    c.text(`SÉRIE ${f.serie(nota.serie)}`, X + wr, y + 14.5, W - wr, { font: c.bold, size: 10, align: 'c' });
    c.line(X, 23.3, X + W, 23.3, 0.2, 1);
  }

  function canhotoPaisagem(c: Canvas): void {
    // Faixa lateral (MOC 3.8.2): NF-e/número/série em cima; recebemos, identificação e data giradas.
    const x = 1.3;
    const y = fmt.topo;
    const w = 20.3;
    const hTop = 45.3;
    const bottom = fmt.base;
    c.rect(x, y, w, hTop);
    c.text('NF-e', x, y + 8, w, { font: c.bold, size: 12, align: 'c' });
    c.text(`Nº ${f.numero(nota.nNF)}`, x + 0.6, y + 16, w - 1.2, { font: c.bold, size: 10, align: 'c' });
    c.text(`SÉRIE ${f.serie(nota.serie)}`, x, y + 22, w, { font: c.bold, size: 10, align: 'c' });
    const h = bottom - (y + hTop);
    const y0 = y + hTop;
    c.rect(x, y0, 10.2, h);
    c.rect(x + 10.2, y0, 10.1, h);
    c.line(x + 10.2, y0 + h * 0.58, x + w, y0 + h * 0.58);
    const recebemos = toWinAnsi(
      `RECEBEMOS DE ${nota.emit.xNome} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO. EMISSÃO: ${f.data(nota.dhEmi)} VALOR TOTAL: R$ ${f.num(nota.tot.vNF)} DESTINATÁRIO: ${nota.dest?.xNome ?? ''}`,
    );
    const r = fit(recebemos, 'Times-Roman', 6, h - 2, 3);
    if (r.cortado) c.count({ ...r, quebrado: false });
    r.lines.forEach((l, i) => {
      c.raw(l, x + 2.6 + i * lineHeight(r.size), y0 + h - 1, 'Times-Roman', r.size, undefined, 90);
    });
    c.raw('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', x + 12.4, y0 + h * 0.58 - 1, 'Times-Roman', 6, undefined, 90);
    c.raw('DATA DE RECEBIMENTO', x + 12.4, y0 + h - 1, 'Times-Roman', 6, undefined, 90);
    c.line(x + w + 1.2, y, x + w + 1.2, bottom, 0.2, 1);
  }

  function header(c: Canvas, y: number, folha: number, totalFolhas: number): void {
    const g = fmt.cabecalho;
    const ew = g.emitente;
    // Identificação do emitente (MOC 3.1.3 e 3.7.6), com o logotipo à esquerda quando houver.
    c.rect(X, y, ew, g.altura);
    c.text('IDENTIFICAÇÃO DO EMITENTE', X + 0.6, y + 2.6, ew - 1.2, { size: FONTES.rotulo });
    let tx = X + 1;
    let tw = ew - 2;
    if (b.logo) {
      const box = Math.min(g.altura - 5, ew * 0.3);
      drawLogo(c, b, X + 1, y + 3.8, box, g.altura - 5);
      tx = X + 2 + box;
      tw = ew - 3 - box;
    }
    const e = nota.emit.ender;
    const nome = fit(nota.emit.xNome, c.bold, FONTES.emitente, tw, 2);
    c.count(nome);
    const lines = [
      ender(e),
      [e.xBairro, f.cep(e.CEP)].filter(Boolean).join(' - '),
      [e.xMun, e.UF].filter(Boolean).join(' - '),
      e.fone ? `FONE: ${f.fone(e.fone)}` : '',
    ]
      .filter(Boolean)
      .map((l) => fit(l, c.bold, 8, tw, 2));
    for (const l of lines) c.count(l);
    const nomeLh = lineHeight(nome.size, 1.05);
    const bodyLh = (z: number): number => lineHeight(z, 1.1);
    const blockH = nome.lines.length * nomeLh + lines.reduce((a, l) => a + l.lines.length * bodyLh(l.size), 0);
    let yy = y + 3 + Math.max(0, (g.altura - 3 - blockH) / 2) + ascentMm(c.bold, nome.size);
    for (const l of nome.lines) {
      c.aligned(l, tx, yy, tw, c.bold, nome.size, 'c');
      yy += nomeLh;
    }
    yy += 0.6;
    for (const l of lines) {
      for (const s of l.lines) {
        c.aligned(s, tx, yy, tw, c.bold, l.size, 'c');
        yy += bodyLh(l.size);
      }
    }
    // Quadro "DANFE" (MOC 3.7.4).
    const dx = X + ew;
    const dw = g.danfe;
    c.rect(dx, y, dw, g.altura);
    // Linhas de base do quadro, de cima para baixo: DANFE, três linhas do descritivo, entrada, saída, número,
    // série e folha. A paisagem tem 31 mm de altura contra 39,2 mm do retrato (MOC 3.8.1 e 3.8.2).
    const [bDanfe, bDoc, bEnt, bSai, bNum, bSer, bFol] = paisagem
      ? [4.6, 7.5, 16.4, 19.3, 23.2, 26.8, 30.3]
      : [5.2, 8.4, 21.6, 24.8, 29.6, 33.4, 37.2];
    const docLh = paisagem ? 2.8 : 2.9;
    c.text('DANFE', dx, y + bDanfe, dw, { font: c.bold, size: FONTES.danfe, align: 'c' });
    let ly = y + bDoc;
    const docLines = wrap(toWinAnsi('DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA'), c.regular, 8, dw - 1.5);
    for (const l of docLines.slice(0, paisagem ? 3 : 4)) {
      c.text(l, dx, ly, dw, { size: 8, align: 'c', fixo: true });
      ly += docLh;
    }
    c.text('0 - ENTRADA', dx + 0.8, y + bEnt, dw - 6.8, { size: 8, fixo: true });
    c.text('1 - SAÍDA', dx + 0.8, y + bSai, dw - 6.8, { size: 8, fixo: true });
    c.rect(dx + dw - 5.8, y + bEnt - 2.6, 5, 5.6);
    c.text(nota.tpNF, dx + dw - 5.8, y + bEnt + 1.4, 5, { font: c.bold, size: 10, align: 'c' });
    c.text(`Nº ${f.numero(nota.nNF)}`, dx + 0.5, y + bNum, dw - 1, { font: c.bold, size: 10, align: 'c' });
    c.text(`SÉRIE ${f.serie(nota.serie)}`, dx + 0.5, y + bSer, dw - 1, { font: c.bold, size: 10, align: 'c' });
    c.text(`FOLHA ${folha}/${totalFolhas}`, dx + 0.5, y + bFol, dw - 1, { font: c.bold, size: 10, align: 'c' });
    // Código de barras da chave, chave e campos variáveis (MOC 3.9).
    const bx = dx + dw;
    const bw = X + W - bx;
    c.rect(bx, y, bw, g.barras);
    barcode(c, nota.chave, bx + 1, y + 1.5, bw - 2, g.barras - 3);
    c.field(bx, y + g.barras, bw, g.chave, 'CHAVE DE ACESSO', f.chave(nota.chave), {
      bold: true,
      size: 9,
      align: 'c',
    });
    const cy = y + g.barras + g.chave;
    const ch = g.altura - g.barras - g.chave;
    c.rect(bx, cy, bw, ch);
    const campo2: { label: string; value: string } = { label: 'PROTOCOLO DE AUTORIZAÇÃO DE USO', value: '' };
    // Autorizada ou cancelada pelo cStat do protocolo: o protocolo de autorização de uso (ADR 0006, decisão 15).
    const prot = protocoloDeUso(situacao);
    if (nota.tpEmis === '2' || nota.tpEmis === '5') {
      // FS-IA e FS-DA: código de barras adicional "Dados da NF-e" no campo 1 e a representação no campo 2 (3.9.2).
      const dados = dadosNfe(nota);
      barcode(c, dados, bx + 1, cy + 1.2, bw - 2, ch - 2.4);
      campo2.label = 'DADOS DA NF-e';
      campo2.value = f.chave(dados);
    } else {
      const consulta = nota.tpEmis === '4' ? CONSULTA_NFE.epec : CONSULTA_NFE.normal;
      const lh2 = lineHeight(8, 1.1);
      let yy2 = cy + ch / 2 - lh2 / 2 + 1;
      for (const l of consulta) {
        c.text(l, bx + 1, yy2, bw - 2, { size: 8, align: 'c' });
        yy2 += lh2;
      }
      if (nota.tpEmis === '4') {
        campo2.label = 'PROTOCOLO DE AUTORIZAÇÃO DO EPEC';
        campo2.value = options.epec ? `${options.epec.nProt} - ${f.dataHora(options.epec.dhRegEvento)}` : '';
      } else if (prot) {
        campo2.value = `${prot.nProt} - ${f.dataHora(prot.dhRecbto)}`;
      }
    }
    // Denegada, em qualquer forma de emissão (FS-IA, FS-DA e EPEC inclusive): o campo 2 mostra o protocolo da
    // denegação (MOC 7.0, Visão Geral, 5.4.2, ER08: "Protocolo de autorização ou denegação de uso").
    if (situacao.tipo === 'denegada') {
      campo2.label = 'PROTOCOLO DE DENEGAÇÃO DE USO';
      campo2.value = `${situacao.nProt} - ${f.dataHora(situacao.dhRecbto)}`;
    }
    const ry = y + g.altura;
    const natW = bx - X;
    c.field(X, ry, natW, RH, 'NATUREZA DA OPERAÇÃO', nota.natOp, { size: FONTES.demais });
    c.field(bx, ry, bw, RH, campo2.label, campo2.value, { size: FONTES.demais, bold: true, align: 'c' });
    const w3 = W / 3;
    c.field(X, ry + RH, w3, RH, 'INSCRIÇÃO ESTADUAL', nota.emit.IE, { size: FONTES.demais });
    c.field(X + w3, ry + RH, w3, RH, 'INSC. ESTADUAL DO SUBST. TRIB.', nota.emit.IEST, { size: FONTES.demais });
    c.field(X + 2 * w3, ry + RH, W - 2 * w3, RH, 'CNPJ/CPF', f.cnpjCpf(nota.emit.doc), { size: FONTES.demais });
    const [rCrt, rApur] = REGIME.rotulos;
    const crt = REGIME.crt[nota.emit.CRT] ?? nota.emit.CRT;
    c.field(X, ry + 2 * RH, W / 2, RH, rCrt, crt, { size: FONTES.demais });
    c.field(X + W / 2, ry + 2 * RH, W / 2, RH, rApur, '', { size: FONTES.demais });
  }

  function destinatario(c: Canvas, y: number): number {
    frame(c, 'DESTINATÁRIO/REMETENTE', y, 3 * RH);
    const d = nota.dest;
    const e = d?.ender;
    const yy = y + TITLE;
    const [l1, l2, l3] = fmt.destinatario as [Linha, Linha, Linha];
    fields(c, yy, l1, [
      { v: d?.xNome ?? '' },
      { v: f.cnpjCpf(d?.doc), bold: true, align: 'c' },
      { v: f.data(nota.dhEmi), align: 'c' },
    ]);
    fields(c, yy + RH, l2, [
      { v: e ? ender(e) : '' },
      { v: e?.xBairro ?? '' },
      { v: f.cep(e?.CEP), align: 'c' },
      { v: f.data(nota.dhSaiEnt), bold: true, align: 'c' },
    ]);
    fields(c, yy + 2 * RH, l3, [
      { v: e?.xMun ?? '' },
      { v: f.fone(e?.fone) },
      { v: e?.UF ?? '', align: 'c' },
      { v: d?.IE ?? '' },
      { v: f.hora(nota.dhSaiEnt), bold: true, align: 'c' },
    ]);
    return yy + 3 * RH;
  }

  // Local de retirada ou de entrega (MOC 3.1.4 e 3.1.5, NT 2018.005), quando o grupo existe.
  function local(c: Canvas, y: number, title: string, l: NonNullable<NotaView['entrega']>): number {
    frame(c, paisagem ? title.replace('INFORMAÇÕES DO ', '') : title, y, 2 * RH);
    const yy = y + TITLE;
    fields(
      c,
      yy,
      [
        ['NOME/RAZÃO SOCIAL', 123.2],
        ['CNPJ/CPF', 53.3],
        ['INSCRIÇÃO ESTADUAL', 29.2],
      ],
      [{ v: l.xNome }, { v: f.cnpjCpf(l.doc), align: 'c' }, { v: l.IE }],
    );
    fields(
      c,
      yy + RH,
      [
        ['ENDEREÇO', 101.6],
        ['BAIRRO/DISTRITO', 48.3],
        ['CEP', 26.6],
        ['MUNICÍPIO/UF', 29.2],
      ],
      [
        { v: ender(l.ender) },
        { v: l.ender.xBairro },
        { v: f.cep(l.ender.CEP), align: 'c' },
        { v: [l.ender.xMun, l.ender.UF].filter(Boolean).join('/') },
      ],
    );
    return yy + 2 * RH;
  }

  // Fatura e duplicatas (MOC 3.1.6 e 3.3.2): linha da fatura e grade de duplicatas que cresce.
  function fatura(c: Canvas, y: number): number {
    const h = fatH - TITLE;
    frame(c, 'FATURA/DUPLICATAS', y, h);
    let yy = y + TITLE;
    if (nota.fat) {
      const fh = RH * 0.75;
      c.rect(BX, yy, BW, fh);
      const fat = nota.fat;
      const s = [
        `FATURA Nº ${fat.nFat}`,
        `VALOR ORIGINAL R$ ${f.num(fat.vOrig)}`,
        `DESCONTO R$ ${f.num(fat.vDesc || '0')}`,
        `VALOR LÍQUIDO R$ ${f.num(fat.vLiq)}`,
      ].join('    ');
      c.text(s, BX + 0.6, yy + fh / 2 + 1.2, BW - 1.2, { size: 7 });
      yy += fh;
    }
    const dw = BW / dupPerRow;
    const cell = (i: number): readonly [number, number] => {
      const x = BX + (i % dupPerRow) * dw;
      const top = yy + Math.floor(i / dupPerRow) * DUP_H;
      c.rect(x, top, dw, DUP_H);
      return [x, top];
    };
    dupGrade.forEach((d, i) => {
      const [x, top] = cell(i);
      c.text(`Nº ${d.nDup}`, x + 0.6, top + 2.3, dw - 1.2, { size: 6.5 });
      c.text(`VENC. ${f.data(d.dVenc)}`, x + 0.6, top + 4.6, dw - 1.2, { size: 6.5 });
      c.text(`VALOR R$ ${f.num(d.vDup)}`, x + 0.6, top + 6.9, dw - 1.2, { size: 6.5 });
    });
    if (dupResto.length > 0 && dupRows > 0) {
      const [x, top] = cell(dupGrade.length);
      c.text(`+ ${dupResto.length} DUPLICATAS`, x + 0.6, top + 2.3, dw - 1.2, { font: c.bold, size: 6.5, fixo: true });
      c.text('EM INFORMAÇÕES', x + 0.6, top + 4.6, dw - 1.2, { size: 6.5, fixo: true });
      c.text('COMPLEMENTARES', x + 0.6, top + 6.9, dw - 1.2, { size: 6.5, fixo: true });
    }
    return y + fatH;
  }

  function imposto(c: Canvas, y: number): number {
    frame(c, 'CÁLCULO DO IMPOSTO', y, 2 * RH);
    const t = nota.tot;
    const yy = y + TITLE;
    const v = (s: string | undefined, bold = false): FieldValue => ({ v: f.num(s || '0'), align: 'r', bold });
    const [l1, l2] = fmt.imposto as [Linha, Linha];
    fields(c, yy, l1, [v(t.vBC), v(t.vICMS), v(t.vBCST), v(t.vST), v(t.vProd)]);
    fields(c, yy + RH, l2, [v(t.vFrete), v(t.vSeg), v(t.vDesc), v(t.vOutro), v(t.vIPI), v(t.vNF, true)]);
    return yy + 2 * RH;
  }

  function ibsCbs(c: Canvas, y: number): number {
    frame(c, paisagem ? 'IBS CBS IS' : QUADRO_IBSCBS.titulo, y, 2 * RH);
    const t = nota.ibscbs;
    // Campo sem informação no XML fica vazio, nunca 0,00 (NT 2026.010, 4.4).
    const v = (s: string | undefined): FieldValue => ({ v: s ? f.num(s) : '', align: 'r' });
    const [l1, l2] = QUADRO_IBSCBS.linhas as [Linha, Linha];
    fields(c, y + TITLE, l1, [v(t?.vCBS), v(t?.vIBSUF), v(t?.vIBSMun), v(t?.vIS)]);
    fields(c, y + TITLE + RH, l2, [v(t?.vIBSMono), v(t?.vCBSMono), v(t?.vIBSMonoReten), v(t?.vCBSMonoReten)]);
    return y + TITLE + 2 * RH;
  }

  function transportador(c: Canvas, y: number): number {
    frame(c, paisagem ? 'TRANSPORTADOR VOLUMES' : 'TRANSPORTADOR/VOLUMES TRANSPORTADOS', y, 3 * RH);
    const t = nota.transp;
    const vol = t.vol[0];
    const yy = y + TITLE;
    const [l1, l2, l3] = fmt.transportador as [Linha, Linha, Linha];
    fields(c, yy, l1, [
      { v: t.xNome },
      { v: MOD_FRETE.valores[t.modFrete] ?? t.modFrete, size: 8 },
      { v: t.RNTC, size: 8 },
      { v: t.placa },
      { v: t.placaUF, align: 'c' },
      { v: f.cnpjCpf(t.doc) },
    ]);
    fields(c, yy + RH, l2, [{ v: t.xEnder }, { v: t.xMun }, { v: t.UF, align: 'c' }, { v: t.IE }]);
    // Vários volumes: quantidade e pesos somados não existem no XML, então só o primeiro grupo vai para o quadro e os
    // demais seguem nas informações complementares do próprio emitente, se ele os quiser impressos.
    fields(c, yy + 2 * RH, l3, [
      { v: vol?.qVol ?? '', align: 'r' },
      { v: vol?.esp ?? '' },
      { v: vol?.marca ?? '' },
      { v: vol?.nVol ?? '' },
      { v: vol?.pesoB ? f.num(vol.pesoB, 3) : '', align: 'r' },
      { v: vol?.pesoL ? f.num(vol.pesoL, 3) : '', align: 'r' },
    ]);
    return yy + 3 * RH;
  }

  function produtos(c: Canvas, top: number, bottom: number, rs: readonly Row[], continua: boolean): void {
    frame(c, 'DADOS DOS PRODUTOS/SERVIÇOS', top, bottom - top - TITLE);
    const y0 = top + TITLE;
    c.rect(BX, y0, BW, bottom - y0);
    let x = BX;
    for (const col of cols) {
      // Rótulos das colunas em caixa alta, 5,5 pt (MOC 3.7.2: mínimo 5 pt), em até duas linhas.
      const r = fit(col.label, c.regular, 5.5, col.w - 0.6, 2, 5);
      const lhl = lineHeight(r.size, 1.05);
      let ly = y0 + TH / 2 - ((r.lines.length - 1) * lhl) / 2 + ascentMm(c.regular, r.size) / 2;
      for (const l of r.lines) {
        c.aligned(l, x + 0.3, ly, col.w - 0.6, c.regular, r.size, 'c');
        ly += lhl;
      }
      if (x > BX) c.line(x, y0, x, bottom, 0.1);
      x += col.w;
    }
    c.line(BX, y0 + TH, BX + BW, y0 + TH, 0.1);
    let y = y0 + TH;
    for (const r of rs) {
      const h = rowH(r);
      let cx = BX;
      cols.forEach((col, i) => {
        const lines = r.cells[i] ?? [];
        const pad = col.k === 'desc' ? 0.6 : 0.4;
        const cellSize = r.sizes[i] ?? r.size;
        let yy = y + PAD + ascentMm(c.regular, r.size);
        for (const l of lines) {
          c.aligned(l, cx + pad, yy, col.w - 2 * pad, c.regular, cellSize, col.align);
          yy += lh;
        }
        cx += col.w;
      });
      y += h;
      // Destaque divisório entre itens (MOC 3.1.7): linha tracejada.
      if (y < bottom - 0.5) c.line(BX, y, BX + BW, y, 0.05, 0.5);
    }
    if (continua) {
      c.text('CONTINUA NA PRÓXIMA FOLHA', BX + 0.6, bottom - 0.9, BW - 1.2, { font: c.bold, size: 6, align: 'r' });
    }
  }

  function issqn(c: Canvas, y: number): number {
    frame(c, paisagem ? 'ISSQN' : 'CÁLCULO DO ISSQN', y, RH);
    const s = nota.issqn;
    const v = (x: string | undefined): FieldValue => ({ v: f.num(x || '0'), align: 'r' });
    fields(c, y + TITLE, fmt.issqn, [{ v: nota.emit.IM }, v(s?.vServ), v(s?.vBC), v(s?.vISS)]);
    return y + TITLE + RH;
  }

  function adicionais(c: Canvas, y: number, lines: readonly string[], continua: boolean): void {
    const h = fmt.adicionais.altura;
    frame(c, 'DADOS ADICIONAIS', y, h);
    const yy = y + TITLE;
    const cw = fmt.adicionais.complementares;
    c.rect(BX, yy, cw, h);
    c.text('INFORMAÇÕES COMPLEMENTARES', BX + 0.6, yy + 2.3, cw - 1.2, { size: FONTES.rotulo });
    c.para(lines, BX + 0.6, yy + 3, h - 3.5, c.regular, size);
    if (continua)
      c.text('CONTINUA NA PRÓXIMA FOLHA', BX + 0.6, yy + h - 0.7, cw - 1.2, { font: c.bold, size: 6, align: 'r' });
    c.rect(BX + cw, yy, BW - cw, h);
    c.text('RESERVADO AO FISCO', BX + cw + 0.6, yy + 2.3, BW - cw - 1.2, { size: FONTES.rotulo });
  }
}

interface FieldValue {
  readonly v: string;
  readonly align?: Align;
  readonly bold?: boolean;
  readonly size?: number;
}
