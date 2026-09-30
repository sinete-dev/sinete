/**
 * O certificado do emissor: como arquivo e senha (`CertificadoA1`), ou já aberto pelo integrador (`CertificadoAberto`).
 *
 * Quem emite por muitos emitentes costuma abrir o PFX uma vez, completar a cadeia para o mTLS e reaproveitar o signer
 * em outras operações. O emissor aceita esse certificado aberto no lugar do PFX, para não abrir o arquivo de novo;
 * `abrirCertificado` faz a abertura do jeito que o emissor faria, com a cadeia completada se pedida.
 */

import type { IdentidadeIcp } from '@sinete/cert';
import { abrirPfx, certificadosIcpBrasil, lerCertificado, montarCadeia } from '@sinete/cert';
import type { Assinador, Relogio } from '@sinete/core';
import { relogioDoSistema } from '@sinete/core';
import type { IdentidadeTls } from '@sinete/transport';
import { identidadePem } from '@sinete/transport';

/** Certificado A1 como arquivo e senha. */
export interface CertificadoA1 {
  readonly pfx: Uint8Array;
  readonly senha: string;
}

/** Certificado já aberto: o signer dos documentos, o titular e a identidade do mTLS. */
export interface CertificadoAberto {
  readonly assinador: Assinador;
  /** Titular do certificado (CNPJ ou CPF, nome): é o autor dos eventos. */
  readonly titular: IdentidadeIcp;
  /** Identidade do mTLS. `identidadePem(certificado, { cadeia })` leva a cadeia completada. */
  readonly identidade: IdentidadeTls;
}

export interface AbrirCertificadoOpcoes {
  /** Relógio da validade do certificado e da cadeia. Padrão: o do sistema. */
  readonly relogio?: Relogio;
  /**
   * Completa a cadeia do mTLS com as ACs da ICP-Brasil que o pacote conhece (as intermediárias do `@sinete/cert`, além
   * das que vieram no PFX), para o PFX que só traz o titular. Padrão: `false`, a cadeia que veio no PFX.
   */
  readonly completarCadeia?: boolean;
}

/** Abre o PFX (fora da validade, `ErroCertificado`) e devolve o certificado aberto. Os bytes não ficam guardados. */
export async function abrirCertificado(
  certificado: CertificadoA1,
  opcoes: AbrirCertificadoOpcoes = {},
): Promise<CertificadoAberto> {
  const clock = opcoes.relogio ?? relogioDoSistema;
  const ks = await abrirPfx(certificado.pfx, { senha: certificado.senha, relogio: clock });
  const cadeia = opcoes.completarCadeia
    ? (
        await montarCadeia(ks.certificado, {
          intermediarias: [
            ...ks.certificadosExtras,
            ...certificadosIcpBrasil()
              .filter((c) => c.tipo !== 'raiz')
              .map((c) => lerCertificado(c.der)),
          ],
          relogio: clock,
        })
      ).cadeia
    : undefined;
  return {
    assinador: await ks.assinador(),
    titular: ks.identidade,
    identidade: identidadePem(ks, cadeia === undefined ? {} : { cadeia: cadeia }),
  };
}
