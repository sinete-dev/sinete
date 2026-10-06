/**
 * NFeAutorizacao4 e NFeRetAutorizacao4 (MOC 7.0 Visão Geral, itens 5.1 e 5.2; regras do Anexo I, item 4.2.1).
 *
 * Síncrono (`indSinc=1`): o lote de uma NF-e é processado na hora e o `retEnviNFe` traz o `protNFe` (cStat 104).
 * Assíncrono (`indSinc=0`): o lote recebe um recibo (103) e é processado quando o relógio injetado passa do atraso
 * configurado; até lá a consulta do recibo devolve 105. O processamento é preguiçoso e determinístico: acontece no
 * primeiro pedido depois do instante (ou em `processarLotes()`), sempre na ordem de recebimento.
 */

import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { atributoDe, lerXml } from '@sinete/core/xml';
import type { ElementoRaiz } from '@sinete/schemas';
import { serializarRaiz, VIGENCIAS } from '@sinete/schemas';
import * as PL_010e from '@sinete/schemas/nfe/PL_010e';
import type { TProtNFe, TRetConsReciNFe, TRetEnviNFe } from '@sinete/schemas/nfe/PL_010f';
import * as PL_010f from '@sinete/schemas/nfe/PL_010f';
import { conferirAssinaturaDoDocumento } from '../certs.ts';
import type { ContextoDoPedido, EstadoDeExecucao, Status, Svc } from '../context.ts';
import { dh, omitirDigVal, prelude, status, svcAtual, tipoAutorizador, verAplic } from '../context.ts';
import { standalone } from '../docs.ts';
import { ehDenegacao, motivo } from '../messages.ts';
import { assinaturaDoQrCodeConfere, parametrosDoQrCode } from '../nfce.ts';
import type { FatosNfe, VisaoSim } from '../rules.ts';
import { primeiraRejeicao } from '../rules.ts';
import type { AutorizadorSim } from '../services.ts';
import type {
  Contribuinte,
  NfePendente,
  RegistroEvento,
  RegistroInutilizacao,
  RegistroLote,
  RegistroNfe,
} from '../state.ts';
import { docKey } from '../state.ts';
import { recepcaoSvcRecusada } from '../svc.ts';
import { parseDateTime, yearOf } from '../time.ts';
import { all, at, documento, req, text } from '../xmlutil.ts';
import { distribuirAutorizacao } from './distribuicao.ts';

type Tpl = { readonly enviNFeElement: ElementoRaiz<unknown>; readonly consReciNFeElement: ElementoRaiz<unknown> };
const MODULOS: Readonly<Record<string, Tpl>> = { 'nfe/PL_010e': PL_010e, 'nfe/PL_010f': PL_010f };

/**
 * PL aceitos: todos cuja vigência já começou no ambiente, do mais novo para o mais antigo (a SEFAZ convive com o PL
 * anterior durante a transição). O dia é o do fuso do autorizador. Antes do primeiro PL gerado, vale o mais antigo.
 */
export function plsAceitos(rt: EstadoDeExecucao, now: number): Tpl[] {
  const dia = dh({ rt }, now).slice(0, 10);
  const campo = rt.configuracao.ambiente === 'producao' ? 'producao' : 'homologacao';
  const modulos = (entries: readonly { readonly modulo: string }[]): Tpl[] =>
    entries.map((v) => MODULOS[v.modulo]).filter((m): m is Tpl => m !== undefined);
  const vigentes = VIGENCIAS.nfe.filter((v) => {
    const inicio = v[campo];
    return inicio === null || inicio <= dia;
  });
  const aceitos = modulos(vigentes).reverse();
  return aceitos.length > 0 ? aceitos : modulos(VIGENCIAS.nfe).slice(0, 1);
}

function retEnviNFe(
  ctx: ContextoDoPedido,
  s: Status,
  extra: Pick<TRetEnviNFe, 'infRec'> | Pick<TRetEnviNFe, 'protNFe'> = {},
): string {
  const value = {
    versao: '4.00',
    tpAmb: ctx.rt.configuracao.tpAmb,
    verAplic: verAplic(ctx),
    cStat: s.cStat,
    xMotivo: s.xMotivo,
    cUF: ctx.rt.configuracao.cUF,
    dhRecbto: dh(ctx, ctx.agora),
    ...extra,
  } as TRetEnviNFe;
  return serializarRaiz(PL_010f.retEnviNFeElement, value);
}

/**
 * Visão somente leitura do estado para as regras. `nRec` é o recibo do lote em processamento: o 635 só enxerga os
 * lotes recebidos antes dele. Sem `nRec` (eventos, inutilização), todos os lotes pendentes contam.
 */
export function viewOf(rt: EstadoDeExecucao, nRec?: string, svc?: Svc): VisaoSim {
  const st = rt.estado;
  return {
    configuracao: rt.configuracao,
    contingencia: svc ?? svcAtual(rt),
    nfe: (chave: string): RegistroNfe | undefined => st.nfes.get(chave),
    nfePorNumero: (e: string, m: string, s: string, n: string): RegistroNfe | undefined => st.nfeByNumero(e, m, s, n),
    pendentePorNumero: (e: string, m: string, s: string, n: string): NfePendente | undefined =>
      st.pendingByNumero(e, m, s, n, nRec),
    inutilizacaoCom: (c: string, a: string, m: string, s: number, n: number): RegistroInutilizacao | undefined =>
      st.inutilizacaoCom(c, a, m, s, n),
    inutilizacoes: (): readonly RegistroInutilizacao[] => st.inutilizacoes,
    eventos: (chave: string): readonly RegistroEvento[] => st.eventosDa(chave),
    contribuinte: (uf: string, ie: string): Contribuinte | undefined =>
      rt.configuracao.cadastro.find((c) => c.UF === uf && c.IE === ie),
  };
}

function factsOf(nfe: ElementoXml): { facts: FatosNfe; inf: ElementoXml } {
  const inf = at(nfe, 'infNFe') as ElementoXml;
  const ide = at(inf, 'ide');
  const emit = at(inf, 'emit');
  const ie = text(emit, 'IE');
  const destEl = at(inf, 'dest');
  const idEstrangeiro = text(destEl, 'idEstrangeiro');
  const indIEDest = text(destEl, 'indIEDest');
  const dest =
    destEl === undefined
      ? undefined
      : {
          ...documento(destEl),
          ...(idEstrangeiro === undefined ? {} : { idEstrangeiro }),
          ...(indIEDest === undefined ? {} : { indIEDest }),
        };
  const itens = all(inf, 'det').map((det) => {
    const icms = at(det, 'imposto/ICMS')?.filhos.find((f): f is ElementoXml => f.tipo === 'elemento');
    const cst = text(icms, 'CST');
    const anp = text(det, 'prod/comb/cProdANP');
    return {
      CFOP: req(det, 'prod/CFOP'),
      NCM: req(det, 'prod/NCM'),
      ...(cst === undefined ? {} : { CST: cst }),
      veicProd: at(det, 'prod/veicProd') !== undefined,
      ...(anp === undefined ? {} : { cProdANP: anp }),
    };
  });
  const tpNFCredito = text(ide, 'tpNFCredito');
  const supl = at(nfe, 'infNFeSupl');
  const qrCode = text(supl, 'qrCode')?.trim();
  const facts: FatosNfe = {
    id: atributoDe(inf, 'Id') ?? '',
    cUF: req(ide, 'cUF'),
    cNF: req(ide, 'cNF'),
    mod: req(ide, 'mod'),
    serie: req(ide, 'serie'),
    nNF: req(ide, 'nNF'),
    dhEmi: req(ide, 'dhEmi'),
    tpEmis: req(ide, 'tpEmis'),
    cDV: req(ide, 'cDV'),
    tpAmb: req(ide, 'tpAmb'),
    emitente: {
      ...documento(emit),
      xNome: req(emit, 'xNome'),
      UF: req(emit, 'enderEmit/UF'),
      ...(ie === undefined ? {} : { IE: ie }),
    },
    ide: {
      tpNF: req(ide, 'tpNF'),
      idDest: req(ide, 'idDest'),
      tpImp: req(ide, 'tpImp'),
      finNFe: req(ide, 'finNFe'),
      indFinal: req(ide, 'indFinal'),
      indPres: req(ide, 'indPres'),
      ...(tpNFCredito === undefined ? {} : { tpNFCredito }),
    },
    itens,
    vNF: req(inf, 'total/ICMSTot/vNF'),
    ...(dest === undefined ? {} : { destinatario: dest }),
    supl: qrCode === undefined ? {} : { qrCode },
  };
  return { facts, inf };
}

/** O `protNFe` como sai na resposta `onde`: sem `digVal` quando o simulador foi configurado assim. */
export function protNFeNaResposta(rt: EstadoDeExecucao, onde: 'autorizacao' | 'consulta', prot: TProtNFe): TProtNFe {
  const inf = prot.infProt;
  if (inf.digVal === undefined || !omitirDigVal(rt, onde, inf.cStat)) return prot;
  const { digVal: _, ...semDigVal } = inf;
  return { ...prot, infProt: semDigVal };
}

interface Processed {
  readonly prot: TProtNFe;
}

/** Processa uma NF-e de um lote: grupos E e F, regras de negócio e gravação no estado. */
async function processNfe(
  rt: EstadoDeExecucao,
  quem: { readonly autorizador: AutorizadorSim; readonly svc: Svc | undefined },
  doc: DocumentoXml,
  nfeEl: ElementoXml,
  now: number,
  nRec: string,
): Promise<Processed> {
  const lidos = factsOf(nfeEl);
  const { inf } = lidos;
  let facts = lidos.facts;
  const chave = facts.id.replace(/^NFe/, '');
  const { autorizador, svc } = quem;
  const ctxLike = { rt, autorizador, svc };
  const base = { tpAmb: rt.configuracao.tpAmb, verAplic: verAplic(ctxLike), chNFe: chave, dhRecbto: dh(ctxLike, now) };
  const rejected = (cStat: string, params?: Readonly<Record<string, string>>): Processed => ({
    prot: { versao: '4.00', infProt: { ...base, cStat, xMotivo: motivo(cStat, params) } },
  });
  const sig = await conferirAssinaturaDoDocumento({
    documento: doc,
    id: facts.id,
    elemento: 'infNFe',
    agora: now,
    titular: facts.emitente,
  });
  if (!sig.ok) return rejected(sig.cStat);
  // ZX02-338: a assinatura do QR Code versão 3 off-line confere com o certificado da nota; a regra lê o resultado.
  const qr = facts.supl?.qrCode;
  const params = qr === undefined ? undefined : parametrosDoQrCode(qr);
  if (facts.tpEmis === '9' && params?.[1] === '3') {
    const assinaturaConfere = await assinaturaDoQrCodeConfere(params, sig.certificadoDer);
    facts = { ...facts, supl: { ...facts.supl, assinaturaConfere } };
  }
  const r = primeiraRejeicao(rt.configuracao.regras.autorizacao, {
    nfe: facts,
    chave,
    autorizador,
    visao: viewOf(rt, nRec, svc),
    agora: now,
  });
  if (r !== undefined && !ehDenegacao(r.cStat)) return rejected(r.cStat, r.parametros);
  const cStat = r === undefined ? '100' : r.cStat;
  const nProt = rt.estado.nextProtocolo(
    tipoAutorizador(ctxLike),
    facts.cUF,
    yearOf(now, rt.configuracao.deslocamentoMin),
  );
  const infProt = { ...base, nProt, digVal: sig.digestValue, cStat, xMotivo: motivo(cStat, r?.parametros) };
  const prot: TProtNFe = { versao: '4.00', infProt: { Id: `ID${nProt}`, ...infProt } };
  const dest = at(inf, 'dest');
  const destDoc = documento(dest);
  const terceiros = [
    ...all(inf, 'autXML').map((a) => docKey(documento(a))),
    docKey(documento(at(inf, 'transp/transporta'))),
  ].filter((x): x is string => x !== undefined);
  const record: RegistroNfe = {
    chave,
    cUF: facts.cUF,
    mod: facts.mod,
    serie: facts.serie,
    nNF: facts.nNF,
    cNF: facts.cNF,
    tpEmis: facts.tpEmis,
    tpNF: req(at(inf, 'ide'), 'tpNF'),
    dhEmi: facts.dhEmi,
    dhEmiMs: parseDateTime(facts.dhEmi) ?? now,
    vNF: req(inf, 'total/ICMSTot/vNF'),
    emitente: facts.emitente,
    destinatario: destDoc.CNPJ === undefined && destDoc.CPF === undefined ? undefined : destDoc,
    terceiros: [...new Set(terceiros)],
    xml: standalone(doc.texto, nfeEl),
    digVal: sig.digestValue,
    nRec,
    nProt,
    cStat,
    xMotivo: infProt.xMotivo,
    dhRecbto: base.dhRecbto,
    dhRecbtoMs: now,
    prot,
    situacao: cStat === '100' ? 'autorizada' : 'denegada',
    liberadaAoDestinatario: false,
  };
  rt.estado.nfes.set(chave, record);
  distribuirAutorizacao(rt.estado, record);
  return { prot };
}

async function processLote(rt: EstadoDeExecucao, lote: RegistroLote): Promise<void> {
  const doc = lerXml(lote.payload);
  // O 635 só olha lotes recebidos antes deste (viewOf com o nRec), então as NF-e do lote não contam para si. O
  // resultado é publicado de uma vez no fim; o simulador atende um pedido por vez, então ninguém vê o lote pela metade.
  const protNFe: TProtNFe[] = [];
  for (const nfeEl of all(doc.raiz, 'NFe')) {
    protNFe.push((await processNfe(rt, lote, doc, nfeEl, lote.disponivelEm, lote.nRec)).prot);
  }
  lote.protNFe = protNFe;
  lote.processadoEm = dh({ rt }, lote.disponivelEm);
}

/** Processa, na ordem de recebimento, os lotes assíncronos cujo instante de processamento já passou. */
export async function settleLotes(rt: EstadoDeExecucao, now: number): Promise<void> {
  for (const lote of rt.estado.lotes.values()) {
    if (lote.protNFe === undefined && lote.disponivelEm <= now) await processLote(rt, lote);
  }
}

/** NFeAutorizacao4 (nfeAutorizacaoLote). */
export async function autorizacao(ctx: ContextoDoPedido): Promise<string> {
  const pls = plsAceitos(ctx.rt, ctx.agora);
  const pre = prelude(ctx, { roots: pls.map((p) => p.enviNFeElement), lote: true });
  if (!pre.ok) return retEnviNFe(ctx, pre.status);
  const doc = pre.doc;
  const nfes = all(doc.raiz, 'NFe');
  const indSinc = text(doc.raiz, 'indSinc');
  // GAP03a-1 e GAP03a-2 (Anexo I, DA), B06-20 (lote com NF-e e NFC-e).
  if (indSinc === '1' && nfes.length > 1) return retEnviNFe(ctx, status('764'));
  if (indSinc === '1' && ctx.rt.configuracao.respostaSincrona === 'recusa') return retEnviNFe(ctx, status('776'));
  const modelos = new Set(nfes.map((n) => text(n, 'infNFe/ide/mod')));
  if (modelos.size > 1) return retEnviNFe(ctx, status('765'));
  // GAP03a-4 (NT 2023.002 v1.00, item 3.1): o lote de NFC-e tem uma nota só.
  if (modelos.has('65') && nfes.length > 1) return retEnviNFe(ctx, status('126'));
  const cUFs = new Set(nfes.map((n) => text(n, 'infNFe/ide/cUF')));
  // B05: UF atendida pelo web service (410), antes das regras de cada NF-e.
  if ([...cUFs].some((c) => c === undefined || !ctx.rt.configuracao.cUFsAtendidas.includes(c))) {
    return retEnviNFe(ctx, status('410'));
  }
  // C03.2 e GB02.2 (NT 2013.007 v1.03, item 04.1): a SVC só recebe da UF para a qual a SEFAZ de origem a ativou.
  const semSvc = ctx.autorizador === 'svc' ? recepcaoSvcRecusada(ctx.rt, cUFs as Set<string>, ctx.agora) : undefined;
  if (semSvc !== undefined) return retEnviNFe(ctx, semSvc);
  const nRec = ctx.rt.estado.nextRecibo(ctx.rt.configuracao.cUF, tipoAutorizador(ctx));
  const sincrono = indSinc === '1' && ctx.rt.configuracao.respostaSincrona === 'aceita';
  const lote: RegistroLote = {
    nRec,
    autorizador: ctx.autorizador === 'svc' ? 'svc' : 'uf',
    svc: ctx.autorizador === 'svc' ? svcAtual(ctx.rt) : undefined,
    recebidoEm: ctx.agora,
    disponivelEm: ctx.agora + ctx.rt.configuracao.atrasoProcessamentoMs,
    dhRecbto: dh(ctx, ctx.agora),
    payload: ctx.payload,
    pendente: nfes.map((n) => {
      const emit = documento(at(n, 'infNFe/emit'));
      return {
        chave: (atributoDe(at(n, 'infNFe') as ElementoXml, 'Id') ?? '').replace(/^NFe/, ''),
        chaveDoEmitente: docKey(emit) ?? '',
        mod: req(n, 'infNFe/ide/mod'),
        serie: req(n, 'infNFe/ide/serie'),
        nNF: req(n, 'infNFe/ide/nNF'),
      };
    }),
    transmissor: docKey(ctx.transmissor),
    protNFe: undefined,
    processadoEm: undefined,
  };
  // O lote síncrono também fica registrado, processado: o recibo que o 204 devolve continua consultável.
  ctx.rt.estado.lotes.set(nRec, lote);
  if (sincrono) {
    const { prot } = await processNfe(ctx.rt, lote, doc, nfes[0] as ElementoXml, ctx.agora, nRec);
    lote.protNFe = [prot];
    lote.processadoEm = dh(ctx, ctx.agora);
    return retEnviNFe(ctx, status('104'), { protNFe: protNFeNaResposta(ctx.rt, 'autorizacao', prot) });
  }
  const tMed = String(Math.max(1, Math.ceil(ctx.rt.configuracao.atrasoProcessamentoMs / 1000)));
  return retEnviNFe(ctx, status('103'), { infRec: { nRec, tMed } });
}

/** NFeRetAutorizacao4 (nfeRetAutorizacaoLote): consulta do recibo. */
export async function retAutorizacao(ctx: ContextoDoPedido): Promise<string> {
  const pls = plsAceitos(ctx.rt, ctx.agora);
  const pre = prelude(ctx, { roots: pls.map((p) => p.consReciNFeElement), lote: false });
  const nRecLido = pre.doc === undefined ? undefined : text(pre.doc.raiz, 'nRec');
  const nRec = nRecLido !== undefined && /^[0-9]{15}$/.test(nRecLido) ? nRecLido : '0'.repeat(15);
  const ret = (s: Status, extra: Pick<TRetConsReciNFe, 'protNFe'> = {}): string => {
    const value: TRetConsReciNFe = {
      versao: '4.00',
      tpAmb: ctx.rt.configuracao.tpAmb,
      verAplic: verAplic(ctx),
      nRec,
      cStat: s.cStat,
      xMotivo: s.xMotivo,
      cUF: ctx.rt.configuracao.cUF as TRetConsReciNFe['cUF'],
      dhRecbto: dh(ctx, ctx.agora),
      ...extra,
    };
    return serializarRaiz(PL_010f.retConsReciNFeElement, value);
  };
  if (!pre.ok) return ret(pre.status);
  // B24-10 (252) e 248 (UF do recibo diverge da UF autorizadora).
  if (text(pre.doc.raiz, 'tpAmb') !== ctx.rt.configuracao.tpAmb) return ret(status('252'));
  if (nRec.slice(0, 2) !== ctx.rt.configuracao.cUF) return ret(status('248'));
  const lote = ctx.rt.estado.lotes.get(nRec);
  const mesmoAutorizador = lote !== undefined && (lote.autorizador === 'svc') === (ctx.autorizador === 'svc');
  if (lote === undefined || !mesmoAutorizador) return ret(status('106'));
  const quem = docKey(ctx.transmissor);
  if (lote.transmissor !== undefined && quem !== undefined && lote.transmissor !== quem) return ret(status('223'));
  if (lote.protNFe === undefined) return ret(status('105'));
  return ret(status('104'), { protNFe: lote.protNFe.map((p) => protNFeNaResposta(ctx.rt, 'autorizacao', p)) });
}
