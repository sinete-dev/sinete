/**
 * Assinatura XMLDSig enveloped em três fases, sem reserializar o documento (ADR 0003, invariante "assinar a string
 * final e nunca mais tocar nela"):
 *
 * 1. `prepararAssinatura`: acha o elemento pelo `Id`, calcula o digest do C14N dele e insere por splice o `<Signature>`
 *    como último filho do pai do elemento, com um placeholder no `SignatureValue`. O `SignedInfo` é canonicalizado
 *    já no contexto final, herdando os namespaces reais dos ancestrais.
 * 2. `assinarPreparada`: o `Assinador` do `@sinete/core` assina os bytes do `SignedInfo` (modo `dados`) ou só o DigestInfo
 *    SHA-1 de 35 bytes (modo `digest`, para PKCS#11, HSM e A3 em nuvem).
 * 3. `montarAssinatura`: troca o placeholder pelo `SignatureValue`. É a única edição depois do digest.
 *
 * A saída é a entrada com exatamente uma inserção; é ela que vai para a SEFAZ e para o banco.
 */

import type { Assinador } from '../signer.ts';
import { c14n } from './c14n.ts';
import { ALGORITMOS_XMLDSIG, XMLDSIG_NS } from './dsig.ts';
import { codificarBase64 } from './encoding.ts';
import { ErroAssinaturaXml } from './errors.ts';
import type { ElementoXml } from './parser.ts';
import { lerXml, primeiroFilho } from './parser.ts';

/** Prefixo DER do DigestInfo SHA-1 (RFC 8017, 9.2, nota 1). */
export const PREFIXO_DIGEST_INFO_SHA1: Uint8Array = Uint8Array.from([
  0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14,
]);

const PLACEHOLDER = '@@SINETE_SIGNATURE_VALUE@@';
const te = new TextEncoder();

export interface AssinaturaPreparada {
  /** Documento com o `<Signature>` inserido e o `SignatureValue` ainda com placeholder. */
  readonly modelo: string;
  readonly marcador: string;
  /** Offset onde o `<Signature>` foi inserido: logo antes da tag de fechamento do pai do elemento referenciado. */
  readonly inseridaEm: number;
  /** O `SignedInfo` canonicalizado: exatamente os bytes que o signer assina no modo `dados`. */
  readonly signedInfo: Uint8Array<ArrayBuffer>;
  /** DigestValue (base64) do elemento referenciado. */
  readonly digestValue: string;
  /** O elemento referenciado canonicalizado, de onde saiu o `DigestValue`; vai no `ContextoDaAssinatura` do assinador `dados`. */
  readonly referenciado?: Uint8Array<ArrayBuffer>;
  readonly id: string;
}

export interface PrepararAssinaturaOpcoes {
  /** `Id` do elemento a assinar (`infNFe`, `infEvento`, `infMDFe`, `infInut`). */
  readonly id: string;
  /** Certificado do titular em DER, que vai para `KeyInfo/X509Data/X509Certificate`. */
  readonly certificadoDer: Uint8Array;
}

/** Fase 1: calcula o digest e insere o `<Signature>` com placeholder, sem tocar no resto do texto. */
export async function prepararAssinatura(xml: string, opcoes: PrepararAssinaturaOpcoes): Promise<AssinaturaPreparada> {
  if (xml.includes(PLACEHOLDER)) {
    throw new ErroAssinaturaXml('marcador-no-documento', 'o documento já contém o placeholder de assinatura');
  }
  const doc = lerXml(xml);
  const targets = doc.ids.get(opcoes.id) ?? [];
  if (targets.length === 0) throw new ErroAssinaturaXml('id-ausente', `nenhum elemento com Id=${opcoes.id}`);
  if (targets.length > 1) {
    throw new ErroAssinaturaXml('id-duplicado', `${targets.length} elementos com Id=${opcoes.id}`);
  }
  const target = targets[0] as ElementoXml;
  if (target.pai === null) {
    throw new ErroAssinaturaXml(
      'referencia-na-raiz',
      'o elemento assinado não pode ser a raiz: a Signature fica como irmã dele',
    );
  }
  const referenced = te.encode(c14n(target));
  const digest = await globalThis.crypto.subtle.digest('SHA-1', referenced);
  const digestValue = codificarBase64(new Uint8Array(digest));
  const A = ALGORITMOS_XMLDSIG;
  const signedInfo =
    `<SignedInfo><CanonicalizationMethod Algorithm="${A.c14n}"/><SignatureMethod Algorithm="${A.rsaSha1}"/>` +
    `<Reference URI="#${opcoes.id}"><Transforms><Transform Algorithm="${A.envelopedSignature}"/>` +
    `<Transform Algorithm="${A.c14n}"/></Transforms><DigestMethod Algorithm="${A.sha1}"/>` +
    `<DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
  const signature =
    `<Signature xmlns="${XMLDSIG_NS}">${signedInfo}<SignatureValue>${PLACEHOLDER}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${codificarBase64(opcoes.certificadoDer)}</X509Certificate></X509Data>` +
    '</KeyInfo></Signature>';
  // Último filho do pai, não logo depois do elemento: NFC-e (`infNFeSupl`), MDF-e (`infMDFeSupl`) e CT-e têm um
  // irmão entre o elemento assinado e a Signature no schema. Em NFe, evento, MDFe e inutNFe a Signature é o último
  // filho. `contentEnd` é o `<` da tag de fechamento do pai (que existe, porque o pai tem o alvo como filho).
  const insertedAt = target.pai.fimDoConteudo;
  const template = xml.slice(0, insertedAt) + signature + xml.slice(insertedAt);

  // O SignedInfo é canonicalizado no documento final, com os ancestrais reais.
  const tdoc = lerXml(template);
  let sigEl: ElementoXml | undefined;
  const stack: ElementoXml[] = [tdoc.raiz];
  while (stack.length > 0 && !sigEl) {
    const e = stack.pop() as ElementoXml;
    if (e.inicio === insertedAt && e.local === 'Signature') sigEl = e;
    else if (e.inicio < insertedAt && e.fim > insertedAt) {
      for (const c of e.filhos) if (c.tipo === 'elemento') stack.push(c);
    }
  }
  const si = sigEl && primeiroFilho(sigEl, 'SignedInfo', XMLDSIG_NS);
  if (!si) throw new ErroAssinaturaXml('marcador-ausente', 'Signature inserida não foi encontrada no template');
  return {
    modelo: template,
    marcador: PLACEHOLDER,
    inseridaEm: insertedAt,
    signedInfo: te.encode(c14n(si)),
    digestValue,
    referenciado: referenced,
    id: opcoes.id,
  };
}

/** Monta o DigestInfo DER (prefixo SHA-1 + hash) do `SignedInfo`, entrada do modo `digest`. */
export async function digestInfoDoSignedInfo(preparada: AssinaturaPreparada): Promise<Uint8Array> {
  const h = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-1', preparada.signedInfo));
  const di = new Uint8Array(PREFIXO_DIGEST_INFO_SHA1.length + h.length);
  di.set(PREFIXO_DIGEST_INFO_SHA1);
  di.set(h, PREFIXO_DIGEST_INFO_SHA1.length);
  return di;
}

/** Fase 2: pede a assinatura RSA PKCS#1 v1.5 com SHA-1 ao assinador, no modo dele. */
export async function assinarPreparada(preparada: AssinaturaPreparada, assinador: Assinador): Promise<Uint8Array> {
  const value =
    assinador.tipo === 'dados'
      ? await assinador.assinar(
          preparada.signedInfo,
          'SHA-1',
          preparada.referenciado === undefined ? undefined : { id: preparada.id, referenciado: preparada.referenciado },
        )
      : await assinador.assinarDigestInfo(await digestInfoDoSignedInfo(preparada));
  if (value.length === 0) throw new ErroAssinaturaXml('assinatura-vazia', 'o assinador devolveu assinatura vazia');
  return value;
}

/** Fase 3: troca o marcador pelo `SignatureValue`. Nada mais no texto muda. */
export function montarAssinatura(preparada: AssinaturaPreparada, valorDaAssinatura: Uint8Array): string {
  if (valorDaAssinatura.length === 0) throw new ErroAssinaturaXml('assinatura-vazia', 'SignatureValue vazio');
  const i = preparada.modelo.indexOf(preparada.marcador);
  if (i === -1 || preparada.modelo.indexOf(preparada.marcador, i + 1) !== -1) {
    throw new ErroAssinaturaXml('marcador-ausente', 'o modelo precisa ter exatamente um marcador');
  }
  return (
    preparada.modelo.slice(0, i) +
    codificarBase64(valorDaAssinatura) +
    preparada.modelo.slice(i + preparada.marcador.length)
  );
}

/** As três fases de uma vez: prepara com o certificado do assinador, assina e monta. */
export async function assinarXml(xml: string, opcoes: { readonly id: string }, assinador: Assinador): Promise<string> {
  const preparada = await prepararAssinatura(xml, { id: opcoes.id, certificadoDer: await assinador.certificadoDer() });
  return montarAssinatura(preparada, await assinarPreparada(preparada, assinador));
}
