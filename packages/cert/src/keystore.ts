/**
 * `KeyStore`: onde está a chave do titular e como usá-la, sem que o resto do sinete saiba se é A1 em memória, A3 em
 * token ou chave remota. Esta versão traz o A1 (`openPfx`); A3 e chave remota entram pelo helper do ADR 0005.
 */

import type { Assinador, AssinadorDeDados, Relogio } from '@sinete/core';
import type { Tlv } from './der.ts';
import { children, integerHex, readTlv, TAG } from './der.ts';
import { CertError } from './errors.ts';
import type { IcpIdentity } from './icp.ts';
import { icpIdentity } from './icp.ts';
import { derToPem } from './pem.ts';
import type { Pkcs12Reader } from './pkcs12.ts';
import { forgePkcs12Reader } from './pkcs12.ts';
import { createA1Signer } from './signer.ts';
import type { CertificateInfo } from './x509.ts';
import { certificateToPem, parseCertificate } from './x509.ts';

export type Validity = 'valido' | 'expirado' | 'ainda_nao_valido';

export interface KeyStore {
  /** `a1` para chave em memória. Outros valores ficam para A3 e chave remota. */
  readonly kind: string;
  /** Certificado do titular. */
  readonly certificate: CertificateInfo;
  /** Os outros certificados que vieram com a chave (intermediárias do PFX), sem o do titular. */
  readonly extraCertificates: readonly CertificateInfo[];
  /** CNPJ, CPF e responsável, lidos do certificado. */
  readonly identity: IcpIdentity;
  /** Validade no instante em que o KeyStore foi aberto. */
  readonly validity: Validity;
  /** Quem assina com esta chave (contrato `Signer` do `@sinete/core`). */
  signer(): Promise<Assinador>;
}

/** Material para TLS em processo: cadeia do cliente e chave, em PEM, só em memória. */
export interface TlsPemMaterial {
  readonly certChain: string;
  readonly key: string;
}

export interface A1KeyStore extends KeyStore {
  readonly kind: 'a1';
  signer(): Promise<AssinadorDeDados>;
  /**
   * PEM para o transporte em processo (ADR 0003: nunca passar o PFX ao TLS, porque o OpenSSL 3 recusa o legado).
   * A cadeia sai com o titular primeiro e as intermediárias do PFX depois (sem raízes); passe `chain` (por exemplo o
   * resultado de `buildChain`) para mandar a cadeia completada. A chave sai em PKCS#8: não grave, não logue.
   */
  tlsPem(options?: { readonly chain?: readonly CertificateInfo[] }): TlsPemMaterial;
}

export interface OpenPfxOptions {
  readonly password: string;
  /** Relógio para a trava de validade (princípio 6). */
  readonly clock: Relogio;
  /**
   * Abre mesmo fora da validade (vencido ou ainda não válido). Serve para diagnóstico e reprocessamento; a SEFAZ
   * recusa assinatura e TLS com certificado vencido.
   */
  readonly allowExpired?: boolean;
  /** Leitor do PKCS#12. Padrão: node-forge. */
  readonly reader?: Pkcs12Reader;
}

function rsaModulusOfPkcs8(der: Uint8Array): string | undefined {
  try {
    const info = readTlv(der, 0);
    const parts = children(der, info);
    const octet = parts[2] as Tlv | undefined;
    if (!octet || octet.tag !== TAG.OCTET_STRING) return undefined;
    const rsa = readTlv(der, octet.start, octet.end);
    const n = children(der, rsa)[1];
    return n ? integerHex(der, n) : undefined;
  } catch {
    return undefined;
  }
}

/** Validade de um certificado num instante. */
export function validityAt(cert: CertificateInfo, clock: Relogio): Validity {
  const now = clock.agora().getTime();
  if (now < cert.notBefore) return 'ainda_nao_valido';
  if (now > cert.notAfter) return 'expirado';
  return 'valido';
}

/**
 * Abre um PFX A1 em memória e devolve o `KeyStore`.
 *
 * Escolhe como titular o certificado de fim de cadeia que casa com uma chave do PFX e tem a validade mais longa
 * (PFX renovados às vezes trazem a folha antiga junto). Recusa certificado fora da validade, salvo `allowExpired`.
 */
export async function openPfx(pfx: Uint8Array, options: OpenPfxOptions): Promise<A1KeyStore> {
  const reader = options.reader ?? forgePkcs12Reader;
  const contents = await reader.read(pfx, options.password);
  if (contents.privateKeys.length === 0) throw new CertError('pfx_sem_chave', 'o PFX não tem chave privada');
  const certs = contents.certificates.map((c) => parseCertificate(c));
  const keys = contents.privateKeys.map((k) => ({ der: k, modulus: rsaModulusOfPkcs8(k) }));

  let best: { cert: CertificateInfo; key: Uint8Array } | undefined;
  for (const cert of certs) {
    if (cert.isCA || cert.publicKey.algorithm !== 'RSA') continue;
    const modulus = cert.publicKey.modulusHex;
    const key = keys.find((k) => k.modulus === modulus);
    if (!key) continue;
    const better =
      !best ||
      cert.notAfter > best.cert.notAfter ||
      (cert.notAfter === best.cert.notAfter && cert.notBefore > best.cert.notBefore);
    if (better) best = { cert, key: key.der };
  }
  if (!best) {
    const rsaKeys = keys.filter((k) => k.modulus !== undefined).length;
    throw new CertError(
      rsaKeys === 0 ? 'algoritmo_nao_suportado' : 'pfx_sem_certificado_da_chave',
      rsaKeys === 0
        ? 'a chave do PFX não é RSA (só RSA PKCS#1 v1.5 é suportado)'
        : 'nenhum certificado do PFX corresponde à chave privada',
      { detalhes: { certificates: certs.map((c) => c.subject.text) } },
    );
  }
  const leaf = best.cert;
  const pkcs8 = best.key;
  const validity = validityAt(leaf, options.clock);
  if (validity !== 'valido' && options.allowExpired !== true) {
    const details = { subject: leaf.subject.text, notBefore: leaf.notBeforeIso, notAfter: leaf.notAfterIso };
    throw validity === 'expirado'
      ? new CertError('certificado_expirado', `certificado vencido em ${leaf.notAfterIso}`, { detalhes: details })
      : new CertError('certificado_ainda_nao_valido', `certificado só vale a partir de ${leaf.notBeforeIso}`, {
          detalhes: details,
        });
  }
  // Outras folhas da mesma chave (renovações antigas) não entram como intermediárias.
  const leafModulus = leaf.publicKey.algorithm === 'RSA' ? leaf.publicKey.modulusHex : '';
  const extra = certs.filter(
    (c) => !sameDer(c, leaf) && !(c.publicKey.algorithm === 'RSA' && c.publicKey.modulusHex === leafModulus),
  );
  const identity = icpIdentity(leaf);
  let signer: Promise<AssinadorDeDados> | undefined;

  return {
    kind: 'a1',
    certificate: leaf,
    extraCertificates: extra,
    identity,
    validity,
    signer(): Promise<AssinadorDeDados> {
      signer ??= createA1Signer(pkcs8, leaf.der);
      return signer;
    },
    tlsPem(opts?: { readonly chain?: readonly CertificateInfo[] }): TlsPemMaterial {
      const chain = (opts?.chain ?? [leaf, ...extra]).filter((c) => !looksLikeRoot(c) || sameDer(c, leaf));
      const withLeaf = sameDer(chain[0], leaf) ? chain : [leaf, ...chain.filter((c) => !sameDer(c, leaf))];
      return {
        certChain: withLeaf.map((c) => certificateToPem(c)).join(''),
        key: derToPem(pkcs8, ['PRIVATE', 'KEY'].join(' ')),
      };
    },
  };
}

/**
 * Raiz (autoassinada) não vai no TLS. Nome de emissor igual ao do titular não basta: na troca de chave de uma AC, o
 * certificado "chave velha assina a nova" tem o mesmo nome dos dois lados e precisa seguir na cadeia. Só é raiz o
 * auto-emitido sem AKI ou com AKI igual ao próprio SKI.
 */
function looksLikeRoot(c: CertificateInfo): boolean {
  return c.selfIssued && (c.authorityKeyId === undefined || c.authorityKeyId === c.subjectKeyId);
}

function sameDer(a: CertificateInfo | undefined, b: CertificateInfo): boolean {
  if (!a || a.der.length !== b.der.length) return false;
  for (let i = 0; i < a.der.length; i++) if (a.der[i] !== b.der[i]) return false;
  return true;
}
