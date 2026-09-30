/**
 * Montagem dos documentos processados do MDF-e (`mdfeProc`, `procEventoMDFe`) por splice de texto. O documento
 * assinado entra byte a byte como foi assinado e o protocolo entra como fatia da resposta recebida: nada é reparseado
 * para gerar saída nem reserializado (invariante do repositório, ADR 0003).
 */

import { ErroDeConfiguracao, ErroRespostaInvalida } from '@sinete/core';
import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import {
  atributoDe,
  descendentes,
  lerXml,
  namespacesEmEscopo,
  primeiroFilho,
  textoDe,
  XMLDSIG_NS,
} from '@sinete/core/xml';

/** Namespace dos documentos do MDF-e. */
export const MDFE_NS = 'http://www.portalfiscal.inf.br/mdfe';

const XML_DECL = /^﻿?<\?xml[^?]*\?>\s*/;

/**
 * Recorta o elemento da fonte, acrescentando na tag de abertura só as declarações de namespace que ele usa e que
 * estão em ancestrais fora do recorte. O default entra apenas quando difere de `nsPadraoDoPai` (o default do
 * envelope onde a fatia vai morar).
 */
export function recortarElemento(documento: DocumentoXml, el: ElementoXml, nsPadraoDoPai: string = MDFE_NS): string {
  const slice = documento.texto.slice(el.inicio, el.fim);
  // Só os prefixos usados por algum elemento ou atributo cuja declaração está fora do recorte: um prefixo redeclarado
  // dentro dele não pode ganhar outra declaração na raiz, que mudaria o C14N inclusivo de um irmão assinado.
  //
  // Declaração herdada e não usada (xmlns:soap, xmlns:xsi, xmlns:xsd do envelope da resposta) fica de fora de
  // propósito. O que a fatia leva é o contexto em que o autorizador montou o documento, não o do transporte: o
  // protocolo vai para o proc como o leiaute pede, e é assim que o proc confere depois. Copiar para a fatia todo
  // namespace em escopo mudaria o C14N inclusivo do documento assinado pelo emitente, que nunca viu o envelope. No
  // corpus de MDF-e autorizados, nenhum protMDFe traz Signature; o infProt é conferido pelo digVal, não por assinatura.
  const used = new Set<string>();
  const cobertoDentro = (d: ElementoXml, p: string): boolean => {
    for (let e: ElementoXml | null = d; e; e = e === el ? null : e.pai) if (e.namespaces.has(p)) return true;
    return false;
  };
  for (const d of descendentes(el)) {
    const prefixos = [d.prefixo, ...d.atributos.map((a) => a.prefixo)].filter((p) => p !== '' && p !== 'xml');
    for (const p of prefixos) if (!cobertoDentro(d, p)) used.add(p);
  }
  const extra: string[] = [];
  const inScope = new Map<string, string>();
  for (let e: ElementoXml | null = el.pai; e; e = e.pai) {
    for (const [p, u] of e.namespaces) if (!inScope.has(p)) inScope.set(p, u);
  }
  // O default herdado de fora entra quando algum elemento sem prefixo do recorte (a raiz ou um descendente, inclusive
  // sob uma raiz prefixada) depende dele e ele difere do default do envelope de destino.
  const herdado = inScope.get('') ?? '';
  if (herdado !== nsPadraoDoPai && usaDefaultHerdado(el)) extra.push(` xmlns="${herdado}"`);
  for (const p of [...used].sort()) {
    const uri = inScope.get(p);
    if (uri === undefined) throw new ErroRespostaInvalida(`prefixo ${p} sem declaração no recorte de ${el.nome}`);
    extra.push(` xmlns:${p}="${uri}"`);
  }
  if (extra.length === 0) return slice;
  const at = 1 + el.nome.length;
  return slice.slice(0, at) + extra.join('') + slice.slice(at);
}

/** Algum elemento sem prefixo do recorte resolve o default por uma declaração de fora do recorte. */
function usaDefaultHerdado(raiz: ElementoXml): boolean {
  for (const d of descendentes(raiz)) {
    if (d.prefixo !== '') continue;
    let coberto = false;
    for (let e: ElementoXml | null = d; e; e = e === raiz ? null : e.pai) {
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
  /** `Id` do elemento assinado (`MDFe5126...`, `ID110112...`). */
  readonly id: string;
  /** DigestValue da assinatura (base64). */
  readonly digestValue: string;
  readonly documento: DocumentoXml;
}

/**
 * Confere que `xml` é um documento `raiz` assinado (no namespace do MDF-e, com `Signature` referenciando o filho
 * `elemento`) e devolve a string sem a declaração XML. Lança `ErroDeConfiguracao` para qualquer outra coisa: o serviço nunca
 * "conserta" o documento de quem chama.
 */
export function documentoAssinado(xml: string, raiz: string, elemento: string): DocumentoAssinado {
  const text = xml.replace(XML_DECL, '');
  let doc: DocumentoXml;
  try {
    doc = lerXml(text);
  } catch (cause) {
    throw new ErroDeConfiguracao(`${raiz} assinado malformado`, { cause });
  }
  if (doc.raiz.local !== raiz || doc.raiz.ns !== MDFE_NS) {
    throw new ErroDeConfiguracao(`esperado <${raiz}> no namespace do MDF-e, veio <${doc.raiz.nome}>`);
  }
  // O envelope (mdfeProc, procEventoMDFe) declara o default do MDF-e; o C14N inclusivo herda os namespaces dos
  // ancestrais, então a raiz assinada precisa declarar ela mesma esse default, ou a assinatura deixa de conferir
  // dentro do envelope. Não se conserta o documento de quem chama: recusa.
  if (doc.raiz.namespaces.get('') !== MDFE_NS) {
    throw new ErroDeConfiguracao(`<${raiz}> assinado precisa declarar xmlns="${MDFE_NS}" na própria raiz`);
  }
  const alvo = primeiroFilho(doc.raiz, elemento, MDFE_NS);
  const id = alvo ? atributoDe(alvo, 'Id') : undefined;
  const sig = primeiroFilho(doc.raiz, 'Signature', XMLDSIG_NS);
  const digest = sig && descendantText(sig, 'DigestValue');
  if (!id || digest === undefined)
    throw new ErroDeConfiguracao(`${raiz} sem ${elemento} identificado ou sem assinatura`);
  return { xml: text, id, digestValue: digest, documento: doc };
}

function descendantText(el: ElementoXml, local: string): string | undefined {
  for (const d of descendentes(el)) if (d.local === local && d.ns === XMLDSIG_NS) return textoDe(d).trim();
  return undefined;
}

/**
 * MDF-e assinado de dentro de um `mdfeProc` (ou o próprio MDF-e assinado), como fatia do texto e sem a declaração XML,
 * pronto para `consultar`, `resolverEnvioSemResposta` e a retomada, que recusam raiz sem `xmlns` próprio. O `MDFe` dentro
 * do proc herda os namespaces do envelope; eles são declarados na raiz da fatia. O C14N inclusivo do `infMDFe` já os
 * enxergava em escopo, então o digest e a assinatura são os mesmos dentro e fora do proc. Nada mais muda nos bytes.
 * Lança `ErroDeConfiguracao` quando não há MDF-e assinado (proc de outro documento, MDFe sem assinatura, XML malformado).
 */
export function mdfeAssinadoDoProc(xml: string): string {
  const text = xml.replace(XML_DECL, '');
  let doc: DocumentoXml;
  try {
    doc = lerXml(text);
  } catch (cause) {
    throw new ErroDeConfiguracao('mdfeProc malformado', { cause });
  }
  const noProc =
    doc.raiz.local === 'mdfeProc' && doc.raiz.ns === MDFE_NS ? primeiroFilho(doc.raiz, 'MDFe', MDFE_NS) : undefined;
  const el = noProc ?? (doc.raiz.local === 'MDFe' && doc.raiz.ns === MDFE_NS ? doc.raiz : undefined);
  if (el === undefined) throw new ErroDeConfiguracao(`esperado <mdfeProc> ou <MDFe> assinado, veio <${doc.raiz.nome}>`);
  const fatia = doc.texto.slice(el.inicio, el.fim);
  const herdados = [...namespacesEmEscopo(el)].filter(([p]) => p !== 'xml' && !el.namespaces.has(p));
  const decl = herdados
    .map(
      ([p, uri]) =>
        ` ${p === '' ? 'xmlns' : `xmlns:${p}`}="${uri.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}"`,
    )
    .join('');
  const at = 1 + el.nome.length;
  const assinado = decl === '' ? fatia : fatia.slice(0, at) + decl + fatia.slice(at);
  // Confere raiz, Id e assinatura como a retomada vai conferir: o que sai daqui serve direto nela.
  return documentoAssinado(assinado, 'MDFe', 'infMDFe').xml;
}

/** `<raiz xmlns versao>` + partes + `</raiz>`, sem tocar nas partes. */
export function envelope(raiz: string, versao: string, partes: readonly string[]): string {
  return `<${raiz} xmlns="${MDFE_NS}" versao="${versao}">${partes.join('')}</${raiz}>`;
}
