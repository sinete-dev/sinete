/**
 * DANFE Simplificado (MOC 7.0, Anexo II, 3.11; `tpImp` = 3) e DANFE Simplificado - Etiqueta (3.12, NT 2020.004).
 * Papel com largura mínima de 55 mm, fonte de no mínimo 6 pt com títulos em negrito e caixa alta, chave e código de
 * barras no canto superior direito, em qualquer sentido: com largura útil menor que a do CODE-128C no módulo mínimo,
 * as barras vão na vertical, à direita.
 */

import { code128Chave, modules, QUIET_MODULES } from '../barcode/code128.ts';
import * as f from '../format.ts';
import type { NotaView } from '../input/nfe.ts';
import type { Documento } from '../model.ts';
import { Canvas } from '../render/canvas.ts';
import type { DaOpcoes } from './common.ts';
import { barcode, barcodeVertical, DocBuilder, drawLogo, moduloMinimo } from './common.ts';
import type { Cancelamento, Situacao } from './marcas.ts';
import { avisoSituacao, marcas, protocoloDeUso } from './marcas.ts';

export interface SimplificadoOpcoes extends DaOpcoes {
  /** Largura do papel em mm (mínimo 55; padrão 80, e 100 na etiqueta). */
  readonly largura?: number;
  /** Protocolo do EPEC (3.12.4, f), quando `tpEmis` = 4. */
  readonly epec?: { readonly nProt: string; readonly dhRegEvento: string };
}

const M = 3;
const BODY = 7;

export function simplificado(
  nota: NotaView,
  etiqueta: boolean,
  options: SimplificadoOpcoes,
  situacao: Situacao,
  cancel?: Cancelamento,
): Documento {
  const largura = Math.max(55, options.largura ?? (etiqueta ? 100 : 80));
  const b = new DocBuilder(options);
  const c = new Canvas('Times-Roman', 'Times-Bold');
  const W = largura - 2 * M;
  let y = M;
  const barWidths = code128Chave(nota.chave);
  const barLen = (modules(barWidths) + 2 * QUIET_MODULES) * moduloMinimo(barWidths);
  const vertical = W < barLen;
  const barH = 10;
  // Com barras na vertical, o topo do conteúdo fica mais estreito até o fim delas.
  let colW = vertical ? W - barH - 2 : W;
  let barEnd = 0;
  if (vertical) barEnd = M + barcodeVertical(c, nota.chave, M + W - barH, M, barH);

  const text = (s: string, o: { bold?: boolean; size?: number; align?: 'l' | 'c' | 'r' } = {}): void => {
    if (vertical && y >= barEnd) colW = W;
    y += c.block(s, M, y, colW, Number.POSITIVE_INFINITY, {
      font: o.bold ? c.bold : c.regular,
      size: o.size ?? BODY,
      align: o.align ?? 'l',
    });
  };
  const titled = (title: string, value: string): void => {
    text(title, { bold: true, size: 6.5 });
    if (value) text(value);
    y += 0.8;
  };

  if (b.logo) {
    drawLogo(c, b, M, y, Math.min(24, colW), 10);
    y += 11;
  }
  text(etiqueta ? 'DANFE SIMPLIFICADO - ETIQUETA' : 'DANFE SIMPLIFICADO', { bold: true, size: 10, align: 'c' });
  y += 0.8;
  if (!vertical) {
    barcode(c, nota.chave, M, y, W, barH);
    y += barH + 1;
  }
  titled('CHAVE DE ACESSO', '');
  y -= 0.8;
  text(f.chave(nota.chave), { bold: true, align: vertical ? 'l' : 'c' });
  y += 0.8;
  // A denegação vem antes do EPEC, como no DANFE A4.
  const epec = nota.tpEmis === '4' && options.epec;
  if (situacao.tipo === 'denegada')
    titled('PROTOCOLO DE DENEGAÇÃO DE USO', `${situacao.nProt} ${f.dataHora(situacao.dhRecbto)}`);
  else if (epec) titled('PROTOCOLO DE AUTORIZAÇÃO DO EPEC', `${epec.nProt} ${f.dataHora(epec.dhRegEvento)}`);
  else {
    const prot = protocoloDeUso(situacao);
    titled('PROTOCOLO DE AUTORIZAÇÃO DE USO', prot ? `${prot.nProt} ${f.dataHora(prot.dhRecbto)}` : '');
  }
  if (vertical) y = Math.max(y, barEnd + 1);
  colW = W;
  c.line(M, y, M + W, y);
  y += 1;
  titled(
    'EMITENTE',
    `${nota.emit.xNome} - CNPJ/CPF: ${f.cnpjCpf(nota.emit.doc)} - IE: ${nota.emit.IE} - UF: ${nota.emit.ender.UF}`,
  );
  titled(
    'NF-e',
    `${nota.tpNF === '0' ? '0 - ENTRADA' : '1 - SAÍDA'}  SÉRIE ${f.serie(nota.serie)}  Nº ${f.numero(nota.nNF)}  EMISSÃO: ${f.data(nota.dhEmi)}`,
  );
  const d = nota.dest;
  const destIe = etiqueta && d?.IE ? ` - IE: ${d.IE}` : '';
  titled(
    'DESTINATÁRIO/REMETENTE',
    d ? `${d.xNome} - CNPJ/CPF: ${f.cnpjCpf(d.doc)}${destIe} - UF: ${d.ender?.UF ?? ''}` : '',
  );
  if (!etiqueta) {
    c.line(M, y, M + W, y);
    y += 1;
    text('DESCRIÇÃO / UN / QTDE / VALOR UNIT. / VALOR TOTAL', { bold: true, size: 6.5 });
    for (const it of nota.itens) {
      text(it.xProd, { size: 6.5 });
      // Valores alinhados à direita; sem espaço, reduzem até 6 pt e quebram (ADR 0006, decisão 7).
      text(`${it.uCom}  ${f.num(it.qCom, 0, 4)}  X  ${f.num(it.vUnCom, 2, 10)}  =  ${f.num(it.vProd)}`, {
        size: 6.5,
        align: 'r',
      });
      y += 0.3;
    }
  }
  c.line(M, y, M + W, y);
  y += 1;
  text(`VALOR TOTAL DA NF-e: R$ ${f.num(nota.tot.vNF)}`, { bold: true, size: 9, align: 'r' });
  const aviso = avisoSituacao(situacao);
  if (aviso) text(aviso, { bold: true, align: 'c' });
  if (nota.tpAmb === '2') text('EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL', { bold: true, align: 'c' });
  const H = Math.max(y, barEnd) + M;
  const bg = new Canvas('Times-Roman', 'Times-Bold');
  marcas(bg, largura, H, nota.tpAmb, situacao, cancel);
  b.page(largura, H, c, bg);
  return b.build(`DANFE Simplificado ${nota.chave}`);
}
