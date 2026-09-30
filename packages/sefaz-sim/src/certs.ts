/**
 * Regras de certificado e assinatura do MOC 7.0 Anexo I (itens 4.1.1, 4.1.4 e 4.1.5), sobre o `@sinete/cert` (leitura
 * do X.509 e da identidade ICP-Brasil) e o verificador do `@sinete/core/xml`.
 *
 * Fora do escopo do simulador: cadeia de certificação, LCR e raiz ICP-Brasil (A03 a A06, E04 a E07). Os certificados
 * de teste são sintéticos, então essas regras só fariam sentido com uma AC configurável; ficam como pendência.
 */

import type { CertificateInfo } from '@sinete/cert';
import { icpIdentity, parseCertificate } from '@sinete/cert';
import type { DocumentoXml, ElementoXml } from '@sinete/core/xml';
import {
  atributoDe,
  conferirAssinatura,
  decodificarBase64,
  descendentes,
  primeiroFilho,
  textoDe,
  XMLDSIG_NS,
} from '@sinete/core/xml';
import type { Documento } from './state.ts';

/** Identidade lida de um certificado: CNPJ ou CPF do `otherName` ICP-Brasil, quando houver. */
export interface CertIdentity extends Documento {
  readonly info: CertificateInfo;
}

function readCert(der: Uint8Array): CertificateInfo | undefined {
  try {
    return parseCertificate(der);
  } catch {
    return undefined;
  }
}

function identityOf(info: CertificateInfo): Documento {
  const id = icpIdentity(info);
  // A07 e E03 pedem a extensão otherName; o CN no padrão NOME:DOCUMENTO não conta.
  if (id.source !== 'san') return {};
  if (id.cnpj !== undefined) return { CNPJ: id.cnpj };
  return id.cpf === undefined ? {} : { CPF: id.cpf };
}

export type CertCheck =
  | { readonly ok: true; readonly identity: CertIdentity }
  | { readonly ok: false; readonly cStat: string };

/**
 * Grupo A (certificado de transmissão, no TLS): A01 (280) ilegível, de AC ou sem `clientAuth`; A02 (281) fora da
 * validade; A07 (282) sem CNPJ nem CPF no `otherName`.
 */
export function checkTransmissor(der: Uint8Array, now: number): CertCheck {
  const info = readCert(der);
  if (info === undefined || info.version !== 3 || info.isCA || !info.extKeyUsage.includes('clientAuth')) {
    return { ok: false, cStat: '280' };
  }
  if (now < info.notBefore || now > info.notAfter) return { ok: false, cStat: '281' };
  const doc = identityOf(info);
  if (doc.CNPJ === undefined && doc.CPF === undefined) return { ok: false, cStat: '282' };
  return { ok: true, identity: { ...doc, info } };
}

function signatureFor(doc: DocumentoXml, id: string): ElementoXml | undefined {
  for (const e of descendentes(doc.raiz)) {
    if (e.local !== 'Signature' || e.ns !== XMLDSIG_NS) continue;
    const si = primeiroFilho(e, 'SignedInfo', XMLDSIG_NS);
    const ref = si && primeiroFilho(si, 'Reference', XMLDSIG_NS);
    if (ref && atributoDe(ref, 'URI') === `#${id}`) return e;
  }
  return undefined;
}

function certificateOf(sig: ElementoXml): Uint8Array | undefined {
  const keyInfo = primeiroFilho(sig, 'KeyInfo', XMLDSIG_NS);
  const data = keyInfo && primeiroFilho(keyInfo, 'X509Data', XMLDSIG_NS);
  const cert = data && primeiroFilho(data, 'X509Certificate', XMLDSIG_NS);
  if (!cert) return undefined;
  try {
    return decodificarBase64(textoDe(cert));
  } catch {
    return undefined;
  }
}

export interface SignatureCheckInput {
  readonly doc: DocumentoXml;
  /** `Id` do elemento assinado (`NFe<chave>`, `ID110111<chave>01`, `ID<cUF><ano>...`). */
  readonly id: string;
  /** Nome local do elemento assinado (`infNFe`, `infEvento`, `infInut`). */
  readonly element: string;
  readonly now: number;
  /** Documento que precisa ter a mesma raiz de CNPJ (ou o mesmo CPF) do certificado: regra F03 (213) ou F03A (227). */
  readonly titular: Documento;
}

export type SignatureCheck =
  | {
      readonly ok: true;
      readonly identity: CertIdentity;
      readonly digestValue: string;
      /** Certificado da assinatura (DER): confere também a assinatura do QR Code da NFC-e off-line. */
      readonly certificateDer: Uint8Array;
    }
  | { readonly ok: false; readonly cStat: string };

/**
 * Grupos E e F: E01 (290) certificado ausente, ilegível, de AC ou sem assinatura digital e não recusa no KeyUsage;
 * E02 (291) validade; E03 (292) sem CNPJ/CPF; F01 (298) assinatura fora do padrão (referência, transforms,
 * algoritmos); F02 (297) valor da assinatura não confere; F03 (213) e F03A (227) raiz do CNPJ ou CPF do titular
 * diferente da do certificado.
 */
export async function checkAssinatura(input: SignatureCheckInput): Promise<SignatureCheck> {
  const sig = signatureFor(input.doc, input.id);
  if (!sig) return { ok: false, cStat: '298' };
  const der = certificateOf(sig);
  const info = der === undefined ? undefined : readCert(der);
  if (
    info === undefined ||
    info.version !== 3 ||
    info.isCA ||
    !info.keyUsage.includes('digitalSignature') ||
    !info.keyUsage.includes('nonRepudiation')
  ) {
    return { ok: false, cStat: '290' };
  }
  if (input.now < info.notBefore || input.now > info.notAfter) return { ok: false, cStat: '291' };
  const doc = identityOf(info);
  if (doc.CNPJ === undefined && doc.CPF === undefined) return { ok: false, cStat: '292' };
  const r = await conferirAssinatura(input.doc, { id: input.id, elemento: input.element });
  if (!r.ok) {
    return { ok: false, cStat: r.motivo === 'digest-diverge' || r.motivo === 'assinatura-invalida' ? '297' : '298' };
  }
  const titular = input.titular;
  if (doc.CNPJ !== undefined && titular.CNPJ !== undefined && doc.CNPJ.slice(0, 8) !== titular.CNPJ.slice(0, 8)) {
    return { ok: false, cStat: '213' };
  }
  if (doc.CNPJ !== undefined && titular.CPF !== undefined) return { ok: false, cStat: '213' };
  if (doc.CPF !== undefined && doc.CPF !== titular.CPF) return { ok: false, cStat: '227' };
  const dv = primeiroFilho(primeiroFilho(sig, 'SignedInfo', XMLDSIG_NS) as ElementoXml, 'Reference', XMLDSIG_NS);
  const digest = dv && primeiroFilho(dv, 'DigestValue', XMLDSIG_NS);
  return {
    ok: true,
    identity: { ...doc, info },
    digestValue: digest ? textoDe(digest).trim() : '',
    certificateDer: der as Uint8Array,
  };
}
