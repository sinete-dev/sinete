/**
 * NFeRecepcaoEvento4 (MOC 7.0 Visão Geral, itens 5.8 a 5.11): cancelamento (110111), cancelamento por substituição
 * (110112), carta de correção (110110) na UF, e manifestação do destinatário (210200, 210210, 210220, 210240) no
 * Ambiente Nacional, com `cOrgao` 91.
 *
 * O lote é validado pelo schema genérico do envelope; cada evento, pelo schema do seu tipo (regras D04 a D06), todos
 * gerados dos XSD oficiais (o 110112 pelo e110112_v1.00.xsd do Evento_CancSubst_v1.01).
 */

import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { atributoDe, elementosFilhos, textoDe } from '@sinete/core/xml';
import type { RootElement } from '@sinete/schemas';
import { serializeRoot, validateRoot } from '@sinete/schemas';
import type { TRetEnvEvento, TRetEvento } from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import * as canc from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import * as cancSubst from '@sinete/schemas/nfe/evento-cancelamento-substituicao/PL_010d';
import * as cce from '@sinete/schemas/nfe/evento-cce/PL_010d';
import * as ciencia from '@sinete/schemas/nfe/evento-ciencia-operacao/PL_010d';
import * as confirmacao from '@sinete/schemas/nfe/evento-confirmacao-operacao/PL_010d';
import * as desconhecimento from '@sinete/schemas/nfe/evento-desconhecimento-operacao/PL_010d';
import * as naoRealizada from '@sinete/schemas/nfe/evento-operacao-nao-realizada/PL_010d';
import { checkAssinatura } from '../certs.ts';
import type { RequestContext, Status } from '../context.ts';
import { dh, prelude, status, tipoAutorizador, verAplic } from '../context.ts';
import { retEventoXml, standalone } from '../docs.ts';
import { motivo } from '../messages.ts';
import type { EventoFacts } from '../rules.ts';
import { firstRejection } from '../rules.ts';
import { NFE_NS } from '../services.ts';
import type { EventoRecord } from '../state.ts';
import { yearOf } from '../time.ts';
import { all, at, documento, hasPrefix, req, text } from '../xmlutil.ts';
import { viewOf } from './autorizacao.ts';
import { distribuirEvento } from './distribuicao.ts';

/** Descrição do resultado (`xEvento`) por tipo, das tabelas de retorno de cada evento no MOC. */
const X_EVENTO: Readonly<Record<string, string>> = {
  '110110': 'Carta de Correção registrada',
  '110111': 'Cancelamento homologado',
  '110112': 'Cancelamento homologado',
  '210200': 'Confirmacao de Operacao registrada',
  '210210': 'Ciencia da Operacao registrada',
  '210220': 'Desconhecimento da Operacao registrada',
  '210240': 'Operacao nao Realizada registrada',
};

const SCHEMAS: Readonly<Record<string, RootElement<unknown>>> = {
  '110110': cce.envEventoElement,
  '110111': canc.envEventoElement,
  '110112': cancSubst.envEventoElement,
  '210200': confirmacao.envEventoElement,
  '210210': ciencia.envEventoElement,
  '210220': desconhecimento.envEventoElement,
  '210240': naoRealizada.envEventoElement,
};

/**
 * Envelope genérico: qualquer schema de evento serve para o lote se as ocorrências ficarem restritas ao `detEvento`
 * (que é `xs:any` no leiaute genérico `envEvento_v1.00.xsd`).
 */
function envelopeOk(doc: DocumentoXml): boolean {
  return validateRoot(canc.envEventoElement, doc).every((i) => /\/detEvento(?:\/|\[|$)/.test(i.caminho));
}

function factsOf(evento: ElementoXml): EventoFacts {
  const inf = at(evento, 'infEvento') as ElementoXml;
  const det: Record<string, string> = {};
  for (const c of elementosFilhos(at(inf, 'detEvento') as ElementoXml)) det[c.local] = textoDe(c);
  return {
    id: atributoDe(inf, 'Id') ?? '',
    cOrgao: req(inf, 'cOrgao'),
    tpAmb: req(inf, 'tpAmb'),
    autor: documento(inf),
    chNFe: req(inf, 'chNFe'),
    dhEvento: req(inf, 'dhEvento'),
    tpEvento: req(inf, 'tpEvento'),
    nSeqEvento: req(inf, 'nSeqEvento'),
    verEvento: req(inf, 'verEvento'),
    det,
  };
}

/** NFeRecepcaoEvento4 (nfeRecepcaoEvento). */
export async function recepcaoEvento(ctx: RequestContext): Promise<string> {
  const cOrgao = ctx.autorizador === 'an' ? '91' : ctx.rt.config.cUF;
  // D01 do lote: o envelope genérico, com o detEvento livre; cada evento é conferido depois pelo schema do tipo.
  const pre = prelude(ctx, { roots: [canc.envEventoElement], lote: false });
  const idLido = pre.doc === undefined ? undefined : text(pre.doc.raiz, 'idLote');
  const idLote = idLido !== undefined && /^[0-9]{1,15}$/.test(idLido) ? idLido : '0';
  const ret = (s: Status, retEvento?: TRetEvento[]): string => {
    const value: TRetEnvEvento = {
      versao: '1.00',
      idLote,
      tpAmb: ctx.rt.config.tpAmb,
      verAplic: verAplic(ctx),
      cOrgao: cOrgao as TRetEnvEvento['cOrgao'],
      cStat: s.cStat,
      xMotivo: s.xMotivo,
      ...(retEvento === undefined ? {} : { retEvento }),
    };
    return serializeRoot(canc.retEnvEventoElement, value);
  };
  if (pre.ok) return ret(status('128'), await processarLote(ctx, pre.doc, cOrgao));
  // Falha só no detEvento: o lote passa e cada evento responde pelo próprio schema (D06).
  if (pre.status.cStat === '215' && pre.doc !== undefined && envelopeOk(pre.doc)) {
    // O resto do prelúdio depois do schema (D02) vale também para o lote aceito pelo envelope genérico.
    if (hasPrefix(pre.doc.raiz)) return ret(status('404'));
    return ret(status('128'), await processarLote(ctx, pre.doc, cOrgao));
  }
  return ret(pre.status);
}

async function processarLote(ctx: RequestContext, doc: DocumentoXml, cOrgao: string): Promise<TRetEvento[]> {
  const out: TRetEvento[] = [];
  for (const el of all(doc.raiz, 'evento')) out.push(await processarEvento(ctx, doc, el, cOrgao));
  return out;
}

async function processarEvento(
  ctx: RequestContext,
  doc: DocumentoXml,
  el: ElementoXml,
  cOrgao: string,
): Promise<TRetEvento> {
  const e = factsOf(el);
  const base = {
    tpAmb: ctx.rt.config.tpAmb,
    verAplic: verAplic(ctx),
    cOrgao: cOrgao as TRetEvento['infEvento']['cOrgao'],
  };
  const fields = {
    chNFe: e.chNFe,
    tpEvento: e.tpEvento,
    nSeqEvento: e.nSeqEvento,
    dhRegEvento: dh(ctx, ctx.now),
  };
  const rejeitado = (cStat: string, params?: Readonly<Record<string, string>>): TRetEvento => ({
    versao: '1.00',
    infEvento: { ...base, cStat, xMotivo: motivo(cStat, params), ...fields },
  });
  // D04, D05 e D06: tipo de evento, versão e schema específico (o evento isolado num lote de um evento só).
  const schema = SCHEMAS[e.tpEvento];
  if (schema === undefined) return rejeitado('491');
  if (e.verEvento !== '1.00') return rejeitado('492');
  const eventoXml = standalone(doc.texto, el);
  const single = `<envEvento versao="1.00" xmlns="${NFE_NS}"><idLote>0</idLote>${eventoXml}</envEvento>`;
  if (validateRoot(schema, single).length > 0) return rejeitado('493');
  // Grupos E e F no lote como recebido (o C14N depende dos namespaces em escopo); o titular é o autor do evento.
  const sig = await checkAssinatura({
    doc,
    id: e.id,
    element: 'infEvento',
    now: ctx.now,
    titular: e.autor,
  });
  if (!sig.ok) return rejeitado(sig.cStat);
  const view = viewOf(ctx.rt);
  const r = firstRejection(ctx.rt.config.rules.evento, { evento: e, autorizador: ctx.autorizador, view, now: ctx.now });
  if (r !== undefined) return rejeitado(r.cStat, r.params);
  const nfe = view.nfe(e.chNFe);
  if (nfe === undefined) return rejeitado('494', { chNFe: e.chNFe });
  const nProt = ctx.rt.state.nextProtocolo(tipoAutorizador(ctx), cOrgao, yearOf(ctx.now, ctx.rt.config.offsetMinutes));
  const xEvento = X_EVENTO[e.tpEvento] as string;
  const destino = e.tpEvento === '110111' ? nfe.destinatario : undefined;
  const destFields =
    destino?.CNPJ !== undefined
      ? { CNPJDest: destino.CNPJ }
      : destino?.CPF !== undefined
        ? { CPFDest: destino.CPF }
        : {};
  const retEvento: TRetEvento = {
    versao: '1.00',
    infEvento: {
      Id: `ID${nProt}`,
      ...base,
      cStat: '135',
      xMotivo: motivo('135'),
      chNFe: e.chNFe,
      tpEvento: e.tpEvento,
      xEvento,
      nSeqEvento: e.nSeqEvento,
      ...(e.tpEvento === '110112' ? { cOrgaoAutor: e.det.cOrgaoAutor as TRetEvento['infEvento']['cOrgao'] } : {}),
      ...destFields,
      dhRegEvento: fields.dhRegEvento,
      nProt,
    } as TRetEvento['infEvento'],
  };
  const record: EventoRecord = {
    chave: e.chNFe,
    tpEvento: e.tpEvento,
    nSeqEvento: Number(e.nSeqEvento),
    cOrgao,
    autor: e.autor,
    dhEvento: e.dhEvento,
    dhRegEvento: fields.dhRegEvento,
    nProt,
    xEvento,
    xml: eventoXml,
    retEvento: retEventoXml(retEvento, NFE_NS),
  };
  ctx.rt.state.eventos.push(record);
  if (e.tpEvento === '110111' || e.tpEvento === '110112') nfe.situacao = 'cancelada';
  distribuirEvento(ctx.rt.state, record, nfe);
  return retEvento;
}
