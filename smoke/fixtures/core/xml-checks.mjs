// Verificações do subpath @sinete/core/xml compartilhadas por Node, Bun, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
// A chave é gerada na hora com WebCrypto; o "certificado" é um DER mínimo só com o SubjectPublicKeyInfo no lugar
// certo, que é o que o verificador lê (a confiança na cadeia não é papel deste pacote).
import { isSineteError } from '@sinete/core';
import {
  assembleSignature,
  attributeOf,
  base64Decode,
  base64Encode,
  c14n,
  childElements,
  descendants,
  escapeC14nAttribute,
  escapeC14nText,
  findSignatures,
  firstChild,
  inScopeNamespaces,
  parseXml,
  prepareSignature,
  SHA1_DIGEST_INFO_PREFIX,
  signedInfoDigestInfo,
  signPrepared,
  signXml,
  spkiFromCertificate,
  textOf,
  verifySignature,
  XML_NS,
  XMLDSIG_ALGORITHMS,
  XMLDSIG_NS,
  XMLNS_NS,
  XmlError,
  XmlSignatureError,
} from '@sinete/core/xml';

const NFE = 'http://www.portalfiscal.inf.br/nfe';
const DOC = `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><xNome>A&amp;B Ç</xNome></infNFe></NFe>`;

const tlv = (tag, bytes) => {
  const n = bytes.length;
  const len = n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff];
  return Uint8Array.from([tag, ...len, ...bytes]);
};
const big = (u) => u.reduce((v, b) => (v << 8n) | BigInt(b), 0n);
const b64url = (s) => base64Decode(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

async function keys() {
  const s = globalThis.crypto.subtle;
  const pair = await s.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-1' },
    true,
    ['sign', 'verify'],
  );
  const spki = new Uint8Array(await s.exportKey('spki', pair.publicKey));
  const empty = tlv(0x30, []);
  const tbs = tlv(0x30, [...tlv(0xa0, tlv(0x02, [2])), ...tlv(0x02, [1]), ...empty, ...empty, ...empty, ...empty, ...spki]);
  const cert = tlv(0x30, [...tbs]);
  const jwk = await s.exportKey('jwk', pair.privateKey);
  const n = big(b64url(jwk.n));
  const d = big(b64url(jwk.d));
  const k = b64url(jwk.n).length;
  const data = {
    kind: 'data',
    certificateDer: async () => cert,
    sign: async (bytes) => new Uint8Array(await s.sign('RSASSA-PKCS1-v1_5', pair.privateKey, bytes)),
  };
  const digest = {
    kind: 'digest',
    certificateDer: async () => cert,
    signDigestInfo: async (di) => {
      const em = new Uint8Array(k);
      em[1] = 1;
      em.fill(0xff, 2, k - di.length - 1);
      em.set(di, k - di.length);
      let r = 1n;
      let b = big(em) % n;
      for (let e = d; e > 0n; e >>= 1n) {
        if (e & 1n) r = (r * b) % n;
        b = (b * b) % n;
      }
      const out = new Uint8Array(k);
      for (let i = k - 1; i >= 0; i--, r >>= 8n) out[i] = Number(r & 0xffn);
      return out;
    },
  };
  return { cert, spki, data, digest };
}

export async function runChecks() {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
  };

  const doc = parseXml(DOC);
  const inf = firstChild(doc.root, 'infNFe', NFE);
  expect('parseXml offsets', inf && DOC.slice(inf.start, inf.openEnd) === '<infNFe Id="NFe1" versao="4.00">');
  expect('ids', doc.ids.get('NFe1')?.[0] === inf);
  expect('helpers', childElements(doc.root).length === 1 && [...descendants(doc.root)].length === 3);
  expect('textOf', textOf(firstChild(inf, 'xNome')) === 'A&B Ç' && attributeOf(inf, 'versao') === '4.00');
  expect('inScopeNamespaces', inScopeNamespaces(inf).get('') === NFE);
  expect('c14n', c14n(inf) === `<infNFe xmlns="${NFE}" Id="NFe1" versao="4.00"><xNome>A&amp;B Ç</xNome></infNFe>`);
  expect('escapes', escapeC14nText('<') === '&lt;' && escapeC14nAttribute('"') === '&quot;');
  expect('constantes', XML_NS.includes('XML/1998') && XMLNS_NS.includes('xmlns') && XMLDSIG_NS.endsWith('#'));
  expect('base64', base64Encode(base64Decode('AQID')) === 'AQID');

  let err;
  try {
    parseXml('<a>M&M</a>');
  } catch (e) {
    err = e;
  }
  expect('XmlError', err instanceof XmlError && isSineteError(err, 'xml_malformado') && err.offset === 4);

  const k = await keys();
  expect('spkiFromCertificate', base64Encode(spkiFromCertificate(k.cert)) === base64Encode(k.spki));
  const signed = await signXml(DOC, { id: 'NFe1' }, k.data);
  expect('assinatura é inserção', signed.replace(/<Signature .*<\/Signature>/, '') === DOC);
  expect('algoritmo', signed.includes(XMLDSIG_ALGORITHMS.rsaSha1));
  const r = await verifySignature(signed, { id: 'NFe1', element: 'infNFe' });
  expect('verifySignature ok', r.ok === true && r.element.local === 'infNFe');
  expect('findSignatures', findSignatures(parseXml(signed)).length === 1);
  const bad = await verifySignature(signed.replace('A&amp;B', 'A&amp;C'), { id: 'NFe1' });
  expect('digest-diverge', bad.ok === false && bad.failure === 'digest-diverge' && bad.signedInfoValid === true);
  const wrong = await verifySignature(signed, { id: 'NFe2' });
  expect('referencia-inesperada', wrong.ok === false && wrong.failure === 'referencia-inesperada');

  const p = await prepareSignature(DOC, { id: 'NFe1', certificateDer: k.cert });
  const di = await signedInfoDigestInfo(p);
  expect('DigestInfo', di.length === 35 && di[0] === SHA1_DIGEST_INFO_PREFIX[0]);
  const viaDigest = assembleSignature(p, await signPrepared(p, k.digest));
  expect('modos data e digest idênticos', viaDigest === signed);

  let serr;
  try {
    await prepareSignature(DOC, { id: 'nada', certificateDer: k.cert });
  } catch (e) {
    serr = e;
  }
  expect('XmlSignatureError', serr instanceof XmlSignatureError && serr.reason === 'id-ausente');
  return failures;
}
