/**
 * SOAP 1.2 mínimo dos web services da SEFAZ (NF-e 4.00, MDF-e 3.00), montado a partir dos WSDL oficiais.
 *
 * O corpo entra por concatenação de texto: o XML assinado nunca é reparseado nem reserializado (invariante do repo).
 * Por isso um corpo com declaração XML é recusado em vez de "limpo": quem montou a string tira a declaração antes.
 */

import { ErroDeConfiguracao, ErroRespostaInvalida } from '@sinete/core';

export const SOAP12_NS = 'http://www.w3.org/2003/05/soap-envelope';

/** Envelope SOAP 1.2 com o corpo (e o cabeçalho, se houver) inseridos como texto, sem tocar neles. */
export function envelopeSoap12(corpo: string, opcoes: { readonly cabecalho?: string } = {}): string {
  for (const [part, xml] of [
    ['corpo', corpo],
    ['cabeçalho', opcoes.cabecalho ?? ''],
  ] as const) {
    if (/^\s*<\?xml/.test(xml)) {
      throw new ErroDeConfiguracao(`o ${part} SOAP não pode ter declaração XML; tire-a antes de assinar e envelopar`);
    }
  }
  const header = opcoes.cabecalho === undefined ? '' : `<soap12:Header>${opcoes.cabecalho}</soap12:Header>`;
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="${SOAP12_NS}">${header}<soap12:Body>${corpo}</soap12:Body></soap12:Envelope>`;
}

/** `Content-Type` do SOAP 1.2, com a `action` do WSDL quando houver (`<namespace do WSDL>/<operação>`). */
export function contentTypeSoap12(acao?: string): string {
  if (acao !== undefined && /["\r\n]/.test(acao)) throw new ErroDeConfiguracao('action SOAP inválida');
  return `application/soap+xml; charset=utf-8${acao === undefined ? '' : `; action="${acao}"`}`;
}

const BODY_OPEN = /<(?:([\w.-]+):)?Body(?:\s[^>]*)?>/;

/**
 * Conteúdo do `Body` da resposta, como fatia da string recebida (sem parse nem reserialização).
 * Lança `ErroRespostaInvalida` se não houver `Body`.
 */
export function lerBodySoap(envelope: string): string {
  const open = BODY_OPEN.exec(envelope);
  if (!open) throw new ErroRespostaInvalida('resposta SOAP sem Body');
  const prefix = open[1] === undefined ? '' : `${open[1]}:`;
  const start = open.index + open[0].length;
  const end = envelope.lastIndexOf(`</${prefix}Body>`);
  if (end < start) throw new ErroRespostaInvalida('resposta SOAP com Body sem fechamento');
  return envelope.slice(start, end);
}

export interface SoapFault {
  readonly code: string | undefined;
  readonly reason: string | undefined;
}

/** Fault SOAP 1.2 (ou 1.1) da resposta, se houver. */
export function lerSoapFault(envelope: string): SoapFault | undefined {
  if (!/<(?:[\w.-]+:)?Fault[\s>]/.test(envelope)) return undefined;
  const text = (tag: string): string | undefined => {
    const m = new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`).exec(envelope);
    return m?.[1]
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  return { code: text('Value') ?? text('faultcode'), reason: text('Text') ?? text('faultstring') };
}
