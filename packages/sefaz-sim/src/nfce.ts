/**
 * QR Code da NFC-e (grupo ZX) lido do `infNFeSupl`: os parâmetros das versões 2 e 3 (`?p=` separados por `|`) e a
 * conferência da assinatura da versão 3 em contingência off-line com o certificado que assinou a nota (Manual de Padrões
 * Técnicos do DANFE NFC-e e QR Code 6.0, itens 4.3 e 4.4; NT 2025.001 v1.03, regras ZX02-222 a ZX02-338).
 */

import { decodificarBase64, extrairSpki } from '@sinete/core/xml';

/** Parâmetros do QR Code no leiaute `?p=`; `undefined` para outro formato (a versão 100, com `&`). */
export function parametrosDoQrCode(qrCode: string): readonly string[] | undefined {
  const i = qrCode.indexOf('?p=');
  return i < 0 ? undefined : qrCode.slice(i + 3).split('|');
}

/**
 * Confere a assinatura (parâmetro 8) sobre os parâmetros 1 a 7 da versão 3 off-line: RSA com SHA-1 (PKCS#1 v1.5),
 * com a chave pública do certificado da assinatura da nota (ZX02-338).
 */
export async function assinaturaDoQrCodeConfere(
  params: readonly string[],
  certificadoDer: Uint8Array,
): Promise<boolean> {
  const assinatura = params[7];
  if (assinatura === undefined || params.length !== 8) return false;
  try {
    const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' };
    const key = await globalThis.crypto.subtle.importKey('spki', extrairSpki(certificadoDer), alg, false, ['verify']);
    return await globalThis.crypto.subtle.verify(
      alg,
      key,
      decodificarBase64(assinatura) as Uint8Array<ArrayBuffer>,
      new TextEncoder().encode(params.slice(0, 7).join('|')),
    );
  } catch {
    return false;
  }
}
