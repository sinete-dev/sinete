/**
 * PFX (PKCS#12) de um certificado sintético, para testar quem recebe o certificado como arquivo e senha (o caminho
 * curto dos pacotes de documento, a CLI, um app que lê o PFX do cofre). A chave e o certificado vêm do
 * `syntheticCertificate`; a AC entra como intermediária quando houver. Nada é gravado em disco.
 *
 * Montado com o node-forge (licença dupla `BSD-3-Clause OR GPL-2.0`, usado sob a BSD-3, o mesmo leitor do
 * `@sinete/cert`), em PBE com 3DES, o perfil mais comum dos A1 exportados. O forge fica restrito a este arquivo.
 */

import forge from 'node-forge';
import type { SyntheticCertificate } from './synthetic.ts';

const fromBinary = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

export interface SyntheticPfxOptions {
  /** Certificados que vão junto, depois do titular (a AC sintética, por exemplo). */
  readonly chain?: readonly SyntheticCertificate[];
}

/** PFX com a chave e o certificado de `cert`, cifrado com `senha`. */
export function syntheticPfx(cert: SyntheticCertificate, senha: string, options: SyntheticPfxOptions = {}): Uint8Array {
  const key = forge.pki.privateKeyFromPem(cert.keyPem);
  const certs = [cert, ...(options.chain ?? [])].map((c) => forge.pki.certificateFromPem(c.pem));
  const asn1 = forge.pkcs12.toPkcs12Asn1(key, certs, senha, { algorithm: '3des' });
  return fromBinary(forge.asn1.toDer(asn1).getBytes());
}
