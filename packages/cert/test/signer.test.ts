import { describe, expect, test } from 'bun:test';
import { constants, createPrivateKey, privateEncrypt } from 'node:crypto';
import type { AssinadorDeDigest } from '@sinete/core';
import { relogioFixo } from '@sinete/core';
import {
  createA1Signer,
  digestInfoOf,
  digestSignerAsDataSigner,
  encodeDigestInfo,
  openPfx,
  signBytes,
  verifyBytes,
} from '../src/index.ts';
import { fixture, SENHA } from './helpers.ts';

const clock = relogioFixo('2026-09-25T12:00:00Z');
const data = new TextEncoder().encode('<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">…</SignedInfo>');

async function a1() {
  const ks = await openPfx(fixture('ecnpj-aes.pfx'), { password: SENHA, clock });
  const { key } = ks.tlsPem();
  return { ks, key };
}

describe('signer A1 (WebCrypto)', () => {
  test.each(['SHA-1', 'SHA-256'] as const)('%s confere com a chave pública do certificado', async (hash) => {
    const { ks } = await a1();
    const signer = await ks.signer();
    expect(signer.tipo).toBe('dados');
    const sig = await signer.assinar(data, hash);
    expect(sig).toHaveLength(256);
    expect(await verifyBytes(ks.certificate, data, sig, hash)).toBe(true);
    expect(await verifyBytes(ks.certificate.der, new TextEncoder().encode('outro'), sig, hash)).toBe(false);
  });

  test('o mesmo signer é reaproveitado', async () => {
    const { ks } = await a1();
    expect(await ks.signer()).toBe(await ks.signer());
  });

  test('hash fora do leiaute é recusado', async () => {
    const { ks } = await a1();
    const signer = await ks.signer();
    await expect(signer.assinar(data, 'MD5' as never)).rejects.toMatchObject({ code: 'algoritmo_nao_suportado' });
  });

  test('chave que não é PKCS#8 RSA', async () => {
    const { ks } = await a1();
    await expect(createA1Signer(Uint8Array.of(1, 2, 3), ks.certificate.der)).rejects.toMatchObject({
      code: 'algoritmo_nao_suportado',
    });
  });

  test('certificado que não é RSA', async () => {
    const { ks } = await a1();
    const fakeCert = { ...ks.certificate, publicKey: { algorithm: 'outro' as const, oid: '1.2.840.10045.2.1' } };
    await expect(verifyBytes(fakeCert, data, new Uint8Array(), 'SHA-1')).rejects.toMatchObject({
      code: 'algoritmo_nao_suportado',
    });
  });
});

describe('DigestInfo e adaptador de DigestSigner', () => {
  test('prefixos da RFC 8017', async () => {
    const d1 = await digestInfoOf(data, 'SHA-1');
    expect(d1).toHaveLength(35);
    const d256 = await digestInfoOf(data, 'SHA-256');
    expect(d256).toHaveLength(51);
    expect(() => encodeDigestInfo('SHA-1', new Uint8Array(32))).toThrow(
      expect.objectContaining({ code: 'algoritmo_nao_suportado' }),
    );
    expect(() => encodeDigestInfo('SHA-512' as never, new Uint8Array(64))).toThrow(
      expect.objectContaining({ code: 'algoritmo_nao_suportado' }),
    );
  });

  test.each(['SHA-1', 'SHA-256'] as const)('modo digest gera a mesma assinatura do modo data (%s)', async (hash) => {
    const { ks, key } = await a1();
    const pk = createPrivateKey(key);
    // "HSM" de teste: RSA cru com padding PKCS#1 v1.5 tipo 1 sobre o DigestInfo, como CKM_RSA_PKCS.
    const digestSigner: AssinadorDeDigest = {
      tipo: 'digest',
      certificadoDer: async () => ks.certificate.der,
      assinarDigestInfo: async (di) =>
        new Uint8Array(privateEncrypt({ key: pk, padding: constants.RSA_PKCS1_PADDING }, di)),
    };
    const viaData = await (await ks.signer()).assinar(data, hash);
    expect(await signBytes(digestSigner, data, hash)).toEqual(viaData);
    const adapted = digestSignerAsDataSigner(digestSigner);
    expect(adapted.tipo).toBe('dados');
    expect(await adapted.assinar(data, hash)).toEqual(viaData);
    expect(await adapted.certificadoDer()).toEqual(ks.certificate.der);
    expect(await signBytes(await ks.signer(), data, hash)).toEqual(viaData);
  });
});
