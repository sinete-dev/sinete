/**
 * Base dos serviços do MDF-e no simulador (MOC MDF-e 3.00b Visão Geral, item 4.1): certificado de transmissão (grupo
 * A), compactação (B-0), validação inicial (B), área de dados (C) e o que as regras de negócio dos serviços usam.
 */

import type { DocumentoXml } from '@sinete/core/xml';
import { decodificarBase64, ErroXml, lerXml } from '@sinete/core/xml';
import type { ElementoRaiz } from '@sinete/schemas';
import { validarRaiz } from '@sinete/schemas';
import type { ContextoDoPedido, Status } from '../context.ts';
import { motivoMdfe } from '../messages.ts';
import type { Documento, RegistroMdfe } from '../state.ts';
import { formatInstant } from '../time.ts';
import { hasPrefix } from '../xmlutil.ts';

/** cUF da SVRS, que atende o MDF-e de todas as UFs. */
export const CUF_SVRS: string = '43';
export const VERSAO: string = '3.00';
/** Tolerância de relógio das regras de data (F79, J14 a J16). */
export const CINCO_MINUTOS: number = 5 * 60_000;

export function statusMdfe(cStat: string, params?: Readonly<Record<string, string>>): Status {
  return { cStat, xMotivo: motivoMdfe(cStat, params) };
}

export function verAplicMdfe(): string {
  return 'SVRS_SINETE_SIM';
}

/** `dhRecbto`/`dhRegEvento` no fuso do autorizador. */
export function dhMdfe(ctx: ContextoDoPedido, ms: number): string {
  return formatInstant(ms, ctx.rt.configuracao.deslocamentoMin);
}

/** A regra está ligada (as desligadas vêm de `regrasMdfeDesligadas`). */
export function ativa(ctx: ContextoDoPedido, id: string): boolean {
  return !ctx.rt.configuracao.regrasMdfeDesligadas.has(id);
}

/**
 * Descompacta a área de dados (GZip em Base64) com o `DecompressionStream` da plataforma, lendo aos pedaços e parando
 * assim que passa de `limite` bytes: um GZip pequeno e muito compressível não chega a ocupar a memória toda (214).
 */
async function gunzip(b64: string, limite: number): Promise<string | 'grande' | undefined> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const bytes = decodificarBase64(b64);
    reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const partes: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limite) {
        await reader.cancel();
        return 'grande';
      }
      partes.push(value);
    }
    const junto = new Uint8Array(total);
    let at = 0;
    for (const p of partes) {
      junto.set(p, at);
      at += p.byteLength;
    }
    return new TextDecoder().decode(junto);
  } catch {
    await reader?.cancel().catch(() => undefined);
    return undefined;
  }
}

export type PreludeMdfe =
  | { readonly ok: true; readonly doc: DocumentoXml; readonly payload: string }
  | {
      readonly ok: false;
      readonly status: Status;
      readonly doc: DocumentoXml | undefined;
      /** Caminhos das ocorrências de schema, quando a rejeição é 215. */
      readonly schemaPaths?: readonly string[];
    };

/** Grupos A, B-0, B e C. `root` é o schema da área de dados. */
export async function preludeMdfe(ctx: ContextoDoPedido, root: ElementoRaiz<unknown>): Promise<PreludeMdfe> {
  if (ctx.transmissorRecusado !== undefined) {
    return { ok: false, status: statusMdfe(ctx.transmissorRecusado), doc: undefined };
  }
  let payload = ctx.payload;
  // B00: descompactação da área de dados (só a recepção vai compactada).
  if (ctx.definicao.compactado === true) {
    const texto = await gunzip(payload, ctx.rt.configuracao.tamanhoMaximoMdfe);
    if (texto === undefined) return { ok: false, status: statusMdfe('244'), doc: undefined };
    if (texto === 'grande') return { ok: false, status: statusMdfe('214'), doc: undefined };
    payload = texto.replace(/^﻿?<\?xml[^?]*\?>/, '');
  }
  // B01: tamanho.
  if (new TextEncoder().encode(payload).length > ctx.rt.configuracao.tamanhoMaximoMdfe) {
    return { ok: false, status: statusMdfe('214'), doc: undefined };
  }
  // B02: XML malformado.
  let doc: DocumentoXml;
  try {
    doc = lerXml(payload);
  } catch (e) {
    if (e instanceof ErroXml) return { ok: false, status: statusMdfe('243'), doc: undefined };
    throw e;
  }
  // B03 e B04: serviço paralisado.
  const parado = ctx.rt.paralisacaoMdfe;
  if (parado !== undefined) return { ok: false, status: statusMdfe(parado), doc };
  // C03: caracteres de edição no início, no fim ou entre as tags.
  if (/>\s+</.test(payload) || payload !== payload.trim()) return { ok: false, status: statusMdfe('599'), doc };
  // C01: schema; C04: prefixo de namespace.
  const issues = validarRaiz(root, doc);
  if (issues.length > 0) {
    return { ok: false, status: statusMdfe('215'), doc, schemaPaths: issues.map((i) => i.caminho) };
  }
  if (hasPrefix(doc.raiz)) return { ok: false, status: statusMdfe('404'), doc };
  return { ok: true, doc, payload };
}

/** Raiz do CNPJ ou o CPF inteiro: o "mesmo emitente" das regras de não encerrados (F85 a F88). */
export function raiz(d: Documento): string {
  return d.CNPJ !== undefined ? d.CNPJ.slice(0, 8) : (d.CPF ?? '');
}

/** Emitente da chave: CPF nas séries 920 a 969 (J09), CNPJ nas demais. */
export function emitenteDaChave(chave: string): Documento {
  const serie = Number(chave.slice(22, 25));
  return serie >= 920 && serie <= 969 ? { CPF: chave.slice(9, 20) } : { CNPJ: chave.slice(6, 20) };
}

export function mesmoDocumento(a: Documento, b: Documento): boolean {
  return (a.CNPJ !== undefined && a.CNPJ === b.CNPJ) || (a.CPF !== undefined && a.CPF === b.CPF);
}

/** Protocolo do MDF-e e data da situação para os marcadores das rejeições 204, 218, 539 e 609. */
export function marcadores(m: RegistroMdfe, extra: Readonly<Record<string, string>> = {}): Record<string, string> {
  return { nProt: m.nProt, dhAut: m.dhRecbto, chMDFe: m.chave, ...extra };
}
