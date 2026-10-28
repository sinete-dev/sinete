/**
 * `@sinete/da/evento`: o documento auxiliar de qualquer evento registrado que o sinete emite, por uma chamada só. Na
 * NF-e e na NFC-e, a Carta de Correção (110110, o mesmo DACCE do `@sinete/da/cce`), o cancelamento (110111) e o
 * cancelamento por substituição (110112); no MDF-e, o cancelamento (110111), o encerramento (110112) e a inclusão de
 * condutor (110114). A raiz do XML (`procEventoNFe` ou `procEventoMDFe`) escolhe a família e o `tpEvento` escolhe os
 * campos. Leva os schemas da NF-e e do MDF-e, mas nenhum layout de DANFE nem de DAMDFE. Os renderizadores
 * (`gerarPdf`, `gerarHtml`, `gerarSvg`) são reexportados aqui para bastar um import.
 */

import { ufPorCUf } from '@sinete/core';
import { ErroDa } from './errors.ts';
import * as f from './format.ts';
import { REGISTRADO_NFE } from './input/cancelamento.ts';
import { REGISTRADO_MDFE } from './input/cancelamento-mdfe.ts';
import type { EventoView } from './input/evento.ts';
import { lerEvento } from './input/evento.ts';
import type { EventoMdfeView } from './input/evento-mdfe.ts';
import { lerEventoMdfe } from './input/evento-mdfe.ts';
import { readMdfe } from './input/mdfe.ts';
import type { NotaView } from './input/nfe.ts';
import { readNota } from './input/nfe.ts';
import type { Rec } from './input/xml.ts';
import { parse, str } from './input/xml.ts';
import type { DaOpcoes } from './layout/common.ts';
import { dacceLayout, linhaDaNota } from './layout/dacce.ts';
import type { Celula, EventoImpresso } from './layout/evento.ts';
import { eventoLayout } from './layout/evento.ts';
import type { Documento } from './model.ts';

export type { CodigoErroDa } from './errors.ts';
export { ErroDa } from './errors.ts';
export type { DaOpcoes } from './layout/common.ts';
export type { Documento } from './model.ts';
export { gerarHtml, gerarSvg } from './render/html.ts';
export type { PdfOpcoes } from './render/pdf.ts';
export { gerarPdf } from './render/pdf.ts';

export interface DaEventoOpcoes extends DaOpcoes {
  /** `nfeProc` da nota do evento da NF-e ou da NFC-e, para o emitente no cabeçalho e a linha da nota. */
  readonly nfe?: string;
  /** `mdfeProc` do manifesto do evento do MDF-e, para o emitente no cabeçalho e a linha do manifesto. */
  readonly mdfe?: string;
}

/** Tipos de evento com documento auxiliar, por família. */
const TIPOS_NFE = ['110110', '110111', '110112'] as const;
const TIPOS_MDFE = ['110111', '110112', '110114'] as const;

/**
 * Documento auxiliar do evento registrado, a partir do `procEventoNFe` ou do `procEventoMDFe`. O evento precisa ter o
 * retorno de registro (cStat 135, 136 ou 155 na NF-e; 135, 134 ou 136 no MDF-e) do mesmo pedido: mesma chave, tipo e
 * sequência. Tipo sem documento auxiliar, evento não registrado ou documento de outra chave é `evento_incompativel`.
 */
export function daEvento(xmlEvento: string, opcoes: DaEventoOpcoes = {}): Documento {
  const doc = parse(xmlEvento);
  const raiz = doc.raiz.local;
  if (raiz === 'procEventoMDFe') {
    if (opcoes.nfe !== undefined) throw incompativel('a opção nfe não serve para evento do MDF-e');
    return eventoMdfe(lerEventoMdfe(doc, TIPOS_MDFE), opcoes);
  }
  if (raiz !== 'procEventoNFe') {
    throw new ErroDa('documento_inesperado', `esperado procEventoNFe ou procEventoMDFe, recebido <${raiz}>`, {
      detalhes: { raiz, esperado: ['procEventoNFe', 'procEventoMDFe'] },
    });
  }
  if (opcoes.mdfe !== undefined) throw incompativel('a opção mdfe não serve para evento da NF-e');
  return eventoNfe(lerEvento(doc, TIPOS_NFE), opcoes);
}

function incompativel(msg: string, detalhes: Readonly<Record<string, unknown>> = {}): ErroDa {
  return new ErroDa('evento_incompativel', msg, { detalhes });
}

/** O retorno existe, é de registro e é deste pedido: a mesma chave, o mesmo tipo e a mesma sequência. */
function conferirRegistro(
  pedido: { readonly chave: string; readonly tpEvento: string; readonly nSeqEvento: string },
  ret:
    | { readonly cStat: string; readonly chave: string; readonly tpEvento: string; readonly nSeqEvento: string }
    | undefined,
  registrado: ReadonlySet<string>,
): void {
  if (ret === undefined || !registrado.has(ret.cStat)) {
    throw incompativel('evento sem retorno de registro', { cStat: ret?.cStat ?? '' });
  }
  if (
    ret.chave !== pedido.chave ||
    ret.tpEvento !== pedido.tpEvento ||
    ret.nSeqEvento === '' ||
    Number(ret.nSeqEvento) !== Number(pedido.nSeqEvento)
  ) {
    throw incompativel('o retorno não é o deste evento', {
      chaveRetorno: ret.chave,
      tpEventoRetorno: ret.tpEvento,
      nSeqRetorno: ret.nSeqEvento,
    });
  }
}

function eventoNfe(ev: EventoView, opcoes: DaEventoOpcoes): Documento {
  conferirRegistro(
    { chave: ev.chNFe, tpEvento: ev.tpEvento, nSeqEvento: ev.nSeqEvento },
    ev.ret && { ...ev.ret, chave: ev.ret.chNFe },
    REGISTRADO_NFE,
  );
  const nota: NotaView | undefined = opcoes.nfe === undefined ? undefined : readNota(opcoes.nfe);
  if (nota && nota.chave !== ev.chNFe) {
    throw incompativel('a NF-e passada não é a do evento', { chave: nota.chave, chaveEvento: ev.chNFe });
  }
  if (ev.tpEvento === '110110') return dacceLayout(ev, nota, opcoes);
  // O modelo vem da chave (posições 21 e 22): o cancelamento 110111 vale para a NF-e e para a NFC-e.
  const sigla = ev.chNFe.slice(20, 22) === '65' ? 'NFC-e' : 'NF-e';
  const d: Rec = ev.det;
  const protocolo: Celula = [`PROTOCOLO DE AUTORIZAÇÃO DA ${sigla}`, str(d, 'nProt') ?? ''];
  const substituicao = ev.tpEvento === '110112';
  return eventoLayout(
    {
      nome: substituicao ? `CANCELAMENTO POR SUBSTITUIÇÃO DA ${sigla}` : `CANCELAMENTO DA ${sigla}`,
      documento: { sigla, artigo: 'da' },
      chave: ev.chNFe,
      cOrgao: ev.cOrgao,
      tpAmb: ev.tpAmb,
      autor: ev.autor,
      dhEvento: ev.dhEvento,
      tpEvento: ev.tpEvento,
      nSeqEvento: ev.nSeqEvento,
      ...(ev.ret ? { ret: ev.ret } : {}),
      ...(nota ? { emitente: nota.emit, linhaDoDocumento: linhaDaNota(nota, sigla) } : {}),
      campos: substituicao
        ? [[protocolo], [[`CHAVE DE ACESSO DA ${sigla} SUBSTITUTA`, f.chave(str(d, 'chNFeRef') ?? '')]]]
        : [[protocolo]],
      quadros: [{ titulo: 'JUSTIFICATIVA', texto: str(d, 'xJust') ?? '', tamanho: 10 }],
      titulo: `Evento ${ev.tpEvento} da ${sigla} ${ev.chNFe}`,
    },
    opcoes,
  );
}

function eventoMdfe(ev: EventoMdfeView, opcoes: DaEventoOpcoes): Documento {
  conferirRegistro(
    { chave: ev.chMDFe, tpEvento: ev.tpEvento, nSeqEvento: ev.nSeqEvento },
    ev.ret && { ...ev.ret, chave: ev.ret.chMDFe },
    REGISTRADO_MDFE,
  );
  const m = opcoes.mdfe === undefined ? undefined : readMdfe(opcoes.mdfe);
  if (m && m.chave !== ev.chMDFe) {
    throw incompativel('o MDF-e passado não é o do evento', { chave: m.chave, chaveEvento: ev.chMDFe });
  }
  const tipo = camposMdfe(ev.tpEvento, ev.det);
  return eventoLayout(
    {
      ...tipo,
      documento: { sigla: 'MDF-e', artigo: 'do' },
      chave: ev.chMDFe,
      cOrgao: ev.cOrgao,
      tpAmb: ev.tpAmb,
      autor: ev.autor,
      dhEvento: ev.dhEvento,
      tpEvento: ev.tpEvento,
      nSeqEvento: ev.nSeqEvento,
      ...(ev.ret ? { ret: ev.ret } : {}),
      ...(m
        ? {
            emitente: m.emit,
            linhaDoDocumento: [
              ['NÚMERO DO MDF-e', f.numero(m.nMDF)],
              ['SÉRIE', f.serie(m.serie)],
              ['DATA DE EMISSÃO', f.data(m.dhEmi)],
              ['UF DE INÍCIO E DE FIM', [m.UFIni, m.UFFim].join(' / ')],
            ],
          }
        : {}),
      titulo: `Evento ${ev.tpEvento} do MDF-e ${ev.chMDFe}`,
    },
    opcoes,
  );
}

/** Nome, campos e quadros de cada tipo de evento do MDF-e. */
function camposMdfe(tpEvento: string, d: Rec): Pick<EventoImpresso, 'nome' | 'campos' | 'quadros'> {
  const protocolo: Celula = ['PROTOCOLO DE AUTORIZAÇÃO DO MDF-e', str(d, 'nProt') ?? ''];
  if (tpEvento === '110111') {
    return {
      nome: 'CANCELAMENTO DO MDF-e',
      campos: [[protocolo]],
      quadros: [{ titulo: 'JUSTIFICATIVA', texto: str(d, 'xJust') ?? '', tamanho: 10 }],
    };
  }
  if (tpEvento === '110112') {
    // evEncMDFe: dtEnc, cUF e cMun (código IBGE; o XML não traz o nome do município).
    const terceiro: readonly (readonly Celula[])[] =
      str(d, 'indEncPorTerceiro') === '1' ? [[['ENCERRAMENTO', 'ENCERRADO PELO TRANSPORTADOR TERCEIRO']]] : [];
    return {
      nome: 'ENCERRAMENTO DO MDF-e',
      campos: [
        [protocolo, ['DATA DO ENCERRAMENTO', f.data(str(d, 'dtEnc'))]],
        [
          ['UF DO ENCERRAMENTO', siglaDaUf(str(d, 'cUF') ?? '')],
          ['MUNICÍPIO DO ENCERRAMENTO (CÓDIGO IBGE)', str(d, 'cMun') ?? ''],
        ],
        ...terceiro,
      ],
      quadros: [],
    };
  }
  // O leitor só aceita os TIPOS_MDFE: o que sobra é a inclusão de condutor (evIncCondutorMDFe).
  const condutor = d.condutor as Rec | undefined;
  return {
    nome: 'INCLUSÃO DE CONDUTOR NO MDF-e',
    campos: [
      [
        ['NOME DO CONDUTOR', str(condutor, 'xNome') ?? ''],
        ['CPF DO CONDUTOR', f.cnpjCpf(str(condutor, 'CPF'))],
      ],
    ],
    quadros: [],
  };
}

/** Sigla da UF pelo código IBGE; o código 99 (exterior) e o desconhecido saem como vieram. */
function siglaDaUf(cUF: string): string {
  return ufPorCUf(cUF)?.sigla ?? cUF;
}
