/**
 * Documentos que o simulador guarda e distribui, montados por concatenação: o documento assinado recebido entra como
 * texto, sem reparsear nem reserializar (invariante do repo), e só o que o simulador gera passa pelo serializer.
 */

import type { ElementoXml } from '@sinete/core/xml';
import { serializar } from '@sinete/schemas';
import type { resEvento, resNFe } from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import { resEvento as ResEvento, resNFe as ResNFe } from '@sinete/schemas/nfe/dist-dfe/PL_NFeDistDFe_104';
import type { TRetEvento } from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import { TRetEvento as RetEvento } from '@sinete/schemas/nfe/evento-cancelamento/PL_010d';
import type { TProtNFe } from '@sinete/schemas/nfe/PL_010f';
import { TProtNFe as ProtNFe } from '@sinete/schemas/nfe/PL_010f';
import { NFE_NS } from './services.ts';
import type { EventoRecord, NfeRecord } from './state.ts';

/**
 * Elemento cortado de um lote (`NFe` do `enviNFe`, `evento` do `envEvento`) como documento autônomo: as declarações de
 * namespace herdadas dos ancestrais entram na tag de abertura, e nada mais muda. O C14N inclusivo do elemento assinado
 * leva em conta todo namespace em escopo, então sem isso um `xmlns:x` declarado no lote faria a assinatura divergir no
 * `nfeProc` e no `procEventoNFe`.
 */
export function standalone(source: string, el: ElementoXml): string {
  const herdados = new Map<string, string>();
  for (let a = el.pai; a !== null; a = a.pai) {
    for (const [prefix, uri] of a.namespaces) if (!herdados.has(prefix)) herdados.set(prefix, uri);
  }
  const decls: string[] = [];
  for (const [prefix, uri] of herdados) {
    if (el.namespaces.has(prefix) || prefix === 'xml' || (prefix === '' && uri === '')) continue;
    decls.push(prefix === '' ? ` xmlns="${escAttr(uri)}"` : ` xmlns:${prefix}="${escAttr(uri)}"`);
  }
  const text = source.slice(el.inicio, el.fim);
  const nameEnd = 1 + el.nome.length;
  return `${text.slice(0, nameEnd)}${decls.join('')}${text.slice(nameEnd)}`;
}

function escAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

export function protNFeXml(prot: TProtNFe, inherited: string): string {
  return serializar(ProtNFe, 'protNFe', prot, inherited);
}

/** `nfeProc` (procNFe_v4.00.xsd): a NF-e recebida e o protocolo. */
export function nfeProcXml(nfe: NfeRecord, prot: TProtNFe): string {
  return `<nfeProc versao="4.00" xmlns="${NFE_NS}">${nfe.xml}${protNFeXml(prot, NFE_NS)}</nfeProc>`;
}

export function retEventoXml(ret: TRetEvento, inherited: string): string {
  return serializar(RetEvento, 'retEvento', ret, inherited);
}

/** `procEventoNFe` (procEventoNFe_v1.00.xsd): o evento recebido e o registro. */
export function procEventoXml(evento: EventoRecord): string {
  return `<procEventoNFe versao="1.00" xmlns="${NFE_NS}">${evento.xml}${evento.retEvento}</procEventoNFe>`;
}

/** `resNFe` (resNFe_v1.01.xsd), o resumo que o destinatário recebe antes de se manifestar. */
export function resNFeXml(nfe: NfeRecord): string {
  const emit = nfe.emitente.CNPJ !== undefined ? { CNPJ: nfe.emitente.CNPJ } : { CPF: nfe.emitente.CPF ?? '' };
  const cSitNFe = nfe.situacao === 'autorizada' ? '1' : nfe.situacao === 'denegada' ? '2' : '3';
  const value: resNFe = {
    versao: '1.01',
    chNFe: nfe.chave,
    ...emit,
    xNome: nfe.emitente.xNome,
    // A regra C17 garante a IE de toda NF-e autorizada; sem ela (regra C17 tirada da lista), o resumo usa ISENTO para
    // continuar válido no schema, em vez de um IE vazio.
    IE: nfe.emitente.IE ?? 'ISENTO',
    dhEmi: nfe.dhEmi,
    tpNF: nfe.tpNF === '0' ? '0' : '1',
    vNF: nfe.vNF,
    digVal: nfe.digVal,
    dhRecbto: nfe.dhRecbto,
    nProt: nfe.nProt,
    cSitNFe,
  };
  return serializar(ResNFe, 'resNFe', value);
}

/** `resEvento` (resEvento_v1.01.xsd). */
export function resEventoXml(evento: EventoRecord): string {
  const autor = evento.autor.CNPJ !== undefined ? { CNPJ: evento.autor.CNPJ } : { CPF: evento.autor.CPF ?? '' };
  const value: resEvento = {
    versao: '1.01',
    cOrgao: evento.cOrgao as resEvento['cOrgao'],
    ...autor,
    chNFe: evento.chave,
    dhEvento: evento.dhEvento,
    tpEvento: evento.tpEvento,
    nSeqEvento: String(evento.nSeqEvento),
    xEvento: evento.xEvento,
    dhRecbto: evento.dhRegEvento,
    nProt: evento.nProt,
  };
  return serializar(ResEvento, 'resEvento', value);
}
