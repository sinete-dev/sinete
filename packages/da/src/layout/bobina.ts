/**
 * Documentos em bobina, página única de altura variável: DANFE NFC-e (modelo 65; Manual de Especificações Técnicas
 * do DANFE NFC-e e QR Code, Ajuste SINIEF 19/16, cláusula décima) e DANFE Simplificado Tipo 2 (NF-e modelo 55 com
 * `tpImp` = 6; NT 2026.003 v1.00 e NT 2026.002 v1.10). Os dois têm as mesmas divisões (NT 2026.003, 3.1):
 *
 * I cabeçalho; II itens; III totais e pagamento; III-A IBS/CBS/IS quando existirem; IV consulta pela chave; V QR Code;
 * VI consumidor; VII identificação e protocolo; VIII mensagens fiscais; IX mensagens do contribuinte.
 */

import { MEIO_PAGAMENTO } from '../data/leiaute-bobina.ts';
import { ErroDa } from '../errors.ts';
import * as f from '../format.ts';
import type { NotaView } from '../input/nfe.ts';
import type { Documento } from '../model.ts';
import type { Align } from '../render/canvas.ts';
import { Canvas, lineHeight, MIN_SIZE } from '../render/canvas.ts';
import { ascentMm, toWinAnsi, widthMm } from '../render/text.ts';
import type { DaOpcoes } from './common.ts';
import { DocBuilder, drawLogo, qrcode } from './common.ts';
import type { Cancelamento, Situacao } from './marcas.ts';
import { avisoSituacao, marcas, protocoloDeUso } from './marcas.ts';

export interface BobinaOpcoes extends DaOpcoes {
  /** Largura do papel em mm (padrão 80; mínimo 56, NT 2026.003, 3.3 e Ajuste SINIEF 19/16). */
  readonly largura?: number;
  /** Via impressa em contingência (NT 2026.003, 3.1.9): a do estabelecimento leva a identificação ao lado da data. */
  readonly via?: 'consumidor' | 'estabelecimento';
  /** QR Code à esquerda da identificação (padrão quando a largura permite) ou centralizado (NT 2026.003, 3.1.6). */
  readonly qrLateral?: boolean;
}

/** Margem lateral (NT 2026.003, 3.3: mínimo 2 mm). */
const M = 3;
const BODY = 7;

export function bobina(
  nota: NotaView,
  tipo: 'nfce' | 'tipo2',
  options: BobinaOpcoes,
  situacao: Situacao,
  cancel?: Cancelamento,
): Documento {
  const largura = Math.max(56, options.largura ?? 80);
  if (!nota.qrCode) {
    throw new ErroDa('campo_ausente', 'NFC-e e DANFE Simplificado Tipo 2 exigem infNFeSupl/qrCode', {
      detalhes: { chave: nota.chave },
    });
  }
  const b = new DocBuilder(options);
  const c = new Canvas('Helvetica', 'Helvetica-Bold');
  const W = largura - 2 * M;
  let y = M;
  const contingencia = situacao.tipo === 'contingencia';
  const prot = protocoloDeUso(situacao);
  const lh = lineHeight(BODY);

  // Sem limite de altura: a bobina cresce com o conteúdo, e nenhuma informação fiscal é cortada.
  const text = (s: string, o: { bold?: boolean; size?: number; align?: Align; x?: number; w?: number } = {}): void => {
    const size = o.size ?? BODY;
    const h = c.block(s, o.x ?? M, y, o.w ?? W, Number.POSITIVE_INFINITY, {
      font: o.bold ? c.bold : c.regular,
      size,
      align: o.align ?? 'l',
    });
    y += h;
  };
  // Rótulo à esquerda (quebra se precisar, sem limite de altura) e valor à direita na primeira linha.
  const pair = (left: string, right: string, bold = false): void => {
    const font = bold ? c.bold : c.regular;
    const rw = widthMm(toWinAnsi(right), font, BODY);
    const h = c.block(left, M, y, W - rw - 2, Number.POSITIVE_INFINITY, { font, size: BODY });
    c.aligned(toWinAnsi(right), M, y + ascentMm(font, BODY), W, font, BODY, 'r');
    y += Math.max(lh, h);
  };
  const rule = (dotted = false): void => {
    y += 0.8;
    c.line(M, y, M + W, y, 0.15, dotted ? 0.4 : undefined);
    y += 1.2;
  };
  const gap = (h = 1.2): void => {
    y += h;
  };

  // I - cabeçalho
  const e = nota.emit.ender;
  let tx = M;
  let tw = W;
  const top = y;
  if (b.logo) {
    const lw = drawLogo(c, b, M, y, Math.min(16, W * 0.25), 14, 'l');
    tx = M + lw + 2;
    tw = W - lw - 2;
  }
  const endereco = [
    [e.xLgr, e.nro].filter(Boolean).join(', ') + (e.xCpl ? ` ${e.xCpl}` : ''),
    e.xBairro,
    [e.xMun, e.UF].filter(Boolean).join(' - '),
  ]
    .filter(Boolean)
    .join(', ');
  // CNPJ ou CPF do emitente (Manual de Padrões Técnicos do DANFE NFC-e e QR Code 6.0, 3.1.1; CPF pela NT 2023.002).
  const docEmit = nota.emit.doc.length === 11 ? 'CPF' : 'CNPJ';
  text(`${docEmit}: ${f.cnpjCpf(nota.emit.doc)} ${nota.emit.xNome}`, {
    bold: true,
    align: b.logo ? 'l' : 'c',
    x: tx,
    w: tw,
  });
  text(endereco, { align: b.logo ? 'l' : 'c', x: tx, w: tw, size: 6.5 });
  y = Math.max(y, b.logo ? top + 14 : y);
  gap(0.6);
  text(tipo === 'nfce' ? 'Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica' : 'DANFE Simplificado - Tipo 2', {
    bold: true,
    align: 'c',
  });
  if (contingencia) {
    rule();
    text('EMITIDA EM CONTINGÊNCIA', { bold: true, align: 'c', size: 8 });
    text('Pendente de autorização', { bold: true, align: 'c' });
  }
  rule();

  // II - itens (código, descrição, quantidade, unidade, valor unitário e total; NT 2026.003, 3.1.2)
  // As três colunas numéricas têm a largura do maior valor de cada uma, com as bordas nominais (52% e 74% da largura)
  // quando cabem. Sem espaço, a fonte desce até 6 pt; se nem assim couber, cada item leva uma linha "qtde x unitário =
  // total" que quebra (ADR 0006, decisão 7), em vez de sobrepor colunas.
  const ITEM = 6.5;
  const GAP = 1.2;
  const heads = ['Qtde UN', 'Vl Unit', 'Vl Total'] as const;
  const vals = nota.itens.map(
    (it) => [toWinAnsi(`${f.num(it.qCom, 0, 4)} ${it.uCom}`), f.num(it.vUnCom, 2, 10), f.num(it.vProd)] as const,
  );
  const colW = (i: 0 | 1 | 2, size: number): number =>
    Math.max(widthMm(heads[i], c.bold, size), ...vals.map((v) => widthMm(v[i], c.regular, size)));
  const descW = widthMm('Código  Descrição', c.bold, ITEM);
  // Bordas direitas das colunas de quantidade e unitário: as nominais se couberem, senão as colunas encostadas à
  // direita; sem espaço à esquerda para o rótulo da descrição, não servem.
  const bordas = (size: number): { rQ: number; rU: number } | undefined => {
    const ok = (rQ: number, rU: number): boolean =>
      rU <= W - colW(2, size) - GAP && rQ <= rU - colW(1, size) - GAP && rQ - colW(0, size) - GAP >= descW;
    const rU = Math.min(W * 0.74, W - colW(2, size) - GAP);
    const rQ = Math.min(W * 0.52, rU - colW(1, size) - GAP);
    if (ok(rQ, rU)) return { rQ, rU };
    const tU = W - colW(2, size) - GAP;
    const tQ = tU - colW(1, size) - GAP;
    return ok(tQ, tU) ? { rQ: tQ, rU: tU } : undefined;
  };
  let vs = ITEM;
  while (vs > MIN_SIZE && !bordas(vs)) vs -= 0.25;
  const cols = bordas(vs);
  const head = y + ascentMm(c.bold, ITEM);
  c.raw('Código  Descrição', M, head, c.bold, ITEM);
  if (cols) {
    c.aligned(heads[0], M, head, cols.rQ, c.bold, vs, 'r');
    c.aligned(heads[1], M, head, cols.rU, c.bold, vs, 'r');
    c.aligned(heads[2], M, head, W, c.bold, vs, 'r');
    y += lineHeight(ITEM);
  } else {
    y += lineHeight(ITEM);
    text('Qtde UN x Vl Unit = Vl Total', { bold: true, size: MIN_SIZE, align: 'r' });
  }
  nota.itens.forEach((it, i) => {
    text(`${it.cProd}  ${it.xProd}`, { size: ITEM });
    const [q, u, t] = vals[i] ?? ['', '', ''];
    if (cols) {
      const base = y + ascentMm(c.regular, vs);
      c.aligned(q, M, base, cols.rQ, c.regular, vs, 'r');
      c.aligned(u, M, base, cols.rU, c.regular, vs, 'r');
      c.aligned(t, M, base, W, c.regular, vs, 'r');
      y += lineHeight(ITEM);
    } else text(`${q} x ${u} = ${t}`, { size: MIN_SIZE, align: 'r' });
  });
  rule();

  // III - totais e pagamento (NT 2026.003, 3.1.3)
  const t = nota.tot;
  const acrescimos = f.soma2(t.vFrete, t.vSeg, t.vOutro);
  const temAcrescimo = f.positivo(acrescimos);
  const temDesconto = f.positivo(t.vDesc);
  pair('Qtde. total de itens', String(nota.itens.length));
  pair('Valor total R$', f.num(t.vProd));
  if (temAcrescimo) pair('Acréscimos (frete, seguro e outras despesas) R$', f.num(acrescimos));
  if (temDesconto) pair('Desconto R$', `-${f.num(t.vDesc)}`);
  // III-A - IBS/CBS/IS, quando existirem (NT 2026.003, 3.1.4)
  const ibs = nota.ibscbs;
  if (ibs) {
    rule(true);
    pair('(+) CBS R$', f.num(ibs.vCBS || '0'), true);
    pair('(+) IBS R$', f.num(ibs.vIBS || '0'), true);
    if (f.positivo(ibs.vIS)) pair('(+) IS R$', f.num(ibs.vIS), true);
    rule(true);
  }
  // A Figura 4 da NT 2026.003 soma CBS, IBS e IS ao valor a pagar: com `vNFTot` informado, é ele. Sai sempre que o
  // valor a pagar difere do total dos itens (acréscimo, desconto, novos tributos, ST, IPI).
  const aPagar = ibs && f.positivo(ibs.vNFTot) ? ibs.vNFTot : t.vNF;
  if (temAcrescimo || temDesconto || ibs || f.num(aPagar) !== f.num(t.vProd))
    pair('Valor a Pagar R$', f.num(aPagar), true);
  gap(0.8);
  pair('FORMA PAGAMENTO', 'VALOR PAGO R$');
  for (const p of nota.pag) {
    const nome = p.tPag === '99' && p.xPag ? p.xPag : (MEIO_PAGAMENTO.valores[p.tPag] ?? p.tPag);
    pair(nome, f.num(p.vPag));
  }
  // O troco é obrigatório (3.1.3); sem vTroco no XML, sai zero.
  pair('Troco R$', f.num(nota.vTroco || '0'));
  rule();

  // IV - consulta pela chave (3.1.5)
  text('Consulte pela Chave de Acesso em', { bold: true, align: 'c' });
  if (nota.urlChave) text(nota.urlChave, { align: 'c', size: 6.5 });
  text(f.chave(nota.chave), { align: 'c', size: 6.5 });
  gap(1.5);

  // V, VI e VII - QR Code, consumidor e identificação (3.1.6 a 3.1.8)
  const lateral = options.qrLateral ?? W >= 66;
  const qrSize = Math.max(25, Math.min(32, lateral ? W * 0.4 : W * 0.55));
  const d = nota.dest;
  const consumidor = !d?.doc
    ? 'CONSUMIDOR NÃO IDENTIFICADO'
    : d.tipoDoc === 'idEstrangeiro'
      ? `CONSUMIDOR Id. Estrangeiro: ${d.doc}`
      : `CONSUMIDOR ${d.tipoDoc}: ${f.cnpjCpf(d.doc)}`;
  const dEnd = d?.ender
    ? [
        [d.ender.xLgr, d.ender.nro].filter(Boolean).join(', '),
        d.ender.xBairro,
        [d.ender.xMun, d.ender.UF].filter(Boolean).join(' - '),
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const ent = nota.entrega;
  const entrega = ent
    ? `Entrega: ${[ent.ender.xLgr, ent.ender.nro].filter(Boolean).join(', ')}, ${ent.ender.xBairro}, ${ent.ender.xMun} - ${ent.ender.UF}`
    : '';
  const via = contingencia && options.via === 'estabelecimento' ? ' Via Estabelecimento' : '';
  const ident = `${tipo === 'nfce' ? 'NFC-e' : 'NF-e'} nº ${nota.nNF.padStart(9, '0')} Série ${f.serie(nota.serie)} ${f.dataHora(nota.dhEmi)}${via}`;
  const infoBlock = (x: number, w: number): void => {
    const save = { x, w };
    const t2 = (s: string, bold = false, size = 6.5): void => {
      if (s) text(s, { ...save, bold, size });
    };
    t2(consumidor, true);
    t2([d?.xNome, dEnd].filter(Boolean).join(' - '));
    t2(entrega);
    gap(0.8);
    t2(ident, true);
    if (contingencia) {
      t2('EMITIDA EM CONTINGÊNCIA', true, 7);
      t2('Pendente de autorização', true);
    } else if (prot) {
      t2(`Protocolo de autorização: ${prot.nProt}`, true);
      t2(`Data de autorização: ${f.dataHora(prot.dhRecbto)}`);
    } else if (situacao.tipo === 'denegada') {
      t2(`Protocolo de denegação: ${situacao.nProt}`, true);
      t2(`Data da denegação: ${f.dataHora(situacao.dhRecbto)}`);
    }
  };
  if (lateral) {
    const y0 = y;
    qrcode(c, nota.qrCode, M, y0, qrSize);
    infoBlock(M + qrSize + 1.5, W - qrSize - 1.5);
    y = Math.max(y, y0 + qrSize);
  } else {
    infoBlock(M, W);
    gap(1);
    qrcode(c, nota.qrCode, M + (W - qrSize) / 2, y, qrSize);
    y += qrSize;
  }
  gap(1);

  // VIII - área de mensagem fiscal (3.1.9): sem protocolo ou denegada, o aviso vem antes do de homologação.
  const aviso = avisoSituacao(situacao);
  if (aviso) text(aviso, { bold: true, align: 'c' });
  if (nota.tpAmb === '2') text('EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL', { bold: true, align: 'c' });
  if (nota.infAdFisco) text(nota.infAdFisco, { size: 6.5 });
  // IX - mensagem de interesse do contribuinte e Lei 12.741/2012 (3.1.10)
  if (f.positivo(t.vTotTrib))
    text(`Tributos Totais Incidentes (Lei Federal 12.741/2012): R$ ${f.num(t.vTotTrib)}`, { size: 6.5, align: 'c' });
  if (nota.infCpl) text(nota.infCpl, { size: 6.5 });
  const H = y + M;
  const bg = new Canvas('Helvetica', 'Helvetica-Bold');
  // A contingência já sai em texto no corpo (NT 2026.003, 3.1.9); a marca d'água fica para as outras situações.
  marcas(bg, largura, H, nota.tpAmb, situacao, cancel, []);
  b.page(largura, H, c, bg);
  return b.build(`${tipo === 'nfce' ? 'DANFE NFC-e' : 'DANFE Simplificado Tipo 2'} ${nota.chave}`);
}
