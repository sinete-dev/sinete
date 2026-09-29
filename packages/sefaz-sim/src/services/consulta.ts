/**
 * NFeStatusServico4 (MOC 7.0 Visão Geral, item 5.5) e NFeConsultaProtocolo4 (item 5.4, tabela 5-16).
 */

import { serializeRoot } from '@sinete/schemas';
import type { TRetConsSitNFe } from '@sinete/schemas/nfe/consulta-protocolo/PL_010d';
import { consSitNFeElement, retConsSitNFeElement } from '@sinete/schemas/nfe/consulta-protocolo/PL_010d';
import type { TRetConsStatServ } from '@sinete/schemas/nfe/status-servico/PL_009q';
import { consStatServElement, retConsStatServElement } from '@sinete/schemas/nfe/status-servico/PL_009q';
import type { RequestContext, Status } from '../context.ts';
import { dh, prelude, status, verAplic } from '../context.ts';
import { procEventoXml } from '../docs.ts';
import { chaveRejection } from '../rules.ts';
import { statusDaSvc } from '../svc.ts';
import { text } from '../xmlutil.ts';
import { protNFeNaResposta } from './autorizacao.ts';

/** Eventos devolvidos na consulta: cancelamento, carta de correção e EPEC (item 5.4.3). */
const EVENTOS_CONSULTA = new Set(['110110', '110111', '110112', '110140']);

/** NFeStatusServico4 (nfeStatusServicoNF). */
export function statusServico(ctx: RequestContext): string {
  const pre = prelude(ctx, { roots: [consStatServElement], lote: false });
  const ret = (s: Status): string => {
    const value: TRetConsStatServ = {
      versao: '4.00',
      tpAmb: ctx.rt.config.tpAmb,
      verAplic: verAplic(ctx),
      cStat: s.cStat,
      xMotivo: s.xMotivo,
      cUF: ctx.rt.config.cUF as TRetConsStatServ['cUF'],
      dhRecbto: dh(ctx, ctx.now),
      tMed: '1',
    };
    return serializeRoot(retConsStatServElement, value);
  };
  // O próprio serviço de status informa a paralisação como resultado (tabela 4.4.1), não como rejeição.
  if (!pre.ok)
    return ret(pre.status.cStat === '108' || pre.status.cStat === '109' ? status(pre.status.cStat) : pre.status);
  if (text(pre.doc.root, 'tpAmb') !== ctx.rt.config.tpAmb) return ret(status('252'));
  const cUF = text(pre.doc.root, 'cUF') ?? '';
  if (!ctx.rt.config.cUFsAtendidas.includes(cUF)) return ret(status('410'));
  // Na SVC, o status diz se a SEFAZ de origem a ativou para a UF (NT 2013.007 v1.03, regras K05.1 a K05.3).
  return ret(ctx.autorizador === 'svc' ? statusDaSvc(ctx.rt, cUF, ctx.now) : status('107'));
}

/** NFeConsultaProtocolo4 (nfeConsultaNF). */
export function consultaProtocolo(ctx: RequestContext): string {
  const pre = prelude(ctx, { roots: [consSitNFeElement], lote: false });
  const lida = pre.doc === undefined ? undefined : text(pre.doc.root, 'chNFe');
  const chNFe = lida !== undefined && /^[0-9]{6}[0-9A-Z]{12}[0-9]{26}$/.test(lida) ? lida : '0'.repeat(44);
  const ret = (s: Status, extra: Pick<TRetConsSitNFe, 'protNFe'> = {}, eventos: readonly string[] = []): string => {
    const value: TRetConsSitNFe = {
      versao: '4.00',
      tpAmb: ctx.rt.config.tpAmb,
      verAplic: verAplic(ctx),
      cStat: s.cStat,
      xMotivo: s.xMotivo,
      cUF: ctx.rt.config.cUF as TRetConsSitNFe['cUF'],
      dhRecbto: dh(ctx, ctx.now),
      chNFe,
      ...extra,
    };
    const xml = serializeRoot(retConsSitNFeElement, value);
    // procEventoNFe é o último filho de retConsSitNFe: entra como texto, sem reserializar o evento assinado.
    // Concatenação por posição, sem String.replace: `$&` e `$$` num xCorrecao virariam padrões de substituição.
    const fim = xml.lastIndexOf('</retConsSitNFe>');
    return eventos.length === 0 ? xml : `${xml.slice(0, fim)}${eventos.join('')}${xml.slice(fim)}`;
  };
  if (!pre.ok) return ret(pre.status);
  // J01, J02 e J02a a J02g.
  if (text(pre.doc.root, 'tpAmb') !== ctx.rt.config.tpAmb) return ret(status('252'));
  const invalida = chaveRejection(chNFe, ctx.now, ctx.rt.config.offsetMinutes);
  if (invalida !== undefined) return ret(status(invalida.cStat));
  if (!ctx.rt.config.cUFsAtendidas.includes(chNFe.slice(0, 2))) return ret(status('226'));
  const nfe = ctx.rt.state.nfes.get(chNFe);
  if (nfe === undefined) {
    // J03 a J06: a mesma numeração com outra chave.
    // Emitente CPF nas séries 910 a 969 (NT 2018.001), com 000 à esquerda na chave.
    const serie = Number(chNFe.slice(22, 25));
    const emitente = serie >= 910 && serie <= 969 ? chNFe.slice(9, 20) : chNFe.slice(6, 20);
    const outra = ctx.rt.state.nfeByNumero(emitente, chNFe.slice(20, 22), chNFe.slice(22, 25), chNFe.slice(25, 34));
    if (outra === undefined) return ret(status('217'));
    if (outra.cNF !== chNFe.slice(35, 43)) return ret(status('562', { chNFe: outra.chave }));
    if (outra.chave.slice(2, 6) !== chNFe.slice(2, 6)) return ret(status('561'));
    return ret(status('613'));
  }
  const eventos = ctx.rt.state
    .eventosDa(chNFe)
    .filter((e) => EVENTOS_CONSULTA.has(e.tpEvento))
    .map((e) => procEventoXml(e));
  const situacao: Readonly<Record<string, string>> = { autorizada: '100', cancelada: '101', denegada: '110' };
  const protNFe = protNFeNaResposta(ctx.rt, 'consulta', nfe.prot);
  return ret(status(situacao[nfe.situacao] as string), { protNFe }, eventos);
}
