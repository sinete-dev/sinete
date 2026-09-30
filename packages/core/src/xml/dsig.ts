/**
 * Verificação de XMLDSig enveloped no perfil dos DF-e (ADR 0003), sobre o parser e o C14N deste pacote.
 *
 * Só WebCrypto (`globalThis.crypto.subtle`): roda igual em Node, Bun, Deno e browser. Perfil aceito: C14N 1.0
 * inclusivo sem comentários, uma única `Reference` com `URI="#Id"`, transforms `enveloped-signature` e C14N, digest
 * SHA-1 (SHA-256 aceito) e RSA PKCS#1 v1.5 com SHA-1 (SHA-256 aceito). O resto é recusado com motivo.
 *
 * O chamador diz qual `Id` espera ver assinado: sem isso, um atacante pode assinar outro elemento do documento
 * (signature wrapping). `Id` duplicado no documento também é recusado pelo mesmo motivo.
 */

import { c14n } from './c14n.ts';
import { codificarBase64, decodificarBase64, extrairSpki } from './encoding.ts';
import { ErroXml } from './errors.ts';
import type { DocumentoXml, ElementoXml } from './parser.ts';
import { atributoDe, descendentes, elementosFilhos, lerXml, primeiroFilho, textoDe } from './parser.ts';

/** Namespace do XMLDSig. */
export const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';

/** URIs de algoritmo usadas pelo perfil SEFAZ. */
export const ALGORITMOS_XMLDSIG: {
  readonly c14n: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
  readonly envelopedSignature: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
  readonly rsaSha1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
  readonly rsaSha256: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  readonly sha1: 'http://www.w3.org/2000/09/xmldsig#sha1';
  readonly sha256: 'http://www.w3.org/2001/04/xmlenc#sha256';
} = {
  c14n: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  envelopedSignature: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
  rsaSha1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  rsaSha256: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  sha1: 'http://www.w3.org/2000/09/xmldsig#sha1',
  sha256: 'http://www.w3.org/2001/04/xmlenc#sha256',
};

/** Categoria de uma verificação que falhou. */
export type MotivoFalhaConferencia =
  /** O texto não é XML bem formado (`detail` traz o motivo e o offset). */
  | 'leitura'
  /** Nenhum `Signature` do XMLDSig no documento. */
  | 'sem-assinatura'
  /** Há assinatura, mas nenhuma referencia o `Id` esperado. */
  | 'referencia-inesperada'
  /** Nenhum elemento com o `Id` esperado (ou ele não tem o nome esperado). */
  | 'referencia-nao-encontrada'
  /** Mais de um elemento com o `Id` esperado, ou mais de uma assinatura para ele. */
  | 'id-duplicado'
  /** Algoritmo, transform ou forma de `Reference` fora do perfil aceito. */
  | 'algoritmo-nao-suportado'
  /** `Signature` sem as partes obrigatórias (`SignedInfo`, `DigestValue`, `SignatureValue`). */
  | 'estrutura'
  /** O digest do elemento referenciado não confere: o conteúdo mudou depois de assinado. */
  | 'digest-diverge'
  /** O digest confere, mas o `SignatureValue` não é a assinatura do `SignedInfo` pela chave do certificado. */
  | 'assinatura-invalida'
  /** Sem certificado em `KeyInfo`, ou certificado ilegível. */
  | 'certificado';

export interface AssinaturaEsperada {
  /** Valor do atributo `Id` que deve estar assinado (por exemplo `NFe` + chave de acesso). */
  readonly id: string;
  /** Nome local esperado do elemento referenciado (`infNFe`, `infEvento`, `infMDFe`). */
  readonly elemento?: string;
}

export interface ConferenciaValida {
  readonly ok: true;
  readonly id: string;
  /** O elemento assinado, no documento parseado. Leia os dados dele, não de outro lugar do documento. */
  readonly elemento: ElementoXml;
  readonly documento: DocumentoXml;
  /** Certificado de `KeyInfo` em DER. Confiança na cadeia é com o `@sinete/cert`, não aqui. */
  readonly certificadoDer: Uint8Array;
  readonly algoritmoDeAssinatura: 'rsa-sha1' | 'rsa-sha256';
  readonly algoritmoDeDigest: 'sha1' | 'sha256';
}

export interface ConferenciaInvalida {
  readonly ok: false;
  readonly motivo: MotivoFalhaConferencia;
  readonly detalhe: string;
  /**
   * Só em `digest-diverge`: se o `SignatureValue` confere com o `SignedInfo`. `true` indica documento alterado depois
   * de assinado (namespace removido, whitespace inserido); `false` indica assinatura que nunca foi válida.
   */
  readonly signedInfoValido?: boolean;
}

export type ResultadoConferencia = ConferenciaValida | ConferenciaInvalida;

type HashName = 'SHA-1' | 'SHA-256';

const te = new TextEncoder();

function fail(
  failure: MotivoFalhaConferencia,
  detail: string,
  extra?: { signedInfoValid: boolean },
): ConferenciaInvalida {
  return extra
    ? { ok: false, motivo: failure, detalhe: detail, signedInfoValido: extra.signedInfoValid }
    : { ok: false, motivo: failure, detalhe: detail };
}

async function digestOf(hash: HashName, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest(hash, data));
}

/** Todos os `Signature` do XMLDSig no documento, em ordem de documento. */
export function encontrarAssinaturas(doc: DocumentoXml): ElementoXml[] {
  const out: ElementoXml[] = [];
  for (const e of descendentes(doc.raiz)) if (e.local === 'Signature' && e.ns === XMLDSIG_NS) out.push(e);
  return out;
}

function referenceUri(sig: ElementoXml): string | undefined {
  const si = primeiroFilho(sig, 'SignedInfo', XMLDSIG_NS);
  const ref = si && primeiroFilho(si, 'Reference', XMLDSIG_NS);
  return ref ? atributoDe(ref, 'URI') : undefined;
}

/**
 * Verifica a assinatura que referencia `expected.id`. Aceita a string XML ou um documento já parseado por
 * `parseXml`. Nunca lança por causa do documento: toda falha volta como `VerifyFailed` com categoria.
 */
export async function conferirAssinatura(
  xml: string | DocumentoXml,
  expected: AssinaturaEsperada,
): Promise<ResultadoConferencia> {
  let doc: DocumentoXml;
  if (typeof xml === 'string') {
    try {
      doc = lerXml(xml);
    } catch (e) {
      if (e instanceof ErroXml) return fail('leitura', e.message);
      throw e;
    }
  } else doc = xml;

  const sigs = encontrarAssinaturas(doc);
  if (sigs.length === 0) return fail('sem-assinatura', 'documento sem Signature do XMLDSig');
  const mine = sigs.filter((s) => referenceUri(s) === `#${expected.id}`);
  if (mine.length === 0) return fail('referencia-inesperada', `nenhuma Signature referencia #${expected.id}`);
  if (mine.length > 1) return fail('id-duplicado', `${mine.length} Signature referenciam #${expected.id}`);
  const sig = mine[0] as ElementoXml;

  const targets = doc.ids.get(expected.id) ?? [];
  if (targets.length === 0) return fail('referencia-nao-encontrada', `nenhum elemento com Id=${expected.id}`);
  if (targets.length > 1) return fail('id-duplicado', `${targets.length} elementos com Id=${expected.id}`);
  const target = targets[0] as ElementoXml;
  if (expected.elemento !== undefined && target.local !== expected.elemento) {
    return fail(
      'referencia-nao-encontrada',
      `Id=${expected.id} está em <${target.local}>, esperado <${expected.elemento}>`,
    );
  }

  const si = primeiroFilho(sig, 'SignedInfo', XMLDSIG_NS);
  if (!si) return fail('estrutura', 'Signature sem SignedInfo');
  const cm = primeiroFilho(si, 'CanonicalizationMethod', XMLDSIG_NS);
  const cmAlg = cm && atributoDe(cm, 'Algorithm');
  if (cmAlg !== ALGORITMOS_XMLDSIG.c14n) return fail('algoritmo-nao-suportado', `CanonicalizationMethod ${cmAlg}`);
  const sm = primeiroFilho(si, 'SignatureMethod', XMLDSIG_NS);
  const smAlg = sm && atributoDe(sm, 'Algorithm');
  const signatureAlgorithm =
    smAlg === ALGORITMOS_XMLDSIG.rsaSha1 ? 'rsa-sha1' : smAlg === ALGORITMOS_XMLDSIG.rsaSha256 ? 'rsa-sha256' : null;
  if (!signatureAlgorithm) return fail('algoritmo-nao-suportado', `SignatureMethod ${smAlg}`);
  const refs = elementosFilhos(si).filter((e) => e.local === 'Reference' && e.ns === XMLDSIG_NS);
  if (refs.length !== 1) return fail('algoritmo-nao-suportado', `${refs.length} Reference no SignedInfo`);
  const ref = refs[0] as ElementoXml;

  const exclude = new Set<ElementoXml>();
  const transforms = primeiroFilho(ref, 'Transforms', XMLDSIG_NS);
  for (const t of transforms ? elementosFilhos(transforms) : []) {
    const alg = atributoDe(t, 'Algorithm');
    if (alg === ALGORITMOS_XMLDSIG.envelopedSignature) exclude.add(sig);
    else if (alg !== ALGORITMOS_XMLDSIG.c14n) return fail('algoritmo-nao-suportado', `Transform ${alg}`);
  }
  const dm = primeiroFilho(ref, 'DigestMethod', XMLDSIG_NS);
  const dmAlg = dm && atributoDe(dm, 'Algorithm');
  const digestAlgorithm =
    dmAlg === ALGORITMOS_XMLDSIG.sha1 ? 'sha1' : dmAlg === ALGORITMOS_XMLDSIG.sha256 ? 'sha256' : null;
  if (!digestAlgorithm) return fail('algoritmo-nao-suportado', `DigestMethod ${dmAlg}`);
  const dv = primeiroFilho(ref, 'DigestValue', XMLDSIG_NS);
  const svEl = primeiroFilho(sig, 'SignatureValue', XMLDSIG_NS);
  if (!dv || !svEl) return fail('estrutura', 'Signature sem DigestValue ou SignatureValue');

  let certificateDer: Uint8Array;
  let key: CryptoKey;
  const signatureHash: HashName = signatureAlgorithm === 'rsa-sha1' ? 'SHA-1' : 'SHA-256';
  try {
    const keyInfo = primeiroFilho(sig, 'KeyInfo', XMLDSIG_NS);
    const x509Data = keyInfo && primeiroFilho(keyInfo, 'X509Data', XMLDSIG_NS);
    const certEl = x509Data && primeiroFilho(x509Data, 'X509Certificate', XMLDSIG_NS);
    if (!certEl) return fail('certificado', 'sem KeyInfo/X509Data/X509Certificate');
    certificateDer = decodificarBase64(textoDe(certEl));
    key = await globalThis.crypto.subtle.importKey(
      'spki',
      extrairSpki(certificateDer),
      { name: 'RSASSA-PKCS1-v1_5', hash: signatureHash },
      false,
      ['verify'],
    );
  } catch (e) {
    return fail('certificado', `certificado ilegível: ${e instanceof Error ? e.message : String(e)}`);
  }

  let signatureValue: Uint8Array<ArrayBuffer>;
  let expectedDigest: string;
  try {
    signatureValue = decodificarBase64(textoDe(svEl));
    expectedDigest = codificarBase64(decodificarBase64(textoDe(dv)));
  } catch {
    return fail('estrutura', 'DigestValue ou SignatureValue não é base64');
  }
  const signedInfoOk = await globalThis.crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signatureValue,
    te.encode(c14n(si)),
  );
  const digest = await digestOf(
    digestAlgorithm === 'sha1' ? 'SHA-1' : 'SHA-256',
    te.encode(c14n(target, { excluir: exclude })),
  );
  if (codificarBase64(digest) !== expectedDigest) {
    return fail('digest-diverge', `digest de <${target.local}> não confere com o DigestValue`, {
      signedInfoValid: signedInfoOk,
    });
  }
  if (!signedInfoOk) return fail('assinatura-invalida', 'SignatureValue não confere com o SignedInfo');
  return {
    ok: true,
    id: expected.id,
    elemento: target,
    documento: doc,
    certificadoDer: certificateDer,
    algoritmoDeAssinatura: signatureAlgorithm,
    algoritmoDeDigest: digestAlgorithm,
  };
}
