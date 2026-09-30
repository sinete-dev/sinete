import { describe, expect, test } from 'bun:test';
import { abrirPfx } from '@sinete/cert';
import { relogioManual } from '@sinete/core';
import { syntheticCertificate, syntheticPfx } from '../src/index.ts';

describe('syntheticPfx', () => {
  test('o @sinete/cert abre o PFX: mesma chave, mesmo titular e a AC como intermediária', async () => {
    const clock = relogioManual('2026-09-26T10:00:00-03:00');
    const ac = await syntheticCertificate({ clock, role: 'ac' });
    const titular = await syntheticCertificate({ clock, role: 'titular', cpf: '11144477735', issuer: ac });
    const ks = await abrirPfx(syntheticPfx(titular, 'senha', { chain: [ac] }), { senha: 'senha', relogio: clock });
    expect(ks.identidade.cpf).toBe('11144477735');
    expect(ks.certificado.der).toEqual(titular.der);
    expect(ks.certificadosExtras.map((c) => c.der)).toEqual([ac.der]);
    expect(await (await ks.assinador()).certificadoDer()).toEqual(titular.der);
    const soTitular = await abrirPfx(syntheticPfx(titular, 'outra'), { senha: 'outra', relogio: clock });
    expect(soTitular.certificadosExtras).toHaveLength(0);
    await expect(abrirPfx(syntheticPfx(titular, 'x'), { senha: 'y', relogio: clock })).rejects.toMatchObject({
      code: 'pfx_senha_incorreta',
    });
  });
});
