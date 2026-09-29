/**
 * Montagem dos documentos processados (`nfeProc`, `procEventoNFe`, `ProcInutNFe`) por splice de texto. O documento
 * assinado entra byte a byte como foi assinado e o protocolo entra como fatia da resposta recebida: nada é reparseado
 * para gerar saída nem reserializado (invariante do repositório, ADR 0003).
 */

import { ConfigError, ProtocolError } from '@sinete/core';
import type { XmlDocument, XmlElement } from '@sinete/core/xml';
import {
  attributeOf,
  descendants,
  firstChild,
  inScopeNamespaces,
  parseXml,
  textOf,
  XMLDSIG_NS,
} from '@sinete/core/xml';

/** Namespace dos documentos da NF-e. */
export const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';

const XML_DECL = /^﻿?<\?xml[^?]*\?>\s*/;

/**
 * Recorta o elemento da fonte, acrescentando na tag de abertura só as declarações de namespace que ele usa e que
 * estão em ancestrais fora do recorte. O default entra apenas quando difere de `parentDefaultNs` (o default do
 * envelope onde a fatia vai morar).
 */
export function sliceElement(doc: XmlDocument, el: XmlElement, parentDefaultNs: string = NFE_NS): string {
  const slice = doc.source.slice(el.start, el.end);
  // Só os prefixos usados por algum elemento ou atributo cuja declaração está fora do recorte: um prefixo redeclarado
  // dentro dele não pode ganhar outra declaração na raiz, que mudaria o C14N inclusivo de um irmão assinado.
  //
  // Declaração herdada e não usada (xmlns:soap, xmlns:xsi, xmlns:xsd do envelope da resposta) fica de fora de
  // propósito. O que a fatia leva é o contexto em que o autorizador montou o documento, não o do transporte: o
  // protocolo vai para o proc como o leiaute pede, e é assim que o proc confere depois. Copiar para a fatia todo
  // namespace em escopo mudaria o C14N inclusivo do documento assinado pelo emitente, que nunca viu o envelope.
  const used = new Set<string>();
  const cobertoDentro = (d: XmlElement, p: string): boolean => {
    for (let e: XmlElement | null = d; e; e = e === el ? null : e.parent) if (e.namespaces.has(p)) return true;
    return false;
  };
  for (const d of descendants(el)) {
    const prefixos = [d.prefix, ...d.attributes.map((a) => a.prefix)].filter((p) => p !== '' && p !== 'xml');
    for (const p of prefixos) if (!cobertoDentro(d, p)) used.add(p);
  }
  const extra: string[] = [];
  const inScope = new Map<string, string>();
  for (let e: XmlElement | null = el.parent; e; e = e.parent) {
    for (const [p, u] of e.namespaces) if (!inScope.has(p)) inScope.set(p, u);
  }
  // O default herdado de fora entra quando algum elemento sem prefixo do recorte (a raiz ou um descendente, inclusive
  // sob uma raiz prefixada) depende dele e ele difere do default do envelope de destino.
  const herdado = inScope.get('') ?? '';
  if (herdado !== parentDefaultNs && usaDefaultHerdado(el)) extra.push(` xmlns="${herdado}"`);
  for (const p of [...used].sort()) {
    const uri = inScope.get(p);
    if (uri === undefined) throw new ProtocolError(`prefixo ${p} sem declaração no recorte de ${el.name}`);
    extra.push(` xmlns:${p}="${uri}"`);
  }
  if (extra.length === 0) return slice;
  const at = 1 + el.name.length;
  return slice.slice(0, at) + extra.join('') + slice.slice(at);
}

/** Algum elemento sem prefixo do recorte resolve o default por uma declaração de fora do recorte. */
function usaDefaultHerdado(raiz: XmlElement): boolean {
  for (const d of descendants(raiz)) {
    if (d.prefix !== '') continue;
    let coberto = false;
    for (let e: XmlElement | null = d; e; e = e === raiz ? null : e.parent) {
      if (e.namespaces.has('')) {
        coberto = true;
        break;
      }
    }
    if (!coberto) return true;
  }
  return false;
}

/** Documento assinado já conferido: a string como veio (sem a declaração XML) e o que se lê dela. */
export interface DocumentoAssinado {
  /** O texto que vai no envelope, byte a byte o assinado (só a declaração XML inicial removida). */
  readonly xml: string;
  /** `Id` do elemento assinado (`NFe3526...`, `ID110111...`). */
  readonly id: string;
  /** DigestValue da assinatura (base64). */
  readonly digestValue: string;
  readonly doc: XmlDocument;
}

/**
 * Confere que `xml` é um documento `raiz` assinado (no namespace da NF-e, com `Signature` referenciando o filho
 * `elemento`) e devolve a string sem a declaração XML. Lança `ConfigError` para qualquer outra coisa: o serviço nunca
 * "conserta" o documento de quem chama.
 */
export function documentoAssinado(xml: string, raiz: string, elemento: string): DocumentoAssinado {
  const text = xml.replace(XML_DECL, '');
  let doc: XmlDocument;
  try {
    doc = parseXml(text);
  } catch (cause) {
    throw new ConfigError(`${raiz} assinado malformado`, { cause });
  }
  if (doc.root.local !== raiz || doc.root.ns !== NFE_NS) {
    throw new ConfigError(`esperado <${raiz}> no namespace da NF-e, veio <${doc.root.name}>`);
  }
  // O envelope (nfeProc, procEventoNFe) declara o default da NF-e; o C14N inclusivo herda os namespaces dos
  // ancestrais, então a raiz assinada precisa declarar ela mesma esse default, ou a assinatura deixa de conferir
  // dentro do envelope. Não se conserta o documento de quem chama: recusa.
  if (doc.root.namespaces.get('') !== NFE_NS) {
    throw new ConfigError(`<${raiz}> assinado precisa declarar xmlns="${NFE_NS}" na própria raiz`);
  }
  const alvo = firstChild(doc.root, elemento, NFE_NS);
  const id = alvo ? attributeOf(alvo, 'Id') : undefined;
  const sig = firstChild(doc.root, 'Signature', XMLDSIG_NS);
  const digest = sig && descendantText(sig, 'DigestValue');
  if (!id || digest === undefined) throw new ConfigError(`${raiz} sem ${elemento} identificado ou sem assinatura`);
  return { xml: text, id, digestValue: digest, doc };
}

function descendantText(el: XmlElement, local: string): string | undefined {
  for (const d of descendants(el)) if (d.local === local && d.ns === XMLDSIG_NS) return textOf(d).trim();
  return undefined;
}

/**
 * NF-e assinada de dentro de um `nfeProc` (ou a própria NF-e assinada), como fatia do texto e sem a declaração XML,
 * pronta para `consultar`, `resolverEnvioSemResposta` e a retomada, que recusam raiz sem `xmlns` próprio. O `NFe` dentro
 * do proc herda os namespaces do envelope; eles são declarados na raiz da fatia. O C14N inclusivo do `infNFe` já os
 * enxergava em escopo, então o digest e a assinatura são os mesmos dentro e fora do proc. Nada mais muda nos bytes.
 * Lança `ConfigError` quando não há NF-e assinada (proc de outro documento, NFe sem assinatura, XML malformado).
 */
export function nfeAssinadaDoProc(xml: string): string {
  const text = xml.replace(XML_DECL, '');
  let doc: XmlDocument;
  try {
    doc = parseXml(text);
  } catch (cause) {
    throw new ConfigError('nfeProc malformado', { cause });
  }
  const noProc =
    doc.root.local === 'nfeProc' && doc.root.ns === NFE_NS ? firstChild(doc.root, 'NFe', NFE_NS) : undefined;
  const el = noProc ?? (doc.root.local === 'NFe' && doc.root.ns === NFE_NS ? doc.root : undefined);
  if (el === undefined) throw new ConfigError(`esperado <nfeProc> ou <NFe> assinada, veio <${doc.root.name}>`);
  const fatia = doc.source.slice(el.start, el.end);
  const herdados = [...inScopeNamespaces(el)].filter(([p]) => p !== 'xml' && !el.namespaces.has(p));
  const decl = herdados
    .map(
      ([p, uri]) =>
        ` ${p === '' ? 'xmlns' : `xmlns:${p}`}="${uri.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}"`,
    )
    .join('');
  const at = 1 + el.name.length;
  const assinado = decl === '' ? fatia : fatia.slice(0, at) + decl + fatia.slice(at);
  // Confere raiz, Id e assinatura como a retomada vai conferir: o que sai daqui serve direto nela.
  return documentoAssinado(assinado, 'NFe', 'infNFe').xml;
}

/** `<raiz xmlns versao>` + partes + `</raiz>`, sem tocar nas partes. */
export function envelope(raiz: string, versao: string, partes: readonly string[]): string {
  return `<${raiz} xmlns="${NFE_NS}" versao="${versao}">${partes.join('')}</${raiz}>`;
}
