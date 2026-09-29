/**
 * Pool de emissores por certificado: um emissor por PFX e senha, validade, limite, fechamento só quando o último
 * empréstimo termina, e a chave (hash) que nunca aparece fora do pool.
 */
import { describe, expect, test } from 'bun:test';
import { manualClock } from '@sinete/core';
import type { CertificadoA1 } from '../src/index.ts';
import { createPoolDeEmissores } from '../src/index.ts';

interface Falso {
  readonly n: number;
  readonly cert: CertificadoA1;
  fechado: boolean;
  fechar(): Promise<void>;
}

function montar(o: { ttlMs?: number; maximo?: number; falhar?: (c: CertificadoA1) => boolean } = {}) {
  const clock = manualClock('2026-09-27T10:00:00-03:00');
  const criados: Falso[] = [];
  const pool = createPoolDeEmissores<Falso>({
    clock,
    ...(o.ttlMs === undefined ? {} : { ttlMs: o.ttlMs }),
    ...(o.maximo === undefined ? {} : { maximo: o.maximo }),
    criar: async (cert) => {
      if (o.falhar?.(cert)) throw new Error('senha errada');
      const e: Falso = {
        n: criados.length + 1,
        cert,
        fechado: false,
        async fechar() {
          e.fechado = true;
        },
      };
      criados.push(e);
      return e;
    },
  });
  return { clock, criados, pool };
}

const cert = (b: number, senha = 's'): CertificadoA1 => ({ pfx: new Uint8Array([b, b, b]), senha });

describe('createPoolDeEmissores', () => {
  test('um emissor por PFX e senha; outra senha é outro emissor', async () => {
    const { criados, pool } = montar();
    const a = await pool.usar(cert(1), async (e) => e.n);
    const b = await pool.usar(cert(1), async (e) => e.n);
    const c = await pool.usar(cert(1, 'outra'), async (e) => e.n);
    const d = await pool.usar(cert(2), async (e) => e.n);
    expect([a, b, c, d]).toEqual([1, 1, 2, 3]);
    expect(criados).toHaveLength(3);
  });

  test('vencido pelo ttl: sai do pool e só fecha quando o empréstimo em curso termina', async () => {
    const { clock, criados, pool } = montar({ ttlMs: 1000 });
    let soltar = (): void => {};
    const emUso = pool.usar(cert(1), (e) => new Promise<number>((r) => (soltar = () => r(e.n))));
    await Bun.sleep(1);
    clock.advance(1500);
    expect(await pool.usar(cert(1), async (e) => e.n)).toBe(2);
    expect(criados[0]?.fechado).toBe(false);
    soltar();
    expect(await emUso).toBe(1);
    expect(criados[0]?.fechado).toBe(true);
    expect(criados[1]?.fechado).toBe(false);
  });

  test('o vencido de outro certificado sai no próximo empréstimo, mesmo abaixo do máximo', async () => {
    const { clock, criados, pool } = montar({ ttlMs: 1000 });
    await pool.usar(cert(1), async () => undefined);
    clock.advance(500);
    await pool.usar(cert(2), async () => undefined);
    clock.advance(600);
    await pool.usar(cert(3), async () => undefined);
    expect(criados.map((e) => e.fechado)).toEqual([true, false, false]);
    expect(await pool.usar(cert(2), async (e) => e.n)).toBe(2);
  });

  test('acima do máximo, o mais antigo sai e fecha', async () => {
    const { criados, pool } = montar({ maximo: 2 });
    for (const b of [1, 2, 3]) await pool.usar(cert(b), async () => undefined);
    expect(criados.map((e) => e.fechado)).toEqual([true, false, false]);
    expect(await pool.usar(cert(2), async (e) => e.n)).toBe(2);
  });

  test('falha ao criar não fica no pool: o próximo empréstimo tenta de novo', async () => {
    let falhar = true;
    const { pool } = montar({ falhar: () => falhar });
    await expect(pool.usar(cert(1), async () => 1)).rejects.toThrow('senha errada');
    falhar = false;
    expect(await pool.usar(cert(1), async (e) => e.n)).toBe(1);
  });

  test('fechar fecha tudo e recusa novos empréstimos', async () => {
    const { criados, pool } = montar();
    await pool.usar(cert(1), async () => undefined);
    await pool.usar(cert(2), async () => undefined);
    await pool.fechar();
    expect(criados.every((e) => e.fechado)).toBe(true);
    await expect(pool.usar(cert(1), async () => 1)).rejects.toMatchObject({ code: 'config_invalida' });
  });

  test('fechar alcança o emissor aposentado com empréstimo em curso', async () => {
    const { clock, criados, pool } = montar({ ttlMs: 1000 });
    let soltar = (): void => {};
    const emUso = pool.usar(cert(1), (e) => new Promise<number>((r) => (soltar = () => r(e.n))));
    await Bun.sleep(1);
    clock.advance(1500);
    await pool.usar(cert(1), async () => undefined);
    expect(criados[0]?.fechado).toBe(false);
    await pool.fechar();
    expect(criados.map((e) => e.fechado)).toEqual([true, true]);
    soltar();
    expect(await emUso).toBe(1);
  });

  test('fechar enquanto o hash do certificado é calculado: o empréstimo é recusado e nada é criado', async () => {
    const { criados, pool } = montar();
    const emprestimo = pool.usar(cert(1), async () => 1);
    await pool.fechar();
    await expect(emprestimo).rejects.toMatchObject({ code: 'config_invalida' });
    expect(criados).toHaveLength(0);
  });

  test('o erro do emissor que falha ao fechar não escapa', async () => {
    const pool = createPoolDeEmissores({
      maximo: 1,
      criar: async () => ({
        fechar: async (): Promise<void> => {
          throw new Error('já fechado');
        },
      }),
    });
    await pool.usar(cert(1), async () => undefined);
    await pool.usar(cert(2), async () => undefined);
    await pool.fechar();
  });

  test('opções conferidas', () => {
    expect(() => createPoolDeEmissores({ criar: async () => ({ fechar: async () => {} }), ttlMs: 0 })).toThrow('ttlMs');
    expect(() => createPoolDeEmissores({ criar: async () => ({ fechar: async () => {} }), maximo: 0 })).toThrow(
      'maximo',
    );
  });

  test('certificado de outro tipo com a chave do integrador; sem chave, recusa', async () => {
    const criados: string[] = [];
    const pool = createPoolDeEmissores<{ id: string; fechar(): Promise<void> }, { id: string }>({
      chave: (c) => c.id,
      criar: async (c) => {
        criados.push(c.id);
        return { id: c.id, fechar: async () => {} };
      },
    });
    expect(await pool.usar({ id: 'cert-1' }, async (e) => e.id)).toBe('cert-1');
    expect(await pool.usar({ id: 'cert-1' }, async (e) => e.id)).toBe('cert-1');
    expect(criados).toEqual(['cert-1']);
    const semChave = createPoolDeEmissores<{ fechar(): Promise<void> }, { id: string }>({
      criar: async () => ({ fechar: async () => {} }),
    });
    await expect(semChave.usar({ id: 'x' }, async () => 1)).rejects.toThrow('opção chave');
  });
});
