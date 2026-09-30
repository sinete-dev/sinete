// Verificações do subpath @sinete/core/xml compartilhadas por Node, Bun, Deno e Chromium. Devolve a lista de falhas (vazia = ok).
// A chave é gerada na hora com WebCrypto; o "certificado" é um DER mínimo só com o SubjectPublicKeyInfo no lugar
// certo, que é o que o verificador lê (a confiança na cadeia não é papel deste pacote).
import { ehErroSinete } from '@sinete/core';
import {
  montarAssinatura,
  atributoDe,
  decodificarBase64,
  codificarBase64,
  c14n,
  elementosFilhos,
  descendentes,
  escaparAtributoC14n,
  escaparTextoC14n,
  encontrarAssinaturas,
  primeiroFilho,
  namespacesEmEscopo,
  lerXml,
  prepararAssinatura,
  PREFIXO_DIGEST_INFO_SHA1,
  digestInfoDoSignedInfo,
  assinarPreparada,
  assinarXml,
  extrairSpki,
  textoDe,
  conferirAssinatura,
  XML_NS,
  ALGORITMOS_XMLDSIG,
  XMLDSIG_NS,
  XMLNS_NS,
  ErroXml,
  ErroAssinaturaXml,
} from '@sinete/core/xml';

const NFE = 'http://www.portalfiscal.inf.br/nfe';
const DOC = `<NFe xmlns="${NFE}"><infNFe Id="NFe1" versao="4.00"><xNome>A&amp;B Ç</xNome></infNFe></NFe>`;

const tlv = (tag, bytes) => {
  const n = bytes.length;
  const len = n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff];
  return Uint8Array.from([tag, ...len, ...bytes]);
};
const big = (u) => u.reduce((v, b) => (v << 8n) | BigInt(b), 0n);
const b64url = (s) => decodificarBase64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

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
    tipo: 'dados',
    certificadoDer: async () => cert,
    assinar: async (bytes) => new Uint8Array(await s.sign('RSASSA-PKCS1-v1_5', pair.privateKey, bytes)),
  };
  const digest = {
    tipo: 'digest',
    certificadoDer: async () => cert,
    assinarDigestInfo: async (di) => {
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

  const doc = lerXml(DOC);
  const inf = primeiroFilho(doc.raiz, 'infNFe', NFE);
  expect('lerXml offsets', inf && DOC.slice(inf.inicio, inf.fimDaAbertura) === '<infNFe Id="NFe1" versao="4.00">');
  expect('ids', doc.ids.get('NFe1')?.[0] === inf);
  expect('helpers', elementosFilhos(doc.raiz).length === 1 && [...descendentes(doc.raiz)].length === 3);
  expect('textoDe', textoDe(primeiroFilho(inf, 'xNome')) === 'A&B Ç' && atributoDe(inf, 'versao') === '4.00');
  expect('namespacesEmEscopo', namespacesEmEscopo(inf).get('') === NFE);
  expect('c14n', c14n(inf) === `<infNFe xmlns="${NFE}" Id="NFe1" versao="4.00"><xNome>A&amp;B Ç</xNome></infNFe>`);
  expect('escapes', escaparTextoC14n('<') === '&lt;' && escaparAtributoC14n('"') === '&quot;');
  expect('constantes', XML_NS.includes('XML/1998') && XMLNS_NS.includes('xmlns') && XMLDSIG_NS.endsWith('#'));
  expect('base64', codificarBase64(decodificarBase64('AQID')) === 'AQID');

  let err;
  try {
    lerXml('<a>M&M</a>');
  } catch (e) {
    err = e;
  }
  expect('ErroXml', err instanceof ErroXml && ehErroSinete(err, 'xml_malformado') && err.posicao === 4);

  const k = await keys();
  expect('extrairSpki', codificarBase64(extrairSpki(k.cert)) === codificarBase64(k.spki));
  const signed = await assinarXml(DOC, { id: 'NFe1' }, k.data);
  expect('assinatura é inserção', signed.replace(/<Signature .*<\/Signature>/, '') === DOC);
  expect('algoritmo', signed.includes(ALGORITMOS_XMLDSIG.rsaSha1));
  const r = await conferirAssinatura(signed, { id: 'NFe1', elemento: 'infNFe' });
  expect('conferirAssinatura ok', r.ok === true && r.elemento.local === 'infNFe');
  expect('encontrarAssinaturas', encontrarAssinaturas(lerXml(signed)).length === 1);
  const bad = await conferirAssinatura(signed.replace('A&amp;B', 'A&amp;C'), { id: 'NFe1' });
  expect('digest-diverge', bad.ok === false && bad.motivo === 'digest-diverge' && bad.signedInfoValido === true);
  const wrong = await conferirAssinatura(signed, { id: 'NFe2' });
  expect('referencia-inesperada', wrong.ok === false && wrong.motivo === 'referencia-inesperada');

  const p = await prepararAssinatura(DOC, { id: 'NFe1', certificadoDer: k.cert });
  const di = await digestInfoDoSignedInfo(p);
  expect('DigestInfo', di.length === 35 && di[0] === PREFIXO_DIGEST_INFO_SHA1[0]);
  const viaDigest = montarAssinatura(p, await assinarPreparada(p, k.digest));
  expect('modos data e digest idênticos', viaDigest === signed);

  let serr;
  try {
    await prepararAssinatura(DOC, { id: 'nada', certificadoDer: k.cert });
  } catch (e) {
    serr = e;
  }
  expect('ErroAssinaturaXml', serr instanceof ErroAssinaturaXml && serr.motivo === 'id-ausente');
  return failures;
}
