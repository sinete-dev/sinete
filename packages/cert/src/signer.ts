/**
 * Quem assina, nos dois modos do contrato do `@sinete/core` (ADR 0003, decisão 2).
 *
 * - `criarAssinadorA1`: A1 em memória, modo `dados`, via WebCrypto (RSASSA-PKCS1-v1_5 com SHA-1 ou SHA-256). A chave é
 *   importada como não exportável; depois de importada, só a `CryptoKey` fica no signer.
 * - `comoAssinadorDeDados`: adaptador que faz um `AssinadorDeDigest` (A3 via PKCS#11, A3 em nuvem, HSM, OpenBao) servir
 *   onde se espera um `AssinadorDeDados`: calcula o hash com WebCrypto, monta o DigestInfo e pede só o RSA ao signer.
 * - `assinarBytes`: assina com qualquer `Assinador`, escolhendo o caminho pelo `tipo`.
 */

import type { Assinador, AssinadorDeDados, AssinadorDeDigest, HashDaAssinatura } from '@sinete/core';
import { concatBytes } from './der.ts';
import { ErroCertificado } from './errors.ts';
import type { CertificadoX509 } from './x509.ts';
import { lerCertificado } from './x509.ts';

/** Prefixos DER do DigestInfo (RFC 8017, seção 9.2, nota 1). */
const fromHex = (hex: string): Uint8Array => Uint8Array.from(hex.match(/../g) ?? [], (h) => Number.parseInt(h, 16));

const DIGEST_INFO_PREFIX: Readonly<Record<HashDaAssinatura, Uint8Array>> = {
  'SHA-1': fromHex('3021300906052b0e03021a05000414'),
  'SHA-256': fromHex('3031300d060960864801650304020105000420'),
};

const DIGEST_LENGTH: Readonly<Record<HashDaAssinatura, number>> = { 'SHA-1': 20, 'SHA-256': 32 };

const ab = (b: Uint8Array): Uint8Array<ArrayBuffer> => b as Uint8Array<ArrayBuffer>;

/** DigestInfo DER (`AlgorithmIdentifier` + hash) de um hash já calculado. */
export function codificarDigestInfo(hash: HashDaAssinatura, digest: Uint8Array): Uint8Array {
  const prefix = DIGEST_INFO_PREFIX[hash];
  if (!prefix) throw new ErroCertificado('algoritmo_nao_suportado', `hash não suportado: ${String(hash)}`);
  if (digest.length !== DIGEST_LENGTH[hash]) {
    throw new ErroCertificado('algoritmo_nao_suportado', `hash ${hash} com ${digest.length} bytes`);
  }
  return concatBytes(prefix, digest);
}

/** Calcula o hash dos bytes e devolve o DigestInfo DER, que é o que um `AssinadorDeDigest` assina. */
export async function digestInfoDe(dados: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array> {
  const digest = new Uint8Array(await crypto.subtle.digest(hash, ab(dados)));
  return codificarDigestInfo(hash, digest);
}

/** Adaptador: um `AssinadorDeDigest` com a interface de `AssinadorDeDados`. A assinatura sai idêntica à do modo `dados`. */
export function comoAssinadorDeDados(assinador: AssinadorDeDigest): AssinadorDeDados {
  return {
    tipo: 'dados',
    certificadoDer: (): Promise<Uint8Array> => assinador.certificadoDer(),
    assinar: async (data: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array> =>
      assinador.assinarDigestInfo(await digestInfoDe(data, hash)),
  };
}

/** Assina os bytes com qualquer `Assinador` (RSASSA-PKCS1-v1_5). */
export async function assinarBytes(
  assinador: Assinador,
  dados: Uint8Array,
  hash: HashDaAssinatura,
): Promise<Uint8Array> {
  if (assinador.tipo === 'dados') return assinador.assinar(dados, hash);
  return assinador.assinarDigestInfo(await digestInfoDe(dados, hash));
}

/** Confere uma assinatura RSASSA-PKCS1-v1_5 com a chave pública do certificado. */
export async function conferirBytes(
  cert: CertificadoX509 | Uint8Array,
  dados: Uint8Array,
  assinatura: Uint8Array,
  hash: HashDaAssinatura,
): Promise<boolean> {
  const info = cert instanceof Uint8Array ? lerCertificado(cert) : cert;
  if (info.chavePublica.algoritmo !== 'RSA') {
    throw new ErroCertificado('algoritmo_nao_suportado', 'só chaves RSA são suportadas');
  }
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash };
  const key = await crypto.subtle.importKey('spki', ab(info.spki), alg, false, ['verify']);
  return crypto.subtle.verify(alg.name, key, ab(assinatura), ab(dados));
}

/**
 * Assinador A1 em memória, modo `dados`. Recebe a chave em PKCS#8 DER (como sai do `abrirPfx`) e o certificado da folha.
 * A importação acontece uma vez por hash; a `CryptoKey` não é exportável.
 */
export async function criarAssinadorA1(pkcs8: Uint8Array, certificadoDer: Uint8Array): Promise<AssinadorDeDados> {
  const cert = lerCertificado(certificadoDer);
  if (cert.chavePublica.algoritmo !== 'RSA') {
    throw new ErroCertificado('algoritmo_nao_suportado', 'o A1 precisa de chave RSA (PKCS#1 v1.5)');
  }
  const keys = new Map<HashDaAssinatura, Promise<CryptoKey>>();
  const keyFor = (hash: HashDaAssinatura): Promise<CryptoKey> => {
    let k = keys.get(hash);
    if (!k) {
      if (!(hash in DIGEST_INFO_PREFIX)) {
        return Promise.reject(new ErroCertificado('algoritmo_nao_suportado', `hash não suportado: ${String(hash)}`));
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
    throw new ErroCertificado('algoritmo_nao_suportado', 'chave privada não importável como RSA PKCS#8', { cause });
  }
  const der = cert.der.slice();
  return {
    tipo: 'dados',
    certificadoDer: (): Promise<Uint8Array> => Promise.resolve(der.slice()),
    assinar: async (data: Uint8Array, hash: HashDaAssinatura): Promise<Uint8Array> =>
      new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await keyFor(hash), ab(data))),
  };
}
