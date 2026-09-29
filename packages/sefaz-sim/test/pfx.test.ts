import { describe, expect, test } from 'bun:test';
import { openPfx } from '@sinete/cert';
import { manualClock } from '@sinete/core';
import { syntheticCertificate, syntheticPfx } from '../src/index.ts';

describe('syntheticPfx', () => {
  test('o @sinete/cert abre o PFX: mesma chave, mesmo titular e a AC como intermediária', async () => {
    const clock = manualClock('2026-09-26T10:00:00-03:00');
    const ac = await syntheticCertificate({ clock, role: 'ac' });
    const titular = await syntheticCertificate({ clock, role: 'titular', cpf: '11144477735', issuer: ac });
    const ks = await openPfx(syntheticPfx(titular, 'senha', { chain: [ac] }), { password: 'senha', clock });
    expect(ks.identity.cpf).toBe('11144477735');
    expect(ks.certificate.der).toEqual(titular.der);
    expect(ks.extraCertificates.map((c) => c.der)).toEqual([ac.der]);
    expect(await (await ks.signer()).certificateDer()).toEqual(titular.der);
    const soTitular = await openPfx(syntheticPfx(titular, 'outra'), { password: 'outra', clock });
    expect(soTitular.extraCertificates).toHaveLength(0);
    await expect(openPfx(syntheticPfx(titular, 'x'), { password: 'y', clock })).rejects.toMatchObject({
      code: 'pfx_senha_incorreta',
    });
  });
});
