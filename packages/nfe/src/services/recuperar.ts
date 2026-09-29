/**
 * Recuperação de um evento que a SEFAZ registrou e cuja resposta se perdeu.
 *
 * Um pedido de evento sem resposta (timeout, conexão caída), ou respondido com 573 (duplicidade de evento) ou 580
 * (evento já registrado no contexto do cancelamento), pode ter sido registrado. O `cStat` sozinho não prova: 573 e
 * 580 dizem que algo foi registrado antes, não que foi este evento, com este conteúdo e para esta chave. A prova é a
 * consulta da chave, que devolve os `procEventoNFe` que a SEFAZ tem (MOC 7.0, Visão Geral, consulta protocolo). Esta
 * função lê o evento de lá e só o dá como registrado quando o retorno dele diz 135, 136 ou 155 para a mesma chave e o
 * mesmo tipo.
 */

import type { XmlDocument, XmlElement } from '@sinete/core/xml';
import { firstChild, parseXml, textOf } from '@sinete/core/xml';
import type { ConsultaOutcome, EventoRegistrado, NfeClient } from './client.ts';
import { cstatEm } from './outcome.ts';
import { NFE_NS, sliceElement } from './proc.ts';

/** Resultado da recuperação: o evento registrado, com a consulta que o prova, ou só a consulta. */
export type RecuperacaoEvento =
  | { readonly registrado: true; readonly evento: EventoRegistrado; readonly consulta: ConsultaOutcome }
  | { readonly registrado: false; readonly consulta: ConsultaOutcome };

/** Texto do filho `local` no namespace da NF-e, se houver. */
function campo(el: XmlElement, local: string): string | undefined {
  const c = firstChild(el, local, NFE_NS);
  return c === undefined ? undefined : textOf(c).trim();
}

/** Lê um `procEventoNFe` da consulta; `undefined` para o que não é um evento com retorno legível. */
function lerProcEvento(xml: string): EventoRegistrado | undefined {
  let doc: XmlDocument;
  try {
    doc = parseXml(xml);
  } catch {
    return undefined;
  }
  const evento = firstChild(doc.root, 'evento', NFE_NS);
  const pedido = evento === undefined ? undefined : firstChild(evento, 'infEvento', NFE_NS);
  const retEl = firstChild(doc.root, 'retEvento', NFE_NS);
  const ret = retEl === undefined ? undefined : firstChild(retEl, 'infEvento', NFE_NS);
  if (doc.root.local !== 'procEventoNFe' || pedido === undefined || retEl === undefined || ret === undefined) {
    return undefined;
  }
  const cStat = campo(ret, 'cStat');
  const chNFe = campo(ret, 'chNFe');
  const tpEvento = campo(ret, 'tpEvento');
  const nSeq = campo(ret, 'nSeqEvento');
  const dhRegEvento = campo(ret, 'dhRegEvento');
  if (cStat === undefined || !cstatEm(cStat, 'eventoRegistrado')) return undefined;
  // O pedido e o retorno têm de falar do mesmo evento.
  // Chave, tipo e sequência têm de vir no retorno e ser iguais aos do pedido: um retorno registrado de outro evento, ou
  // sem dizer de qual, não prova nada.
  if (chNFe === undefined || tpEvento === undefined || nSeq === undefined) return undefined;
  const nSeqPedido = campo(pedido, 'nSeqEvento');
  if (campo(pedido, 'chNFe') !== chNFe || campo(pedido, 'tpEvento') !== tpEvento) return undefined;
  if (nSeqPedido === undefined || Number(nSeqPedido) !== Number(nSeq)) return undefined;
  if (chNFe === undefined || tpEvento === undefined || nSeq === undefined || dhRegEvento === undefined)
    return undefined;
  const nProt = campo(ret, 'nProt');
  return {
    chNFe,
    tpEvento,
    nSeqEvento: String(Number(nSeq)),
    dhRegEvento,
    retEvento: sliceElement(doc, retEl, ''),
    procEventoNFe: xml,
    ...(nProt === undefined ? {} : { nProt }),
  };
}

/**
 * Consulta a chave e devolve o evento `tpEvento` que a SEFAZ registrou para ela (o de maior `nSeqEvento`, quando há
 * vários, como na CC-e). Serve depois de um pedido de evento sem resposta ou respondido com 573 ou 580: nunca conclua
 * que o evento existe só pelo `cStat` do pedido. `registrado: false` quer dizer que a consulta não mostrou o evento
 * (ou não decidiu: veja `consulta`); não quer dizer que o evento não existe.
 */
export async function recuperarEventoRegistrado(
  client: NfeClient,
  chave: string,
  tpEvento: string,
): Promise<RecuperacaoEvento> {
  const consulta = await client.consultar(chave);
  if (consulta.status !== 'authorized' && consulta.status !== 'denied') return { registrado: false, consulta };
  let achado: EventoRegistrado | undefined;
  for (const xml of consulta.value.eventos) {
    const e = lerProcEvento(xml);
    if (e === undefined || e.chNFe !== consulta.value.chNFe || e.tpEvento !== tpEvento) continue;
    if (achado === undefined || Number(e.nSeqEvento) > Number(achado.nSeqEvento)) achado = e;
  }
  return achado === undefined ? { registrado: false, consulta } : { registrado: true, evento: achado, consulta };
}
