/**
 * Assinatura XMLDSig enveloped em três fases, sem reserializar o documento (ADR 0003, invariante "assinar a string
 * final e nunca mais tocar nela"):
 *
 * 1. `prepareSignature`: acha o elemento pelo `Id`, calcula o digest do C14N dele e insere por splice o `<Signature>`
 *    como último filho do pai do elemento, com um placeholder no `SignatureValue`. O `SignedInfo` é canonicalizado
 *    já no contexto final, herdando os namespaces reais dos ancestrais.
 * 2. `signPrepared`: o `Signer` do `@sinete/core` assina os bytes do `SignedInfo` (modo `data`) ou só o DigestInfo
 *    SHA-1 de 35 bytes (modo `digest`, para PKCS#11, HSM e A3 em nuvem).
 * 3. `assembleSignature`: troca o placeholder pelo `SignatureValue`. É a única edição depois do digest.
 *
 * A saída é a entrada com exatamente uma inserção; é ela que vai para a SEFAZ e para o banco.
 */

import type { Signer } from '../signer.ts';
import { c14n } from './c14n.ts';
import { XMLDSIG_ALGORITHMS, XMLDSIG_NS } from './dsig.ts';
import { base64Encode } from './encoding.ts';
import { XmlSignatureError } from './errors.ts';
import type { XmlElement } from './parser.ts';
import { firstChild, parseXml } from './parser.ts';

/** Prefixo DER do DigestInfo SHA-1 (RFC 8017, 9.2, nota 1). */
export const SHA1_DIGEST_INFO_PREFIX: Uint8Array = Uint8Array.from([
  0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14,
]);

const PLACEHOLDER = '@@SINETE_SIGNATURE_VALUE@@';
const te = new TextEncoder();

export interface PreparedSignature {
  /** Documento com o `<Signature>` inserido e o `SignatureValue` ainda com placeholder. */
  readonly template: string;
  readonly placeholder: string;
  /** Offset onde o `<Signature>` foi inserido: logo antes da tag de fechamento do pai do elemento referenciado. */
  readonly insertedAt: number;
  /** O `SignedInfo` canonicalizado: exatamente os bytes que o signer assina no modo `data`. */
  readonly signedInfo: Uint8Array<ArrayBuffer>;
  /** DigestValue (base64) do elemento referenciado. */
  readonly digestValue: string;
  /** O elemento referenciado canonicalizado, de onde saiu o `DigestValue`; vai no `SignContext` do signer `data`. */
  readonly referenced?: Uint8Array<ArrayBuffer>;
  readonly id: string;
}

export interface PrepareOptions {
  /** `Id` do elemento a assinar (`infNFe`, `infEvento`, `infMDFe`, `infInut`). */
  readonly id: string;
  /** Certificado do titular em DER, que vai para `KeyInfo/X509Data/X509Certificate`. */
  readonly certificateDer: Uint8Array;
}

/** Fase 1: calcula o digest e insere o `<Signature>` com placeholder, sem tocar no resto do texto. */
export async function prepareSignature(xml: string, options: PrepareOptions): Promise<PreparedSignature> {
  if (xml.includes(PLACEHOLDER)) {
    throw new XmlSignatureError('placeholder-no-documento', 'o documento já contém o placeholder de assinatura');
  }
  const doc = parseXml(xml);
  const targets = doc.ids.get(options.id) ?? [];
  if (targets.length === 0) throw new XmlSignatureError('id-ausente', `nenhum elemento com Id=${options.id}`);
  if (targets.length > 1) {
    throw new XmlSignatureError('id-duplicado', `${targets.length} elementos com Id=${options.id}`);
  }
  const target = targets[0] as XmlElement;
  if (target.parent === null) {
    throw new XmlSignatureError(
      'referencia-na-raiz',
      'o elemento assinado não pode ser a raiz: a Signature fica como irmã dele',
    );
  }
  const referenced = te.encode(c14n(target));
  const digest = await globalThis.crypto.subtle.digest('SHA-1', referenced);
  const digestValue = base64Encode(new Uint8Array(digest));
  const A = XMLDSIG_ALGORITHMS;
  const signedInfo =
    `<SignedInfo><CanonicalizationMethod Algorithm="${A.c14n}"/><SignatureMethod Algorithm="${A.rsaSha1}"/>` +
    `<Reference URI="#${options.id}"><Transforms><Transform Algorithm="${A.envelopedSignature}"/>` +
    `<Transform Algorithm="${A.c14n}"/></Transforms><DigestMethod Algorithm="${A.sha1}"/>` +
    `<DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  const signature =
    `<Signature xmlns="${XMLDSIG_NS}">${signedInfo}<SignatureValue>${PLACEHOLDER}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${base64Encode(options.certificateDer)}</X509Certificate></X509Data>` +
    '</KeyInfo></Signature>';
  // Último filho do pai, não logo depois do elemento: NFC-e (`infNFeSupl`), MDF-e (`infMDFeSupl`) e CT-e têm um
  // irmão entre o elemento assinado e a Signature no schema. Em NFe, evento, MDFe e inutNFe a Signature é o último
  // filho. `contentEnd` é o `<` da tag de fechamento do pai (que existe, porque o pai tem o alvo como filho).
  const insertedAt = target.parent.contentEnd;
  const template = xml.slice(0, insertedAt) + signature + xml.slice(insertedAt);

  // O SignedInfo é canonicalizado no documento final, com os ancestrais reais.
  const tdoc = parseXml(template);
  let sigEl: XmlElement | undefined;
  const stack: XmlElement[] = [tdoc.root];
  while (stack.length > 0 && !sigEl) {
    const e = stack.pop() as XmlElement;
    if (e.start === insertedAt && e.local === 'Signature') sigEl = e;
    else if (e.start < insertedAt && e.end > insertedAt) {
      for (const c of e.children) if (c.type === 'element') stack.push(c);
    }
  }
  const si = sigEl && firstChild(sigEl, 'SignedInfo', XMLDSIG_NS);
  if (!si) throw new XmlSignatureError('placeholder-ausente', 'Signature inserida não foi encontrada no template');
  return {
    template,
    placeholder: PLACEHOLDER,
    insertedAt,
    signedInfo: te.encode(c14n(si)),
    digestValue,
    referenced,
    id: options.id,
  };
}

/** Monta o DigestInfo DER (prefixo SHA-1 + hash) do `SignedInfo`, entrada do modo `digest`. */
export async function signedInfoDigestInfo(prepared: PreparedSignature): Promise<Uint8Array> {
  const h = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-1', prepared.signedInfo));
  const di = new Uint8Array(SHA1_DIGEST_INFO_PREFIX.length + h.length);
  di.set(SHA1_DIGEST_INFO_PREFIX);
  di.set(h, SHA1_DIGEST_INFO_PREFIX.length);
  return di;
}

/** Fase 2: pede a assinatura RSA PKCS#1 v1.5 com SHA-1 ao signer, no modo dele. */
export async function signPrepared(prepared: PreparedSignature, signer: Signer): Promise<Uint8Array> {
  const value =
    signer.kind === 'data'
      ? await signer.sign(
          prepared.signedInfo,
          'SHA-1',
          prepared.referenced === undefined ? undefined : { id: prepared.id, referenced: prepared.referenced },
        )
      : await signer.signDigestInfo(await signedInfoDigestInfo(prepared));
  if (value.length === 0) throw new XmlSignatureError('assinatura-vazia', 'o signer devolveu assinatura vazia');
  return value;
}

/** Fase 3: troca o placeholder pelo `SignatureValue`. Nada mais no texto muda. */
export function assembleSignature(prepared: PreparedSignature, signatureValue: Uint8Array): string {
  if (signatureValue.length === 0) throw new XmlSignatureError('assinatura-vazia', 'SignatureValue vazio');
  const i = prepared.template.indexOf(prepared.placeholder);
  if (i === -1 || prepared.template.indexOf(prepared.placeholder, i + 1) !== -1) {
    throw new XmlSignatureError('placeholder-ausente', 'o template precisa ter exatamente um placeholder');
  }
  return (
    prepared.template.slice(0, i) +
    base64Encode(signatureValue) +
    prepared.template.slice(i + prepared.placeholder.length)
  );
}

/** As três fases de uma vez: prepara com o certificado do signer, assina e monta. */
export async function signXml(xml: string, options: { readonly id: string }, signer: Signer): Promise<string> {
  const prepared = await prepareSignature(xml, { id: options.id, certificateDer: await signer.certificateDer() });
  return assembleSignature(prepared, await signPrepared(prepared, signer));
}
