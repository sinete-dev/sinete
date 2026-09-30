/**
 * Descompressão do `docZip` da Distribuição DF-e (gzip em base64, NT 2014.002). Usa o `DecompressionStream` da
 * plataforma (Node 18+, Bun, Deno e browsers), sem dependência.
 */

import { ErroNaoSuportado, ErroRespostaInvalida } from '@sinete/core';
import { decodificarBase64 } from '@sinete/core/xml';

/** Base64 de um gzip para o texto UTF-8 de dentro. */
export async function descomprimirGzipBase64(b64: string): Promise<string> {
  const Ds = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (Ds === undefined)
    throw new ErroNaoSuportado('DecompressionStream indisponível nesta runtime; docZip não pode ser lido');
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = decodificarBase64(b64.trim());
  } catch (cause) {
    throw new ErroRespostaInvalida('docZip com base64 inválido', { cause });
  }
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new Ds('gzip'));
    return await new Response(stream).text();
  } catch (cause) {
    throw new ErroRespostaInvalida('docZip não é um gzip válido', { cause });
  }
}
