/**
 * Leitura de certificados X.509 (RFC 5280) sobre o leitor DER próprio. Só o que o sinete usa: titular, emissor,
 * validade, extensões de uso, SAN (inclusive os `otherName` da ICP-Brasil), AIA, chave pública RSA e os bytes para
 * verificar a assinatura do emissor.
 */

import type { Tlv } from './der.ts';
import {
  children,
  contentBytes,
  decodeOid,
  decodeString,
  decodeTime,
  equalBytes,
  expectTag,
  integerHex,
  isoFromEpoch,
  readTlv,
  TAG,
  tlvBytes,
  toHex,
} from './der.ts';
import { ErroCertificado } from './errors.ts';
import { pemDoDer } from './pem.ts';

/** Atributo de um nome distinto (DN), na ordem em que aparece no certificado. */
export interface AtributoDoNome {
  readonly oid: string;
  /** Nome curto (`CN`, `O`, `OU`, `C`...) ou o OID quando não há nome curto. */
  readonly type: string;
  readonly value: string;
}

export interface NomeDistinto {
  /** `C=BR, O=ICP-Brasil, OU=..., CN=...`, na ordem do certificado (a mesma do OpenSSL e do Node). */
  readonly texto: string;
  readonly atributos: readonly AtributoDoNome[];
  readonly commonName: string | undefined;
  /** DER do Name, usado para casar emissor e titular byte a byte. */
  readonly der: Uint8Array;
}

/** `otherName` do SAN: OID e o valor já decodificado como texto. */
export interface OtherName {
  readonly oid: string;
  readonly value: string;
}

export interface SubjectAltNames {
  readonly otherNames: readonly OtherName[];
  readonly emails: readonly string[];
  readonly nomesDns: readonly string[];
  readonly uris: readonly string[];
  /** `iPAddress` (RFC 5280, seção 4.2.1.6): IPv4 com pontos, IPv6 na forma curta da RFC 5952 (minúsculas, `::`). */
  readonly enderecosIp: readonly string[];
}

export interface ChavePublicaRsa {
  readonly algoritmo: 'RSA';
  /** Módulo em hexadecimal minúsculo, sem zero à esquerda. Serve para casar certificado e chave privada. */
  readonly moduloHex: string;
  readonly expoenteHex: string;
  readonly bits: number;
}

export interface OutraChavePublica {
  readonly algoritmo: 'outro';
  readonly oid: string;
}

export interface CertificadoX509 {
  readonly der: Uint8Array;
  readonly version: number;
  /** Número de série em hexadecimal minúsculo. */
  readonly serialNumber: string;
  readonly subject: NomeDistinto;
  readonly issuer: NomeDistinto;
  /** Início e fim da validade, em milissegundos desde a época (UTC). */
  readonly notBefore: number;
  readonly notAfter: number;
  /** Os mesmos instantes em ISO 8601 UTC, para exibir. */
  readonly notBeforeIso: string;
  readonly notAfterIso: string;
  readonly isCA: boolean;
  /** `pathLenConstraint` do BasicConstraints, quando houver. */
  readonly pathLenConstraint: number | undefined;
  readonly selfIssued: boolean;
  /**
   * OIDs de extensões marcadas como críticas que este parser não processa (por exemplo nameConstraints ou
   * certificatePolicies críticas). `montarCadeia` não dá como confiável um caminho que passe por um certificado assim.
   */
  readonly extensoesCriticasNaoSuportadas: readonly string[];
  readonly keyUsage: readonly string[];
  readonly extKeyUsage: readonly string[];
  readonly subjectAltNames: SubjectAltNames;
  readonly subjectKeyId: string | undefined;
  readonly authorityKeyId: string | undefined;
  readonly urlsOcsp: readonly string[];
  readonly urlsCaIssuers: readonly string[];
  readonly urlsCrl: readonly string[];
  readonly chavePublica: ChavePublicaRsa | OutraChavePublica;
  /** SubjectPublicKeyInfo em DER (importável como `spki` no WebCrypto). */
  readonly spki: Uint8Array;
  /** TBSCertificate em DER: os bytes que o emissor assinou. */
  readonly tbs: Uint8Array;
  readonly signatureAlgorithm: string;
  readonly signature: Uint8Array;
}

const DN_NAMES: Readonly<Record<string, string>> = {
  '2.5.4.3': 'CN',
  '2.5.4.5': 'serialNumber',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '1.2.840.113549.1.9.1': 'emailAddress',
};

const KEY_USAGE = [
  'digitalSignature',
  'nonRepudiation',
  'keyEncipherment',
  'dataEncipherment',
  'keyAgreement',
  'keyCertSign',
  'cRLSign',
  'encipherOnly',
  'decipherOnly',
];

const EKU_NAMES: Readonly<Record<string, string>> = {
  '1.3.6.1.5.5.7.3.1': 'serverAuth',
  '1.3.6.1.5.5.7.3.2': 'clientAuth',
  '1.3.6.1.5.5.7.3.3': 'codeSigning',
  '1.3.6.1.5.5.7.3.4': 'emailProtection',
  '1.3.6.1.5.5.7.3.8': 'timeStamping',
  '1.3.6.1.5.5.7.3.9': 'OCSPSigning',
};

const OID_RSA = '1.2.840.113549.1.1.1';

function parseName(buf: Uint8Array, node: Tlv): NomeDistinto {
  expectTag(node, TAG.SEQUENCE, 'Name');
  const attributes: AtributoDoNome[] = [];
  for (const rdn of children(buf, node)) {
    for (const atv of children(buf, expectTag(rdn, TAG.SET, 'RDN'))) {
      const [t, v] = children(buf, atv);
      if (!t || !v) throw new ErroCertificado('certificado_invalido', 'atributo de DN incompleto');
      const oid = decodeOid(buf, t);
      attributes.push({ oid, type: DN_NAMES[oid] ?? oid, value: decodeString(buf, v) });
    }
  }
  return {
    texto: attributes.map((a) => `${a.type}=${a.value}`).join(', '),
    atributos: attributes,
    commonName: attributes.findLast((a) => a.type === 'CN')?.value,
    der: tlvBytes(buf, node),
  };
}

function parseSpki(buf: Uint8Array, node: Tlv): ChavePublicaRsa | OutraChavePublica {
  const [alg, bits] = children(buf, expectTag(node, TAG.SEQUENCE, 'SubjectPublicKeyInfo'));
  if (!alg || !bits) throw new ErroCertificado('certificado_invalido', 'SubjectPublicKeyInfo incompleto');
  const [algOidNode] = children(buf, alg);
  if (!algOidNode) throw new ErroCertificado('certificado_invalido', 'AlgorithmIdentifier vazio');
  const oid = decodeOid(buf, algOidNode);
  if (oid !== OID_RSA) return { algoritmo: 'outro', oid };
  expectTag(bits, TAG.BIT_STRING, 'chave pública');
  // pula o byte de bits não usados
  const rsa = readTlv(buf, bits.start + 1, bits.end);
  const [n, e] = children(buf, expectTag(rsa, TAG.SEQUENCE, 'RSAPublicKey'));
  if (!n || !e) throw new ErroCertificado('certificado_invalido', 'RSAPublicKey incompleta');
  const modulusHex = integerHex(buf, n);
  return { algoritmo: 'RSA', moduloHex: modulusHex, expoenteHex: integerHex(buf, e), bits: bitLength(modulusHex) };
}

function bitLength(hex: string): number {
  if (hex === '0' || hex === '') return 0;
  return (hex.length - 1) * 4 + Number.parseInt(hex[0] ?? '0', 16).toString(2).length;
}

function collectUris(buf: Uint8Array, node: Tlv, out: string[]): void {
  if (node.tag === 0x86) {
    out.push(decodeString(buf, { ...node, tag: TAG.IA5_STRING }));
    return;
  }
  if (node.constructed) for (const c of children(buf, node)) collectUris(buf, c, out);
}

interface Extensions {
  isCA: boolean;
  pathLen: number | undefined;
  keyUsage: string[];
  extKeyUsage: string[];
  san: { otherNames: OtherName[]; emails: string[]; nomesDns: string[]; uris: string[]; enderecosIp: string[] };
  subjectKeyId: string | undefined;
  authorityKeyId: string | undefined;
  ocspUrls: string[];
  caIssuersUrls: string[];
  crlUrls: string[];
  unsupportedCritical: string[];
}

/** Extensões que o parser entende; uma crítica fora desta lista invalida o caminho (RFC 5280, 4.2). */
const KNOWN_EXTENSIONS: ReadonlySet<string> = new Set([
  '2.5.29.14',
  '2.5.29.15',
  '2.5.29.17',
  '2.5.29.19',
  '2.5.29.31',
  '2.5.29.35',
  '2.5.29.37',
  '1.3.6.1.5.5.7.1.1',
]);

function parseExtensions(buf: Uint8Array, list: Tlv | undefined): Extensions {
  const x: Extensions = {
    isCA: false,
    pathLen: undefined,
    keyUsage: [],
    extKeyUsage: [],
    san: { otherNames: [], emails: [], nomesDns: [], uris: [], enderecosIp: [] },
    subjectKeyId: undefined,
    authorityKeyId: undefined,
    ocspUrls: [],
    caIssuersUrls: [],
    crlUrls: [],
    unsupportedCritical: [],
  };
  if (!list) return x;
  for (const ext of children(buf, expectTag(list, TAG.SEQUENCE, 'Extensions'))) {
    const parts = children(buf, ext);
    const oidNode = parts[0];
    const valueNode = parts.at(-1);
    if (!oidNode || !valueNode) continue;
    const oid = decodeOid(buf, oidNode);
    const flag = parts.length === 3 ? parts[1] : undefined;
    if (flag?.tag === TAG.BOOLEAN && buf[flag.start] !== 0 && !KNOWN_EXTENSIONS.has(oid))
      x.unsupportedCritical.push(oid);
    const value = readTlv(buf, valueNode.start, valueNode.end);
    switch (oid) {
      case '2.5.29.19': {
        const parts = children(buf, value);
        const first = parts[0];
        x.isCA = first?.tag === TAG.BOOLEAN && buf[first.start] !== 0;
        const len = parts.find((c) => c.tag === TAG.INTEGER);
        if (len) x.pathLen = Number.parseInt(integerHex(buf, len), 16);
        break;
      }
      case '2.5.29.15': {
        const bytes = contentBytes(buf, value).subarray(1);
        KEY_USAGE.forEach((name, i) => {
          if (((bytes[i >> 3] ?? 0) >> (7 - (i & 7))) & 1) x.keyUsage.push(name);
        });
        break;
      }
      case '2.5.29.37':
        for (const o of children(buf, value)) {
          const id = decodeOid(buf, o);
          x.extKeyUsage.push(EKU_NAMES[id] ?? id);
        }
        break;
      case '2.5.29.17':
        for (const gn of children(buf, value)) {
          if (gn.tag === 0xa0) {
            const [typeId, explicit] = children(buf, gn);
            if (!typeId || !explicit) continue;
            const inner = children(buf, explicit)[0];
            let text = '';
            try {
              text = inner ? decodeString(buf, inner) : '';
            } catch {
              text = inner ? toHex(contentBytes(buf, inner)) : '';
            }
            x.san.otherNames.push({ oid: decodeOid(buf, typeId), value: text });
          } else if (gn.tag === 0x81) x.san.emails.push(decodeString(buf, { ...gn, tag: TAG.IA5_STRING }));
          else if (gn.tag === 0x82) x.san.nomesDns.push(decodeString(buf, { ...gn, tag: TAG.IA5_STRING }));
          else if (gn.tag === 0x86) x.san.uris.push(decodeString(buf, { ...gn, tag: TAG.IA5_STRING }));
          else if (gn.tag === 0x87) {
            const ip = formatIp(contentBytes(buf, gn));
            if (ip !== undefined) x.san.enderecosIp.push(ip);
          }
        }
        break;
      case '2.5.29.14':
        x.subjectKeyId = toHex(contentBytes(buf, value));
        break;
      case '2.5.29.35': {
        const kid = children(buf, value).find((c) => c.tag === 0x80);
        if (kid) x.authorityKeyId = toHex(contentBytes(buf, kid));
        break;
      }
      case '1.3.6.1.5.5.7.1.1':
        for (const ad of children(buf, value)) {
          const [method, location] = children(buf, ad);
          if (!method || location?.tag !== 0x86) continue;
          const url = decodeString(buf, { ...location, tag: TAG.IA5_STRING });
          const m = decodeOid(buf, method);
          if (m === '1.3.6.1.5.5.7.48.1') x.ocspUrls.push(url);
          else if (m === '1.3.6.1.5.5.7.48.2') x.caIssuersUrls.push(url);
        }
        break;
      case '2.5.29.31':
        collectUris(buf, value, x.crlUrls);
        break;
    }
  }
  return x;
}

/** Lê um certificado X.509 em DER. Lança `ErroCertificado('certificado_invalido')` se o DER não for um certificado. */
export function lerCertificado(der: Uint8Array): CertificadoX509 {
  const buf = der;
  try {
    const cert = expectTag(readTlv(buf, 0), TAG.SEQUENCE, 'Certificate');
    const [tbs, sigAlg, sigValue] = children(buf, cert);
    if (!tbs || !sigAlg || !sigValue) throw new ErroCertificado('certificado_invalido', 'Certificate incompleto');
    const fields = children(buf, expectTag(tbs, TAG.SEQUENCE, 'TBSCertificate'));
    let i = 0;
    let version = 1;
    if (fields[0]?.tag === 0xa0) {
      const v = children(buf, fields[0])[0];
      version = v ? Number.parseInt(integerHex(buf, v), 16) + 1 : 1;
      i = 1;
    }
    const at = (k: number): Tlv => {
      const f = fields[k];
      if (!f) throw new ErroCertificado('certificado_invalido', 'TBSCertificate incompleto');
      return f;
    };
    const serialNumber = integerHex(buf, at(i));
    const issuer = parseName(buf, at(i + 2));
    const [nb, na] = children(buf, expectTag(at(i + 3), TAG.SEQUENCE, 'Validity'));
    if (!nb || !na) throw new ErroCertificado('certificado_invalido', 'Validity incompleta');
    const subject = parseName(buf, at(i + 4));
    const spkiNode = at(i + 5);
    const extWrapper = fields.slice(i + 6).find((f) => f.tag === 0xa3);
    const ext = parseExtensions(buf, extWrapper ? children(buf, extWrapper)[0] : undefined);
    const sigAlgOid = children(buf, sigAlg)[0];
    if (!sigAlgOid) throw new ErroCertificado('certificado_invalido', 'signatureAlgorithm vazio');
    expectTag(sigValue, TAG.BIT_STRING, 'signatureValue');
    const notBefore = decodeTime(buf, nb);
    const notAfter = decodeTime(buf, na);
    return {
      der: buf,
      version,
      serialNumber,
      subject,
      issuer,
      notBefore,
      notAfter,
      notBeforeIso: isoFromEpoch(notBefore),
      notAfterIso: isoFromEpoch(notAfter),
      isCA: ext.isCA,
      pathLenConstraint: ext.pathLen,
      extensoesCriticasNaoSuportadas: ext.unsupportedCritical,
      selfIssued: nomesIguais(issuer, subject),
      keyUsage: ext.keyUsage,
      extKeyUsage: ext.extKeyUsage,
      subjectAltNames: ext.san,
      subjectKeyId: ext.subjectKeyId,
      authorityKeyId: ext.authorityKeyId,
      urlsOcsp: ext.ocspUrls,
      urlsCaIssuers: ext.caIssuersUrls,
      urlsCrl: ext.crlUrls,
      chavePublica: parseSpki(buf, spkiNode),
      spki: tlvBytes(buf, spkiNode),
      tbs: tlvBytes(buf, tbs),
      signatureAlgorithm: decodeOid(buf, sigAlgOid),
      signature: contentBytes(buf, sigValue).subarray(1),
    };
  } catch (cause) {
    if (cause instanceof ErroCertificado) throw cause;
    throw new ErroCertificado('certificado_invalido', 'certificado X.509 ilegível', { cause });
  }
}

/** Certificado em PEM (`CERTIFICATE`). */
export function pemDoCertificado(cert: CertificadoX509 | Uint8Array): string {
  return pemDoDer(cert instanceof Uint8Array ? cert : cert.der, 'CERTIFICATE');
}

/** SHA-256 do DER em hexadecimal maiúsculo com `:`, no formato do OpenSSL e do Node (`fingerprint256`). */
export async function impressaoDigitalSha256(cert: CertificadoX509 | Uint8Array): Promise<string> {
  const der = cert instanceof Uint8Array ? cert : cert.der;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', der as Uint8Array<ArrayBuffer>));
  return toHex(digest)
    .toUpperCase()
    .replace(/(..)(?!$)/g, '$1:');
}

/** Normalização simplificada da RFC 4518 para comparar valores de atributo: espaços colapsados e caixa ignorada. */
const norm = (v: string): string => v.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Nomes distintos equivalentes (RFC 5280, 7.1): mesmos tipos de atributo na mesma ordem e valores iguais depois da
 * normalização, independente do tipo de string usado na codificação (PrintableString contra UTF8String).
 */
export function nomesIguais(a: NomeDistinto, b: NomeDistinto): boolean {
  if (equalBytes(a.der, b.der)) return true;
  if (a.atributos.length !== b.atributos.length) return false;
  return a.atributos.every((x, i) => {
    const y = b.atributos[i];
    return y !== undefined && x.oid === y.oid && norm(x.value) === norm(y.value);
  });
}

/** Endereço do `iPAddress` do SAN: 4 bytes (IPv4) ou 16 (IPv6, forma curta da RFC 5952, seção 4). Outro tamanho é ignorado. */
function formatIp(b: Uint8Array): string | undefined {
  if (b.length === 4) return [...b].join('.');
  if (b.length !== 16) return undefined;
  const groups: number[] = [];
  for (let i = 0; i < 16; i += 2) groups.push(((b[i] ?? 0) << 8) | (b[i + 1] ?? 0));
  // A maior sequência de grupos zero com dois ou mais vira `::`; no empate, a primeira.
  let best = -1;
  let bestLen = 1;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > bestLen) {
      best = i;
      bestLen = j - i;
    }
    i = j;
  }
  const hex = (g: number[]): string => g.map((n) => n.toString(16)).join(':');
  if (best < 0) return hex(groups);
  return `${hex(groups.slice(0, best))}::${hex(groups.slice(best + bestLen))}`;
}
