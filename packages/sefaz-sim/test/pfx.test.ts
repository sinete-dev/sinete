import { describe, expect, test } from 'bun:test';
import { abrirPfx } from '@sinete/cert';
import { relogioManual } from '@sinete/core';
import { certificadoSintetico, pfxSintetico } from '../src/index.ts';

describe('pfxSintetico', () => {
  test('o @sinete/cert abre o PFX: mesma chave, mesmo titular e a AC como intermediária', async () => {
    const clock = relogioManual('2026-09-26T10:00:00-03:00');
    const ac = await certificadoSintetico({ relogio: clock, papel: 'ac' });
    const titular = await certificadoSintetico({ relogio: clock, papel: 'titular', cpf: '11144477735', emissor: ac });
    const ks = await abrirPfx(pfxSintetico(titular, 'senha', { cadeia: [ac] }), { senha: 'senha', relogio: clock });
    expect(ks.identidade.cpf).toBe('11144477735');
    expect(ks.certificado.der).toEqual(titular.der);
    expect(ks.certificadosExtras.map((c) => c.der)).toEqual([ac.der]);
    expect(await (await ks.assinador()).certificadoDer()).toEqual(titular.der);
    const soTitular = await abrirPfx(pfxSintetico(titular, 'outra'), { senha: 'outra', relogio: clock });
    expect(soTitular.certificadosExtras).toHaveLength(0);
    await expect(abrirPfx(pfxSintetico(titular, 'x'), { senha: 'y', relogio: clock })).rejects.toMatchObject({
      code: 'pfx_senha_incorreta',
    });
  });
});
