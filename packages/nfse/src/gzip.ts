/**
 * GZip em base64, a forma dos documentos nas mensagens JSON da Sefin Nacional e do ADN (`dpsXmlGZipB64`,
 * `nfseXmlGZipB64`, `pedidoRegistroEventoXmlGZipB64`, `eventoXmlGZipB64`). Usa `CompressionStream` e
 * `DecompressionStream` da plataforma (Node 18+, Bun, Deno e browsers), sem dependência.
 */

import { ProtocolError, UnsupportedError } from '@sinete/core';
import { base64Decode, base64Encode } from '@sinete/core/xml';

type StreamCtor = new (format: 'gzip') => TransformStream<Uint8Array, Uint8Array>;

function ctor(name: 'CompressionStream' | 'DecompressionStream'): StreamCtor {
  const c = (globalThis as unknown as Record<string, StreamCtor | undefined>)[name];
  if (c === undefined) throw new UnsupportedError(`${name} indisponível nesta runtime`);
  return c;
}

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: TransformStream<Uint8Array, Uint8Array>,
): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** Texto (UTF-8) para gzip em base64. */
export async function gzipBase64(text: string): Promise<string> {
  const Cs = ctor('CompressionStream');
  return base64Encode(await pipe(new TextEncoder().encode(text), new Cs('gzip')));
}

/** Gzip em base64 para o texto UTF-8 de dentro. Lança `ProtocolError` se não for base64 de um gzip. */
export async function gunzipBase64(b64: string, campo: string = 'documento'): Promise<string> {
  const Ds = ctor('DecompressionStream');
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64Decode(b64.trim());
  } catch (cause) {
    throw new ProtocolError(`${campo} com base64 inválido`, { cause });
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(await pipe(bytes, new Ds('gzip')));
  } catch (cause) {
    throw new ProtocolError(`${campo} não é um gzip UTF-8 válido`, { cause });
  }
}

/**
 * `arquivoXml` da consulta de eventos da Sefin: base64 do texto do gzip em base64. Observado na produção restrita em
 * 28/09/2026: o campo começa com `SDRzSUFBQUFB`, que decodifica para `H4sIAAAA`, o início de um gzip em base64.
 */
export async function gunzipBase64Duplo(b64: string, campo: string = 'documento'): Promise<string> {
  let interno: string;
  try {
    interno = new TextDecoder('utf-8', { fatal: true }).decode(base64Decode(b64.trim()));
  } catch (cause) {
    throw new ProtocolError(`${campo} com base64 inválido`, { cause });
  }
  return gunzipBase64(interno, campo);
}
