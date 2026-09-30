/**
 * GZip em base64, a forma dos documentos nas mensagens JSON da Sefin Nacional e do ADN (`dpsXmlGZipB64`,
 * `nfseXmlGZipB64`, `pedidoRegistroEventoXmlGZipB64`, `eventoXmlGZipB64`). Usa `CompressionStream` e
 * `DecompressionStream` da plataforma (Node 18+, Bun, Deno e browsers), sem dependência.
 */

import { ErroNaoSuportado, ErroRespostaInvalida } from '@sinete/core';
import { codificarBase64, decodificarBase64 } from '@sinete/core/xml';

type StreamCtor = new (format: 'gzip') => TransformStream<Uint8Array, Uint8Array>;

function ctor(name: 'CompressionStream' | 'DecompressionStream'): StreamCtor {
  const c = (globalThis as unknown as Record<string, StreamCtor | undefined>)[name];
  if (c === undefined) throw new ErroNaoSuportado(`${name} indisponível nesta runtime`);
  return c;
}

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: TransformStream<Uint8Array, Uint8Array>,
): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** Texto (UTF-8) para gzip em base64. */
export async function comprimirGzipBase64(texto: string): Promise<string> {
  const Cs = ctor('CompressionStream');
  return codificarBase64(await pipe(new TextEncoder().encode(texto), new Cs('gzip')));
}

/** Gzip em base64 para o texto UTF-8 de dentro. Lança `ErroRespostaInvalida` se não for base64 de um gzip. */
export async function descomprimirGzipBase64(b64: string, campo: string = 'documento'): Promise<string> {
  const Ds = ctor('DecompressionStream');
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = decodificarBase64(b64.trim());
  } catch (cause) {
    throw new ErroRespostaInvalida(`${campo} com base64 inválido`, { cause });
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await pipe(bytes, new Ds('gzip')));
  } catch (cause) {
    throw new ErroRespostaInvalida(`${campo} não é um gzip UTF-8 válido`, { cause });
  }
}

/**
 * `arquivoXml` da consulta de eventos da Sefin: base64 do texto do gzip em base64. Observado na produção restrita em
 * 28/09/2026: o campo começa com `SDRzSUFBQUFB`, que decodifica para `H4sIAAAA`, o início de um gzip em base64.
 */
export async function gunzipBase64Duplo(b64: string, campo: string = 'documento'): Promise<string> {
  let interno: string;
  try {
    interno = new TextDecoder('utf-8', { fatal: true }).decode(decodificarBase64(b64.trim()));
  } catch (cause) {
    throw new ErroRespostaInvalida(`${campo} com base64 inválido`, { cause });
  }
  return descomprimirGzipBase64(interno, campo);
}
