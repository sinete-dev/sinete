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

/** `cStat` e `xMotivo` que a SEFAZ mandou, em qualquer elemento e namespace. */
export interface MotivoDaSefaz {
  readonly cStat: string;
  readonly xMotivo?: string;
}

const ENTIDADES: Readonly<Record<string, string>> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** Caractere de uma referência numérica, ou `undefined` quando o código não é um caractere válido do XML. */
function caractereDoCodigo(codigo: number): string | undefined {
  const valido =
    Number.isInteger(codigo) &&
    (codigo === 0x9 ||
      codigo === 0xa ||
      codigo === 0xd ||
      (codigo >= 0x20 && codigo <= 0xd7ff) ||
      (codigo >= 0xe000 && codigo <= 0xfffd) ||
      (codigo >= 0x10000 && codigo <= 0x10ffff));
  return valido ? String.fromCodePoint(codigo) : undefined;
}

/**
 * Texto de um elemento: seções CDATA como vieram e o texto entre elas com as entidades do XML decodificadas (uma
 * referência inválida fica como veio), espaços colapsados. Nunca lança: é o diagnóstico de uma resposta já defeituosa.
 */
function textoDoElemento(conteudo: string): string | undefined {
  let v = '';
  for (const m of conteudo.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+)/g)) {
    if (m[1] !== undefined) {
      v += m[1];
      continue;
    }
    v += (m[2] ?? '').replace(
      /&(?:#(\d+)|#x([\da-fA-F]+)|(lt|gt|amp|quot|apos));/g,
      (entidade: string, dec?: string, hex?: string, nome?: string): string => {
        if (dec !== undefined) return caractereDoCodigo(Number(dec)) ?? entidade;
        if (hex !== undefined) return caractereDoCodigo(Number.parseInt(hex, 16)) ?? entidade;
        return ENTIDADES[nome ?? ''] ?? entidade;
      },
    );
  }
  const t = v.replace(/\s+/g, ' ').trim();
  return t === '' ? undefined : t;
}

/**
 * O primeiro `cStat` de uma resposta que não veio no formato esperado (outro elemento de retorno, fora do namespace,
 * sem o grupo do `cStat`), com o `xMotivo` do mesmo grupo: só o que vem logo depois dele, como no leiaute, para nunca
 * juntar o status de um grupo com o motivo de outro. Lê o texto, não o XML, para valer também quando o corpo não é XML
 * bem formado; o conteúdo de cada elemento pode ter texto, CDATA ou os dois, com espaços em volta. Sem `cStat`,
 * `undefined`. Nunca lança. Serve para o erro levar a mensagem real da SEFAZ em vez de descartá-la.
 */
export function lerMotivoDaSefaz(corpo: string): MotivoDaSefaz | undefined {
  // Conteúdo de um elemento simples: texto e seções CDATA intercalados, sem outros elementos.
  const conteudo = '((?:[^<]|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>)*)';
  const el = (tag: string): string => `<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>${conteudo}</(?:[\\w.-]+:)?${tag}>`;
  const re = new RegExp(`${el('cStat')}(?:\\s*${el('xMotivo')})?`, 'g');
  for (const m of corpo.matchAll(re)) {
    const cStat = textoDoElemento(m[1] ?? '');
    if (cStat === undefined) continue;
    const xMotivo = m[2] === undefined ? undefined : textoDoElemento(m[2]);
    return xMotivo === undefined ? { cStat } : { cStat, xMotivo };
  }
  return undefined;
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
