/**
 * Leitura de PKCS#12 (PFX) atrás de uma interface (ADR 0003, decisão 5). A implementação padrão usa o node-forge
 * (licença dupla `BSD-3-Clause OR GPL-2.0`; o sinete usa a opção BSD-3, ver NOTICE), que lê os perfis que aparecem em
 * A1 ICP-Brasil nas três runtimes e no browser: PBES2 com AES, 3DES e o legado RC2-40 + 3DES do Windows. RC2-128 não
 * é lido. A interface existe para trocar o leitor depois (um leitor próprio da RFC 7292, por exemplo) sem mexer em
 * quem usa.
 *
 * O forge fica restrito a este arquivo: nenhum tipo dele aparece na API pública.
 */

import forge from 'node-forge';
import { ErroCertificado } from './errors.ts';

/** Conteúdo de um PFX já decifrado: chaves em PKCS#8 DER e certificados em DER, na ordem do arquivo. */
export interface ConteudoPkcs12 {
  readonly chavesPrivadas: readonly Uint8Array[];
  readonly certificados: readonly Uint8Array[];
}

/**
 * Quem abre o PFX. Deve lançar `ErroCertificado` com `pfx_invalido`, `pfx_senha_incorreta` ou `pfx_nao_suportado`.
 * Nunca guarda a senha nem os bytes depois de devolver.
 */
export interface LeitorPkcs12 {
  readonly nome: string;
  ler(pfx: Uint8Array, senha: string): ConteudoPkcs12 | Promise<ConteudoPkcs12>;
}

const toBinary = (bytes: Uint8Array): string => {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return s;
};

const fromBinary = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

function classify(e: unknown): ErroCertificado {
  const msg = e instanceof Error ? e.message : String(e);
  if (/MAC could not be verified|wrong password|Failed to decrypt/i.test(msg)) {
    return new ErroCertificado('pfx_senha_incorreta', 'senha do PFX incorreta', { cause: e });
  }
  if (/Unsupported/i.test(msg)) {
    return new ErroCertificado('pfx_nao_suportado', `algoritmo do PFX não suportado pelo leitor: ${msg}`, { cause: e });
  }
  return new ErroCertificado('pfx_invalido', `PFX ilegível: ${msg}`, { cause: e });
}

function readOnce(pfx: Uint8Array, password: string): ConteudoPkcs12 {
  const { asn1, pki, pkcs12 } = forge;
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    // `parseAllBytes: false`: há PFX guardados em base64 com lixo no fim (visto no S2) que o OpenSSL aceita.
    const obj = asn1.fromDer(toBinary(pfx), { parseAllBytes: false } as unknown as boolean);
    p12 = pkcs12.pkcs12FromAsn1(obj, false, password);
  } catch (e) {
    throw classify(e);
  }
  const privateKeys: Uint8Array[] = [];
  const certificates: Uint8Array[] = [];
  for (const safe of p12.safeContents) {
    for (const bag of safe.safeBags) {
      const raw = (bag as { asn1?: forge.asn1.Asn1 }).asn1;
      if (bag.type === pki.oids.keyBag || bag.type === pki.oids.pkcs8ShroudedKeyBag) {
        const info = bag.key ? pki.wrapRsaPrivateKey(pki.privateKeyToAsn1(bag.key)) : raw;
        if (info) privateKeys.push(fromBinary(asn1.toDer(info).getBytes()));
      } else if (bag.type === pki.oids.certBag) {
        const c = bag.cert ? pki.certificateToAsn1(bag.cert) : raw;
        if (c) certificates.push(fromBinary(asn1.toDer(c).getBytes()));
      }
    }
  }
  return { chavesPrivadas: privateKeys, certificados: certificates };
}

/**
 * Variante da senha para PFX gerados por ferramentas antigas (OpenSSL 1.0 e afins), que convertiam cada byte UTF-8
 * da senha num caractere BMP em vez de converter o caractere (ADR 0003, pendência). `ç` vira `Ã§`.
 */
export function senhaNoFormatoLegado(senha: string): string | undefined {
  if (![...senha].some((ch) => ch.charCodeAt(0) > 0x7f)) return undefined;
  return toBinary(new TextEncoder().encode(senha));
}

/** Leitor padrão, com o node-forge. Tenta a senha como veio e, se tiver acento, a variante legada. */
export const leitorPkcs12Forge: LeitorPkcs12 = {
  nome: 'node-forge',
  ler(pfx: Uint8Array, password: string): ConteudoPkcs12 {
    try {
      return readOnce(pfx, password);
    } catch (e) {
      const alt = senhaNoFormatoLegado(password);
      if (!(e instanceof ErroCertificado) || e.code !== 'pfx_senha_incorreta' || alt === undefined) throw e;
      return readOnce(pfx, alt);
    }
  },
};
