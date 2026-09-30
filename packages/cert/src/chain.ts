/**
 * Montagem e conferência da cadeia do certificado do titular: do leaf até uma âncora confiável (por padrão, as raízes
 * do bundle ICP-Brasil), usando os certificados do PFX e os que o chamador trouxer. A assinatura de cada elo é
 * conferida com WebCrypto (RSASSA-PKCS1-v1_5 com SHA-1, SHA-256, SHA-384 ou SHA-512).
 *
 * Não consulta revogação (OCSP/LCR): isso fica com o `sinete doctor`, sob demanda (ADR 0004, decisão 3).
 */

import type { Relogio } from '@sinete/core';
import { certificadosIcpBrasil } from './bundle.ts';
import { equalBytes } from './der.ts';
import type { CertificadoX509 } from './x509.ts';
import { lerCertificado, nomesIguais } from './x509.ts';

const SIG_HASH: Readonly<Record<string, string>> = {
  '1.2.840.113549.1.1.5': 'SHA-1',
  '1.2.840.113549.1.1.11': 'SHA-256',
  '1.2.840.113549.1.1.12': 'SHA-384',
  '1.2.840.113549.1.1.13': 'SHA-512',
};

const ab = (b: Uint8Array): Uint8Array<ArrayBuffer> => b as Uint8Array<ArrayBuffer>;

/** Confere se `emissor` assinou `cert`. `undefined` quando o algoritmo não é suportado (ex.: RSA-PSS, ECDSA). */
export async function conferirEmitidoPor(
  cert: CertificadoX509,
  emissor: CertificadoX509,
): Promise<boolean | undefined> {
  const hash = SIG_HASH[cert.signatureAlgorithm];
  if (!hash || emissor.chavePublica.algoritmo !== 'RSA') return undefined;
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash };
  try {
    const key = await crypto.subtle.importKey('spki', ab(emissor.spki), alg, false, ['verify']);
    return await crypto.subtle.verify(alg.name, key, ab(cert.signature), ab(cert.tbs));
  } catch {
    return false;
  }
}

export type SituacaoCadeia =
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

export interface ResultadoCadeia {
  readonly situacao: SituacaoCadeia;
  /** Do titular para cima, até onde foi possível subir (inclui a âncora quando achada). */
  readonly cadeia: readonly CertificadoX509[];
  readonly ancora: CertificadoX509 | undefined;
  /** DN do emissor que faltou, quando `incompleta`. */
  readonly emissorAusente: string | undefined;
  /** Elos fora da validade no instante do relógio, quando um `relogio` foi passado. */
  readonly vencidos: readonly CertificadoX509[];
}

export interface MontarCadeiaOpcoes {
  /** Certificados candidatos a intermediária (os do PFX, uma cadeia `.pem` trazida pelo usuário). */
  readonly intermediarias?: readonly (CertificadoX509 | Uint8Array)[];
  /** Âncoras de confiança. Padrão: as raízes do bundle ICP-Brasil. */
  readonly ancoras?: readonly (CertificadoX509 | Uint8Array)[];
  /** Com relógio, o resultado lista os elos vencidos ou ainda não válidos. */
  readonly relogio?: Relogio;
  readonly profundidadeMaxima?: number;
}

const asInfo = (c: CertificadoX509 | Uint8Array): CertificadoX509 => (c instanceof Uint8Array ? lerCertificado(c) : c);

function defaultAnchors(): CertificadoX509[] {
  return certificadosIcpBrasil()
    .filter((c) => c.tipo === 'raiz')
    .map((c) => lerCertificado(c.der));
}

function isIssuerCandidate(cert: CertificadoX509, cand: CertificadoX509): boolean {
  if (!nomesIguais(cert.issuer, cand.subject)) return false;
  if (cert.authorityKeyId && cand.subjectKeyId) return cert.authorityKeyId === cand.subjectKeyId;
  return true;
}

/**
 * O emissor na posição `depth` da cadeia (1 = emissor do titular) pode assinar o elo abaixo: é AC, tem `keyCertSign`
 * quando declara KeyUsage e respeita o `pathLenConstraint` (intermediárias não autoemitidas abaixo dele).
 */
export function podeEmitir(emissor: CertificadoX509, abaixo: readonly CertificadoX509[]): boolean {
  if (!emissor.isCA) return false;
  if (emissor.keyUsage.length > 0 && !emissor.keyUsage.includes('keyCertSign')) return false;
  if (emissor.pathLenConstraint !== undefined) {
    const intermediates = abaixo.slice(1).filter((c) => !c.selfIssued).length;
    if (intermediates > emissor.pathLenConstraint) return false;
  }
  return true;
}

type Found = Omit<ResultadoCadeia, 'vencidos'>;

/** Quanto mais alto, mais útil o resultado para quem diagnostica, entre caminhos que não chegaram a uma âncora. */
const RANK: Readonly<Record<SituacaoCadeia, number>> = {
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
 * versão com certificação cruzada. Com `relogio`, prefere o caminho sem elos vencidos acima do titular (intermediária
 * renovada com o mesmo nome e chave). Nunca lança por cadeia ruim: o resultado diz o que houve.
 */
export async function montarCadeia(
  folha: CertificadoX509 | Uint8Array,
  opcoes: MontarCadeiaOpcoes = {},
): Promise<ResultadoCadeia> {
  const anchors = (opcoes.ancoras ?? defaultAnchors()).map(asInfo);
  const pool = [...(opcoes.intermediarias ?? []).map(asInfo), ...anchors];
  const maxDepth = opcoes.profundidadeMaxima ?? 8;
  const isAnchor = (c: CertificadoX509): boolean => anchors.some((a) => equalBytes(a.der, c.der));
  const now = opcoes.relogio?.agora().getTime();
  const outOfValidity = (c: CertificadoX509): boolean => now !== undefined && (now < c.notBefore || now > c.notAfter);
  /** Elos vencidos acima do titular: a validade do titular não depende do caminho escolhido. */
  const expiredAbove = (f: Found): number => f.cadeia.slice(1).filter(outOfValidity).length;
  const better = (a: Found, b: Found | undefined): boolean => {
    if (!b || RANK[a.situacao] !== RANK[b.situacao]) return !b || RANK[a.situacao] > RANK[b.situacao];
    const ea = expiredAbove(a);
    const eb = expiredAbove(b);
    return ea !== eb ? ea < eb : a.cadeia.length > b.cadeia.length;
  };

  async function search(chain: CertificadoX509[]): Promise<Found> {
    const cur = chain[chain.length - 1] as CertificadoX509;
    const found = (status: SituacaoCadeia, missingIssuer?: string): Found => ({
      situacao: status,
      cadeia: chain,
      ancora: status === 'confiavel' ? cur : undefined,
      emissorAusente: missingIssuer,
    });
    if (isAnchor(cur)) return found('confiavel');
    if (cur.extensoesCriticasNaoSuportadas.length > 0) return found('extensao_critica_nao_suportada');
    if (chain.length > maxDepth) return found('incompleta', cur.issuer.texto);
    if (cur.selfIssued && (await conferirEmitidoPor(cur, cur)) !== false) return found('raiz_desconhecida');
    const candidates = pool.filter((p) => !chain.some((c) => equalBytes(c.der, p.der)) && isIssuerCandidate(cur, p));
    let best: Found | undefined;
    let sawUnauthorized = false;
    let sawBadSignature = false;
    for (const cand of candidates) {
      const ok = await conferirEmitidoPor(cur, cand);
      if (ok === false) sawBadSignature = true;
      if (!ok) continue;
      if (!podeEmitir(cand, chain)) {
        sawUnauthorized = true;
        continue;
      }
      const sub = await search([...chain, cand]);
      // Um caminho confiável e todo dentro da validade encerra a busca; com elo vencido, segue procurando um renovado.
      if (sub.situacao === 'confiavel' && expiredAbove(sub) === 0) return sub;
      if (better(sub, best)) best = sub;
    }
    const here = sawUnauthorized
      ? found('emissor_nao_autorizado')
      : sawBadSignature
        ? found('assinatura_invalida')
        : found('incompleta', cur.issuer.texto);
    return best && better(best, here) ? best : here;
  }

  const r = await search([asInfo(folha)]);
  const expired = r.cadeia.filter(outOfValidity);
  return { ...r, vencidos: expired };
}
