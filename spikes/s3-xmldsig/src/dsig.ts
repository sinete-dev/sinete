// Verificação e assinatura XMLDSig enveloped no perfil SEFAZ, sobre o parser/C14N próprio.
// Só usa WebCrypto (globalThis.crypto.subtle): roda em Node, Bun, Deno e browser.
import { attr, c14n, childEl, childEls, type Document, type Element, nsUri, parse, textOf, walk, XmlError } from './xml.ts';

export const DSIG = 'http://www.w3.org/2000/09/xmldsig#';
export const ALG = {
  c14n: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  enveloped: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
  rsaSha1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  rsaSha256: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  sha1: 'http://www.w3.org/2000/09/xmldsig#sha1',
  sha256: 'http://www.w3.org/2001/04/xmlenc#sha256',
} as const;

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export function b64decode(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ''));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
export function b64encode(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

// --- DER mínimo: extrai o SubjectPublicKeyInfo de um certificado X.509 (RFC 5280 §4.1) ---
function derRead(b: Uint8Array, off: number) {
  const tag = b[off];
  let len = b[off + 1];
  let hdr = 2;
  if (len & 0x80) {
    const nb = len & 0x7f;
    len = 0;
    for (let k = 0; k < nb; k++) len = len * 256 + b[off + 2 + k];
    hdr += nb;
  }
  return { tag, start: off, content: off + hdr, end: off + hdr + len };
}
export function spkiFromCert(der: Uint8Array): Uint8Array {
  const cert = derRead(der, 0);
  const tbs = derRead(der, cert.content);
  let p = tbs.content;
  let f = derRead(der, p);
  if (f.tag === 0xa0) { p = f.end; f = derRead(der, p); } // [0] version
  // serial, signature, issuer, validity, subject
  for (let k = 0; k < 5; k++) { p = f.end; f = derRead(der, p); }
  return der.slice(f.start, f.end);
}

export type Failure =
  | 'sem-assinatura'
  | 'parse'
  | 'algoritmo-nao-suportado'
  | 'referencia-nao-encontrada'
  | 'id-duplicado'
  | 'digest-diverge'
  | 'assinatura-invalida'
  | 'certificado';

export interface SigResult {
  ok: boolean;
  failure?: Failure;
  detail?: string;
  refId?: string;
  refLocal?: string;
}

const hashFor = (uri: string) => (uri === ALG.sha1 ? 'SHA-1' : uri === ALG.sha256 ? 'SHA-256' : undefined);

export async function verifySignatureElement(doc: Document, sig: Element): Promise<SigResult> {
  const si = childEl(sig, 'SignedInfo', DSIG);
  if (!si) return { ok: false, failure: 'parse', detail: 'sem SignedInfo' };
  const cm = attr(childEl(si, 'CanonicalizationMethod')!, 'Algorithm');
  const sm = attr(childEl(si, 'SignatureMethod')!, 'Algorithm');
  if (cm !== ALG.c14n) return { ok: false, failure: 'algoritmo-nao-suportado', detail: `c14n ${cm}` };
  const sigHash = sm === ALG.rsaSha1 ? 'SHA-1' : sm === ALG.rsaSha256 ? 'SHA-256' : undefined;
  if (!sigHash) return { ok: false, failure: 'algoritmo-nao-suportado', detail: `sig ${sm}` };
  const refs = childEls(si, 'Reference');
  if (refs.length !== 1) return { ok: false, failure: 'parse', detail: `${refs.length} Reference` };
  let refId = '', refLocal = '';
  for (const ref of refs) {
    const uri = attr(ref, 'URI') ?? '';
    if (!uri.startsWith('#')) return { ok: false, failure: 'algoritmo-nao-suportado', detail: `URI '${uri}'` };
    refId = uri.slice(1);
    const targets = doc.ids.get(refId);
    if (!targets) return { ok: false, failure: 'referencia-nao-encontrada', refId };
    if (targets.length > 1) return { ok: false, failure: 'id-duplicado', refId };
    const target = targets[0];
    refLocal = target.local;
    const exclude = new Set<Element>();
    const tr = childEl(ref, 'Transforms');
    for (const t of tr ? childEls(tr, 'Transform') : []) {
      const a = attr(t, 'Algorithm');
      if (a === ALG.enveloped) exclude.add(sig);
      else if (a !== ALG.c14n) return { ok: false, failure: 'algoritmo-nao-suportado', detail: `transform ${a}` };
    }
    const h = hashFor(attr(childEl(ref, 'DigestMethod')!, 'Algorithm') ?? '');
    if (!h) return { ok: false, failure: 'algoritmo-nao-suportado', detail: 'digest' };
    const digest = new Uint8Array(await subtle.digest(h, te.encode(c14n(target, exclude))));
    const expected = textOf(childEl(ref, 'DigestValue')!).replace(/\s+/g, '');
    if (b64encode(digest) !== expected) return { ok: false, failure: 'digest-diverge', refId, refLocal };
  }
  const certEl = [...walk(sig)].find((e) => e.local === 'X509Certificate');
  if (!certEl) return { ok: false, failure: 'certificado', detail: 'sem X509Certificate', refId, refLocal };
  let key: CryptoKey;
  try {
    key = await subtle.importKey('spki', spkiFromCert(b64decode(textOf(certEl))), { name: 'RSASSA-PKCS1-v1_5', hash: sigHash }, false, ['verify']);
  } catch (e) {
    return { ok: false, failure: 'certificado', detail: String(e), refId, refLocal };
  }
  const sv = b64decode(textOf(childEl(sig, 'SignatureValue', DSIG)!));
  const ok = await subtle.verify('RSASSA-PKCS1-v1_5', key, sv, te.encode(c14n(si)));
  return ok ? { ok, refId, refLocal } : { ok, failure: 'assinatura-invalida', refId, refLocal };
}

export async function verifyDocument(xml: string): Promise<SigResult[]> {
  let doc: Document;
  try {
    doc = parse(xml);
  } catch (e) {
    return [{ ok: false, failure: 'parse', detail: e instanceof XmlError ? e.message : String(e) }];
  }
  const sigs = [...walk(doc.root)].filter((e) => e.local === 'Signature' && nsUri(e, e.prefix) === DSIG);
  if (!sigs.length) return [{ ok: false, failure: 'sem-assinatura' }];
  const res: SigResult[] = [];
  for (const s of sigs) res.push(await verifySignatureElement(doc, s));
  return res;
}

// ------------------------------- Assinatura em duas fases -------------------------------

/**
 * Quem assina. O core nunca vê a chave: entrega bytes e recebe bytes.
 * - `data`: o signer recebe o SignedInfo canonicalizado e faz hash+RSA (WebCrypto, CKM_SHA1_RSA_PKCS).
 * - `digest`: o signer recebe só o DigestInfo DER (prefixo SHA-1 + hash de 20 bytes) e faz RSA puro
 *   (CKM_RSA_PKCS em PKCS#11, HSM/A3 em nuvem que assina hash, KMS). Menos bytes pela rede e
 *   o conteúdo do documento não sai do processo.
 */
export type Signer =
  | { kind: 'data'; certificateDer(): Promise<Uint8Array>; sign(data: Uint8Array): Promise<Uint8Array> }
  | { kind: 'digest'; certificateDer(): Promise<Uint8Array>; signDigestInfo(digestInfo: Uint8Array): Promise<Uint8Array> };

const SHA1_DIGESTINFO_PREFIX = Uint8Array.from([0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14]);

export interface PreparedSignature {
  /** XML com o <Signature> já inserido e SignatureValue marcado por placeholder. */
  template: string;
  placeholder: string;
  /** SignedInfo canonicalizado: exatamente os bytes que precisam ser assinados. */
  signedInfoC14n: Uint8Array;
  digestValue: string;
}

const SIG_PLACEHOLDER = '@@SINETE_SIGNATURE_VALUE@@';

/**
 * Fase 1: acha o elemento com Id=refId, calcula o digest, e insere por splice de string o
 * <Signature> como irmão logo após o elemento referenciado (layout SEFAZ: NFe > infNFe + Signature).
 * O resto do XML nunca é reserializado.
 */
export async function prepare(xml: string, refId: string, certDer: Uint8Array): Promise<PreparedSignature> {
  const doc = parse(xml);
  const targets = doc.ids.get(refId);
  if (!targets || targets.length !== 1) throw new Error(`Id ${refId} ausente ou duplicado`);
  const target = targets[0];
  const digest = b64encode(new Uint8Array(await subtle.digest('SHA-1', te.encode(c14n(target)))));
  const signedInfo =
    `<SignedInfo><CanonicalizationMethod Algorithm="${ALG.c14n}"/><SignatureMethod Algorithm="${ALG.rsaSha1}"/>` +
    `<Reference URI="#${refId}"><Transforms><Transform Algorithm="${ALG.enveloped}"/><Transform Algorithm="${ALG.c14n}"/></Transforms>` +
    `<DigestMethod Algorithm="${ALG.sha1}"/><DigestValue>${digest}</DigestValue></Reference></SignedInfo>`;
  const sigXml =
    `<Signature xmlns="${DSIG}">${signedInfo}<SignatureValue>${SIG_PLACEHOLDER}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${b64encode(certDer)}</X509Certificate></X509Data></KeyInfo></Signature>`;
  const template = xml.slice(0, target.end) + sigXml + xml.slice(target.end);
  // Canonicaliza o SignedInfo já no contexto final (herda namespaces dos ancestrais reais).
  const tdoc = parse(template);
  const sig = [...walk(tdoc.root)].find((e) => e.local === 'Signature' && e.start === target.end)!;
  const si = childEl(sig, 'SignedInfo')!;
  return { template, placeholder: SIG_PLACEHOLDER, signedInfoC14n: te.encode(c14n(si)), digestValue: digest };
}

/** Fase 2: o signer assina bytes (ou o DigestInfo). */
export async function signPrepared(p: PreparedSignature, signer: Signer): Promise<Uint8Array> {
  if (signer.kind === 'data') return signer.sign(p.signedInfoC14n);
  const h = new Uint8Array(await subtle.digest('SHA-1', p.signedInfoC14n));
  const di = new Uint8Array(SHA1_DIGESTINFO_PREFIX.length + h.length);
  di.set(SHA1_DIGESTINFO_PREFIX);
  di.set(h, SHA1_DIGESTINFO_PREFIX.length);
  return signer.signDigestInfo(di);
}

/** Fase 3: troca o placeholder pelo SignatureValue. Única edição de string depois do digest. */
export function assemble(p: PreparedSignature, signatureValue: Uint8Array): string {
  const i = p.template.indexOf(p.placeholder);
  return p.template.slice(0, i) + b64encode(signatureValue) + p.template.slice(i + p.placeholder.length);
}

export async function signXml(xml: string, refId: string, signer: Signer): Promise<string> {
  const p = await prepare(xml, refId, await signer.certificateDer());
  return assemble(p, await signPrepared(p, signer));
}

/** Signer A1 com WebCrypto (chave PKCS#8 já extraída do PFX). */
export async function webCryptoSigner(pkcs8: Uint8Array, certDer: Uint8Array): Promise<Signer> {
  const key = await subtle.importKey('pkcs8', pkcs8, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' }, false, ['sign']);
  return {
    kind: 'data',
    certificateDer: async () => certDer,
    sign: async (data) => new Uint8Array(await subtle.sign('RSASSA-PKCS1-v1_5', key, data)),
  };
}
