/**
 * Bundle ICP-Brasil como dado versionado (ADR 0004, decisão 2).
 *
 * `data/icp-brasil.json` é gerado por `tools/icp-bundle/build-bundle.ts` a partir do `ACcompactado.zip` do ITI, com o
 * SHA-512 do zip conferido contra o `hashsha512.txt` oficial e o SHA-256 de cada certificado. A versão é a data da
 * coleta (`2026.09.25`). Entram no conjunto TLS as raízes v5, v10, v11 e v12 e as intermediárias SSL vistas nos
 * servidores DF-e; v6 e v7 ficam de fora (ver `excluidos`).
 *
 * O transporte soma este conjunto à loja padrão da runtime por conexão, sem mexer no processo: nada de
 * `NODE_EXTRA_CA_CERTS` nem `setDefaultCACertificates`.
 */

import data from './data/icp-brasil.json' with { type: 'json' };
import { decodificarBase64, pemDoDer } from './pem.ts';

export interface CertificadoDoBundleIcp {
  readonly id: string;
  readonly tipo: 'raiz' | 'intermediaria';
  /** Entra no conjunto de confiança TLS. */
  readonly tls: boolean;
  /** Nome do arquivo dentro do `ACcompactado.zip`. */
  readonly arquivo: string;
  readonly subject: string;
  readonly subjectCN: string;
  readonly issuerCN: string;
  /** SHA-256 do DER, `AA:BB:...`. */
  readonly sha256: string;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly tipoDeChave: string;
  readonly fonte: string;
  readonly der: Uint8Array;
}

export interface DescricaoBundleIcp {
  readonly versaoDoFormato: number;
  /** Data da coleta do zip no ITI, `AAAA.MM.DD`. */
  readonly versao: string;
  readonly fonte: {
    readonly url: string;
    readonly sha512: string;
    readonly urlDoHash: string;
    readonly coletadoEm: string;
    readonly certificadosNoZip: number;
  };
  readonly excluidos: readonly { readonly arquivo: string; readonly motivo: string }[];
}

export const ICP_BRASIL_BUNDLE: DescricaoBundleIcp = {
  versaoDoFormato: data.versaoDoFormato,
  versao: data.versao,
  fonte: data.fonte,
  excluidos: data.excluidos,
};

let cache: readonly CertificadoDoBundleIcp[] | undefined;

/** Todos os certificados do bundle, com o DER já decodificado. */
export function certificadosIcpBrasil(): readonly CertificadoDoBundleIcp[] {
  cache ??= data.certificados.map(
    (c): CertificadoDoBundleIcp => ({
      id: c.id,
      tipo: c.tipo === 'raiz' ? 'raiz' : 'intermediaria',
      tls: c.tls,
      arquivo: c.arquivo,
      subject: c.subject,
      subjectCN: c.subjectCN,
      issuerCN: c.issuerCN,
      sha256: c.sha256,
      notBefore: c.notBefore,
      notAfter: c.notAfter,
      tipoDeChave: c.tipoDeChave,
      fonte: c.fonte,
      der: decodificarBase64(c.der),
    }),
  );
  return cache;
}

/** Conjunto de confiança TLS (raízes + intermediárias vistas), em PEM, para somar à loja padrão da runtime. */
export function pemTlsIcpBrasil(): string[] {
  return certificadosIcpBrasil()
    .filter((c) => c.tls)
    .map((c) => pemDoDer(c.der, 'CERTIFICATE'));
}
