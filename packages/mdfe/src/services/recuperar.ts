/**
 * Recuperação de um evento do MDF-e que a SEFAZ registrou e cuja resposta se perdeu.
 *
 * Um pedido de evento sem resposta, ou respondido com uma duplicidade de evento (631, por exemplo), pode ter sido
 * registrado. O `cStat` do pedido não prova que foi este evento: a prova é a consulta da chave, que devolve os
 * `procEventoMDFe` que a SEFAZ tem (MOC MDF-e 3.00b, Visão Geral, consulta da situação). Esta função lê o evento de
 * lá e só o dá como registrado quando o retorno dele diz 135, 134 ou 136 para a mesma chave e o mesmo tipo.
 */

import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { lerXml, primeiroFilho, textoDe } from '@sinete/core/xml';
import type { ConsultaOutcome, EventoRegistrado, MdfeClient } from './client.ts';
import { cstatEm } from './outcome.ts';
import { MDFE_NS, sliceElement } from './proc.ts';

/** Resultado da recuperação: o evento registrado, com a consulta que o prova, ou só a consulta. */
export type RecuperacaoEvento =
  | { readonly registrado: true; readonly evento: EventoRegistrado; readonly consulta: ConsultaOutcome }
  | { readonly registrado: false; readonly consulta: ConsultaOutcome };

/** Texto do filho `local` no namespace do MDF-e, se houver. */
function campo(el: ElementoXml, local: string): string | undefined {
  const c = primeiroFilho(el, local, MDFE_NS);
  return c === undefined ? undefined : textoDe(c).trim();
}

/** Lê um `procEventoMDFe` da consulta; `undefined` para o que não é um evento com retorno legível. */
function lerProcEvento(xml: string): EventoRegistrado | undefined {
  let doc: DocumentoXml;
  try {
    doc = lerXml(xml);
  } catch {
    return undefined;
  }
  const evento = primeiroFilho(doc.raiz, 'eventoMDFe', MDFE_NS);
  const pedido = evento === undefined ? undefined : primeiroFilho(evento, 'infEvento', MDFE_NS);
  const retEl = primeiroFilho(doc.raiz, 'retEventoMDFe', MDFE_NS);
  const ret = retEl === undefined ? undefined : primeiroFilho(retEl, 'infEvento', MDFE_NS);
  if (doc.raiz.local !== 'procEventoMDFe' || pedido === undefined || retEl === undefined || ret === undefined) {
    return undefined;
  }
  const cStat = campo(ret, 'cStat');
  const chMDFe = campo(ret, 'chMDFe');
  const tpEvento = campo(ret, 'tpEvento');
  const nSeq = campo(ret, 'nSeqEvento');
  if (cStat === undefined || !cstatEm(cStat, 'eventoRegistrado')) return undefined;
  // O pedido e o retorno têm de falar do mesmo evento.
  // Chave, tipo e sequência têm de vir no retorno e ser iguais aos do pedido: um retorno registrado de outro evento, ou
  // sem dizer de qual, não prova nada.
  if (chMDFe === undefined || tpEvento === undefined || nSeq === undefined) return undefined;
  const nSeqPedido = campo(pedido, 'nSeqEvento');
  if (campo(pedido, 'chMDFe') !== chMDFe || campo(pedido, 'tpEvento') !== tpEvento) return undefined;
  if (nSeqPedido === undefined || Number(nSeqPedido) !== Number(nSeq)) return undefined;
  if (chMDFe === undefined || tpEvento === undefined || nSeq === undefined) return undefined;
  const nProt = campo(ret, 'nProt');
  const dhRegEvento = campo(ret, 'dhRegEvento');
  const xEvento = campo(ret, 'xEvento');
  return {
    chMDFe,
    tpEvento,
    nSeqEvento: String(Number(nSeq)),
    retEventoMDFe: sliceElement(doc, retEl, ''),
    procEventoMDFe: xml,
    ...(nProt === undefined ? {} : { nProt }),
    ...(dhRegEvento === undefined ? {} : { dhRegEvento }),
    ...(xEvento === undefined ? {} : { xEvento }),
  };
}

/**
 * Consulta a chave e devolve o evento `tpEvento` que a SEFAZ registrou para ela (o de maior `nSeqEvento`, quando há
 * vários, como na inclusão de condutor). Serve depois de um pedido de evento sem resposta ou respondido com uma
 * duplicidade: nunca conclua que o evento existe só pelo `cStat` do pedido. `registrado: false` quer dizer que a
 * consulta não mostrou o evento (ou não decidiu: veja `consulta`); não quer dizer que o evento não existe.
 */
export async function recuperarEventoRegistrado(
  client: MdfeClient,
  chave: string,
  tpEvento: string,
): Promise<RecuperacaoEvento> {
  const consulta = await client.consultar(chave);
  if (consulta.tipo !== 'autorizado') return { registrado: false, consulta };
  let achado: EventoRegistrado | undefined;
  for (const xml of consulta.valor.eventos) {
    const e = lerProcEvento(xml);
    if (e === undefined || e.chMDFe !== consulta.valor.chMDFe || e.tpEvento !== tpEvento) continue;
    if (achado === undefined || Number(e.nSeqEvento) > Number(achado.nSeqEvento)) achado = e;
  }
  return achado === undefined ? { registrado: false, consulta } : { registrado: true, evento: achado, consulta };
}
