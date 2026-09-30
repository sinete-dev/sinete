/**
 * DAMDFE em A4 retrato (MOC MDF-e 3.00a, Anexo II, 2.7: modelos rodoviário, aéreo, aquaviário e ferroviário, em
 * emissão normal e em contingência). QR Code de `infMDFeSupl/qrCodMDFe` com no mínimo 25 mm (2.3 e 2.6.2), CODE-128C
 * da chave com barras de 1,5 a 2,5 cm de altura numa área de 3 x 9 cm (2.2). Em contingência, "EMISSÃO EM
 * CONTINGÊNCIA" no lugar do protocolo e a composição da carga com as chaves dos documentos (2.4); em homologação,
 * "EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL" no mesmo lugar (2.5). Sem protocolo de autorização fora
 * da contingência, "SEM PROTOCOLO DE AUTORIZAÇÃO DE USO - SEM VALOR FISCAL" no mesmo lugar e a marca "SEM VALOR
 * FISCAL"; o MDF-e não tem denegação (MOC MDF-e 3.00b, Visão Geral, 4.2.6).
 *
 * O DAMDFE pode ter quantas folhas forem necessárias (2.1); as seguintes repetem a identificação do manifesto.
 */

import { MARCAS } from '../data/leiaute.ts';
import { CONSULTA_MDFE } from '../data/leiaute-mdfe.ts';
import * as f from '../format.ts';
import { cancelamentoMdfe } from '../input/cancelamento-mdfe.ts';
import type { MdfeView } from '../input/mdfe.ts';
import type { Documento } from '../model.ts';
import { Canvas, lineHeight } from '../render/canvas.ts';
import { ascentMm, toWinAnsi, widthMm, wrap } from '../render/text.ts';
import type { DaOpcoes } from './common.ts';
import { barcode, DocBuilder, drawLogo, qrcode } from './common.ts';
import type { Cancelamento } from './marcas.ts';
import { carimbo, marcas, protocoloDeUso, situacaoMdfe } from './marcas.ts';

export interface DamdfeOpcoes extends DaOpcoes {
  /**
   * Lista dos documentos vinculados (composição da carga). Padrão: só em contingência, onde é obrigatória (2.4); a
   * lista pode ser longa e ocupar várias folhas.
   */
  readonly documentos?: boolean;
  /**
   * Carimbo de MDF-e cancelado: o `procEventoMDFe` do cancelamento (110111), que dá o protocolo e a data do evento ao
   * carimbo (o evento tem de ser deste MDF-e e ter retorno registrado, senão `evento_incompativel`), o protocolo e a
   * data já lidos, ou `true` para carimbar sem protocolo. Sem ele, o `protMDFe` com cStat 101 também carimba, sem o
   * protocolo do evento.
   */
  readonly cancelado?: boolean | string | { readonly nProt: string; readonly dhRegEvento: string };
}

const X = 8;
const W = 194;
const PAGE_W = 210;
const PAGE_H = 297;
const BOTTOM = 289;
const MODAL: Readonly<Record<string, string>> = {
  '1': 'Modelo Rodoviário de Carga',
  '2': 'Modelo Aéreo de Carga',
  '3': 'Modelo Aquaviário de Carga',
  '4': 'Modelo Ferroviário de Carga',
};

export function damdfeLayout(m: MdfeView, options: DamdfeOpcoes): Documento {
  const b = new DocBuilder(options);
  const contingencia = m.tpEmis === '2';
  const situacao = situacaoMdfe(m);
  // Autorizado, encerrado ou cancelado pelo cStat do protocolo: o protocolo de autorização (ADR 0006, decisão 15).
  const prot = protocoloDeUso(situacao);
  const pages: Canvas[] = [];
  let c = new Canvas('Helvetica', 'Helvetica-Bold');
  let y = 8;
  const label = (s: string, x: number, yy: number, w: number): void => {
    c.text(s, x, yy + ascentMm(c.regular, 6), w, { size: 6 });
  };
  const value = (s: string, x: number, yy: number, w: number, bold = true, size = 8): void => {
    c.text(s, x, yy + ascentMm(c.bold, size), w, { font: bold ? c.bold : c.regular, size });
  };

  // Cabeçalho: emitente e QR Code em todas as folhas; identificação do manifesto numa faixa de campos.
  const header = (folha: number, total: number): void => {
    let tx = X;
    if (b.logo) {
      drawLogo(c, b, X, y, 26, 14);
      tx = X + 28;
    }
    const tw = X + W - 34 - tx;
    const e = m.emit.ender;
    value(m.emit.xNome, tx, y, tw, true, 9);
    const end = `${[e.xLgr, e.nro].filter(Boolean).join(', ')}${e.xCpl ? ` ${e.xCpl}` : ''}, ${e.xBairro}`;
    c.text(end, tx, y + 7, tw, { size: 7 });
    c.text(`${e.xMun} - ${e.UF}   CEP ${f.cep(e.CEP)}`, tx, y + 10, tw, { size: 7 });
    const rntrc = m.RNTRC ? `   RNTRC: ${m.RNTRC}` : '';
    c.text(`CNPJ/CPF: ${f.cnpjCpf(m.emit.doc)}   IE: ${m.emit.IE}${rntrc}`, tx, y + 13, tw, { font: c.bold, size: 7 });
    if (m.qrCode) qrcode(c, m.qrCode, X + W - 32, y - 2, 32);
    y += 17;
    c.text('DAMDFE - Documento Auxiliar de Manifesto Eletrônico de Documentos Fiscais', X, y + 2.5, W - 36, {
      font: c.bold,
      size: 8,
    });
    y += 4;
    const cells: [string, string, number][] = [
      ['Modelo', '58', 14],
      ['Série', m.serie, 14],
      ['Número', m.nMDF, 22],
      ['FL', `${folha}/${total}`, 14],
      ['Data e hora de Emissão', f.dataHora(m.dhEmi), 40],
      ['UF Carreg.', m.UFIni, 20],
      ['UF Descarreg.', m.UFFim, 20],
    ];
    let x = X;
    for (const [l, v, w] of cells) {
      c.fillRect(x, y, w - 1, 9, 0.88);
      label(l, x + 1, y + 0.8, w - 2);
      value(v, x + 1, y + 4.2, w - 2);
      x += w;
    }
    y += 12;
  };

  // Paginação do fluxo: cada bloco pede a altura que precisa; sem espaço, abre folha nova com o cabeçalho.
  const ensure = (h: number): void => {
    if (y + h <= BOTTOM) return;
    pages.push(c);
    c = new Canvas('Helvetica', 'Helvetica-Bold');
    y = 8;
    header(pages.length + 1, 0);
  };
  const section = (title: string): void => {
    ensure(12);
    c.text(title, X, y + 4, W, { font: c.bold, size: 10 });
    y += 6;
  };
  const table = (
    cols: readonly (readonly [string, number])[],
    rows: readonly (readonly string[])[],
    bold = true,
  ): void => {
    const lh = lineHeight(8);
    const width = cols.reduce((a, [, w]) => a + w, 0);
    const head = (): void => {
      let hx = X;
      for (const [h, w] of cols) {
        c.text(h, hx, y + 2.2, w - 1, { font: c.bold, size: 6 });
        hx += w;
      }
      y += 3;
      c.line(X, y, X + width, y, 0.15);
      y += 0.5;
    };
    ensure(4 + lh);
    head();
    for (const r of rows) {
      const before = pages.length;
      ensure(lh + 0.5);
      // Tabela que continua em outra folha repete a linha de títulos.
      if (pages.length !== before) head();
      let x = X;
      cols.forEach(([, w], i) => {
        c.text(r[i] ?? '', x, y + ascentMm(c.bold, 8), w - 1, { font: bold && i === 0 ? c.bold : c.regular, size: 8 });
        x += w;
      });
      y += lh;
      c.line(X, y, X + cols.reduce((a, [, w]) => a + w, 0), y, 0.1, 0.4);
      y += 0.5;
    }
    y += 2;
  };

  header(1, 0);
  // Modal, totais e código de barras (controle do fisco).
  const top = y;
  c.text(MODAL[m.modal] ?? 'Modelo de Carga', X, y + 4, 90, { font: c.bold, size: 10 });
  y += 7;
  const unid = m.tot.cUnid === '02' ? 'Peso total (Ton)' : 'Peso total (Kg)';
  const totais: [string, string][] = [
    ['Qtd. CT-e', m.tot.qCTe || '0'],
    ['Qtd. NF-e', m.tot.qNFe || '0'],
    ...(m.tot.qMDFe ? ([['Qtd. MDF-e', m.tot.qMDFe]] as [string, string][]) : []),
    [unid, f.num(m.tot.qCarga, 2, 4)],
  ];
  const tw = 88 / totais.length;
  totais.forEach(([l, v], i) => {
    const x = X + i * tw;
    c.fillRect(x, y, tw - 1, 9, 0.88);
    label(l, x + 1, y + 0.8, tw - 2);
    value(v, x + 1, y + 4.2, tw - 2);
  });
  c.fillRect(X, y + 10, 87, 9, 0.88);
  label('Valor da carga (R$)', X + 1, y + 10.8, 85);
  value(f.num(m.tot.vCarga), X + 1, y + 14.2, 85);
  const bx = X + 96;
  const bw = W - 96;
  c.text('CONTROLE DO FISCO', bx, top + 2.5, bw, { size: 6 });
  barcode(c, m.chave, bx, top + 4, bw, 18, 0.3);
  y = top + 28;
  // Protocolo, contingência ou homologação no mesmo lugar (2.4 e 2.5); chave e consulta à direita.
  label('Protocolo de autorização', X, y, 90);
  if (contingencia) {
    c.fillRect(X, y + 3, 90, 9, 0);
    c.block(
      `EMISSÃO EM CONTINGÊNCIA. Obrigatória a autorização em 168 horas após esta emissão (${f.data(m.dhEmi)} ${f.hora(m.dhEmi).slice(0, 5)})`,
      X + 1.2,
      y + 4,
      87.6,
      7.5,
      { font: c.bold, size: 7, gray: 1 },
    );
  } else if (m.tpAmb === '2') {
    value('EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL', X, y + 3.5, 90, true, 7);
  } else if (prot) {
    value(`${prot.nProt} - ${f.dataHora(prot.dhRecbto)}`, X, y + 3.5, 90, false, 8);
  } else if (situacao.tipo !== 'cancelada') {
    // Emissão normal sem protocolo de autorização (ou com cStat que não é o 100): o manual não prevê o caso; o aviso
    // segue o de homologação (2.5), no mesmo lugar e em caixa alta.
    value(`${MARCAS.semProtocolo} - ${MARCAS.semValor}`, X, y + 3.5, 90, true, 7);
  }
  label('Chave de Acesso', bx, y, bw);
  value(f.chave(m.chave), bx, y + 3.5, bw, false, 8);
  c.text(`Consulte em ${CONSULTA_MDFE.url}`, bx, y + 10, bw, { font: c.bold, size: 7 });
  y += 15;

  // Veículos, condutores e vale-pedágio (rodoviário).
  if (m.modal === '1' || m.veiculos.length > 0) {
    section('Veículo');
    table(
      [
        ['Placa', 30],
        ['RNTRC', 30],
        ['UF', 20],
      ],
      m.veiculos.map((v) => [v.placa, v.RNTRC, v.UF]),
    );
    if (m.condutores.length > 0) {
      section('Condutor');
      table(
        [
          ['CPF', 30],
          ['Nome', 100],
        ],
        m.condutores.map((d) => [f.cnpjCpf(d.CPF), d.xNome]),
      );
    }
    if (m.valePed.length > 0) {
      section('Vale Pedágio');
      table(
        [
          ['Responsável CNPJ/CPF', 40],
          ['Fornecedor CNPJ', 40],
          ['Nº Comprovante', 50],
        ],
        m.valePed.map((v) => [f.cnpjCpf(v.pagador), f.cnpjCpf(v.CNPJForn), v.nCompra]),
        false,
      );
    }
  }
  if (m.aereo) {
    const a = m.aereo;
    section('Aeronave');
    table(
      [
        ['Nacionalidade', 26],
        ['Matrícula', 26],
        ['Nº do voo', 26],
        ['Aeródromo de embarque', 38],
        ['Aeródromo de destino', 38],
        ['Data do voo', 30],
      ],
      [[a.nac, a.matr, a.nVoo, a.cAerEmb, a.cAerDes, f.data(a.dVoo)]],
    );
  }
  if (m.aquav) {
    const a = m.aquav;
    section('Embarcação');
    table(
      [
        ['Código', 22],
        ['Nome', 58],
        ['IRIN', 24],
        ['Viagem', 20],
        ['Porto de embarque', 35],
        ['Porto de destino', 35],
      ],
      [[a.cEmbar, a.xEmbar, a.irin, a.nViag, a.cPrtEmb, a.cPrtDest]],
    );
  }
  if (m.ferrov) {
    const t = m.ferrov;
    section('Trem');
    table(
      [
        ['Prefixo', 30],
        ['Data e hora', 40],
        ['Origem', 45],
        ['Destino', 45],
        ['Vagões', 20],
      ],
      [[t.xPref, f.dataHora(t.dhTrem), t.xOri, t.xDest, t.qVag]],
    );
  }
  if (options.documentos ?? contingencia) {
    section('Informações da Composição da Carga');
    table(
      [
        ['Informações dos documentos fiscais vinculados ao manifesto', 104],
        ['Informações da unidade de transporte', 45],
        ['Informações da unidade de carga', 45],
      ],
      m.docs.map((d) => [`${d.tipo} - ${f.chave(d.chave)}`, d.unidTransp, d.unidCarga]),
      false,
    );
  }
  section('Observações');
  const obs = wrap(toWinAnsi([m.infAdFisco, m.infCpl].filter(Boolean).join(' ')), c.regular, 7, W);
  c.line(X, y - 0.5, X + W, y - 0.5, 0.15);
  for (const l of obs) {
    ensure(lineHeight(7));
    c.raw(l, X, y + ascentMm(c.regular, 7), c.regular, 7);
    y += lineHeight(7);
  }
  pages.push(c);

  // O total de folhas só é conhecido agora: o "FL x/y" de cada folha é refeito com ele.
  const total = pages.length;
  // O cancelamento passado pelo chamador prevalece sobre o cStat 101 no protocolo.
  const cancel: Cancelamento | undefined = carimbo(
    situacao,
    options.cancelado === undefined || options.cancelado === false
      ? undefined
      : options.cancelado === true
        ? { rotulo: 'CANCELADO' }
        : typeof options.cancelado === 'string'
          ? { ...cancelamentoMdfe(m, options.cancelado), rotulo: 'CANCELADO' }
          : { ...options.cancelado, rotulo: 'CANCELADO' },
    'CANCELADO',
  );
  pages.forEach((p, i) => {
    const fl = p.ops.findIndex((op) => op.t === 'texto' && /^\d+\/0$/.test(op.s));
    const op = p.ops[fl];
    if (op && op.t === 'texto') {
      const s = `${i + 1}/${total}`;
      p.ops[fl] = { ...op, s, w: widthMm(s, op.fonte, op.tamanho) };
    }
    const bg = new Canvas('Helvetica', 'Helvetica-Bold');
    marcas(bg, PAGE_W, PAGE_H, m.tpAmb, situacao, cancel, MARCAS.contingenciaMdfe);
    b.page(PAGE_W, PAGE_H, p, bg);
  });
  return b.build(`DAMDFE ${m.chave}`);
}
