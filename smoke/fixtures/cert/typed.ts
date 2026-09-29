// Tipos do pacote publicado, vistos por um consumidor com tsc nodenext (e por deno check).
import type { DataSigner } from '@sinete/core';
import { fixedClock } from '@sinete/core';
import type { A1KeyStore, CertErrorCode, ChainStatus, IcpIdentity, KeyStore, Pkcs12Reader } from '@sinete/cert';
import { buildChain, openPfx } from '@sinete/cert';

export async function usar(bytes: Uint8Array): Promise<string> {
  const ks: A1KeyStore = await openPfx(bytes, { password: 'x', clock: fixedClock('2026-09-25T12:00:00Z') });
  const generic: KeyStore = ks;
  const signer: DataSigner = await ks.signer();
  const id: IcpIdentity = generic.identity;
  const status: ChainStatus = (await buildChain(ks.certificate)).status;
  const reader: Pkcs12Reader = { name: 'meu', read: () => ({ privateKeys: [], certificates: [] }) };
  const code: CertErrorCode = 'pfx_senha_incorreta';
  // @ts-expect-error hash fora do contrato
  await signer.sign(new Uint8Array(), 'MD5');
  return `${id.tipo} ${status} ${reader.name} ${code}`;
}
