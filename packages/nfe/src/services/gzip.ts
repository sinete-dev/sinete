/**
 * Descompressão do `docZip` da Distribuição DF-e (gzip em base64, NT 2014.002). Usa o `DecompressionStream` da
 * plataforma (Node 18+, Bun, Deno e browsers), sem dependência.
 */

import { ProtocolError, UnsupportedError } from '@sinete/core';
import { base64Decode } from '@sinete/core/xml';

/** Base64 de um gzip para o texto UTF-8 de dentro. */
export async function gunzipBase64(b64: string): Promise<string> {
  const Ds = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (Ds === undefined)
    throw new UnsupportedError('DecompressionStream indisponível nesta runtime; docZip não pode ser lido');
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64Decode(b64.trim());
  } catch (cause) {
    throw new ProtocolError('docZip com base64 inválido', { cause });
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new Ds('gzip'));
    return await new Response(stream).text();
  } catch (cause) {
    throw new ProtocolError('docZip não é um gzip válido', { cause });
  }
}
