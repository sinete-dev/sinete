/**
 * Chamada SOAP 1.2 a um web service da NF-e 4.00: monta o corpo com o namespace do WSDL (dado em `data/servicos.json`),
 * envia pelo `Transport` injetado e devolve o elemento de retorno como fatia da resposta, com a árvore para leitura.
 */

import type { Logger } from '@sinete/core';
import { ErroRespostaInvalida } from '@sinete/core';
import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { descendentes, elementosFilhos, lerXml } from '@sinete/core/xml';
import type { EndpointRef, NfeServico, Transport } from '@sinete/transport';
import { soap12ContentType, soap12Envelope, soapFault } from '@sinete/transport';
import servicos from '../data/servicos.json' with { type: 'json' };
import { NFE_NS } from './proc.ts';

interface ServicoInfo {
  readonly namespace: string;
  readonly operacao: string;
  readonly envelope?: string;
  /**
   * Autorizadores que pedem a mensagem dentro do elemento da operação do WSDL (`<operacao><nfeDadosMsg>`), como a
   * Distribuição DF-e faz para todos. Valor `operacao`; a fonte fica em `fonteEnvelope`.
   */
  readonly envelopeNoAutorizador?: Readonly<Record<string, string>>;
  readonly fonteEnvelope?: string;
}

const SERVICOS: Readonly<Record<string, ServicoInfo>> = servicos.servicos;

/** Namespace do WSDL e operação do serviço. */
export function servicoInfo(servico: NfeServico): ServicoInfo {
  const s = SERVICOS[servico];
  if (!s) throw new ErroRespostaInvalida(`serviço sem descrição em data/servicos.json: ${servico}`);
  return s;
}

/** Corpo SOAP do serviço: a mensagem entra como texto, sem reparse. */
export function soapBodyFor(servico: NfeServico, mensagem: string, autorizador?: string): string {
  const s = servicoInfo(servico);
  if (s.envelope === 'distDFeInteresse' || (autorizador && s.envelopeNoAutorizador?.[autorizador] === 'operacao')) {
    return `<${s.operacao} xmlns="${s.namespace}"><nfeDadosMsg>${mensagem}</nfeDadosMsg></${s.operacao}>`;
  }
  return `<nfeDadosMsg xmlns="${s.namespace}">${mensagem}</nfeDadosMsg>`;
}

/** Resposta de um serviço: o documento inteiro (para fatiar) e o elemento de retorno. */
export interface RespostaSoap {
  readonly doc: DocumentoXml;
  readonly ret: ElementoXml;
  readonly status: number;
}

export interface ChamadaSoap {
  readonly transport: Transport;
  readonly endpoint: EndpointRef;
  readonly servico: NfeServico;
  readonly mensagem: string;
  /** Nome local do elemento de retorno (`retEnviNFe`, `retConsSitNFe`...). */
  readonly retorno: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly logger: Logger;
}

/** Envia e devolve o elemento de retorno. Fault SOAP, retorno ausente ou XML malformado viram `ErroRespostaInvalida`. */
export async function chamar(c: ChamadaSoap): Promise<RespostaSoap> {
  const s = servicoInfo(c.servico);
  const started = { servico: c.servico, autorizador: c.endpoint.autorizador, host: c.endpoint.host };
  const res = await c.transport.send({
    url: c.endpoint.url,
    endpoint: c.endpoint,
    method: 'POST',
    headers: { 'content-type': soap12ContentType(`${s.namespace}/${s.operacao}`) },
    body: soap12Envelope(soapBodyFor(c.servico, c.mensagem, c.endpoint.autorizador)),
    ...(c.timeoutMs === undefined ? {} : { timeoutMs: c.timeoutMs }),
    ...(c.signal === undefined ? {} : { signal: c.signal }),
  });
  const text = res.text();
  const fault = soapFault(text);
  if (fault) {
    c.logger.warn('nfe.soap.fault', { ...started, status: res.status, code: fault.code });
    throw new ErroRespostaInvalida(`SOAP fault de ${c.endpoint.host}: ${fault.reason ?? fault.code ?? 'sem motivo'}`, {
      detalhes: { status: res.status, code: fault.code, reason: fault.reason, servico: c.servico },
    });
  }
  let doc: DocumentoXml;
  try {
    doc = lerXml(text.replace(/^﻿/, ''));
  } catch (cause) {
    throw new ErroRespostaInvalida(`resposta de ${c.endpoint.host} não é XML (HTTP ${res.status})`, {
      cause,
      detalhes: { status: res.status, servico: c.servico },
    });
  }
  let ret: ElementoXml | undefined;
  for (const el of descendentes(doc.raiz)) {
    if (el.local === c.retorno && el.ns === NFE_NS) {
      ret = el;
      break;
    }
  }
  if (!ret) ret = retornoForaDoNamespace(doc.raiz, c.retorno);
  if (ret && ret.ns !== NFE_NS) {
    // A SEFAZ-MG devolve o <retConsCad> sem o namespace da NF-e: ele herda o default do WSDL do nfeResultMsg, e só
    // os filhos declaram o da NF-e (visto em homologação e em produção em 28/09/2026). O conteúdo é o do leiaute.
    c.logger.warn('nfe.soap.retorno_fora_do_namespace', { ...started, retorno: c.retorno, ns: ret.ns });
  }
  if (!ret) {
    throw new ErroRespostaInvalida(`resposta de ${c.endpoint.host} sem <${c.retorno}> (HTTP ${res.status})`, {
      detalhes: { status: res.status, servico: c.servico },
    });
  }
  if (!Array.from(descendentes(ret)).some((el) => el.local === 'cStat' && el.ns === NFE_NS)) {
    throw new ErroRespostaInvalida(`<${c.retorno}> de ${c.endpoint.host} sem cStat (HTTP ${res.status})`, {
      detalhes: { status: res.status, servico: c.servico },
    });
  }
  c.logger.debug('nfe.soap.resposta', { ...started, status: res.status });
  return { doc, ret, status: res.status };
}

/**
 * O elemento de retorno com o nome certo em outro namespace, aceito só quando os filhos dele estão no namespace da
 * NF-e: é o caso do autorizador que esquece o `xmlns` no elemento de retorno e o declara nos filhos. Com os filhos
 * fora do namespace, a resposta continua recusada.
 */
function retornoForaDoNamespace(root: ElementoXml, retorno: string): ElementoXml | undefined {
  for (const el of descendentes(root)) {
    if (el.local !== retorno) continue;
    const filhos = elementosFilhos(el);
    if (filhos.length > 0 && filhos.every((f) => f.ns === NFE_NS)) return el;
  }
  return undefined;
}
