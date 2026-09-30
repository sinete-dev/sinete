/**
 * MDFeRecepcaoSinc (MOC MDF-e 3.00b Visão Geral, item 4.2; Anexo I, grupo F): recepção síncrona de um MDF-e, com a
 * área de dados em GZip e Base64. As regras que o simulador aplica, na ordem do Anexo I:
 *
 * - F01 (252) ambiente, F02 (247) UF do emitente e da chave, F03 (227) composição do `Id`, F05 (253) DV;
 * - F67/F68 (207, 210) documento do emitente, F69 a F71 (232, 233, 234) série e tipo do emitente pessoa física;
 * - F79 (212) emissão no futuro, F80 (228) emissão normal com mais de 24 horas;
 * - F30a e F37a (518, 519) chave de CT-e ou NF-e anterior a 6 meses da autorização e F89c (523) cavalo mecânico sem
 *   reboque, da NT 2024.001;
 * - F114 a F118 (480, 479, 481, 482, 488) QR Code;
 * - F81 (539) e F82 (204) duplicidade;
 * - F85 (611), F86 (686), F87 (462) e F88 (662) MDF-e não encerrados.
 *
 * Grupos D e E pela assinatura (290 a 298; 213 e 202 contra o emitente). Fora do simulador: cadastro de emitente e
 * de municípios, bases da ANTT (RNTRC, CIOT) e de NF-e e CT-e referenciados, e a conferência do `sign` do QR Code
 * (F119).
 */

import { ehUf, ufPorSigla } from '@sinete/core';
import type { ElementoXml } from '@sinete/core/xml';
import { atributoDe } from '@sinete/core/xml';
import { serializarRaiz } from '@sinete/schemas';
import type { TProtMDFe, TRetMDFe } from '@sinete/schemas/mdfe/3.00b';
import { MDFeElement, retMDFeElement } from '@sinete/schemas/mdfe/3.00b';
import { calcularDvChaveAcesso, cnpjValido, cpfValido } from '@sinete/validators';
import { checkAssinatura } from '../certs.ts';
import type { RequestContext, Status } from '../context.ts';
import { omitirDigVal } from '../context.ts';
import { standalone } from '../docs.ts';
import type { MdfeRecord } from '../state.ts';
import { parseDateTime, utcParts, yearOf } from '../time.ts';
import { all, at, documento, req, text } from '../xmlutil.ts';
import {
  ativa,
  CINCO_MINUTOS,
  CUF_SVRS,
  dhMdfe,
  marcadores,
  mesmoDocumento,
  preludeMdfe,
  raiz,
  statusMdfe,
  VERSAO,
  verAplicMdfe,
} from './comum.ts';

const QR_BASE = 'https://dfe-portal.svrs.rs.gov.br/mdfe/qrcode';
const DIA = 86_400_000;
/** Idade máxima, em meses, do ano e mês da chave de um documento vinculado (NT 2024.001 v1.02, F30a e F37a). */
const MESES_CHAVE_ANTIGA = 6;

const cUFDe = (uf: string): string | undefined => (ehUf(uf) ? ufPorSigla(uf)?.cUF : undefined);

function naoEncerrados(ctx: RequestContext): MdfeRecord[] {
  return [...ctx.rt.state.mdfes.values()]
    .filter((m) => m.situacao === 'autorizado')
    .sort((a, b) => a.dhRecbtoMs - b.dhRecbtoMs);
}

/** MDFeRecepcaoSinc (mdfeRecepcao). */
export async function recepcaoMdfe(ctx: RequestContext): Promise<string> {
  const ret = (s: Status, prot?: TProtMDFe): string => {
    const value: TRetMDFe = {
      versao: VERSAO,
      tpAmb: ctx.rt.config.tpAmb,
      cUF: CUF_SVRS as TRetMDFe['cUF'],
      verAplic: verAplicMdfe(),
      cStat: s.cStat,
      xMotivo: s.xMotivo,
      ...(prot === undefined ? {} : { protMDFe: prot }),
    };
    return serializarRaiz(retMDFeElement, value);
  };
  const pre = await preludeMdfe(ctx, MDFeElement);
  if (!pre.ok) return ret(pre.status);
  const doc = pre.doc;
  const inf = at(doc.raiz, 'infMDFe') as ElementoXml;
  const ide = at(inf, 'ide') as ElementoXml;
  const emit = at(inf, 'emit') as ElementoXml;
  const id = atributoDe(inf, 'Id') ?? '';
  const chave = id.slice(4);
  const emitente = documento(emit);
  const now = ctx.now;
  const rej = (cStat: string, params?: Readonly<Record<string, string>>): string => ret(statusMdfe(cStat, params));

  // Grupos D e E: assinatura sobre o documento como recebido; E04 do MDF-e é 202 (a NF-e usa 227).
  const sig = await checkAssinatura({ doc, id, element: 'infMDFe', now, titular: emitente });
  if (!sig.ok) return rej(sig.cStat === '227' ? '202' : sig.cStat);

  const tpAmb = req(ide, 'tpAmb');
  const cUF = req(ide, 'cUF');
  const serie = req(ide, 'serie');
  const nMDF = req(ide, 'nMDF');
  const cMDF = req(ide, 'cMDF');
  const tpEmis = req(ide, 'tpEmis');
  const tpEmit = req(ide, 'tpEmit');
  const dhEmi = req(ide, 'dhEmi');
  const dhEmiMs = parseDateTime(dhEmi) ?? now;
  if (ativa(ctx, 'F01') && tpAmb !== ctx.rt.config.tpAmb) return rej('252');
  if (ativa(ctx, 'F02') && cUFDe(req(emit, 'enderEmit/UF')) !== cUF) return rej('247');
  // F03: "MDFe" + cUF, AAMM do dhEmi, CNPJ ou 000 + CPF, 58, série, número, tpEmis, cMDF e cDV.
  const doc14 = emitente.CNPJ ?? `000${emitente.CPF ?? ''}`;
  const base = `${cUF}${dhEmi.slice(2, 4)}${dhEmi.slice(5, 7)}${doc14}58${serie.padStart(3, '0')}${nMDF.padStart(9, '0')}${tpEmis}${cMDF}`;
  if (ativa(ctx, 'F03') && `${base}${req(ide, 'cDV')}` !== chave) return rej('227');
  if (ativa(ctx, 'F05') && calcularDvChaveAcesso(base) !== req(ide, 'cDV')) return rej('253');
  if (emitente.CNPJ !== undefined && !cnpjValido(emitente.CNPJ)) return rej('207');
  if (emitente.CPF !== undefined && !cpfValido(emitente.CPF)) return rej('210');
  const serieCpf = Number(serie) >= 920 && Number(serie) <= 969;
  if (ativa(ctx, 'F69') && emitente.CNPJ !== undefined && serieCpf) return rej('232');
  if (ativa(ctx, 'F70') && emitente.CPF !== undefined && !serieCpf) return rej('233');
  if (ativa(ctx, 'F71') && emitente.CPF !== undefined && tpEmit !== '2') return rej('234');
  if (ativa(ctx, 'F79') && dhEmiMs > now + CINCO_MINUTOS) return rej('212');
  if (ativa(ctx, 'F80') && tpEmis === '1' && now - dhEmiMs > DIA) return rej('228');

  // NT 2024.001: chaves de CT-e e NF-e anteriores a 6 meses da autorização (F30a, F37a) e cavalo mecânico sem reboque
  // (F89c). O mês limite passa (autorizado em setembro, março ainda é aceito).
  const agora = utcParts(now + ctx.rt.config.offsetMinutes * 60_000);
  const limite = agora.year * 12 + (agora.month - 1) - MESES_CHAVE_ANTIGA;
  const antiga = (ch: string): boolean => (2000 + Number(ch.slice(2, 4))) * 12 + (Number(ch.slice(4, 6)) - 1) < limite;
  for (const mun of all(at(inf, 'infDoc'), 'infMunDescarga')) {
    for (const cte of all(mun, 'infCTe')) {
      const ch = req(cte, 'chCTe');
      if (ativa(ctx, 'F30a') && antiga(ch)) return rej('518', { chCTe: ch });
    }
    for (const nfe of all(mun, 'infNFe')) {
      const ch = req(nfe, 'chNFe');
      if (ativa(ctx, 'F37a') && antiga(ch)) return rej('519', { chNFe: ch });
    }
  }
  const rodoviario = at(inf, 'infModal/rodo');
  if (
    ativa(ctx, 'F89c') &&
    text(rodoviario, 'veicTracao/tpRod') === '03' &&
    all(rodoviario, 'veicReboque').length === 0
  ) {
    return rej('523');
  }

  // QR Code (F114 a F118).
  const qr = text(doc.raiz, 'infMDFeSupl/qrCodMDFe');
  if (ativa(ctx, 'F114') && qr === undefined) return rej('480');
  if (qr !== undefined) {
    const [url = '', query = ''] = qr.split('?', 2);
    const params = new Map(query.split('&').map((p) => p.split('=', 2) as [string, string]));
    if (ativa(ctx, 'F115') && url.toLowerCase() !== QR_BASE) return rej('479');
    if (ativa(ctx, 'F116') && params.get('chMDFe') !== chave) return rej('481');
    if (ativa(ctx, 'F117') && tpEmis === '2' && !params.has('sign')) return rej('482');
    if (ativa(ctx, 'F118') && tpEmis === '1' && params.has('sign')) return rej('488');
  }

  // Duplicidade (F81 e F82): a mesma numeração do emitente.
  const docKey = emitente.CNPJ ?? emitente.CPF ?? '';
  const existente = ctx.rt.state.mdfeByNumero(docKey, serie, nMDF);
  if (existente !== undefined) {
    if (ativa(ctx, 'F81') && existente.chave !== chave) return rej('539', marcadores(existente));
    if (ativa(ctx, 'F82')) return rej('204', marcadores(existente));
  }

  // Não encerrados (F85 a F88), no modal rodoviário, pela placa do veículo de tração.
  const rodo = at(inf, 'infModal/rodo');
  const placa = text(rodo, 'veicTracao/placa');
  const ufIni = req(ide, 'UFIni');
  const ufFim = req(ide, 'UFFim');
  const doEmitente = naoEncerrados(ctx).filter((m) => raiz(m.emitente) === raiz(emitente));
  if (rodo !== undefined && placa !== undefined) {
    const daPlaca = doEmitente.filter((m) => m.placa === placa && m.tpEmit === tpEmit);
    const f85 = daPlaca.find((m) => m.UFFim === ufFim);
    if (ativa(ctx, 'F85') && f85 !== undefined) return rej('611', marcadores(f85));
  }
  // F86 é pelo CNPJ ou CPF completo do emitente; F85, F87 e F88 pela raiz (CNPJ base).
  const f86 = naoEncerrados(ctx).find((m) => mesmoDocumento(m.emitente, emitente) && now - m.dhRecbtoMs > 30 * DIA);
  if (ativa(ctx, 'F86') && f86 !== undefined) return rej('686', marcadores(f86));
  if (rodo !== undefined && placa !== undefined) {
    const daPlaca = doEmitente.filter((m) => m.placa === placa);
    const f87 = daPlaca.find((m) => now - m.dhRecbtoMs > 5 * DIA && m.qtdPercurso <= 2);
    if (ativa(ctx, 'F87') && f87 !== undefined) return rej('462', marcadores(f87));
    const f88 = daPlaca.find((m) => m.tpEmit === tpEmit && m.UFIni === ufFim && m.UFFim === ufIni);
    if (ativa(ctx, 'F88') && f88 !== undefined) return rej('662', marcadores(f88));
  }

  // Autorização: protocolo 9 + cUF do emitente + ano + sequencial.
  const nProt = ctx.rt.state.nextProtocolo('9', cUF, yearOf(now, ctx.rt.config.offsetMinutes));
  const dhRecbto = dhMdfe(ctx, now);
  const prot: TProtMDFe = {
    versao: VERSAO,
    infProt: {
      Id: `ID${nProt}`,
      tpAmb: ctx.rt.config.tpAmb,
      verAplic: verAplicMdfe(),
      chMDFe: chave,
      dhRecbto,
      nProt,
      digVal: sig.digestValue,
      cStat: '100',
      xMotivo: statusMdfe('100').xMotivo,
    },
  };
  const xml = ret(statusMdfe('100'), prot);
  const { digVal: _, ...semDigVal } = prot.infProt;
  const resposta = omitirDigVal(ctx.rt, 'autorizacao', '100')
    ? ret(statusMdfe('100'), { ...prot, infProt: semDigVal })
    : xml;
  const inicioProt = xml.indexOf('<protMDFe');
  const record: MdfeRecord = {
    chave,
    cUF,
    emitente,
    serie,
    nMDF,
    cMDF,
    tpEmit,
    tpEmis,
    modal: req(ide, 'modal'),
    UFIni: ufIni,
    UFFim: ufFim,
    qtdPercurso: all(ide, 'infPercurso').length,
    placa,
    tpProp: text(rodo, 'veicTracao/prop/tpProp'),
    proprietario: at(rodo, 'veicTracao/prop') === undefined ? undefined : documento(at(rodo, 'veicTracao/prop')),
    carregaPosterior: text(ide, 'indCarregaPosterior') === '1',
    cMunCarrega: all(ide, 'infMunCarrega').map((m) => req(m, 'cMunCarrega')),
    dhEmi,
    dhEmiMs,
    xml: standalone(doc.texto, doc.raiz),
    digVal: sig.digestValue,
    nProt,
    dhRecbto,
    dhRecbtoMs: now,
    // O protMDFe sai do mesmo texto da resposta, com o xmlns para viver fora dela (consulta, mdfeProc).
    protMDFe: xml
      .slice(inicioProt, xml.indexOf('</protMDFe>') + '</protMDFe>'.length)
      .replace('<protMDFe', `<protMDFe xmlns="${doc.raiz.ns}"`),
    situacao: 'autorizado',
  };
  ctx.rt.state.mdfes.set(chave, record);
  return resposta;
}
