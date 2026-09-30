/**
 * DACCE, a representação impressa da Carta de Correção Eletrônica (evento 110110). O MOC não define leiaute de DACCE:
 * segue a convenção de mercado (cabeçalho, chave com código de barras, dados do evento, texto da correção e condições
 * de uso), com os mínimos de fonte e o CODE-128C do MOC 7.0, Anexo II. O nome do emitente não está no XML do evento:
 * vem da NF-e quando ela é passada; sem ela, sai o CNPJ/CPF do autor.
 */

import * as f from '../format.ts';
import type { EventoView } from '../input/evento.ts';
import type { NotaView } from '../input/nfe.ts';
import type { Documento } from '../model.ts';
import { Canvas, lineHeight } from '../render/canvas.ts';
import { toWinAnsi, wrap } from '../render/text.ts';
import type { DaOpcoes } from './common.ts';
import { barcode, DocBuilder, drawLogo } from './common.ts';
import { marcas } from './marcas.ts';

export interface DacceOpcoes extends DaOpcoes {
  /** `nfeProc` da nota corrigida, para o nome e o endereço do emitente no cabeçalho. */
  readonly nfe?: string;
}

const X = 8;
const W = 194;
const RH = 8.5;
const PAGE_H = 297;
const BOTTOM = 289;

export function dacceLayout(ev: EventoView, nota: NotaView | undefined, options: DaOpcoes): Documento {
  const b = new DocBuilder(options);
  const pages: Canvas[] = [];
  let c = new Canvas('Times-Roman', 'Times-Bold');
  pages.push(c);
  let y = 8;
  const emit = nota?.emit;
  c.rect(X, y, W, 26);
  let tx = X;
  let tw = W;
  if (b.logo) {
    const lw = drawLogo(c, b, X + 1.5, y + 1.5, 30, 23, 'l');
    tx = X + lw + 3;
    tw = W - lw - 4.5;
  }
  c.text('CARTA DE CORREÇÃO ELETRÔNICA', tx, y + 7, tw, { font: c.bold, size: 14, align: 'c' });
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
    'Não possui valor fiscal, simples representação do evento indicado abaixo. Consulte a autenticidade no portal da NF-e.',
    tx,
    y + 22.5,
    tw,
    { size: 7, align: 'c' },
  );
  y += 28;
  c.rect(X, y, W, 14);
  barcode(c, ev.chNFe, X + 40, y + 2, W - 80, 10);
  y += 14;
  c.field(X, y, W, RH, 'CHAVE DE ACESSO DA NF-e', f.chave(ev.chNFe), { bold: true, size: 10, align: 'c' });
  y += RH;
  const w4 = W / 4;
  const row = (cells: readonly (readonly [string, string, boolean?])[]): void => {
    cells.forEach(([label, value, bold], i) => {
      c.field(X + i * w4, y, w4, RH, label, value, { size: 10, ...(bold ? { bold: true } : {}) });
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
  if (nota) {
    row([
      ['NÚMERO DA NF-e', f.numero(nota.nNF)],
      ['SÉRIE', f.serie(nota.serie)],
      ['DATA DE EMISSÃO', f.data(nota.dhEmi)],
      ['DESTINATÁRIO', nota.dest?.xNome ?? ''],
    ]);
  }
  c.field(X, y, W, RH, 'STATUS', ev.ret ? `${ev.ret.cStat} - ${ev.ret.xMotivo}` : '', { size: 10 });
  y += RH + 3;
  // Texto da correção: pode passar de uma folha (1.000 caracteres a 10 pt cabem numa, mas não se confia nisso).
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
  box('CORREÇÃO', String(ev.det.xCorrecao ?? ''), 10);
  box('CONDIÇÕES DE USO', String(ev.det.xCondUso ?? ''), 7);
  for (const p of pages) {
    const bg = new Canvas('Times-Roman', 'Times-Bold');
    marcas(bg, 210, PAGE_H, ev.tpAmb, undefined, undefined);
    b.page(210, PAGE_H, p, bg);
  }
  return b.build(`DACCE ${ev.chNFe}`);
}
