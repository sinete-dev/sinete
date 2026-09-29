/**
 * DANFSe v2 em A4 retrato numa página só (NT SE/CGNFS-e 008/2026 v1.02): o modelo do Anexo I com as posições e os
 * tamanhos do 2.4.5 (`data/leiaute-danfse.ts`). Blocos, na ordem do anexo: cabeçalho (2.4.3), identificação da
 * NFS-e com o QR Code (2.1.1 e 2.1.2), prestador (2.1.3), tomador (2.1.4), destinatário (2.1.5), intermediário
 * (2.1.6), serviço (2.1.7), tributação municipal (2.1.8), federal (2.1.9) e IBS/CBS (2.1.10), valor total (2.1.11),
 * informações complementares (2.1.12) e canhoto opcional (2.1.13).
 *
 * A página é uma só (2.2), então a altura que sobra dos blocos fixos vai para a descrição do serviço e para as
 * informações complementares, os dois quadros que a NT deixa crescer (2.3.1 a 2.3.3), e o que não cabe termina em
 * reticências (2.1). A linha dos tributos aproximados é fixa e nunca é cortada (2.4.5, informações complementares).
 * Conteúdo nunca abaixo de 7 pt (2.4.3 e 2.4.4); campo sem dado no XML sai com traço (nota 12).
 */

import { ufByCUf } from '@sinete/core';
import { base64Decode } from '@sinete/core/xml';
import { qrMatrix } from '../barcode/qr.ts';
import {
  CABECALHO_DANFSE,
  GRADE_DANFSE,
  OPCOES_DANFSE,
  QR_DANFSE,
  RETENCAO_PIS_COFINS,
  TEXTOS_DANFSE,
} from '../data/leiaute-danfse.ts';
import { LOGO_NFSE_PNG_B64 } from '../data/logo-nfse.ts';
import * as f from '../format.ts';
import type { EnderecoNfseView, NfseView, PessoaNfseView } from '../input/nfse.ts';
import type { Doc } from '../model.ts';
import { Canvas, lineHeight } from '../render/canvas.ts';
import { ascentMm, toWinAnsi, widthMm, wrap } from '../render/text.ts';
import { DocBuilder, drawLogo, watermark } from './common.ts';

export interface DanfseOptions {
  /**
   * NFS-e cancelada (NT 008/2026, 2.5.1): o `evento` registrado de cancelamento (e101101), de cancelamento deferido
   * por análise fiscal (e105104) ou de cancelamento por ofício (e305101), que precisa ser desta NFS-e, ou `true`.
   */
  readonly cancelamento?: string | true;
  /**
   * NFS-e substituída (2.5.2): o `evento` registrado de cancelamento por substituição (e105102) desta NFS-e, ou
   * `true`.
   */
  readonly substituicao?: string | true;
  /** Canhoto (2.1.13 e 2.3.3: opcional). Padrão: com canhoto, como no Anexo I. */
  readonly canhoto?: boolean;
  /**
   * Nome do município pelo código IBGE, para os endereços (2.4.5: "Utilizar a descrição destes códigos"). O XML só
   * traz o nome dos municípios de emissão, de prestação e de incidência; os outros saem com o código quando o
   * chamador não resolve o nome.
   */
  readonly nomeMunicipio?: (cMun: string) => string | undefined;
}

/** Marca d'água do documento (2.5.1 e 2.5.2). */
export type MarcaDanfse = 'cancelada' | 'substituida';

const G: typeof GRADE_DANFSE = GRADE_DANFSE;
const T: typeof CABECALHO_DANFSE.tamanhos = CABECALHO_DANFSE.tamanhos;
const [C1, C2, C3, C4]: readonly [number, number, number, number] = G.colunas;
const CW: number = G.coluna;
const PAD = 0.8;
const LH = lineHeight(T.conteudo);

type Campo = readonly [rotulo: string, valor: string, x: number, w: number];

function opcao(grupo: string, v: string): string {
  return v ? (OPCOES_DANFSE.opcoes[grupo]?.[v] ?? v) : '';
}

function dash(v: string | undefined): string {
  return v?.trim() ? v : TEXTOS_DANFSE.vazio;
}

function reais(v: string | undefined): string {
  return v?.trim() ? `R$ ${f.num(v)}` : TEXTOS_DANFSE.vazio;
}

function pct(v: string | undefined): string {
  return v?.trim() ? `${f.num(v)}%` : TEXTOS_DANFSE.vazio;
}

/**
 * CEP como no exemplo da NT (2.4.5): `nn.nnn-nnn`. A Sefin já devolveu o CEP do emitente com sete dígitos, sem o zero
 * à esquerda (produção restrita, 28/09/2026); o CEP tem sempre oito, então o zero volta.
 */
function cep(v: string): string {
  const d = /^\d{7}$/.test(v) ? `0${v}` : v;
  return /^\d{8}$/.test(d) ? `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}` : v;
}

/** Código de tributação nacional `nn.nn.nn` e municipal, e NBS `n.nnnn.nn.nn` (2.4.5). */
function cTrib(nac: string, mun: string): string {
  const n = /^\d{6}$/.test(nac) ? `${nac.slice(0, 2)}.${nac.slice(2, 4)}.${nac.slice(4)}` : nac;
  return [n, mun].filter(Boolean).join(' / ');
}

function nbs(v: string): string {
  return /^\d{9}$/.test(v) ? `${v.slice(0, 1)}.${v.slice(1, 5)}.${v.slice(5, 7)}.${v.slice(7)}` : v;
}

function docPessoa(p: PessoaNfseView | undefined): string {
  if (!p) return '';
  return p.CNPJ ? f.cnpjCpf(p.CNPJ) : p.CPF ? f.cnpjCpf(p.CPF) : p.NIF;
}

function endereco(e: EnderecoNfseView | undefined): string {
  return e ? [e.xLgr, e.nro, e.xCpl, e.xBairro].filter(Boolean).join(', ') : '';
}

export function danfseLayout(n: NfseView, options: DanfseOptions, marca: MarcaDanfse | undefined): Doc {
  const b = new DocBuilder({ logo: base64Decode(LOGO_NFSE_PNG_B64) });
  const c = new Canvas('Helvetica', 'Helvetica-Bold');
  const d = n.dps;
  const ibs = n.ibscbs;

  // Nomes de município que o próprio XML traz; os demais vêm do chamador ou ficam com o código.
  const nomes = new Map<string, string>();
  const nome = (cod: string, x: string): void => {
    if (cod && x) nomes.set(cod, x);
  };
  nome(d.cLocEmi, n.xLocEmi);
  nome(d.serv.cLocPrestacao, n.xLocPrestacao);
  nome(n.cLocIncid, n.xLocIncid);
  if (ibs) nome(ibs.cLocalidadeIncid, ibs.xLocalidadeIncid);
  const uf = (cod: string): string => ufByCUf(cod.slice(0, 2))?.sigla ?? '';
  const municipio = (cod: string): string => {
    if (!cod) return '';
    return [nomes.get(cod) ?? options.nomeMunicipio?.(cod) ?? cod, uf(cod)].filter(Boolean).join(' / ');
  };
  const municipioEnd = (e: EnderecoNfseView | undefined): string => {
    if (!e) return '';
    if (e.cMun) return municipio(e.cMun);
    return [e.xCidade, e.xEstProvReg].filter(Boolean).join(' / ');
  };
  const ibgeCep = (e: EnderecoNfseView | undefined): string => {
    if (!e) return '';
    if (e.cMun) return [e.cMun, cep(e.CEP)].filter(Boolean).join(' / ');
    return e.cEndPost;
  };

  // O prestador na DPS emitida por ele mesmo costuma trazer só o documento e o regime: nome, endereço e contato
  // saem do grupo do emitente, que está no mesmo XML (2.1: só o que consta do arquivo).
  const doPrestador = (d.prest.CNPJ && d.prest.CNPJ === n.emit.CNPJ) || (d.prest.CPF && d.prest.CPF === n.emit.CPF);
  const prest: PessoaNfseView = doPrestador
    ? {
        ...d.prest,
        IM: d.prest.IM || n.emit.IM,
        xNome: d.prest.xNome || n.emit.xNome,
        fone: d.prest.fone || n.emit.fone,
        email: d.prest.email || n.emit.email,
        ...((d.prest.end ?? n.emit.end) ? { end: d.prest.end ?? n.emit.end } : {}),
      }
    : d.prest;

  // Primitivas: divisória de 0,5 pt no topo de cada bloco e rótulo do bloco em fundo cinza (2.2.3).
  const divisoria = (y: number): void => c.line(G.x, y, G.x + G.w, y, G.divisoria);
  const tituloBloco = (s: string, y: number, h: number): void => {
    c.fillRect(C1, y, CW, h, G.sombra);
    c.text(s, C1 + PAD, y + 0.7 + ascentMm(c.bold, T.rotuloBloco), CW - 2 * PAD, {
      font: c.bold,
      size: T.rotuloBloco,
      min: T.rotuloBloco,
      fixo: true,
    });
  };
  const campo = (
    rotulo: string,
    valor: string | null,
    x: number,
    y: number,
    w: number,
    rotuloSize = T.rotuloCampo,
  ): void => {
    const base = y + 0.6 + ascentMm(c.bold, rotuloSize);
    c.text(rotulo, x + PAD, base, w - 2 * PAD, { font: c.bold, size: rotuloSize, min: rotuloSize, fixo: true });
    // null: campo de preenchimento à mão (canhoto), sem o traço da nota 12.
    if (valor === null) return;
    c.text(dash(valor), x + PAD, base + 0.8 + ascentMm(c.regular, T.conteudo), w - 2 * PAD, {
      size: T.conteudo,
      min: T.conteudo,
    });
  };
  const linha = (campos: readonly Campo[], y: number): void => {
    for (const [r, v, x, w] of campos) campo(r, v, x, y, w);
  };
  const faixa = (s: string, y: number): void => {
    divisoria(y);
    c.text(s, G.x, y + (G.blocoSuprimido + ascentMm(c.regular, T.conteudo)) / 2, G.w, {
      size: T.conteudo,
      min: T.conteudo,
      align: 'c',
      fixo: true,
    });
  };

  // Bloco de pessoa: prestador, tomador, destinatário e intermediário (2.1.3 a 2.1.6), três linhas de campos.
  const pessoa = (titulo: string, p: PessoaNfseView, im: boolean, y: number): number => {
    divisoria(y);
    tituloBloco(titulo, y, G.linha);
    linha(
      [
        ['CNPJ / CPF / NIF', docPessoa(p), C2, CW],
        ...(im ? ([['Indicador Municipal (Inscrição)', p.IM, C3, CW]] as const) : []),
        ['Telefone', f.fone(p.fone), C4, CW],
      ],
      y,
    );
    linha(
      [
        ['Nome / Nome Empresarial', p.xNome, C1, 2 * CW + (C2 - C1 - CW)],
        ['Município / Sigla UF', municipioEnd(p.end), C3, CW],
        ['Código IBGE / CEP', ibgeCep(p.end), C4, CW],
      ],
      y + G.linha,
    );
    linha(
      [
        ['Endereço', endereco(p.end), C1, C3 - C1],
        ['E-mail', p.email, C3, G.x + G.w - C3],
      ],
      y + 2 * G.linha,
    );
    return 3 * G.linha;
  };

  // ISSQN (2.1.8): linhas com ** (nota 5) saem só com algum dado. O regime especial "Nenhum" (0) é o valor padrão
  // do leiaute e não conta como dado.
  const v = d.valores;
  const semIssqn = v.tribISSQN === '4';
  const linhaRegime = [d.prest.regEspTrib === '0' ? '' : d.prest.regEspTrib, v.tpImunidade, v.tpSusp, v.nProcesso].some(
    Boolean,
  );
  const calcBm = n.valores.vCalcBM || v.vRedBCBM;
  const dedRed = n.valores.vCalcDR || v.vDR;
  const totalDedRed = dedRed || ibs?.valores.vCalcReeRepRes ? f.soma2(dedRed, ibs?.valores.vCalcReeRepRes) : '';
  const linhaBm = [n.valores.tpBM, calcBm, totalDedRed, v.vDescIncond].some(Boolean);
  const issqnLinhas = 2 + (linhaRegime ? 1 : 0) + (linhaBm ? 1 : 0);
  // Tributação federal (2.1.9): a linha de PIS e COFINS sai até a competência de 2026 (nota 6).
  const linhaPisCofins = !/^\d{4}/.test(d.dCompet) || Number(d.dCompet.slice(0, 4)) <= 2026;

  // Alturas dos blocos fixos; o que sobra é da descrição do serviço e das informações complementares.
  const destTomador = d.ibscbs?.indDest === '0';
  const alturaPessoa = (p: PessoaNfseView | undefined): number => (p ? 3 * G.linha : G.blocoSuprimido);
  const canhoto = options.canhoto !== false;
  const fim = canhoto ? G.canhoto.y - 0.8 : G.fim;
  const fixo =
    G.topo +
    G.cabecalho +
    G.linhaChave +
    3 * G.linhaIdentificacao +
    4 * G.linha +
    alturaPessoa(d.toma) +
    (d.ibscbs?.dest && !destTomador ? 3 * G.linha : G.blocoSuprimido) +
    alturaPessoa(d.interm) +
    G.linha +
    G.descricaoTributacao +
    (semIssqn ? G.blocoSuprimido : issqnLinhas * G.linha) +
    (linhaPisCofins ? 2 : 1) * G.linha +
    4 * G.linha +
    2 * G.linhaTotal +
    G.tituloInformacoes;
  const livre = fim - fixo;

  // Informações complementares (2.1.12 e 2.4.5): a ordem da tabela, separadas por barra vertical, e a linha dos
  // tributos aproximados por último, fixa.
  const I = TEXTOS_DANFSE.informacoes;
  const partes: [string, string][] = [
    [I.infCont, d.serv.xInfComp],
    [I.subst, d.chSubstda],
    [I.docRef, d.serv.docRef],
    [I.obra, d.serv.cObra],
    [I.imovel, d.serv.inscImobFisc || (d.ibscbs?.inscImobFisc ?? '')],
    [I.evento, d.serv.idAtvEvt],
    [I.docTec, d.serv.idDocTec],
    [I.pedido, d.serv.xPed],
    [I.itemPedido, d.serv.xItemPed.join(', ')],
    [I.municipio, n.xOutInf],
  ];
  const corpo = partes
    .filter(([, x]) => x.trim())
    .map(([r, x]) => `${r} ${x}`)
    .join(TEXTOS_DANFSE.separador);
  const tt = d.totTrib;
  const totais = `${TEXTOS_DANFSE.totais} ${
    tt.vTotTribFed || tt.vTotTribEst || tt.vTotTribMun
      ? `Federais: ${reais(tt.vTotTribFed)}; Estaduais: ${reais(tt.vTotTribEst)}; Municipais: ${reais(tt.vTotTribMun)}`
      : tt.pTotTribFed || tt.pTotTribEst || tt.pTotTribMun
        ? `Federais: ${pct(tt.pTotTribFed)}; Estaduais: ${pct(tt.pTotTribEst)}; Municipais: ${pct(tt.pTotTribMun)}`
        : tt.pTotTribSN
          ? `Simples Nacional: ${pct(tt.pTotTribSN)}`
          : `Federais: ${TEXTOS_DANFSE.vazio}; Estaduais: ${TEXTOS_DANFSE.vazio}; Municipais: ${TEXTOS_DANFSE.vazio}`
  }`;
  const larguraTexto = G.w - 2 * PAD;
  const linhasDe = (s: string): number =>
    s.trim() ? wrap(toWinAnsi(s).trim(), c.regular, T.conteudo, larguraTexto).length : 0;
  const totaisH = linhasDe(totais) * LH;
  const topoTexto = ascentMm(c.regular, T.conteudo);
  const rotuloDescricao = 0.6 + ascentMm(c.bold, T.rotuloCampo) + 0.8;
  const precisaDesc = Math.max(G.linha, rotuloDescricao + topoTexto + (linhasDe(d.serv.xDescServ) - 1) * LH + 1.2);
  const precisaInfo = 0.4 + totaisH + (corpo ? linhasDe(corpo) * LH : 0) + 0.4;
  const minInfo = 0.4 + totaisH + 0.4;
  let descH: number;
  let infoH: number;
  if (precisaDesc + precisaInfo <= livre) {
    const extra = (livre - precisaDesc - precisaInfo) / 2;
    descH = precisaDesc + extra;
    infoH = precisaInfo + extra;
  } else if (precisaInfo <= livre / 2) {
    infoH = precisaInfo;
    descH = livre - infoH;
  } else if (precisaDesc <= livre / 2) {
    descH = precisaDesc;
    infoH = livre - descH;
  } else {
    infoH = Math.max(minInfo, livre / 2);
    descH = livre - infoH;
  }

  // Borda da página (2.2.3) e cabeçalho sombreado (2.2.3 e 2.4.3).
  const m = G.borda.margem;
  c.rect(m, m, G.pagina.w - 2 * m, G.pagina.h - 2 * m, G.borda.espessura);
  let y = G.topo;
  c.fillRect(G.x, y, G.w, G.cabecalho - 0.2, G.sombra);
  const L = CABECALHO_DANFSE.logo;
  drawLogo(c, b, L.x, L.y, L.w, L.h, 'l');
  const D = CABECALHO_DANFSE.descricao;
  const lt = lineHeight(T.titulo, 1.2);
  let ty = y + 0.8 + ascentMm(c.bold, T.titulo);
  for (const s of CABECALHO_DANFSE.titulo) {
    c.text(s, D.x, ty, D.w, { font: c.bold, size: T.titulo, min: T.titulo, align: 'c', fixo: true });
    ty += lt;
  }
  if (d.tpAmb === '2') {
    const s = toWinAnsi(CABECALHO_DANFSE.homologacao);
    const tw = widthMm(s, c.bold, T.titulo);
    c.rawRgb(s, D.x + (D.w - tw) / 2, ty, c.bold, T.titulo, CABECALHO_DANFSE.vermelho);
  }
  const M = CABECALHO_DANFSE.municipio;
  // Município do emitente com a UF, fora quando o item do código de tributação nacional é 99 (2.4.5).
  if (d.serv.cTribNac.slice(0, 2) !== '99' && n.xLocEmi) {
    c.block(
      `Município: ${[n.xLocEmi, n.emit.UF].filter(Boolean).join(' / ')}`,
      M.x + PAD,
      y + 0.4,
      M.w - 2 * PAD,
      6.2,
      {
        size: T.municipio,
        min: T.municipio,
      },
    );
  }
  c.text(
    `Ambiente Gerador: ${dash(opcao('ambGer', n.ambGer))}`,
    M.x + PAD,
    9.7 + ascentMm(c.regular, T.ambiente),
    M.w - 2 * PAD,
    {
      size: T.ambiente,
      min: T.ambiente,
    },
  );
  c.text(
    `Tipo de Ambiente: ${dash(opcao('tpAmb', d.tpAmb))}`,
    M.x + PAD,
    12.2 + ascentMm(c.regular, T.ambiente),
    M.w - 2 * PAD,
    {
      size: T.ambiente,
      min: T.ambiente,
    },
  );
  y += G.cabecalho;
  divisoria(y);

  // Identificação da NFS-e (2.1.2), rótulos em 7 pt e caixa alta (2.4.2), chave num bloco só de 50 dígitos (2.1.1).
  const ident = (r: string, val: string, x: number, yy: number, w: number): void =>
    campo(r, val, x, yy, w, T.rotuloIdentificacao);
  ident('CHAVE DE ACESSO DA NFS-E', n.chave, C1, y, C4 - C1);
  y += G.linhaChave;
  ident('NÚMERO DA NFS-E', n.nNFSe, C1, y, CW);
  ident('COMPETÊNCIA DA NFS-E', f.data(d.dCompet), C2, y, CW);
  ident('DATA E HORA DA EMISSÃO DA NFS-E', f.dataHora(n.dhProc), C3, y, CW);
  y += G.linhaIdentificacao;
  ident('NÚMERO DA DPS', d.nDPS, C1, y, CW);
  ident('SÉRIE DA DPS', d.serie, C2, y, CW);
  ident('DATA E HORA DA EMISSÃO DA DPS', f.dataHora(d.dhEmi), C3, y, CW);
  y += G.linhaIdentificacao;
  c.fillRect(C1, y, CW, G.linhaIdentificacao, G.sombra);
  ident('EMITENTE DA NFS-e', opcao('tpEmit', d.tpEmit), C1, y, CW);
  ident('SITUAÇÃO DA NFS-e', opcao('cStat', n.cStat), C2, y, CW);
  ident('FINALIDADE', opcao('finNFSe', d.ibscbs?.finNFSe ?? ''), C3, y, CW);
  y += G.linhaIdentificacao;
  // QR Code de no mínimo 1,52 cm na posição do 2.4.3, com a zona de silêncio no espaço livre em volta.
  c.qr({
    x: QR_DANFSE.x,
    y: QR_DANFSE.y,
    size: QR_DANFSE.lado,
    modules: qrMatrix(`${QR_DANFSE.url}${n.chave}`, { ecc: 'M' }),
  });
  const Q = QR_DANFSE.quadroTexto;
  c.block(QR_DANFSE.texto, Q.x, Q.y, G.x + G.w - Q.x - 0.2, Q.h, { size: 6, min: 6, fixo: true });

  // Prestador (2.1.3), com a situação no Simples Nacional e o regime de apuração.
  y += pessoa('PRESTADOR / FORNECEDOR', prest, true, y);
  linha(
    [
      ['Simples Nacional na Data de Competência', opcao('opSimpNac', d.prest.opSimpNac), C1, CW],
      ['Regime de Apuração Tributária pelo SN', opcao('regApTribSN', d.prest.regApTribSN), C2, G.x + G.w - C2],
    ],
    y,
  );
  y += G.linha;

  // Tomador, destinatário e intermediário: sem dados, só a frase numa faixa (2.3.1, 2.3.2 e notas 2 e 3).
  if (d.toma) y += pessoa('TOMADOR / ADQUIRENTE', d.toma, true, y);
  else {
    faixa(TEXTOS_DANFSE.tomadorAusente, y);
    y += G.blocoSuprimido;
  }
  if (d.ibscbs?.dest && !destTomador) y += pessoa('DESTINATÁRIO DA OPERAÇÃO', d.ibscbs.dest, false, y);
  else {
    faixa(destTomador ? TEXTOS_DANFSE.destinatarioTomador : TEXTOS_DANFSE.destinatarioAusente, y);
    y += G.blocoSuprimido;
  }
  if (d.interm) y += pessoa('INTERMEDIÁRIO DA OPERAÇÃO', d.interm, true, y);
  else {
    faixa(TEXTOS_DANFSE.intermediarioAusente, y);
    y += G.blocoSuprimido;
  }

  // Serviço prestado (2.1.7): a descrição do código de tributação é a municipal quando existe, senão a nacional, sem
  // rótulo; a descrição do serviço ocupa a altura que sobrou.
  divisoria(y);
  tituloBloco('SERVIÇO PRESTADO', y, G.linha);
  const s = d.serv;
  const local = s.cLocPrestacao
    ? [
        n.xLocPrestacao || municipio(s.cLocPrestacao),
        s.cLocPrestacao && n.xLocPrestacao ? uf(s.cLocPrestacao) : '',
        'BR',
      ]
        .filter(Boolean)
        .join(' / ')
    : [n.xLocPrestacao, s.cPaisPrestacao].filter(Boolean).join(' / ');
  linha(
    [
      ['Código de Tributação Nacional / Municipal', cTrib(s.cTribNac, s.cTribMun), C2, CW],
      ['Código da NBS', nbs(s.cNBS), C3, CW],
      ['Local da Prestação / Sigla UF / País', local, C4, CW],
    ],
    y,
  );
  y += G.linha;
  c.text(dash(n.xTribMun.trim() ? n.xTribMun : n.xTribNac), G.x + PAD, y + 0.3 + topoTexto, larguraTexto, {
    size: T.conteudo,
    min: T.conteudo,
  });
  y += G.descricaoTributacao;
  c.text('Descrição do Serviço', G.x + PAD, y + 0.6 + ascentMm(c.bold, T.rotuloCampo), larguraTexto, {
    font: c.bold,
    size: T.rotuloCampo,
    min: T.rotuloCampo,
    fixo: true,
  });
  c.block(dash(s.xDescServ), G.x + PAD, y + rotuloDescricao, larguraTexto, descH - rotuloDescricao - 0.4, {
    size: T.conteudo,
    min: T.conteudo,
  });
  y += descH;

  // Tributação municipal (2.1.8), ou só a frase quando a operação não é sujeita ao ISSQN (nota 4).
  if (semIssqn) {
    faixa(TEXTOS_DANFSE.issqnAusente, y);
    y += G.blocoSuprimido;
  } else {
    divisoria(y);
    tituloBloco('TRIBUTAÇÃO MUNICIPAL (ISSQN)', y, G.linha);
    const incid = n.cLocIncid
      ? [n.xLocIncid || municipio(n.cLocIncid), n.xLocIncid ? uf(n.cLocIncid) : '', 'BR'].filter(Boolean).join(' / ')
      : v.cPaisResult;
    linha(
      [
        ['Tipo de Tributação do ISSQN', opcao('tribISSQN', v.tribISSQN), C2, CW],
        ['Município / Sigla UF / País de Incidência do ISSQN', incid, C3, G.x + G.w - C3],
      ],
      y,
    );
    y += G.linha;
    if (linhaRegime) {
      linha(
        [
          ['Regime Especial de Tributação do ISSQN', opcao('regEspTrib', d.prest.regEspTrib), C1, CW],
          ['Tipo de Imunidade do ISSQN', opcao('tpImunidade', v.tpImunidade), C2, CW],
          ['Suspensão da Exigibilidade do ISSQN', opcao('tpSusp', v.tpSusp), C3, CW],
          ['Número Processo Suspensão', v.nProcesso, C4, CW],
        ],
        y,
      );
      y += G.linha;
    }
    if (linhaBm) {
      linha(
        [
          ['Benefício Municipal', opcao('tpBM', n.valores.tpBM), C1, CW],
          ['Cálculo do BM', calcBm ? reais(calcBm) : '', C2, CW],
          ['Total Deduções/Reduções', totalDedRed ? reais(totalDedRed) : '', C3, CW],
          ['Desconto Incondicionado', v.vDescIncond ? reais(v.vDescIncond) : '', C4, CW],
        ],
        y,
      );
      y += G.linha;
    }
    linha(
      [
        ['BC ISSQN', reais(n.valores.vBC), C1, CW],
        ['Alíquota Aplicada', pct(n.valores.pAliqAplic), C2, CW],
        ['Retenção do ISSQN', opcao('tpRetISSQN', v.tpRetISSQN), C3, CW],
        ['ISSQN Apurado', reais(n.valores.vISSQN), C4, CW],
      ],
      y,
    );
    y += G.linha;
  }

  // Tributação federal (2.1.9). A NT 008/2026 v1.02 (2.4.5) só trata o tpRetPisCofins 1: as contribuições retidas somam
  // CSLL, PIS e COFINS e o débito de apuração própria fica zerado; nos demais, CSLL retida e PIS e COFINS como vieram.
  // Os códigos 3 a 9 dizem tributo a tributo o que foi retido (`RETENCAO_PIS_COFINS`), e a mesma regra vale para cada
  // um: o retido soma nas retidas e zera no débito próprio.
  const ret = RETENCAO_PIS_COFINS.codigos[v.tpRetPisCofins] ?? { pis: false, cofins: false };
  divisoria(y);
  tituloBloco('TRIBUTAÇÃO FEDERAL (EXCETO CBS)', y, G.linha);
  linha(
    [
      ['IRRF', reais(v.vRetIRRF), C2, CW],
      ['Contribuição Previdenciária - Retida', reais(v.vRetCP), C3, CW],
      [
        'Contribuições Sociais - Retidas',
        ret.pis || ret.cofins
          ? reais(f.soma2(v.vRetCSLL, ret.pis ? v.vPis : '', ret.cofins ? v.vCofins : ''))
          : reais(v.vRetCSLL),
        C4,
        CW,
      ],
    ],
    y,
  );
  y += G.linha;
  if (linhaPisCofins) {
    linha(
      [
        ['PIS - Débito Apuração Própria', ret.pis ? reais('0') : reais(v.vPis), C1, CW],
        ['COFINS - Débito Apuração Própria', ret.cofins ? reais('0') : reais(v.vCofins), C2, CW],
        ['Descrição Contrib. Sociais - Retidas', opcao('tpRetPisCofins', v.tpRetPisCofins), C3, G.x + G.w - C3],
      ],
      y,
    );
    y += G.linha;
  }

  // Tributação IBS/CBS (2.1.10). O bloco não é suprimível (2.3 não o lista); sem o grupo IBSCBS no XML, os campos
  // saem com traço (nota 12).
  divisoria(y);
  tituloBloco('TRIBUTAÇÃO IBS / CBS', y, G.linha);
  const iv = ibs?.valores;
  const it = ibs?.tot;
  const gi = d.ibscbs;
  // O indicador de operação vem da DPS; município e UF de incidência, do grupo que a Sefin calcula.
  const incidIbs = [
    gi?.cIndOp ?? '',
    ibs?.cLocalidadeIncid ?? '',
    ibs?.xLocalidadeIncid ?? '',
    ibs ? uf(ibs.cLocalidadeIncid) : '',
  ]
    .filter(Boolean)
    .join(' / ');
  linha(
    [
      ['CST / cClassTrib', [gi?.CST ?? '', gi?.cClassTrib ?? ''].filter(Boolean).join(' / '), C2, CW],
      [
        'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF',
        incidIbs,
        C3,
        G.x + G.w - C3,
      ],
    ],
    y,
  );
  y += G.linha;
  const exclusoes = ibs ? f.soma2(v.vDescIncond, iv?.vCalcReeRepRes, n.valores.vISSQN, v.vPis, v.vCofins) : '';
  const trio = (...ps: (string | undefined)[]): string =>
    ibs ? ps.map((p) => (p ? `${f.num(p)}%` : TEXTOS_DANFSE.vazio)).join(' / ') : '';
  linha(
    [
      ['Exclusões e Reduções da Base de Cálculo', ibs ? reais(exclusoes) : '', C1, CW],
      ['Base de Cálculo Após Exclusões e Reduções', reais(iv?.vBC), C2, CW],
      ['Red. Alíquota IBS / Red. Alíquota CBS', trio(iv?.pRedAliqUF, iv?.pRedAliqMun, iv?.pRedAliqCBS), C3, CW],
      ['Alíquota - IBS UF / IBS Mun', trio(iv?.pIBSUF, iv?.pIBSMun), C4, CW],
    ],
    y,
  );
  y += G.linha;
  linha(
    [
      ['Alíq. Efetiva Municipal - IBS', pct(iv?.pAliqEfetMun), C1, CW],
      ['Valor Apurado Municipal - IBS', reais(it?.vIBSMun), C2, CW],
      ['Alíq. Efetiva Estadual - IBS', pct(iv?.pAliqEfetUF), C3, CW],
      ['Valor Apurado Estadual - IBS', reais(it?.vIBSUF), C4, CW],
    ],
    y,
  );
  y += G.linha;
  linha(
    [
      ['Valor Total Apurado - IBS', reais(it?.vIBSTot), C1, CW],
      ['Alíquota - CBS', pct(iv?.pCBS), C2, CW],
      ['Alíquota Efetiva - CBS', pct(iv?.pAliqEfetCBS), C3, CW],
      ['Valor Total Apurado - CBS', reais(it?.vCBS), C4, CW],
    ],
    y,
  );
  y += G.linha;

  // Valor total da NFS-e (2.1.11): "Valor Líquido da NFS-e + IBS/CBS" com fundo cinza (2.2.3); os três valores
  // principais com rótulo de 7 pt em caixa alta, como no Anexo I.
  divisoria(y);
  tituloBloco('VALOR TOTAL DA NFS-E', y, G.linhaTotal);
  campo('VALOR DA OPERAÇÃO / SERVIÇO', reais(v.vServ), C2, y, CW, T.rotuloIdentificacao);
  campo('Desconto Incondicionado', reais(v.vDescIncond), C3, y, CW);
  campo('Desconto Condicionado', reais(v.vDescCond), C4, y, CW);
  y += G.linhaTotal;
  c.fillRect(C4, y, CW, G.linhaTotal, G.sombra);
  campo('Total das Retenções (ISSQN / Federais)', reais(n.valores.vTotalRet), C1, y, CW);
  campo('VALOR LÍQUIDO DA NFS-e', reais(n.valores.vLiq), C2, y, CW, T.rotuloIdentificacao);
  campo('Total do IBS/CBS', it ? reais(f.soma2(it.vIBSTot, it.vCBS)) : '', C3, y, CW);
  campo('VALOR LÍQUIDO DA NFS-e + IBS/CBS', reais(it?.vTotNF), C4, y, CW, T.rotuloIdentificacao);
  y += G.linhaTotal;

  // Informações complementares (2.1.12): o corpo termina em reticências se passar da altura; os tributos, nunca.
  divisoria(y);
  c.text('INFORMAÇÕES COMPLEMENTARES', G.x + PAD, y + 0.6 + ascentMm(c.bold, T.rotuloBloco), larguraTexto, {
    font: c.bold,
    size: T.rotuloBloco,
    min: T.rotuloBloco,
    fixo: true,
  });
  y += G.tituloInformacoes;
  let iy = y + 0.4;
  if (corpo)
    iy += c.block(corpo, G.x + PAD, iy, larguraTexto, infoH - 0.8 - totaisH, { size: T.conteudo, min: T.conteudo });
  c.block(totais, G.x + PAD, iy, larguraTexto, totaisH + 0.4, { size: T.conteudo, min: T.conteudo, fixo: true });

  // Canhoto opcional (2.1.13), com o número e a chave da NFS-e.
  if (canhoto) {
    const K = G.canhoto;
    c.rect(G.x, K.y, G.w, K.h, G.divisoria);
    c.line(C2, K.y, C2, K.y + K.h, G.divisoria);
    c.line(C3, K.y, C3, K.y + K.h, G.divisoria);
    campo('DATA CIENTIFICAÇÃO:', null, C1, K.y, CW, T.rotuloIdentificacao);
    campo('IDENTIFICAÇÃO E ASSINATURA', null, C2, K.y, CW, T.rotuloIdentificacao);
    campo('Nº NFS-e / CHAVE NFS-e', `${n.nNFSe} / ${n.chave}`, C3, K.y, G.x + G.w - C3, T.rotuloIdentificacao);
  }

  // Marca d'água de cancelada ou substituída (2.5.1 e 2.5.2), atrás do conteúdo.
  let bg: Canvas | undefined;
  if (marca) {
    bg = new Canvas(c.regular, c.bold);
    const texto = marca === 'cancelada' ? TEXTOS_DANFSE.cancelada : TEXTOS_DANFSE.substituida;
    watermark(bg, G.pagina.w, G.pagina.h, [texto], TEXTOS_DANFSE.marca.cinza, c.regular);
  }
  b.page(G.pagina.w, G.pagina.h, c, bg);
  return b.build(`DANFSe ${n.chave}`);
}
