/**
 * Chamada SOAP 1.2 a um web service do MDF-e 3.00: a área de dados vai em `mdfeDadosMsg` no namespace do WSDL (dado em
 * `data/servicos.json`), compactada em GZip e Base64 na recepção e como XML nos demais serviços. O elemento de retorno
 * é procurado pelo nome local no namespace do MDF-e em qualquer ponto do corpo, para não depender do nome do elemento
 * de resultado do WSDL.
 */

import type { Logger } from '@sinete/core';
import { ErroRespostaInvalida } from '@sinete/core';
import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import { descendentes, lerXml, primeiroFilho } from '@sinete/core/xml';
import type { EndpointResolvido, MdfeServico, Transporte } from '@sinete/transport';
import { contentTypeSoap12, envelopeSoap12, lerSoapFault } from '@sinete/transport';
import servicos from '../data/servicos.json' with { type: 'json' };
import { comprimirGzipBase64 } from './gzip.ts';
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
  if (!s) throw new ErroRespostaInvalida(`serviço sem descrição em data/servicos.json: ${servico}`);
  return s;
}

/** Corpo SOAP do serviço; na recepção a mensagem vai compactada, nos demais como texto, sem reparse. */
export async function soapBodyFor(servico: MdfeServicoCliente, mensagem: string): Promise<string> {
  const s = servicoInfo(servico);
  const dados = s.compactado ? await comprimirGzipBase64(mensagem) : mensagem;
  return `<mdfeDadosMsg xmlns="${s.namespace}">${dados}</mdfeDadosMsg>`;
}

export interface RespostaSoap {
  readonly doc: DocumentoXml;
  readonly ret: ElementoXml;
  readonly status: number;
}

export interface ChamadaSoap {
  readonly transport: Transporte;
  readonly endpoint: EndpointResolvido;
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

/** Envia e devolve o elemento de retorno. Fault SOAP, retorno ausente ou XML malformado viram `ErroRespostaInvalida`. */
export async function chamar(c: ChamadaSoap): Promise<RespostaSoap> {
  const s = servicoInfo(c.servico);
  const started = { servico: c.servico, autorizador: c.endpoint.autorizador, host: c.endpoint.host };
  const res = await c.transport.enviar({
    url: c.endpoint.url,
    endpoint: c.endpoint,
    metodo: 'POST',
    cabecalhos: { 'content-type': contentTypeSoap12(`${s.namespace}/${s.operacao}`) },
    corpo: envelopeSoap12(await soapBodyFor(c.servico, c.mensagem)),
    ...(c.timeoutMs === undefined ? {} : { timeoutMs: c.timeoutMs }),
    ...(c.signal === undefined ? {} : { signal: c.signal }),
  });
  const text = res.texto();
  const fault = lerSoapFault(text);
  if (fault) {
    c.logger.warn('mdfe.soap.fault', { ...started, status: res.status, code: fault.code });
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
    if (el.local === c.retorno && el.ns === MDFE_NS) {
      ret = el;
      break;
    }
  }
  if (!ret) {
    throw new ErroRespostaInvalida(`resposta de ${c.endpoint.host} sem <${c.retorno}> (HTTP ${res.status})`, {
      detalhes: { status: res.status, servico: c.servico },
    });
  }
  const grupo = c.cStatEm === undefined ? ret : primeiroFilho(ret, c.cStatEm, MDFE_NS);
  if (grupo === undefined || primeiroFilho(grupo, 'cStat', MDFE_NS) === undefined) {
    const onde = c.cStatEm === undefined ? '' : `/${c.cStatEm}`;
    throw new ErroRespostaInvalida(`<${c.retorno}${onde}> de ${c.endpoint.host} sem cStat (HTTP ${res.status})`, {
      detalhes: { status: res.status, servico: c.servico },
    });
  }
  c.logger.debug('mdfe.soap.resposta', { ...started, status: res.status });
  return { doc, ret, status: res.status };
}
