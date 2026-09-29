/**
 * Chamada SOAP 1.2 a um web service do MDF-e 3.00: a área de dados vai em `mdfeDadosMsg` no namespace do WSDL (dado em
 * `data/servicos.json`), compactada em GZip e Base64 na recepção e como XML nos demais serviços. O elemento de retorno
 * é procurado pelo nome local no namespace do MDF-e em qualquer ponto do corpo, para não depender do nome do elemento
 * de resultado do WSDL.
 */

import type { Logger } from '@sinete/core';
import { ProtocolError } from '@sinete/core';
import type { XmlDocument, XmlElement } from '@sinete/core/xml';
import { descendants, firstChild, parseXml } from '@sinete/core/xml';
import type { EndpointRef, MdfeServico, Transport } from '@sinete/transport';
import { soap12ContentType, soap12Envelope, soapFault } from '@sinete/transport';
import servicos from '../data/servicos.json' with { type: 'json' };
import { gzipBase64 } from './gzip.ts';
import { MDFE_NS } from './proc.ts';

/** Serviços do MDF-e que o cliente chama (a distribuição de DF-e do MDF-e fica fora deste pacote). */
export type MdfeServicoCliente = Exclude<MdfeServico, 'MDFeDistribuicaoDFe'>;

interface ServicoInfo {
  readonly namespace: string;
  readonly operacao: string;
  readonly compactado: boolean;
}

const SERVICOS: Readonly<Record<string, ServicoInfo>> = servicos.servicos;

export function servicoInfo(servico: MdfeServicoCliente): ServicoInfo {
  const s = SERVICOS[servico];
  if (!s) throw new ProtocolError(`serviço sem descrição em data/servicos.json: ${servico}`);
  return s;
}

/** Corpo SOAP do serviço; na recepção a mensagem vai compactada, nos demais como texto, sem reparse. */
export async function soapBodyFor(servico: MdfeServicoCliente, mensagem: string): Promise<string> {
  const s = servicoInfo(servico);
  const dados = s.compactado ? await gzipBase64(mensagem) : mensagem;
  return `<mdfeDadosMsg xmlns="${s.namespace}">${dados}</mdfeDadosMsg>`;
}

export interface RespostaSoap {
  readonly doc: XmlDocument;
  readonly ret: XmlElement;
  readonly status: number;
}

export interface ChamadaSoap {
  readonly transport: Transport;
  readonly endpoint: EndpointRef;
  readonly servico: MdfeServicoCliente;
  readonly mensagem: string;
  /** Nome local do elemento de retorno (`retMDFe`, `retConsSitMDFe`...). */
  readonly retorno: string;
  /**
   * Filho do retorno que traz o `cStat` (`infEvento` no `retEventoMDFe`); sem ele, o `cStat` é filho direto do
   * retorno. Um `cStat` perdido em outro lugar (dentro do `protMDFe`, por exemplo) não conta.
   */
  readonly cStatEm?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly logger: Logger;
}

/** Envia e devolve o elemento de retorno. Fault SOAP, retorno ausente ou XML malformado viram `ProtocolError`. */
export async function chamar(c: ChamadaSoap): Promise<RespostaSoap> {
  const s = servicoInfo(c.servico);
  const started = { servico: c.servico, autorizador: c.endpoint.autorizador, host: c.endpoint.host };
  const res = await c.transport.send({
    url: c.endpoint.url,
    endpoint: c.endpoint,
    method: 'POST',
    headers: { 'content-type': soap12ContentType(`${s.namespace}/${s.operacao}`) },
    body: soap12Envelope(await soapBodyFor(c.servico, c.mensagem)),
    ...(c.timeoutMs === undefined ? {} : { timeoutMs: c.timeoutMs }),
    ...(c.signal === undefined ? {} : { signal: c.signal }),
  });
  const text = res.text();
  const fault = soapFault(text);
  if (fault) {
    c.logger.warn('mdfe.soap.fault', { ...started, status: res.status, code: fault.code });
    throw new ProtocolError(`SOAP fault de ${c.endpoint.host}: ${fault.reason ?? fault.code ?? 'sem motivo'}`, {
      details: { status: res.status, code: fault.code, reason: fault.reason, servico: c.servico },
    });
  }
  let doc: XmlDocument;
  try {
    doc = parseXml(text.replace(/^﻿/, ''));
  } catch (cause) {
    throw new ProtocolError(`resposta de ${c.endpoint.host} não é XML (HTTP ${res.status})`, {
      cause,
      details: { status: res.status, servico: c.servico },
    });
  }
  let ret: XmlElement | undefined;
  for (const el of descendants(doc.root)) {
    if (el.local === c.retorno && el.ns === MDFE_NS) {
      ret = el;
      break;
    }
  }
  if (!ret) {
    throw new ProtocolError(`resposta de ${c.endpoint.host} sem <${c.retorno}> (HTTP ${res.status})`, {
      details: { status: res.status, servico: c.servico },
    });
  }
  const grupo = c.cStatEm === undefined ? ret : firstChild(ret, c.cStatEm, MDFE_NS);
  if (grupo === undefined || firstChild(grupo, 'cStat', MDFE_NS) === undefined) {
    const onde = c.cStatEm === undefined ? '' : `/${c.cStatEm}`;
    throw new ProtocolError(`<${c.retorno}${onde}> de ${c.endpoint.host} sem cStat (HTTP ${res.status})`, {
      details: { status: res.status, servico: c.servico },
    });
  }
  c.logger.debug('mdfe.soap.resposta', { ...started, status: res.status });
  return { doc, ret, status: res.status };
}
