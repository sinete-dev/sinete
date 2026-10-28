/**
 * Documento auxiliar de um evento registrado da NF-e, da NFC-e ou do MDF-e (CC-e, cancelamento, encerramento,
 * inclusão de condutor). Os manuais não definem leiaute para a representação impressa de evento: segue a convenção de
 * mercado do DACCE (cabeçalho, chave com código de barras, dados do evento e do registro, campos próprios do tipo e
 * quadros de texto), com os mínimos de fonte e o CODE-128C do MOC 7.0, Anexo II. O nome do emitente não está no XML do
 * evento: vem do documento quando ele é passado; sem ele, sai o CNPJ/CPF do autor.
 */

import * as f from '../format.ts';
import type { EnderecoView } from '../input/nfe.ts';
import type { Documento } from '../model.ts';
import { Canvas, lineHeight } from '../render/canvas.ts';
import { toWinAnsi, wrap } from '../render/text.ts';
import type { DaOpcoes } from './common.ts';
import { barcode, DocBuilder, drawLogo } from './common.ts';
import { marcas } from './marcas.ts';

/** Campo de uma linha: rótulo, valor e se o valor sai em negrito. */
export type Celula = readonly [rotulo: string, valor: string, negrito?: boolean];

/** O que o leiaute imprime, já tirado do XML do evento e, quando passado, do documento. */
export interface EventoImpresso {
  /** Nome do evento no topo (ex.: `CANCELAMENTO DO MDF-e`). */
  readonly nome: string;
  /** O documento do evento, com o artigo das frases (`da NF-e`, `do MDF-e`). */
  readonly documento: { readonly sigla: 'NF-e' | 'NFC-e' | 'MDF-e'; readonly artigo: 'da' | 'do' };
  readonly chave: string;
  readonly cOrgao: string;
  readonly tpAmb: string;
  readonly autor: string;
  readonly dhEvento: string;
  readonly tpEvento: string;
  readonly nSeqEvento: string;
  readonly ret?: {
    readonly cStat: string;
    readonly xMotivo: string;
    readonly nProt: string;
    readonly dhRegEvento: string;
  };
  readonly emitente?: { readonly xNome: string; readonly ender: EnderecoView };
  /** Número, série, emissão e mais um dado do documento, quando ele é passado. */
  readonly linhaDoDocumento?: readonly Celula[];
  /** Campos próprios do tipo, uma linha por item, dividida em partes iguais. */
  readonly campos: readonly (readonly Celula[])[];
  /** Textos longos, que continuam na folha seguinte quando não cabem. */
  readonly quadros: readonly { readonly titulo: string; readonly texto: string; readonly tamanho: number }[];
  /** Título do `Documento`. */
  readonly titulo: string;
}

const X = 8;
const W = 194;
const RH = 8.5;
const PAGE_H = 297;
const BOTTOM = 289;

export function eventoLayout(ev: EventoImpresso, options: DaOpcoes): Documento {
  const b = new DocBuilder(options);
  const pages: Canvas[] = [];
  let c = new Canvas('Times-Roman', 'Times-Bold');
  pages.push(c);
  let y = 8;
  const emit = ev.emitente;
  c.rect(X, y, W, 26);
  let tx = X;
  let tw = W;
  if (b.logo) {
    const lw = drawLogo(c, b, X + 1.5, y + 1.5, 30, 23, 'l');
    tx = X + lw + 3;
    tw = W - lw - 4.5;
  }
  c.text(ev.nome, tx, y + 7, tw, { font: c.bold, size: 14, align: 'c' });
  c.text(emit?.xNome ?? `CNPJ/CPF DO AUTOR: ${f.cnpjCpf(ev.autor)}`, tx, y + 13, tw, {
    font: c.bold,
    size: 10,
    align: 'c',
  });
  if (emit) {
    const e = emit.ender;
    const end = [[e.xLgr, e.nro].filter(Boolean).join(', '), e.xBairro, [e.xMun, e.UF].filter(Boolean).join(' - ')];
    c.text(end.filter(Boolean).join(' - '), tx, y + 17.5, tw, { size: 8, align: 'c' });
  }
  c.text(
    `Não possui valor fiscal, simples representação do evento indicado abaixo. Consulte a autenticidade no portal ${ev.documento.artigo} ${ev.documento.sigla}.`,
    tx,
    y + 22.5,
    tw,
    { size: 7, align: 'c' },
  );
  y += 28;
  c.rect(X, y, W, 14);
  barcode(c, ev.chave, X + 40, y + 2, W - 80, 10);
  y += 14;
  const doc = `${ev.documento.artigo.toUpperCase()} ${ev.documento.sigla}`;
  c.field(X, y, W, RH, `CHAVE DE ACESSO ${doc}`, f.chave(ev.chave), { bold: true, size: 10, align: 'c' });
  y += RH;
  const row = (cells: readonly Celula[]): void => {
    const w = W / cells.length;
    cells.forEach(([label, value, bold], i) => {
      c.field(X + i * w, y, w, RH, label, value, { size: 10, ...(bold ? { bold: true } : {}) });
    });
    y += RH;
  };
  row([
    ['ÓRGÃO', ev.cOrgao],
    ['AMBIENTE', ev.tpAmb === '1' ? '1 - PRODUÇÃO' : '2 - HOMOLOGAÇÃO'],
    ['CNPJ/CPF DO AUTOR', f.cnpjCpf(ev.autor)],
    ['DATA E HORA DO EVENTO', f.dataHora(ev.dhEvento)],
  ]);
  row([
    ['CÓDIGO DO EVENTO', ev.tpEvento],
    ['SEQUÊNCIA DO EVENTO', ev.nSeqEvento],
    ['PROTOCOLO', ev.ret?.nProt ?? '', true],
    ['DATA E HORA DO REGISTRO', f.dataHora(ev.ret?.dhRegEvento)],
  ]);
  if (ev.linhaDoDocumento) row(ev.linhaDoDocumento);
  c.field(X, y, W, RH, 'STATUS', ev.ret ? `${ev.ret.cStat} - ${ev.ret.xMotivo}` : '', { size: 10 });
  y += RH + 3;
  if (ev.campos.length > 0) {
    c.title('DADOS DO EVENTO', X, y, W);
    y += 4.2;
    for (const linha of ev.campos) row(linha);
    y += 3;
  }
  // Texto longo (a correção da CC-e passa de uma folha): não se confia que caiba numa.
  const box = (title: string, text: string, size: number): void => {
    const lh = lineHeight(size);
    let lines = wrap(toWinAnsi(text.trim()), c.regular, size, W - 3);
    let t = title;
    while (lines.length > 0) {
      if (y + 4.2 + 2 * lh + 3 > BOTTOM) {
        c = new Canvas('Times-Roman', 'Times-Bold');
        pages.push(c);
        y = 8;
        t = `${title} (CONTINUAÇÃO)`;
      }
      const cap = Math.max(1, Math.floor((BOTTOM - y - 4.2 - 3) / lh));
      const part = lines.slice(0, cap);
      lines = lines.slice(cap);
      const hh = Math.max(12, part.length * lh + 3);
      c.title(t, X, y, W);
      y += 4.2;
      c.rect(X, y, W, hh);
      c.para(part, X + 1.5, y + 1.5, hh, c.regular, size);
      y += hh + 3;
    }
  };
  for (const q of ev.quadros) box(q.titulo, q.texto, q.tamanho);
  for (const p of pages) {
    const bg = new Canvas('Times-Roman', 'Times-Bold');
    marcas(bg, 210, PAGE_H, ev.tpAmb, undefined, undefined);
    b.page(210, PAGE_H, p, bg);
  }
  return b.build(ev.titulo);
}
