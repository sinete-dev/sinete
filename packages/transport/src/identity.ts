import type { A1KeyStore, CertificateInfo } from '@sinete/cert';
import type { TlsIdentity } from './types.ts';

/**
 * Identidade `pem` a partir de um A1 aberto pelo `@sinete/cert`. Por padrão manda o titular e as intermediárias que
 * vieram no PFX; passe `chain` (o resultado de `buildChain`) para mandar a cadeia completada.
 */
export function pemIdentity(
  keyStore: A1KeyStore,
  options: { readonly chain?: readonly CertificateInfo[] } = {},
): Extract<TlsIdentity, { kind: 'pem' }> {
  const { certChain, key } = keyStore.tlsPem(options.chain === undefined ? undefined : { chain: options.chain });
  return { kind: 'pem', certChain, key };
}
