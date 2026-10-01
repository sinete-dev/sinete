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

import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { lerXml, primeiroFilho, textoDe } from '@sinete/core/xml';
import type { ClienteNfe, EnvioOpcoes, EventoRegistrado, ResultadoConsulta } from './client.ts';
import { cstatEm } from './outcome.ts';
import { NFE_NS, recortarElemento } from './proc.ts';

/** Resultado da recuperação: o evento registrado, com a consulta que o prova, ou só a consulta. */
export type RecuperacaoEvento =
  | { readonly registrado: true; readonly evento: EventoRegistrado; readonly consulta: ResultadoConsulta }
  | { readonly registrado: false; readonly consulta: ResultadoConsulta };

/** Texto do filho `local` no namespace da NF-e, se houver. */
function campo(el: ElementoXml, local: string): string | undefined {
  const c = primeiroFilho(el, local, NFE_NS);
  return c === undefined ? undefined : textoDe(c).trim();
}

/** Lê um `procEventoNFe` da consulta; `undefined` para o que não é um evento com retorno legível. */
function lerProcEvento(xml: string): EventoRegistrado | undefined {
  let doc: DocumentoXml;
  try {
    doc = lerXml(xml);
  } catch {
    return undefined;
  }
  const evento = primeiroFilho(doc.raiz, 'evento', NFE_NS);
  const pedido = evento === undefined ? undefined : primeiroFilho(evento, 'infEvento', NFE_NS);
  const retEl = primeiroFilho(doc.raiz, 'retEvento', NFE_NS);
  const ret = retEl === undefined ? undefined : primeiroFilho(retEl, 'infEvento', NFE_NS);
  if (doc.raiz.local !== 'procEventoNFe' || pedido === undefined || retEl === undefined || ret === undefined) {
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
    retEvento: recortarElemento(doc, retEl, ''),
    procEventoNFe: xml,
    ...(nProt === undefined ? {} : { nProt }),
  };
}

/**
 * Consulta a chave e devolve o evento `tpEvento` que a SEFAZ registrou para ela (o de maior `nSeqEvento`, quando há
 * vários, como na CC-e; com `nSeqEvento`, só o dessa sequência). Serve depois de um pedido de evento sem resposta ou
 * respondido com 573 ou 580: nunca conclua que o evento existe só pelo `cStat` do pedido. `registrado: false` quer
 * dizer que a consulta não mostrou o evento (ou não decidiu: veja `consulta`); não quer dizer que o evento não existe.
 * `opcoes.signal` cancela a consulta.
 */
export async function recuperarEventoRegistrado(
  cliente: ClienteNfe,
  chave: string,
  tpEvento: string,
  nSeqEvento?: number,
  opcoes?: EnvioOpcoes,
): Promise<RecuperacaoEvento> {
  const consulta = await cliente.consultar(chave, undefined, opcoes);
  if (consulta.tipo !== 'autorizado' && consulta.tipo !== 'denegado') return { registrado: false, consulta };
  let achado: EventoRegistrado | undefined;
  for (const xml of consulta.valor.eventos) {
    const e = lerProcEvento(xml);
    if (e === undefined || e.chNFe !== consulta.valor.chNFe || e.tpEvento !== tpEvento) continue;
    if (nSeqEvento !== undefined && Number(e.nSeqEvento) !== nSeqEvento) continue;
    if (achado === undefined || Number(e.nSeqEvento) > Number(achado.nSeqEvento)) achado = e;
  }
  return achado === undefined ? { registrado: false, consulta } : { registrado: true, evento: achado, consulta };
}
