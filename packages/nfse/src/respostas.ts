/**
 * Leitura das respostas JSON da Sefin Nacional e do ADN, e o desfecho da NFS-e sobre o `ResultadoSefaz` do core.
 *
 * A rejeição chega como HTTP 4xx com uma lista de erros. No spike S2 (ADR 0004, NFS-e operação 5) a Sefin de produção
 * restrita respondeu `{"erros":[{"Codigo":"E1229","Descricao":"..."}]}`, com as chaves em PascalCase; o Swagger e
 * clientes de terceiros usam `codigo`, `descricao` e `complemento`. A leitura aceita as duas grafias, `erros` ou
 * `erro`, lista ou objeto único, e nunca decide pelo texto da mensagem.
 */

import type { Autorizado, DicaRejeicao, Recusado } from '@sinete/core';
import { ErroRespostaInvalida } from '@sinete/core';
import type { NfseErro } from '@sinete/rejeicoes/nfse';
import { dicaRejeicaoNfse, nfseErroPorCodigo } from '@sinete/rejeicoes/nfse';

/** Uma mensagem de erro ou alerta da Sefin, com a entrada do catálogo quando o código é conhecido. */
export interface MensagemNfse {
  readonly codigo: string;
  readonly descricao: string;
  readonly complemento?: string;
  /** Entrada do catálogo do Anexo I ou II (`@sinete/rejeicoes/nfse`): nível, regra, categoria. */
  readonly catalogo?: NfseErro;
}

/**
 * Rejeição da NFS-e: o `cStat` é o código do primeiro erro (`E0312`), o `xMotivo` a descrição dele, e `erros` traz a
 * lista inteira na ordem da resposta.
 */
export interface RejeicaoNfse extends Recusado {
  readonly erros: readonly MensagemNfse[];
  /** Status HTTP da resposta (400 na recusa da DPS). */
  readonly statusHttp: number;
}

/** Desfecho de uma operação da NFS-e: gerada ou registrada, ou rejeitada. Não há pendente nem denegação na NFS-e. */
export type ResultadoNfse<T> = Autorizado<T> | RejeicaoNfse;

type Json = Record<string, unknown>;

/** Campo com a grafia do Swagger (`codigo`) ou a observada na Sefin (`Codigo`). */
function campo(o: Json, nome: string): unknown {
  if (Object.hasOwn(o, nome)) return o[nome];
  const pascal = nome.charAt(0).toUpperCase() + nome.slice(1);
  return Object.hasOwn(o, pascal) ? o[pascal] : undefined;
}

function comoTexto(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

/** Lê o corpo como objeto JSON; `undefined` se não for JSON de objeto. */
export function lerJson(texto: string): Json | undefined {
  try {
    const v: unknown = JSON.parse(texto);
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Json) : undefined;
  } catch {
    return undefined;
  }
}

/** Mensagens da lista `erros` (ou `erro`) ou `alertas` (ou `alerta`), em qualquer das grafias. */
export function mensagens(json: Json, tipo: 'erros' | 'alertas'): MensagemNfse[] {
  const singular = tipo.slice(0, -1);
  const bruto = campo(json, tipo) ?? campo(json, singular);
  const lista: unknown[] = Array.isArray(bruto) ? bruto : bruto === undefined || bruto === null ? [] : [bruto];
  const out: MensagemNfse[] = [];
  for (const item of lista) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Json;
    const codigo = comoTexto(campo(o, 'codigo'))?.trim();
    if (codigo === undefined || codigo === '') continue;
    const descricao = comoTexto(campo(o, 'descricao')) ?? comoTexto(campo(o, 'mensagem')) ?? '';
    const complemento = comoTexto(campo(o, 'complemento'));
    const catalogo = nfseErroPorCodigo(codigo);
    out.push({
      codigo,
      descricao,
      ...(complemento === undefined || complemento === '' ? {} : { complemento }),
      ...(catalogo === undefined ? {} : { catalogo }),
    });
  }
  return out;
}

const CODIGO = /^E\d{4}$/;

/**
 * Rejeição a partir de uma resposta 4xx com erros. Lança `ErroRespostaInvalida` quando o corpo não traz nenhum erro com
 * código no formato do Anexo I (`E` e 4 dígitos): aí não há desfecho, há resposta fora do contrato.
 */
export function rejeicao(json: Json | undefined, httpStatus: number, operacao: string): RejeicaoNfse {
  const erros = json === undefined ? [] : mensagens(json, 'erros');
  const primeiro = erros.find((e) => CODIGO.test(e.codigo));
  if (primeiro === undefined) {
    throw new ErroRespostaInvalida(`${operacao}: HTTP ${httpStatus} sem erro no formato do Anexo I`, {
      detalhes: { operacao, statusHttp: httpStatus, codigos: erros.map((e) => e.codigo) },
    });
  }
  const hint: DicaRejeicao | undefined = dicaRejeicaoNfse(primeiro.codigo);
  return {
    tipo: 'recusado',
    cStat: primeiro.codigo,
    xMotivo: primeiro.descricao,
    ...(hint === undefined ? {} : { dica: hint }),
    erros,
    statusHttp: httpStatus,
  };
}

/** Texto de um campo obrigatório da resposta, ou `ErroRespostaInvalida`. */
export function exigirTexto(json: Json, nome: string, operacao: string): string {
  const v = comoTexto(campo(json, nome));
  if (v === undefined || v === '')
    throw new ErroRespostaInvalida(`${operacao}: resposta sem ${nome}`, { detalhes: { operacao } });
  return v;
}

/** Texto opcional da resposta. */
export function texto(json: Json, nome: string): string | undefined {
  return comoTexto(campo(json, nome));
}

/** Documento de um evento na consulta: `duplo` quando veio em `arquivoXml` (base64 do gzip em base64). */
export interface DocumentoEvento {
  readonly b64: string;
  readonly duplo: boolean;
}

/**
 * Documentos da consulta de eventos, na ordem da resposta. Na Sefin real (produção restrita, 28/09/2026) a resposta é
 * `{"eventos":[{"chaveAcesso","tipoEvento","numeroPedidoRegistroEvento","dataHoraRecebimento","arquivoXml"}]}`. O
 * item sem `arquivoXml` cai na leitura dos campos `...XmlGZipB64`, e a resposta sem `eventos` também; item sem
 * documento nenhum, ou resposta sem evento nenhum, é `ErroRespostaInvalida`, para não sumir com um evento em silêncio.
 */
export function documentosDosEventos(json: Json, operacao: string): DocumentoEvento[] {
  const lista = campo(json, 'eventos');
  if (!Array.isArray(lista)) {
    const compactados = documentosCompactados(json);
    if (compactados.length === 0)
      throw new ErroRespostaInvalida(`${operacao}: resposta sem eventos`, { detalhes: { operacao } });
    return compactados.map((b64) => ({ b64, duplo: false }));
  }
  return lista.flatMap((item): DocumentoEvento[] => {
    const arquivo = typeof item === 'object' && item !== null ? campo(item as Json, 'arquivoXml') : undefined;
    if (typeof arquivo === 'string' && arquivo !== '') return [{ b64: arquivo, duplo: true }];
    const compactados = documentosCompactados(item);
    if (compactados.length === 0)
      throw new ErroRespostaInvalida(`${operacao}: evento sem arquivoXml`, { detalhes: { operacao } });
    return compactados.map((b64) => ({ b64, duplo: false }));
  });
}

/**
 * Todos os documentos compactados (`...XmlGZipB64`) de uma resposta, em qualquer profundidade e na ordem em que
 * aparecem. Na consulta de eventos é a leitura de reserva, para a grafia do Swagger.
 */
export function documentosCompactados(v: unknown): string[] {
  const out: string[] = [];
  const visitar = (x: unknown): void => {
    if (Array.isArray(x)) {
      for (const i of x) visitar(i);
      return;
    }
    if (typeof x !== 'object' || x === null) return;
    for (const [k, val] of Object.entries(x)) {
      if (typeof val === 'string' && /XmlGZipB64$/i.test(k)) out.push(val);
      else visitar(val);
    }
  };
  visitar(v);
  return out;
}
