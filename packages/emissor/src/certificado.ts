/**
 * O certificado do emissor: como arquivo e senha (`CertificadoA1`), ou já aberto pelo integrador (`CertificadoAberto`).
 *
 * Quem emite por muitos emitentes costuma abrir o PFX uma vez, completar a cadeia para o mTLS e reaproveitar o signer
 * em outras operações. O emissor aceita esse certificado aberto no lugar do PFX, para não abrir o arquivo de novo;
 * `abrirCertificado` faz a abertura do jeito que o emissor faria, com a cadeia completada se pedida.
 */

import type { IcpIdentity } from '@sinete/cert';
import { buildChain, icpBrasilCertificates, openPfx, parseCertificate } from '@sinete/cert';
import type { Clock, Signer } from '@sinete/core';
import { systemClock } from '@sinete/core';
import type { TlsIdentity } from '@sinete/transport';
import { pemIdentity } from '@sinete/transport';

/** Certificado A1 como arquivo e senha. */
export interface CertificadoA1 {
  readonly pfx: Uint8Array;
  readonly senha: string;
}

/** Certificado já aberto: o signer dos documentos, o titular e a identidade do mTLS. */
export interface CertificadoAberto {
  readonly signer: Signer;
  /** Titular do certificado (CNPJ ou CPF, nome): é o autor dos eventos. */
  readonly titular: IcpIdentity;
  /** Identidade do mTLS. `pemIdentity(keyStore, { chain })` leva a cadeia completada. */
  readonly identidade: TlsIdentity;
}

export interface OpcoesAbrirCertificado {
  /** Relógio da validade do certificado e da cadeia. Padrão: o do sistema. */
  readonly clock?: Clock;
  /**
   * Completa a cadeia do mTLS com as ACs da ICP-Brasil que o pacote conhece (as intermediárias do `@sinete/cert`, além
   * das que vieram no PFX), para o PFX que só traz o titular. Padrão: `false`, a cadeia que veio no PFX.
   */
  readonly completarCadeia?: boolean;
}

/** Abre o PFX (fora da validade, `CertError`) e devolve o certificado aberto. Os bytes não ficam guardados. */
export async function abrirCertificado(
  cert: CertificadoA1,
  opcoes: OpcoesAbrirCertificado = {},
): Promise<CertificadoAberto> {
  const clock = opcoes.clock ?? systemClock;
  const ks = await openPfx(cert.pfx, { password: cert.senha, clock });
  const cadeia = opcoes.completarCadeia
    ? (
        await buildChain(ks.certificate, {
          intermediates: [
            ...ks.extraCertificates,
            ...icpBrasilCertificates()
              .filter((c) => c.kind !== 'root')
              .map((c) => parseCertificate(c.der)),
          ],
          clock,
        })
      ).chain
    : undefined;
  return {
    signer: await ks.signer(),
    titular: ks.identity,
    identidade: pemIdentity(ks, cadeia === undefined ? {} : { chain: cadeia }),
  };
}
