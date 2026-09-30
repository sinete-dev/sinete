/**
 * MDFeStatusServico (Visão Geral, item 4.5), MDFeConsulta (item 4.3, regras G01 a G06) e MDFeConsNaoEnc (item 4.4,
 * regras H01 a H05).
 */

import { serializarRaiz } from '@sinete/schemas';
import type { TRetConsMDFeNaoEnc, TRetConsSitMDFe, TRetConsStatServ } from '@sinete/schemas/mdfe/servicos/3.00b';
import {
  consMDFeNaoEncElement,
  consSitMDFeElement,
  consStatServMDFeElement,
  retConsMDFeNaoEncElement,
  retConsSitMDFeElement,
  retConsStatServMDFeElement,
} from '@sinete/schemas/mdfe/servicos/3.00b';
import { cnpjValido, cpfValido, lerChaveAcesso } from '@sinete/validators';
import type { RequestContext, Status } from '../context.ts';
import { omitirDigVal } from '../context.ts';
import { MDFE_NS } from '../services.ts';
import { documento, text } from '../xmlutil.ts';
import { CUF_SVRS, dhMdfe, emitenteDaChave, preludeMdfe, raiz, statusMdfe, VERSAO, verAplicMdfe } from './comum.ts';

/** MDFeStatusServico (mdfeStatusServicoMDF). */
export async function statusServicoMdfe(ctx: RequestContext): Promise<string> {
  const pre = await preludeMdfe(ctx, consStatServMDFeElement);
  const ret = (s: Status): string => {
    const value: TRetConsStatServ = {
      versao: VERSAO,
      tpAmb: ctx.rt.config.tpAmb,
      verAplic: verAplicMdfe(),
      cStat: s.cStat,
      xMotivo: s.xMotivo,
      cUF: CUF_SVRS as TRetConsStatServ['cUF'],
      dhRecbto: dhMdfe(ctx, ctx.now),
      tMed: '1',
    };
    return serializarRaiz(retConsStatServMDFeElement, value);
  };
  if (!pre.ok) return ret(pre.status);
  if (text(pre.doc.raiz, 'tpAmb') !== ctx.rt.config.tpAmb) return ret(statusMdfe('252'));
  return ret(statusMdfe('107'));
}

/** MDFeConsulta (mdfeConsultaMDF). */
export async function consultaMdfe(ctx: RequestContext): Promise<string> {
  const pre = await preludeMdfe(ctx, consSitMDFeElement);
  const ret = (s: Status, prot?: string, eventos: readonly string[] = []): string => {
    const value: TRetConsSitMDFe = {
      versao: VERSAO,
      tpAmb: ctx.rt.config.tpAmb,
      verAplic: verAplicMdfe(),
      cStat: s.cStat,
      xMotivo: s.xMotivo,
      cUF: CUF_SVRS as TRetConsSitMDFe['cUF'],
    };
    const xml = serializarRaiz(retConsSitMDFeElement, value);
    // protMDFe e procEventoMDFe entram como texto, na ordem do leiaute, sem reserializar o que foi assinado.
    const fim = xml.lastIndexOf('</retConsSitMDFe>');
    return `${xml.slice(0, fim)}${prot ?? ''}${eventos.join('')}${xml.slice(fim)}`;
  };
  if (!pre.ok) return ret(pre.status);
  const root = pre.doc.raiz;
  // G01 ambiente; G03 chave (modelo 58, DV, UF, AAMM, emitente).
  if (text(root, 'tpAmb') !== ctx.rt.config.tpAmb) return ret(statusMdfe('252'));
  const chMDFe = text(root, 'chMDFe') ?? '';
  const c = lerChaveAcesso(chMDFe);
  if (!c.ok || c.valor.mod !== '58') {
    return ret(statusMdfe('236', { Motivo: c.ok ? 'Modelo diferente de 58' : c.erro.mensagem }));
  }
  const m = ctx.rt.state.mdfes.get(chMDFe);
  if (m === undefined) {
    // G04 a G06: a mesma numeração do emitente com outra chave.
    const e = emitenteDaChave(chMDFe);
    const outra = ctx.rt.state.mdfeByNumero(e.CNPJ ?? e.CPF ?? '', chMDFe.slice(22, 25), chMDFe.slice(25, 34));
    if (outra === undefined) return ret(statusMdfe('217'));
    if (outra.cMDF !== chMDFe.slice(35, 43)) return ret(statusMdfe('216'));
    return ret(statusMdfe('600'));
  }
  const situacao = { autorizado: '100', cancelado: '101', encerrado: '132' } as const;
  // O retConsSitMDFe envolve cada documento num elemento de mesmo nome com `versao` e um `xs:any`: "retornar
  // protMDFe (procEventoMDFe) da versão correspondente" (consSitMDFeTiposBasico_v3.00.xsd). Dentro vai o documento
  // inteiro, com o próprio xmlns.
  const eventos = ctx.rt.state
    .eventosDoMdfe(chMDFe)
    .map(
      (e) =>
        `<procEventoMDFe versao="${VERSAO}"><procEventoMDFe xmlns="${MDFE_NS}" versao="${VERSAO}">${e.xml}${e.retEvento}</procEventoMDFe></procEventoMDFe>`,
    );
  // O protMDFe guardado não é assinado pelo simulador: tirar o digVal do texto não invalida nada.
  const protMDFe = omitirDigVal(ctx.rt, 'consulta', '100')
    ? m.protMDFe.replace(/<digVal>[^<]*<\/digVal>/, '')
    : m.protMDFe;
  const prot = `<protMDFe versao="${VERSAO}">${protMDFe}</protMDFe>`;
  return ret(statusMdfe(situacao[m.situacao]), prot, eventos);
}

/** MDFeConsNaoEnc (mdfeConsNaoEnc). */
export async function consNaoEncMdfe(ctx: RequestContext): Promise<string> {
  const pre = await preludeMdfe(ctx, consMDFeNaoEncElement);
  const ret = (s: Status, lista: TRetConsMDFeNaoEnc['infMDFe'] = undefined): string => {
    const value: TRetConsMDFeNaoEnc = {
      versao: VERSAO,
      tpAmb: ctx.rt.config.tpAmb,
      verAplic: verAplicMdfe(),
      cStat: s.cStat,
      xMotivo: s.xMotivo,
      cUF: CUF_SVRS as TRetConsMDFeNaoEnc['cUF'],
      ...(lista === undefined ? {} : { infMDFe: lista }),
    };
    return serializarRaiz(retConsMDFeNaoEncElement, value);
  };
  if (!pre.ok) return ret(pre.status);
  const root = pre.doc.raiz;
  if (text(root, 'tpAmb') !== ctx.rt.config.tpAmb) return ret(statusMdfe('252'));
  const emitente = documento(root);
  if (emitente.CNPJ !== undefined && !cnpjValido(emitente.CNPJ)) return ret(statusMdfe('207'));
  if (emitente.CPF !== undefined && !cpfValido(emitente.CPF)) return ret(statusMdfe('210'));
  // H04 e H05: o certificado de transmissão é do emitente (raiz do CNPJ ou o mesmo CPF).
  const t = ctx.transmissor;
  if (t !== undefined) {
    if (t.CNPJ !== undefined && (emitente.CNPJ === undefined || raiz(t) !== raiz(emitente))) {
      return ret(statusMdfe('213'));
    }
    if (t.CPF !== undefined && t.CPF !== emitente.CPF) return ret(statusMdfe('202'));
  }
  const lista = [...ctx.rt.state.mdfes.values()]
    .filter((m) => m.situacao === 'autorizado')
    .filter((m) => (m.emitente.CNPJ ?? m.emitente.CPF) === (emitente.CNPJ ?? emitente.CPF))
    .sort((a, b) => a.dhRecbtoMs - b.dhRecbtoMs)
    .map((m) => ({ chMDFe: m.chave, nProt: m.nProt }));
  return lista.length === 0 ? ret(statusMdfe('112')) : ret(statusMdfe('111'), lista);
}
