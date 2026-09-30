/**
 * Envelope SOAP 1.2 do lado do servidor: extrai a área de dados do pedido como fatia da string recebida (o documento
 * assinado nunca é reserializado) e monta a resposta com o retorno inserido como texto.
 */

import type { ElementoXml } from '@sinete/core/xml';
import { descendentes, ErroXml, elementosFilhos, lerXml, textoDe } from '@sinete/core/xml';
import { SOAP12_NS } from '@sinete/transport';
import type { DefinicaoDeServico } from './services.ts';
import { acaoSoap, namespaceDoWsdl } from './services.ts';

/** Pedido recusado antes da área de dados: vira SOAP Fault com HTTP 500, como o IIS da SEFAZ responde. */
export interface SoapReject {
  readonly ok: false;
  readonly code: 'soap:Sender' | 'soap:VersionMismatch';
  readonly reason: string;
}

export interface SoapPayload {
  readonly ok: true;
  /** Elemento da área de dados, cortado da string recebida (`enviNFe`, `consSitNFe`...), ou o texto compactado. */
  readonly payload: string;
  /** O pedido veio com `nfeDadosMsg` dentro do elemento da operação num serviço `resultMsg` (a forma do MT). */
  readonly naOperacao?: boolean;
}

const only = (el: ElementoXml): ElementoXml[] => elementosFilhos(el);

function reject(reason: string, code: SoapReject['code'] = 'soap:Sender'): SoapReject {
  return { ok: false, code, reason };
}

/** `action` do `Content-Type` do SOAP 1.2, quando houver. */
export function actionOf(contentType: string | undefined): string | undefined {
  const m = /;\s*action\s*=\s*"?([^";]+)"?/i.exec(contentType ?? '');
  return m?.[1];
}

/** Extrai a área de dados do envelope conforme o estilo do serviço. */
export function parseSoapRequest(
  body: string,
  def: DefinicaoDeServico,
  contentType: string | undefined,
): SoapReject | SoapPayload {
  if (!/^application\/soap\+xml\b/i.test(contentType ?? '')) {
    return reject(`Content-Type deve ser application/soap+xml (SOAP 1.2), recebido ${contentType ?? 'nenhum'}`);
  }
  const action = actionOf(contentType);
  if (action !== undefined && action !== acaoSoap(def)) {
    return reject(`action ${action} não é a operação ${acaoSoap(def)}`);
  }
  let root: ElementoXml;
  try {
    root = lerXml(body).raiz;
  } catch (e) {
    if (e instanceof ErroXml) return reject(`envelope malformado: ${e.message}`);
    throw e;
  }
  if (root.local !== 'Envelope') return reject('raiz do pedido não é Envelope');
  if (root.ns !== SOAP12_NS) return reject(`envelope fora do SOAP 1.2 (${root.ns})`, 'soap:VersionMismatch');
  const bodyEl = only(root).find((e) => e.local === 'Body' && e.ns === SOAP12_NS);
  if (!bodyEl) return reject('envelope sem Body');
  const ns = namespaceDoWsdl(def);
  let holder = only(bodyEl)[0];
  let naOperacao = false;
  if (def.estilo === 'operacao') {
    if (holder?.local !== def.operacao || holder.ns !== ns) return reject(`Body sem ${def.operacao} de ${ns}`);
    holder = only(holder)[0];
  } else if (def.operacaoEm !== undefined && holder?.local === def.operacao && holder.ns === ns) {
    naOperacao = true;
    holder = only(holder)[0];
  }
  const dadosMsg = def.estilo === 'mdfe' ? 'mdfeDadosMsg' : 'nfeDadosMsg';
  if (holder?.local !== dadosMsg || holder.ns !== ns) return reject(`Body sem ${dadosMsg} de ${ns}`);
  const data = only(holder);
  if (def.compactado === true) {
    // Recepção do MDF-e: a área de dados é o texto (GZip em Base64); a descompactação é a regra B00 do serviço.
    if (data.length !== 0) return reject(`${dadosMsg} deve trazer a área de dados compactada como texto`);
    return { ok: true, payload: textoDe(holder).trim() };
  }
  if (data.length !== 1) return reject(`${dadosMsg} deve ter exatamente um elemento`);
  const el = data[0] as ElementoXml;
  if (def.operacaoEm !== undefined && !naOperacao) {
    // A UF da consulta é a do autorizador que responde: a do MT exige o elemento da operação por fora.
    const uf = Array.from(descendentes(el)).find((e) => e.local === 'UF');
    if (uf !== undefined && def.operacaoEm.includes(textoDe(uf).trim()))
      return reject(`Body sem ${def.operacao} de ${ns}`);
  }
  return { ok: true, payload: body.slice(el.inicio, el.fim), ...(naOperacao ? { naOperacao } : {}) };
}

/** Envelope da resposta com o retorno (`retEnviNFe`, `retConsSitNFe`...) inserido como texto. */
export function soapResponse(def: DefinicaoDeServico, ret: string, naOperacao = false): string {
  const ns = namespaceDoWsdl(def);
  const inner = naOperacao
    ? `<nfeResultMsg xmlns="${ns}"><${def.operacao}Result>${ret}</${def.operacao}Result></nfeResultMsg>`
    : def.estilo === 'operacao'
      ? `<${def.operacao}Response xmlns="${ns}"><${def.operacao}Result>${ret}</${def.operacao}Result></${def.operacao}Response>`
      : def.estilo === 'mdfe'
        ? `<${def.operacao}Result xmlns="${ns}">${ret}</${def.operacao}Result>`
        : `<nfeResultMsg xmlns="${ns}">${ret}</nfeResultMsg>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="${SOAP12_NS}"><soap:Body>${inner}</soap:Body></soap:Envelope>`;
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** SOAP 1.2 Fault. */
export function soapFaultEnvelope(code: SoapReject['code'], reason: string): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="${SOAP12_NS}"><soap:Body><soap:Fault>` +
    `<soap:Code><soap:Value>${code}</soap:Value></soap:Code>` +
    `<soap:Reason><soap:Text xml:lang="pt-BR">${escapeText(reason)}</soap:Text></soap:Reason>` +
    '</soap:Fault></soap:Body></soap:Envelope>'
  );
}

export const SOAP_CONTENT_TYPE = 'application/soap+xml; charset=utf-8';
