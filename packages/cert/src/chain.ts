/**
 * Montagem e conferência da cadeia do certificado do titular: do leaf até uma âncora confiável (por padrão, as raízes
 * do bundle ICP-Brasil), usando os certificados do PFX e os que o chamador trouxer. A assinatura de cada elo é
 * conferida com WebCrypto (RSASSA-PKCS1-v1_5 com SHA-1, SHA-256, SHA-384 ou SHA-512).
 *
 * Não consulta revogação (OCSP/LCR): isso fica com o `sinete doctor`, sob demanda (ADR 0004, decisão 3).
 */

import type { Relogio } from '@sinete/core';
import { icpBrasilCertificates } from './bundle.ts';
import { equalBytes } from './der.ts';
import type { CertificateInfo } from './x509.ts';
import { namesMatch, parseCertificate } from './x509.ts';

const SIG_HASH: Readonly<Record<string, string>> = {
  '1.2.840.113549.1.1.5': 'SHA-1',
  '1.2.840.113549.1.1.11': 'SHA-256',
  '1.2.840.113549.1.1.12': 'SHA-384',
  '1.2.840.113549.1.1.13': 'SHA-512',
};

const ab = (b: Uint8Array): Uint8Array<ArrayBuffer> => b as Uint8Array<ArrayBuffer>;

/** Confere se `issuer` assinou `cert`. `undefined` quando o algoritmo não é suportado (ex.: RSA-PSS, ECDSA). */
export async function verifyIssuedBy(cert: CertificateInfo, issuer: CertificateInfo): Promise<boolean | undefined> {
  const hash = SIG_HASH[cert.signatureAlgorithm];
  if (!hash || issuer.publicKey.algorithm !== 'RSA') return undefined;
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash };
  try {
    const key = await crypto.subtle.importKey('spki', ab(issuer.spki), alg, false, ['verify']);
    return await crypto.subtle.verify(alg.name, key, ab(cert.signature), ab(cert.tbs));
  } catch {
    return false;
  }
}

export type ChainStatus =
  /** Chegou a uma âncora confiável, com todas as assinaturas conferidas. */
  | 'confiavel'
  /** Chegou a uma raiz autoassinada que não está entre as âncoras. */
  | 'raiz_desconhecida'
  /** Falta um emissor (nem no PFX, nem nos extras, nem nas âncoras). */
  | 'incompleta'
  /** Um elo tem assinatura que não confere com o emissor. */
  | 'assinatura_invalida'
  /**
   * O emissor assinou, mas não pode emitir certificados: não é AC (BasicConstraints), não tem `keyCertSign` ou a
   * cadeia passa do `pathLenConstraint` dele (RFC 5280, 6.1.4).
   */
  | 'emissor_nao_autorizado'
  /** Um elo abaixo da âncora tem extensão crítica que não sabemos processar (RFC 5280, 4.2): o caminho é rejeitado. */
  | 'extensao_critica_nao_suportada';

export interface ChainResult {
  readonly status: ChainStatus;
  /** Do titular para cima, até onde foi possível subir (inclui a âncora quando achada). */
  readonly chain: readonly CertificateInfo[];
  readonly anchor: CertificateInfo | undefined;
  /** DN do emissor que faltou, quando `incompleta`. */
  readonly missingIssuer: string | undefined;
  /** Elos fora da validade no instante do relógio, quando um `clock` foi passado. */
  readonly expired: readonly CertificateInfo[];
}

export interface BuildChainOptions {
  /** Certificados candidatos a intermediária (os do PFX, uma cadeia `.pem` trazida pelo usuário). */
  readonly intermediates?: readonly (CertificateInfo | Uint8Array)[];
  /** Âncoras de confiança. Padrão: as raízes do bundle ICP-Brasil. */
  readonly anchors?: readonly (CertificateInfo | Uint8Array)[];
  /** Com relógio, o resultado lista os elos vencidos ou ainda não válidos. */
  readonly clock?: Relogio;
  readonly maxDepth?: number;
}

const asInfo = (c: CertificateInfo | Uint8Array): CertificateInfo =>
  c instanceof Uint8Array ? parseCertificate(c) : c;

function defaultAnchors(): CertificateInfo[] {
  return icpBrasilCertificates()
    .filter((c) => c.kind === 'root')
    .map((c) => parseCertificate(c.der));
}

function isIssuerCandidate(cert: CertificateInfo, cand: CertificateInfo): boolean {
  if (!namesMatch(cert.issuer, cand.subject)) return false;
  if (cert.authorityKeyId && cand.subjectKeyId) return cert.authorityKeyId === cand.subjectKeyId;
  return true;
}

/**
 * O emissor na posição `depth` da cadeia (1 = emissor do titular) pode assinar o elo abaixo: é AC, tem `keyCertSign`
 * quando declara KeyUsage e respeita o `pathLenConstraint` (intermediárias não autoemitidas abaixo dele).
 */
export function mayIssue(issuer: CertificateInfo, below: readonly CertificateInfo[]): boolean {
  if (!issuer.isCA) return false;
  if (issuer.keyUsage.length > 0 && !issuer.keyUsage.includes('keyCertSign')) return false;
  if (issuer.pathLenConstraint !== undefined) {
    const intermediates = below.slice(1).filter((c) => !c.selfIssued).length;
    if (intermediates > issuer.pathLenConstraint) return false;
  }
  return true;
}

type Found = Omit<ChainResult, 'expired'>;

/** Quanto mais alto, mais útil o resultado para quem diagnostica, entre caminhos que não chegaram a uma âncora. */
const RANK: Readonly<Record<ChainStatus, number>> = {
  confiavel: 6,
  raiz_desconhecida: 5,
  emissor_nao_autorizado: 4,
  extensao_critica_nao_suportada: 3,
  assinatura_invalida: 2,
  incompleta: 1,
};

/**
 * Monta a cadeia do certificado até uma âncora, tentando todos os emissores candidatos (com retrocesso): a ordem dos
 * certificados de entrada nunca esconde um caminho confiável, como o de uma intermediária com versão autoassinada e
 * versão com certificação cruzada. Com `clock`, prefere o caminho sem elos vencidos acima do titular (intermediária
 * renovada com o mesmo nome e chave). Nunca lança por cadeia ruim: o resultado diz o que houve.
 */
export async function buildChain(
  leaf: CertificateInfo | Uint8Array,
  options: BuildChainOptions = {},
): Promise<ChainResult> {
  const anchors = (options.anchors ?? defaultAnchors()).map(asInfo);
  const pool = [...(options.intermediates ?? []).map(asInfo), ...anchors];
  const maxDepth = options.maxDepth ?? 8;
  const isAnchor = (c: CertificateInfo): boolean => anchors.some((a) => equalBytes(a.der, c.der));
  const now = options.clock?.agora().getTime();
  const outOfValidity = (c: CertificateInfo): boolean => now !== undefined && (now < c.notBefore || now > c.notAfter);
  /** Elos vencidos acima do titular: a validade do titular não depende do caminho escolhido. */
  const expiredAbove = (f: Found): number => f.chain.slice(1).filter(outOfValidity).length;
  const better = (a: Found, b: Found | undefined): boolean => {
    if (!b || RANK[a.status] !== RANK[b.status]) return !b || RANK[a.status] > RANK[b.status];
    const ea = expiredAbove(a);
    const eb = expiredAbove(b);
    return ea !== eb ? ea < eb : a.chain.length > b.chain.length;
  };

  async function search(chain: CertificateInfo[]): Promise<Found> {
    const cur = chain[chain.length - 1] as CertificateInfo;
    const found = (status: ChainStatus, missingIssuer?: string): Found => ({
      status,
      chain,
      anchor: status === 'confiavel' ? cur : undefined,
      missingIssuer,
    });
    if (isAnchor(cur)) return found('confiavel');
    if (cur.unsupportedCriticalExtensions.length > 0) return found('extensao_critica_nao_suportada');
    if (chain.length > maxDepth) return found('incompleta', cur.issuer.text);
    if (cur.selfIssued && (await verifyIssuedBy(cur, cur)) !== false) return found('raiz_desconhecida');
    const candidates = pool.filter((p) => !chain.some((c) => equalBytes(c.der, p.der)) && isIssuerCandidate(cur, p));
    let best: Found | undefined;
    let sawUnauthorized = false;
    let sawBadSignature = false;
    for (const cand of candidates) {
      const ok = await verifyIssuedBy(cur, cand);
      if (ok === false) sawBadSignature = true;
      if (!ok) continue;
      if (!mayIssue(cand, chain)) {
        sawUnauthorized = true;
        continue;
      }
      const sub = await search([...chain, cand]);
      // Um caminho confiável e todo dentro da validade encerra a busca; com elo vencido, segue procurando um renovado.
      if (sub.status === 'confiavel' && expiredAbove(sub) === 0) return sub;
      if (better(sub, best)) best = sub;
    }
    const here = sawUnauthorized
      ? found('emissor_nao_autorizado')
      : sawBadSignature
        ? found('assinatura_invalida')
        : found('incompleta', cur.issuer.text);
    return best && better(best, here) ? best : here;
  }

  const r = await search([asInfo(leaf)]);
  const expired = r.chain.filter(outOfValidity);
  return { ...r, expired };
}
