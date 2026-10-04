/**
 * `Certificado`: onde está a chave do titular e como usá-la, sem que o resto do sinete saiba se é A1 em memória, A3 em
 * token ou chave remota. Esta versão traz o A1 (`abrirPfx`); A3 e chave remota entram pelo helper do ADR 0005.
 */

import type { Assinador, AssinadorDeDados, Relogio } from '@sinete/core';
import type { Tlv } from './der.ts';
import { children, integerHex, readTlv, TAG } from './der.ts';
import { ErroCertificado } from './errors.ts';
import type { IdentidadeIcp } from './icp.ts';
import { identidadeIcp } from './icp.ts';
import { pemDoDer } from './pem.ts';
import type { LeitorPkcs12 } from './pkcs12.ts';
import { leitorPkcs12Forge } from './pkcs12.ts';
import { criarAssinadorA1 } from './signer.ts';
import type { CertificadoX509 } from './x509.ts';
import { lerCertificado, pemDoCertificado } from './x509.ts';

export type Validade = 'valido' | 'expirado' | 'ainda_nao_valido';

export interface Certificado {
  /** `a1` para chave em memória. Outros valores ficam para A3 e chave remota. */
  readonly tipo: string;
  /** Certificado do titular. */
  readonly certificado: CertificadoX509;
  /** Os outros certificados que vieram com a chave (intermediárias do PFX), sem o do titular. */
  readonly certificadosExtras: readonly CertificadoX509[];
  /** CNPJ, CPF e responsável, lidos do certificado. */
  readonly identidade: IdentidadeIcp;
  /** Validade no instante em que o Certificado foi aberto. */
  readonly validade: Validade;
  /** Quem assina com esta chave (contrato `Assinador` do `@sinete/core`). */
  assinador(): Promise<Assinador>;
}

/** Material para TLS em processo: cadeia do cliente e chave, em PEM, só em memória. */
export interface MaterialTlsPem {
  readonly cadeia: string;
  readonly chave: string;
}

export interface CertificadoA1 extends Certificado {
  readonly tipo: 'a1';
  assinador(): Promise<AssinadorDeDados>;
  /**
   * PEM para o transporte em processo (ADR 0003: nunca passar o PFX ao TLS, porque o OpenSSL 3 recusa o legado).
   * A cadeia sai com o titular primeiro e as intermediárias do PFX depois (sem raízes); passe `cadeia` (por exemplo o
   * resultado de `montarCadeia`) para mandar a cadeia completada. A chave sai em PKCS#8: não grave, não logue.
   */
  tlsPem(opcoes?: { readonly cadeia?: readonly CertificadoX509[] }): MaterialTlsPem;
}

export interface AbrirPfxOpcoes {
  readonly senha: string;
  /** Relógio para a trava de validade (princípio 6). */
  readonly relogio: Relogio;
  /**
   * Abre mesmo fora da validade (vencido ou ainda não válido). Serve para diagnóstico e reprocessamento; a SEFAZ
   * recusa assinatura e TLS com certificado vencido.
   */
  readonly aceitarVencido?: boolean;
  /** Leitor do PKCS#12. Padrão: node-forge. */
  readonly leitor?: LeitorPkcs12;
}

function rsaModulusOfPkcs8(der: Uint8Array): string | undefined {
  try {
    const info = readTlv(der, 0);
    const parts = children(der, info);
    const octet = parts[2] as Tlv | undefined;
    if (!octet || octet.tag !== TAG.OCTET_STRING) return undefined;
    const rsa = readTlv(der, octet.start, octet.end);
    const n = children(der, rsa)[1];
    return n ? integerHex(der, n) : undefined;
  } catch {
    return undefined;
  }
}

/** Validade de um certificado num instante. */
export function validadeEm(cert: CertificadoX509, relogio: Relogio): Validade {
  const now = relogio.agora().getTime();
  if (now < cert.notBefore) return 'ainda_nao_valido';
  if (now > cert.notAfter) return 'expirado';
  return 'valido';
}

/**
 * Abre um PFX A1 em memória e devolve o `Certificado`.
 *
 * Escolhe como titular o certificado de fim de cadeia que casa com uma chave do PFX e tem a validade mais longa
 * (PFX renovados às vezes trazem a folha antiga junto). Recusa certificado fora da validade, salvo `aceitarVencido`.
 */
export async function abrirPfx(pfx: Uint8Array, opcoes: AbrirPfxOpcoes): Promise<CertificadoA1> {
  const reader = opcoes.leitor ?? leitorPkcs12Forge;
  const contents = await reader.ler(pfx, opcoes.senha);
  if (contents.chavesPrivadas.length === 0) throw new ErroCertificado('pfx_sem_chave', 'o PFX não tem chave privada');
  const certs = contents.certificados.map((c) => lerCertificado(c));
  const keys = contents.chavesPrivadas.map((k) => ({ der: k, modulus: rsaModulusOfPkcs8(k) }));

  let best: { cert: CertificadoX509; key: Uint8Array } | undefined;
  for (const cert of certs) {
    if (cert.isCA || cert.chavePublica.algoritmo !== 'RSA') continue;
    const modulus = cert.chavePublica.moduloHex;
    const key = keys.find((k) => k.modulus === modulus);
    if (!key) continue;
    const better =
      !best ||
      cert.notAfter > best.cert.notAfter ||
      (cert.notAfter === best.cert.notAfter && cert.notBefore > best.cert.notBefore);
    if (better) best = { cert, key: key.der };
  }
  if (!best) {
    const rsaKeys = keys.filter((k) => k.modulus !== undefined).length;
    throw new ErroCertificado(
      rsaKeys === 0 ? 'algoritmo_nao_suportado' : 'pfx_sem_certificado_da_chave',
      rsaKeys === 0
        ? 'a chave do PFX não é RSA (só RSA PKCS#1 v1.5 é suportado)'
        : 'nenhum certificado do PFX corresponde à chave privada',
      { detalhes: { certificados: certs.map((c) => c.subject.texto) } },
    );
  }
  const leaf = best.cert;
  // Cópia própria: um leitor injetado pode devolver um buffer do chamador, que o zera depois de abrir; o assinador e o
  // `tlsPem()` leem esta chave mais tarde.
  const pkcs8 = new Uint8Array(best.key);
  const validity = validadeEm(leaf, opcoes.relogio);
  if (validity !== 'valido' && opcoes.aceitarVencido !== true) {
    const details = { subject: leaf.subject.texto, notBefore: leaf.notBeforeIso, notAfter: leaf.notAfterIso };
    throw validity === 'expirado'
      ? new ErroCertificado('certificado_expirado', `certificado vencido em ${leaf.notAfterIso}`, { detalhes: details })
      : new ErroCertificado('certificado_ainda_nao_valido', `certificado só vale a partir de ${leaf.notBeforeIso}`, {
          detalhes: details,
        });
  }
  // Outras folhas da mesma chave (renovações antigas) não entram como intermediárias.
  const leafModulus = leaf.chavePublica.algoritmo === 'RSA' ? leaf.chavePublica.moduloHex : '';
  const extra = certs.filter(
    (c) => !sameDer(c, leaf) && !(c.chavePublica.algoritmo === 'RSA' && c.chavePublica.moduloHex === leafModulus),
  );
  const identity = identidadeIcp(leaf);
  let signer: Promise<AssinadorDeDados> | undefined;

  return {
    tipo: 'a1',
    certificado: leaf,
    certificadosExtras: extra,
    identidade: identity,
    validade: validity,
    assinador(): Promise<AssinadorDeDados> {
      signer ??= criarAssinadorA1(pkcs8, leaf.der);
      return signer;
    },
    tlsPem(opcoes?: { readonly cadeia?: readonly CertificadoX509[] }): MaterialTlsPem {
      const chain = (opcoes?.cadeia ?? [leaf, ...extra]).filter((c) => !looksLikeRoot(c) || sameDer(c, leaf));
      const withLeaf = sameDer(chain[0], leaf) ? chain : [leaf, ...chain.filter((c) => !sameDer(c, leaf))];
      return {
        cadeia: withLeaf.map((c) => pemDoCertificado(c)).join(''),
        chave: pemDoDer(pkcs8, ['PRIVATE', 'KEY'].join(' ')),
      };
    },
  };
}

/**
 * Raiz (autoassinada) não vai no TLS. Nome de emissor igual ao do titular não basta: na troca de chave de uma AC, o
 * certificado "chave velha assina a nova" tem o mesmo nome dos dois lados e precisa seguir na cadeia. Só é raiz o
 * auto-emitido sem AKI ou com AKI igual ao próprio SKI.
 */
function looksLikeRoot(c: CertificadoX509): boolean {
  return c.selfIssued && (c.authorityKeyId === undefined || c.authorityKeyId === c.subjectKeyId);
}

function sameDer(a: CertificadoX509 | undefined, b: CertificadoX509): boolean {
  if (!a || a.der.length !== b.der.length) return false;
  for (let i = 0; i < a.der.length; i++) if (a.der[i] !== b.der[i]) return false;
  return true;
}
