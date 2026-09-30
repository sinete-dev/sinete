/**
 * Contrato de quem assina. O core nunca vê a chave: entrega bytes e recebe bytes (ADR 0003).
 *
 * - `data`: recebe os bytes a assinar (o SignedInfo canonicalizado) e faz hash + RSA PKCS#1 v1.5 (WebCrypto, CKM_SHA1_RSA_PKCS).
 * - `digest`: recebe só o DigestInfo DER (prefixo do algoritmo + hash) e faz RSA puro (CKM_RSA_PKCS em PKCS#11, A3 em nuvem, HSM, OpenBao).
 *
 * O algoritmo de hash é o do leiaute (SHA-1 nos DF-e atuais) e é escolhido por quem monta a assinatura, não pelo signer.
 */
export type TipoAssinador = 'dados' | 'digest';

/** Hash aceito pelos leiautes de DF-e; SHA-256 fica para leiautes futuros e para o TLS. */
export type HashDaAssinatura = 'SHA-1' | 'SHA-256';

interface SignerBase {
  /** Certificado do titular em DER. A cadeia, quando necessária, vem de outra fonte (`@sinete/cert`). */
  certificadoDer(): Promise<Uint8Array>;
}

/**
 * O que acompanha o pedido de assinatura de um documento, para quem assina fora do processo conferir o que assina
 * (o helper `sinete-signer`, por exemplo, confere o autor de um evento no elemento). Quem assina localmente ignora.
 */
export interface ContextoDaAssinatura {
  /** `Id` do elemento referenciado. */
  readonly id: string;
  /** O elemento referenciado canonicalizado (C14N 1.0): os bytes cujo hash é o `DigestValue`. */
  readonly referenciado: Uint8Array;
}

export interface AssinadorDeDados extends SignerBase {
  readonly tipo: 'dados';
  assinar(data: Uint8Array, hash: HashDaAssinatura, context?: ContextoDaAssinatura): Promise<Uint8Array>;
}

export interface AssinadorDeDigest extends SignerBase {
  readonly tipo: 'digest';
  assinarDigestInfo(digestInfo: Uint8Array): Promise<Uint8Array>;
}

export type Assinador = AssinadorDeDados | AssinadorDeDigest;
