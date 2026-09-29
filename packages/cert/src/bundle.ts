/**
 * Bundle ICP-Brasil como dado versionado (ADR 0004, decisão 2).
 *
 * `data/icp-brasil.json` é gerado por `tools/icp-bundle/build-bundle.ts` a partir do `ACcompactado.zip` do ITI, com o
 * SHA-512 do zip conferido contra o `hashsha512.txt` oficial e o SHA-256 de cada certificado. A versão é a data da
 * coleta (`2026.09.25`). Entram no conjunto TLS as raízes v5, v10, v11 e v12 e as intermediárias SSL vistas nos
 * servidores DF-e; v6 e v7 ficam de fora (ver `excluded`).
 *
 * O transporte soma este conjunto à loja padrão da runtime por conexão, sem mexer no processo: nada de
 * `NODE_EXTRA_CA_CERTS` nem `setDefaultCACertificates`.
 */

import data from './data/icp-brasil.json' with { type: 'json' };
import { base64ToBytes, derToPem } from './pem.ts';

export interface IcpBundleCertificate {
  readonly id: string;
  readonly kind: 'root' | 'intermediate';
  /** Entra no conjunto de confiança TLS. */
  readonly tls: boolean;
  /** Nome do arquivo dentro do `ACcompactado.zip`. */
  readonly file: string;
  readonly subject: string;
  readonly subjectCN: string;
  readonly issuerCN: string;
  /** SHA-256 do DER, `AA:BB:...`. */
  readonly sha256: string;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly keyType: string;
  readonly source: string;
  readonly der: Uint8Array;
}

export interface IcpBundleInfo {
  readonly schemaVersion: number;
  /** Data da coleta do zip no ITI, `AAAA.MM.DD`. */
  readonly version: string;
  readonly source: {
    readonly url: string;
    readonly sha512: string;
    readonly hashUrl: string;
    readonly retrievedAt: string;
    readonly zipCertificates: number;
  };
  readonly excluded: readonly { readonly file: string; readonly reason: string }[];
}

export const ICP_BRASIL_BUNDLE: IcpBundleInfo = {
  schemaVersion: data.schemaVersion,
  version: data.version,
  source: data.source,
  excluded: data.excluded,
};

let cache: readonly IcpBundleCertificate[] | undefined;

/** Todos os certificados do bundle, com o DER já decodificado. */
export function icpBrasilCertificates(): readonly IcpBundleCertificate[] {
  cache ??= data.certificates.map(
    (c): IcpBundleCertificate => ({
      id: c.id,
      kind: c.kind === 'root' ? 'root' : 'intermediate',
      tls: c.tls,
      file: c.file,
      subject: c.subject,
      subjectCN: c.subjectCN,
      issuerCN: c.issuerCN,
      sha256: c.sha256,
      notBefore: c.notBefore,
      notAfter: c.notAfter,
      keyType: c.keyType,
      source: c.source,
      der: base64ToBytes(c.der),
    }),
  );
  return cache;
}

/** Conjunto de confiança TLS (raízes + intermediárias vistas), em PEM, para somar à loja padrão da runtime. */
export function icpBrasilTlsPem(): string[] {
  return icpBrasilCertificates()
    .filter((c) => c.tls)
    .map((c) => derToPem(c.der, 'CERTIFICATE'));
}
