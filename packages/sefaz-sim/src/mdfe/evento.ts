/**
 * MDFeRecepcaoEvento (MOC MDF-e 3.00b Visão Geral, item 5.1, regras J01 a J16, e item 6, regras K de cada evento):
 * cancelamento (110111), encerramento (110112), inclusão de condutor (110114), inclusão de DF-e (110115) e pagamento
 * da operação de transporte (110116). O evento vem sozinho (sem lote) e o retorno é o `retEventoMDFe`.
 *
 * Os efeitos no estado: o cancelamento e o encerramento mudam a situação do MDF-e (101 e 132 na consulta, e o MDF-e
 * sai da lista de não encerrados); a inclusão de DF-e guarda as NF-e incluídas (K14 e as regras do cancelamento e do
 * encerramento com carregamento posterior).
 */

import type { ElementoXml } from '@sinete/core/xml';
import { atributoDe, elementosFilhos, textoDe } from '@sinete/core/xml';
import { serialize, serializeRoot } from '@sinete/schemas';
import type { TRetEvento } from '@sinete/schemas/mdfe/eventos/3.00b';
import { eventoMDFeElement, TRetEvento as RetEvento, retEventoMDFeElement } from '@sinete/schemas/mdfe/eventos/3.00b';
import { cnpjValido, cpfValido, lerChaveAcesso } from '@sinete/validators';
import { checkAssinatura } from '../certs.ts';
import type { RequestContext } from '../context.ts';
import type { MdfeEventoRecord, MdfeRecord } from '../state.ts';
import { parseDateTime, yearOf } from '../time.ts';
import { all, at, documento, req, text } from '../xmlutil.ts';
import {
  ativa,
  CINCO_MINUTOS,
  dhMdfe,
  emitenteDaChave,
  mesmoDocumento,
  preludeMdfe,
  statusMdfe,
  VERSAO,
  verAplicMdfe,
} from './comum.ts';

/**
 * Tipos de evento atendidos, com o elemento do `detEvento` que o schema específico do tipo exige (J06), o `xEvento` do
 * retorno e o maior `nSeqEvento` aceito (K01).
 */
const TIPOS: Readonly<Record<string, { readonly det: string; readonly xEvento: string; readonly maxSeq: number }>> = {
  '110111': { det: 'evCancMDFe', xEvento: 'Cancelamento', maxSeq: 1 },
  '110112': { det: 'evEncMDFe', xEvento: 'Encerramento', maxSeq: 1 },
  '110114': { det: 'evIncCondutorMDFe', xEvento: 'Inclusao Condutor', maxSeq: 99 },
  '110115': { det: 'evIncDFeMDFe', xEvento: 'Inclusao DF-e', maxSeq: 99 },
  '110116': { det: 'evPagtoOperMDFe', xEvento: 'Pagamento Operacao MDF-e', maxSeq: 1 },
};

const TOLERANCIA = 1n;
const centavos = (v: string | undefined): bigint => {
  const [i = '0', f = ''] = (v ?? '0').split('.');
  return BigInt(i) * 100n + BigInt(`${f}00`.slice(0, 2));
};

/**
 * Regras de pagamento do evento 110116 (Visão Geral, item 6.5, K07 a K16, as mesmas do grupo infPag do MDF-e), cada
 * uma desligável pelo próprio id, na ordem da tabela.
 */
function regraPagamento(ctx: RequestContext, det: ElementoXml, dataEvento: string): string | undefined {
  const dif = (a: bigint, b: bigint): bigint => (a > b ? a - b : b - a);
  for (const pag of all(det, 'infPag')) {
    const indPag = req(pag, 'indPag');
    const prazo = all(pag, 'infPrazo');
    if (ativa(ctx, 'K07') && indPag === '1' && prazo.length === 0) return '724';
    if (ativa(ctx, 'K08') && indPag === '0' && prazo.length > 0) return '729';
    const doc = documento(pag);
    const docInvalido =
      (doc.CNPJ !== undefined && !cnpjValido(doc.CNPJ)) || (doc.CPF !== undefined && !cpfValido(doc.CPF));
    if (ativa(ctx, 'K09') && docInvalido) return '727';
    const ipef = text(pag, 'infBanc/CNPJIPEF');
    if (ativa(ctx, 'K10') && ipef !== undefined && !cnpjValido(ipef)) return '728';
    const vContrato = centavos(text(pag, 'vContrato'));
    const comps = all(pag, 'Comp').reduce((s, c) => s + centavos(text(c, 'vComp')), 0n);
    if (ativa(ctx, 'K11') && dif(comps, vContrato) > TOLERANCIA) return '746';
    let anterior = '';
    for (const [n, p] of prazo.entries()) {
      if (ativa(ctx, 'K12') && req(p, 'nParcela') !== String(n + 1).padStart(3, '0')) return '735';
      const dVenc = req(p, 'dVenc');
      if (ativa(ctx, 'K13') && dVenc < dataEvento) return '736';
      if (ativa(ctx, 'K14') && dVenc < anterior) return '737';
      anterior = dVenc;
    }
    const vAdiant = text(pag, 'vAdiant');
    if (indPag === '1') {
      const soma = prazo.reduce((s, p) => s + centavos(text(p, 'vParcela')), 0n) + centavos(vAdiant);
      if (ativa(ctx, 'K15') && dif(soma, vContrato) > TOLERANCIA) return '738';
    }
    if (ativa(ctx, 'K16') && indPag === '0' && vAdiant !== undefined) return '739';
  }
  return undefined;
}

/** Regras específicas de cada tipo (item 6). */
function regrasDoTipo(
  ctx: RequestContext,
  tpEvento: string,
  det: ElementoXml,
  m: MdfeRecord,
  eventos: readonly MdfeEventoRecord[],
  dhEvento: string,
): { readonly cStat: string; readonly params?: Readonly<Record<string, string>> } | undefined {
  const cancelado = eventos.find((e) => e.tpEvento === '110111');
  const encerrado = eventos.find((e) => e.tpEvento === '110112');
  const r218 = cancelado && { cStat: '218', params: { nProt: cancelado.nProt, dhCanc: cancelado.dhRegEvento } };
  const r609 = encerrado && { cStat: '609', params: { nProt: encerrado.nProt, dhEnc: encerrado.dhRegEvento } };
  const inclusoes = eventos.filter((e) => e.tpEvento === '110115');
  const nProt = text(det, 'nProt');
  switch (tpEvento) {
    case '110111': {
      if (ativa(ctx, 'K03') && r218) return r218;
      const semInclusao = m.carregaPosterior && inclusoes.length === 0;
      if (ativa(ctx, 'K04') && !semInclusao && ctx.now - m.dhRecbtoMs > ctx.rt.config.prazoCancelamentoMdfeMs) {
        return { cStat: '220' };
      }
      if (ativa(ctx, 'K05') && nProt !== m.nProt) return { cStat: '222' };
      if (ativa(ctx, 'K06') && r609) return r609;
      if (
        ativa(ctx, 'K08') &&
        m.carregaPosterior &&
        inclusoes.some((e) => !m.cMunCarrega.includes(e.det.cMunCarrega ?? ''))
      ) {
        return { cStat: '710' };
      }
      return undefined;
    }
    case '110112': {
      const cUF = req(det, 'cUF');
      const cMun = req(det, 'cMun');
      if (ativa(ctx, 'K03') && cUF !== '99' && cMun.slice(0, 2) !== cUF) return { cStat: '614' };
      if (ativa(ctx, 'K04') && cUF === '99' && cMun !== '9999999') return { cStat: '689' };
      if (ativa(ctx, 'K06') && r218) return r218;
      if (ativa(ctx, 'K07') && req(det, 'dtEnc') < m.dhEmi.slice(0, 10)) return { cStat: '615' };
      if (ativa(ctx, 'K08') && nProt !== m.nProt) return { cStat: '222' };
      if (ativa(ctx, 'K09') && r609) return r609;
      if (ativa(ctx, 'K10') && m.carregaPosterior && inclusoes.length === 0) return { cStat: '715' };
      return undefined;
    }
    case '110114': {
      if (ativa(ctx, 'K03') && r218) return r218;
      if (ativa(ctx, 'K04') && r609) return r609;
      if (ativa(ctx, 'K05') && m.modal !== '1') return { cStat: '644' };
      if (ativa(ctx, 'K06') && !cpfValido(req(det, 'condutor/CPF'))) return { cStat: '645' };
      return undefined;
    }
    case '110115': {
      if (ativa(ctx, 'K03') && r218) return r218;
      if (ativa(ctx, 'K04') && r609) return r609;
      if (ativa(ctx, 'K05') && !m.carregaPosterior) return { cStat: '708' };
      const cUFIni = m.cMunCarrega[0]?.slice(0, 2);
      if (ativa(ctx, 'K06') && req(det, 'cMunCarrega').slice(0, 2) !== cUFIni) return { cStat: '456' };
      const jaIncluidas = new Set(inclusoes.flatMap((e) => e.chNFe));
      for (const d of all(det, 'infDoc')) {
        if (ativa(ctx, 'K08') && req(d, 'cMunDescarga').slice(0, 2) !== cUFIni) return { cStat: '612' };
        const ch = req(d, 'chNFe');
        const c = lerChaveAcesso(ch);
        if (ativa(ctx, 'K10') && (!c.ok || c.valor.mod !== '55')) {
          return { cStat: '709', params: { Motivo: c.ok ? 'Modelo diferente de 55' : c.erro.mensagem } };
        }
        if (ativa(ctx, 'K14') && jaIncluidas.has(ch)) return { cStat: '711' };
      }
      return undefined;
    }
    case '110116': {
      if (ativa(ctx, 'K03') && nProt !== m.nProt) return { cStat: '222' };
      if (ativa(ctx, 'K04') && r218) return r218;
      if (ativa(ctx, 'K05') && m.modal !== '1') return { cStat: '722' };
      if (ativa(ctx, 'K06') && m.tpProp !== '0') return { cStat: '723' };
      const pag = regraPagamento(ctx, det, dhEvento.slice(0, 10));
      return pag === undefined ? undefined : { cStat: pag };
    }
    default:
      return undefined;
  }
}

/** MDFeRecepcaoEvento (mdfeRecepcaoEvento). */
export async function recepcaoEventoMdfe(ctx: RequestContext): Promise<string> {
  const pre = await preludeMdfe(ctx, eventoMDFeElement);
  const doc = pre.doc;
  const inf = doc === undefined ? undefined : at(doc.raiz, 'infEvento');
  const lido = (local: string): string | undefined => (inf === undefined ? undefined : text(inf, local));
  const chMDFe = lido('chMDFe');
  const tpEvento = lido('tpEvento');
  const nSeqEvento = lido('nSeqEvento');
  const cOrgao = lido('cOrgao');
  const ret = (value: TRetEvento): string => serializeRoot(retEventoMDFeElement, value);
  const base = {
    tpAmb: ctx.rt.config.tpAmb,
    verAplic: verAplicMdfe(),
    cOrgao: (cOrgao !== undefined && /^[0-9]{2}$/.test(cOrgao) ? cOrgao : '43') as TRetEvento['infEvento']['cOrgao'],
  };
  const rejeitado = (cStat: string, params?: Readonly<Record<string, string>>): string =>
    ret({
      versao: VERSAO,
      infEvento: {
        ...base,
        cStat,
        xMotivo: statusMdfe(cStat, params).xMotivo,
        ...(chMDFe !== undefined && /^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/.test(chMDFe) ? { chMDFe } : {}),
        ...(tpEvento !== undefined && /^[0-9]{6}$/.test(tpEvento) ? { tpEvento } : {}),
        ...(nSeqEvento !== undefined && /^[0-9]{1,3}$/.test(nSeqEvento) ? { nSeqEvento } : {}),
      },
    });
  if (!pre.ok) {
    // J06: a falha de schema está só no detalhe do evento (o schema do tipo, pelo tpEvento e pela versaoEvento).
    const soDetalhe = pre.schemaPaths?.every((p) => /\/detEvento(?:\/|\[|$)/.test(p));
    return rejeitado(pre.status.cStat === '215' && soDetalhe === true ? '630' : pre.status.cStat);
  }
  const infEl = inf as ElementoXml;
  const id = atributoDe(infEl, 'Id') ?? '';
  const autor = documento(infEl);
  const sig = await checkAssinatura({ doc: pre.doc, id, element: 'infEvento', now: ctx.now, titular: autor });
  if (!sig.ok) return rejeitado(sig.cStat === '227' ? '202' : sig.cStat);
  const ch = chMDFe ?? '';
  const tp = tpEvento ?? '';
  const nSeq = Number(nSeqEvento);
  // J01 a J09
  if (ativa(ctx, 'J01') && lido('tpAmb') !== ctx.rt.config.tpAmb) return rejeitado('252');
  if (ativa(ctx, 'J02') && autor.CNPJ !== undefined && !cnpjValido(autor.CNPJ)) return rejeitado('627');
  if (ativa(ctx, 'J03') && autor.CPF !== undefined && !cpfValido(autor.CPF)) return rejeitado('700');
  const idEsperado = `ID${tp}${ch}${String(nSeq).padStart(nSeq > 99 ? 3 : 2, '0')}`;
  if (ativa(ctx, 'J04') && id !== idEsperado) return rejeitado('628');
  const tipo = TIPOS[tp];
  if (ativa(ctx, 'J05') && tipo === undefined) return rejeitado('629');
  const det = at(infEl, 'detEvento') as ElementoXml;
  const detEv = elementosFilhos(det)[0] as ElementoXml;
  // J06: o schema combinado aceita qualquer detalhe conhecido; o do tipo declarado é o que vale (630).
  if (ativa(ctx, 'J06') && tipo !== undefined && detEv.local !== tipo.det) return rejeitado('630');
  const c = lerChaveAcesso(ch);
  if (ativa(ctx, 'J07') && (!c.ok || c.valor.mod !== '58')) {
    return rejeitado('236', { Motivo: c.ok ? 'Modelo diferente de 58' : c.erro.mensagem });
  }
  const eventos = ctx.rt.state.eventosDoMdfe(ch);
  const duplicado = eventos.find((e) => e.cOrgao === cOrgao && e.tpEvento === tp && e.nSeqEvento === nSeq);
  if (ativa(ctx, 'J08') && duplicado !== undefined) {
    return rejeitado('631', { nProt: duplicado.nProt, dhRegEvento: duplicado.dhRegEvento });
  }
  // J09 com a redação da NT 2024.001: no encerramento pelo transportador terceiro (indEncPorTerceiro), o autor é o
  // proprietário do veículo de tração, conferido depois de achar o MDF-e; nos demais, o emitente da chave.
  const porTerceiro = tp === '110112' && text(detEv, 'indEncPorTerceiro') === '1';
  if (ativa(ctx, 'J09') && !porTerceiro && !mesmoDocumento(autor, emitenteDaChave(ch))) return rejeitado('632');
  // J12 e J13: o MDF-e existe com esta chave.
  const m = ctx.rt.state.mdfes.get(ch);
  if (m === undefined) {
    const e = emitenteDaChave(ch);
    const outra = ctx.rt.state.mdfeByNumero(e.CNPJ ?? e.CPF ?? '', ch.slice(22, 25), ch.slice(25, 34));
    return rejeitado(outra === undefined ? '217' : '600');
  }
  if (porTerceiro) {
    const proprietario = m.proprietario;
    if (ativa(ctx, 'J09') && (proprietario === undefined || !mesmoDocumento(autor, proprietario))) {
      return rejeitado('632');
    }
    // K11 (NT 2024.001): o terceiro tem de ser diferente do emitente.
    if (ativa(ctx, 'K11') && mesmoDocumento(autor, emitenteDaChave(ch))) return rejeitado('524');
  }
  // J14 a J16: datas com 5 minutos de tolerância.
  const dhEvento = lido('dhEvento') ?? '';
  const dhEventoMs = parseDateTime(dhEvento) ?? ctx.now;
  if (ativa(ctx, 'J14') && dhEventoMs < m.dhEmiMs - CINCO_MINUTOS) return rejeitado('634');
  if (ativa(ctx, 'J15') && dhEventoMs < m.dhRecbtoMs - CINCO_MINUTOS) return rejeitado('637');
  if (ativa(ctx, 'J16') && dhEventoMs > ctx.now + CINCO_MINUTOS) return rejeitado('635');
  // K01: sequencial.
  if (ativa(ctx, 'K01') && tipo !== undefined && nSeq > tipo.maxSeq) return rejeitado('636');
  const r = regrasDoTipo(ctx, tp, detEv, m, eventos, dhEvento);
  if (r !== undefined) return rejeitado(r.cStat, r.params);

  const nProt = ctx.rt.state.nextProtocolo('9', m.cUF, yearOf(ctx.now, ctx.rt.config.offsetMinutes));
  const dhRegEvento = dhMdfe(ctx, ctx.now);
  const valor: TRetEvento = {
    versao: VERSAO,
    infEvento: {
      ...base,
      cStat: '135',
      xMotivo: statusMdfe('135').xMotivo,
      chMDFe: ch,
      tpEvento: tp,
      xEvento: tipo?.xEvento ?? tp,
      nSeqEvento: nSeqEvento ?? '1',
      dhRegEvento,
      nProt,
    },
  };
  const detalhe: Record<string, string> = {};
  for (const x of elementosFilhos(detEv)) if (elementosFilhos(x).length === 0) detalhe[x.local] = textoDe(x);
  ctx.rt.state.eventosMdfe.push({
    chave: ch,
    tpEvento: tp,
    nSeqEvento: nSeq,
    cOrgao: cOrgao ?? '',
    dhEvento,
    dhRegEvento,
    nProt,
    det: detalhe,
    chNFe: tp === '110115' ? all(detEv, 'infDoc').map((d) => req(d, 'chNFe')) : [],
    xml: pre.payload,
    retEvento: serialize(RetEvento, 'retEventoMDFe', valor, pre.doc.raiz.ns),
  });
  if (tp === '110111') m.situacao = 'cancelado';
  if (tp === '110112') m.situacao = 'encerrado';
  return ret(valor);
}
