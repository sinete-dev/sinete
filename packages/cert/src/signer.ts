/**
 * Quem assina, nos dois modos do contrato do `@sinete/core` (ADR 0003, decisão 2).
 *
 * - `createA1Signer`: A1 em memória, modo `data`, via WebCrypto (RSASSA-PKCS1-v1_5 com SHA-1 ou SHA-256). A chave é
 *   importada como não exportável; depois de importada, só a `CryptoKey` fica no signer.
 * - `digestSignerAsDataSigner`: adaptador que faz um `DigestSigner` (A3 via PKCS#11, A3 em nuvem, HSM, OpenBao) servir
 *   onde se espera um `DataSigner`: calcula o hash com WebCrypto, monta o DigestInfo e pede só o RSA ao signer.
 * - `signBytes`: assina com qualquer `Signer`, escolhendo o caminho pelo `kind`.
 */

import type { Assinador, AssinadorDeDados, AssinadorDeDigest, HashDaAssinatura } from '@sinete/core';
import { concatBytes } from './der.ts';
import { CertError } from './errors.ts';
import type { CertificateInfo } from './x509.ts';
import { parseCertificate } from './x509.ts';

/** Prefixos DER do DigestInfo (RFC 8017, seção 9.2, nota 1). */
const fromHex = (hex: string): Uint8Array => Uint8Array.from(hex.match(/../g) ?? [], (h) => Number.parseInt(h, 16));

const DIGEST_INFO_PREFIX: Readonly<Record<HashDaAssinatura, Uint8Array>> = {
  'SHA-1': fromHex('3021300906052b0e03021a05000414'),
  'SHA-256': fromHex('3031300d060960864801650304020105000420'),
};

const DIGEST_LENGTH: Readonly<Record<HashDaAssinatura, number>> = { 'SHA-1': 20, 'SHA-256': 32 };

const ab = (b: Uint8Array): Uint8Array<ArrayBuffer> => b as Uint8Array<ArrayBuffer>;

/** DigestInfo DER (`AlgorithmIdentifier` + hash) de um hash já calculado. */
export function encodeDigestInfo(hash: HashDaAssinatura, digest: Uint8Array): Uint8Array {
  const prefix = DIGEST_INFO_PREFIX[hash];
  if (!prefix) throw new CertError('algoritmo_nao_suportado', `hash não suportado: ${String(hash)}`);
  if (digest.length !== DIGEST_LENGTH[hash]) {
    throw new CertError('algoritmo_nao_suportado', `hash ${hash} com ${digest.length} bytes`);
  }
  return concatBytes(prefix, digest);
}

/** Calcula o hash de `data` e devolve o DigestInfo DER, que é o que um `DigestSigner` assina. */
export async function digestInfoOf(data: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array> {
  const digest = new Uint8Array(await crypto.subtle.digest(hash, ab(data)));
  return encodeDigestInfo(hash, digest);
}

/** Adaptador: um `DigestSigner` com a interface de `DataSigner`. A assinatura sai idêntica à do modo `data`. */
export function digestSignerAsDataSigner(signer: AssinadorDeDigest): AssinadorDeDados {
  return {
    tipo: 'dados',
    certificadoDer: (): Promise<Uint8Array> => signer.certificadoDer(),
    assinar: async (data: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array> =>
      signer.assinarDigestInfo(await digestInfoOf(data, hash)),
  };
}

/** Assina `data` com qualquer `Signer` (RSASSA-PKCS1-v1_5). */
export async function signBytes(signer: Assinador, data: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array> {
  if (signer.tipo === 'dados') return signer.assinar(data, hash);
  return signer.assinarDigestInfo(await digestInfoOf(data, hash));
}

/** Confere uma assinatura RSASSA-PKCS1-v1_5 com a chave pública do certificado. */
export async function verifyBytes(
  cert: CertificateInfo | Uint8Array,
  data: Uint8Array,
  signature: Uint8Array,
  hash: HashDaAssinatura,
): Promise<boolean> {
  const info = cert instanceof Uint8Array ? parseCertificate(cert) : cert;
  if (info.publicKey.algorithm !== 'RSA') {
    throw new CertError('algoritmo_nao_suportado', 'só chaves RSA são suportadas');
  }
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash };
  const key = await crypto.subtle.importKey('spki', ab(info.spki), alg, false, ['verify']);
  return crypto.subtle.verify(alg.name, key, ab(signature), ab(data));
}

/**
 * Signer A1 em memória, modo `data`. Recebe a chave em PKCS#8 DER (como sai do `openPfx`) e o certificado da folha.
 * A importação acontece uma vez por hash; a `CryptoKey` não é exportável.
 */
export async function createA1Signer(pkcs8: Uint8Array, certificateDer: Uint8Array): Promise<AssinadorDeDados> {
  const cert = parseCertificate(certificateDer);
  if (cert.publicKey.algorithm !== 'RSA') {
    throw new CertError('algoritmo_nao_suportado', 'o A1 precisa de chave RSA (PKCS#1 v1.5)');
  }
  const keys = new Map<HashDaAssinatura, Promise<CryptoKey>>();
  const keyFor = (hash: HashDaAssinatura): Promise<CryptoKey> => {
    let k = keys.get(hash);
    if (!k) {
      if (!(hash in DIGEST_INFO_PREFIX)) {
        return Promise.reject(new CertError('algoritmo_nao_suportado', `hash não suportado: ${String(hash)}`));
      }
      k = crypto.subtle.importKey('pkcs8', ab(pkcs8), { name: 'RSASSA-PKCS1-v1_5', hash }, false, ['sign']);
      keys.set(hash, k);
    }
    return k;
  };
  // Importa já com SHA-1 para falhar cedo se a chave não for RSA PKCS#8 válida.
  try {
    await keyFor('SHA-1');
  } catch (cause) {
    throw new CertError('algoritmo_nao_suportado', 'chave privada não importável como RSA PKCS#8', { cause });
  }
  const der = cert.der.slice();
  return {
    tipo: 'dados',
    certificadoDer: (): Promise<Uint8Array> => Promise.resolve(der.slice()),
    assinar: async (data: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array> =>
      new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await keyFor(hash), ab(data))),
  };
}
