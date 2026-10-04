import { describe, expect, test } from 'bun:test';
import { constants, createPrivateKey, privateEncrypt } from 'node:crypto';
import type { AssinadorDeDigest } from '@sinete/core';
import { relogioFixo } from '@sinete/core';
import {
  abrirPfx,
  assinarBytes,
  codificarDigestInfo,
  comoAssinadorDeDados,
  conferirBytes,
  criarAssinadorA1,
  digestInfoDe,
} from '../src/index.ts';
import { fixture, SENHA } from './helpers.ts';

const clock = relogioFixo('2026-09-25T12:00:00Z');
const data = new TextEncoder().encode('<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">…</SignedInfo>');

async function a1() {
  const ks = await abrirPfx(fixture('ecnpj-aes.pfx'), { senha: SENHA, relogio: clock });
  const { chave: key } = ks.tlsPem();
  return { ks, key };
}

describe('signer A1 (WebCrypto)', () => {
  test.each(['SHA-1', 'SHA-256'] as const)('%s confere com a chave pública do certificado', async (hash) => {
    const { ks } = await a1();
    const signer = await ks.assinador();
    expect(signer.tipo).toBe('dados');
    const sig = await signer.assinar(data, hash);
    expect(sig).toHaveLength(256);
    expect(await conferirBytes(ks.certificado, data, sig, hash)).toBe(true);
    expect(await conferirBytes(ks.certificado.der, new TextEncoder().encode('outro'), sig, hash)).toBe(false);
  });

  test('zerar a chave do chamador depois de criar o signer não o quebra', async () => {
    const { ks, key } = await a1();
    const pkcs8 = new Uint8Array(createPrivateKey(key).export({ type: 'pkcs8', format: 'der' }));
    const signer = await criarAssinadorA1(pkcs8, ks.certificado.der);
    pkcs8.fill(0);
    const sig = await signer.assinar(data, 'SHA-256');
    expect(await conferirBytes(ks.certificado, data, sig, 'SHA-256')).toBe(true);
  });

  test('o mesmo signer é reaproveitado', async () => {
    const { ks } = await a1();
    expect(await ks.assinador()).toBe(await ks.assinador());
  });

  test('hash fora do leiaute é recusado', async () => {
    const { ks } = await a1();
    const signer = await ks.assinador();
    await expect(signer.assinar(data, 'MD5' as never)).rejects.toMatchObject({ code: 'algoritmo_nao_suportado' });
  });

  test('chave que não é PKCS#8 RSA', async () => {
    const { ks } = await a1();
    await expect(criarAssinadorA1(Uint8Array.of(1, 2, 3), ks.certificado.der)).rejects.toMatchObject({
      code: 'algoritmo_nao_suportado',
    });
  });

  test('certificado que não é RSA', async () => {
    const { ks } = await a1();
    const fakeCert = { ...ks.certificado, chavePublica: { algoritmo: 'outro' as const, oid: '1.2.840.10045.2.1' } };
    await expect(conferirBytes(fakeCert, data, new Uint8Array(), 'SHA-1')).rejects.toMatchObject({
      code: 'algoritmo_nao_suportado',
    });
  });
});

describe('DigestInfo e adaptador de AssinadorDeDigest', () => {
  test('prefixos da RFC 8017', async () => {
    const d1 = await digestInfoDe(data, 'SHA-1');
    expect(d1).toHaveLength(35);
    const d256 = await digestInfoDe(data, 'SHA-256');
    expect(d256).toHaveLength(51);
    expect(() => codificarDigestInfo('SHA-1', new Uint8Array(32))).toThrow(
      expect.objectContaining({ code: 'algoritmo_nao_suportado' }),
    );
    expect(() => codificarDigestInfo('SHA-512' as never, new Uint8Array(64))).toThrow(
      expect.objectContaining({ code: 'algoritmo_nao_suportado' }),
    );
  });

  test.each(['SHA-1', 'SHA-256'] as const)('modo digest gera a mesma assinatura do modo data (%s)', async (hash) => {
    const { ks, key } = await a1();
    const pk = createPrivateKey(key);
    // "HSM" de teste: RSA cru com padding PKCS#1 v1.5 tipo 1 sobre o DigestInfo, como CKM_RSA_PKCS.
    const digestSigner: AssinadorDeDigest = {
      tipo: 'digest',
      certificadoDer: async () => ks.certificado.der,
      assinarDigestInfo: async (di) =>
        new Uint8Array(privateEncrypt({ key: pk, padding: constants.RSA_PKCS1_PADDING }, di)),
    };
    const viaData = await (await ks.assinador()).assinar(data, hash);
    expect(await assinarBytes(digestSigner, data, hash)).toEqual(viaData);
    const adapted = comoAssinadorDeDados(digestSigner);
    expect(adapted.tipo).toBe('dados');
    expect(await adapted.assinar(data, hash)).toEqual(viaData);
    expect(await adapted.certificadoDer()).toEqual(ks.certificado.der);
    expect(await assinarBytes(await ks.assinador(), data, hash)).toEqual(viaData);
  });
});
