/**
 * Compactação da área de dados da recepção do MDF-e (GZip convertido para Base64, MOC MDF-e 3.00b Visão Geral, item
 * 3.4.1) e o caminho inverso. Usa o `CompressionStream` e o `DecompressionStream` da plataforma (Node 18+, Bun, Deno e
 * browsers), sem dependência.
 */

import { ProtocolError, UnsupportedError } from '@sinete/core';
import { base64Decode, base64Encode } from '@sinete/core/xml';

type Streams = { CompressionStream?: typeof CompressionStream; DecompressionStream?: typeof DecompressionStream };

/** Texto UTF-8 para GZip em Base64. */
export async function gzipBase64(text: string): Promise<string> {
  const Cs = (globalThis as Streams).CompressionStream;
  if (Cs === undefined) throw new UnsupportedError('CompressionStream indisponível nesta runtime');
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new Cs('gzip'));
  return base64Encode(new Uint8Array(await new Response(stream).arrayBuffer()));
}

/**
 * Base64 de um GZip para o texto UTF-8 de dentro. `limiteBytes` para a leitura assim que o conteúdo descompactado
 * passa do limite (`ProtocolError`), para GZip de origem não confiável.
 */
export async function gunzipBase64(b64: string, limiteBytes?: number): Promise<string> {
  const Ds = (globalThis as Streams).DecompressionStream;
  if (Ds === undefined) throw new UnsupportedError('DecompressionStream indisponível nesta runtime');
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64Decode(b64.trim());
  } catch (cause) {
    throw new ProtocolError('área de dados com Base64 inválido', { cause });
  }
  const reader = new Blob([bytes]).stream().pipeThrough(new Ds('gzip')).getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (limiteBytes !== undefined && total > limiteBytes) {
        await reader.cancel();
        throw new ProtocolError(`área de dados descompactada passa de ${limiteBytes} bytes`);
      }
      partes.push(value);
    }
  } catch (cause) {
    if (cause instanceof ProtocolError) throw cause;
    throw new ProtocolError('área de dados não é um GZip válido', { cause });
  }
  const junto = new Uint8Array(total);
  let at = 0;
  for (const p of partes) {
    junto.set(p, at);
    at += p.byteLength;
  }
  return new TextDecoder().decode(junto);
}
