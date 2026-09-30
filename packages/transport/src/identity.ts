import type { CertificadoA1, CertificadoX509 } from '@sinete/cert';
import type { IdentidadeTls } from './types.ts';

/**
 * Identidade `pem` a partir de um A1 aberto pelo `@sinete/cert`. Por padrão manda o titular e as intermediárias que
 * vieram no PFX; passe `cadeia` (o resultado de `montarCadeia`) para mandar a cadeia completada.
 */
export function identidadePem(
  certificado: CertificadoA1,
  opcoes: { readonly cadeia?: readonly CertificadoX509[] } = {},
): Extract<IdentidadeTls, { tipo: 'pem' }> {
  const { cadeia, chave } = certificado.tlsPem(opcoes.cadeia === undefined ? undefined : { cadeia: opcoes.cadeia });
  return { tipo: 'pem', cadeia, chave };
}
