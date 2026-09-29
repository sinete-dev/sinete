import { describe, expect, test } from 'bun:test';
import type { CliIo, DoctorOptions, DoctorReport } from '../src/index.ts';
import { main } from '../src/index.ts';

function io(
  overrides: Partial<CliIo> = {},
): CliIo & { outLines: string[]; errLines: string[]; calls: DoctorOptions[] } {
  const outLines: string[] = [];
  const errLines: string[] = [];
  const calls: DoctorOptions[] = [];
  const files: Record<string, string> = { 'a.pfx': 'PFX', 'cadeia.pem': 'CADEIA', 'ca.pem': 'CA' };
  return {
    outLines,
    errLines,
    calls,
    out: (l) => outLines.push(l),
    err: (l) => errLines.push(l),
    env: { SINETE_PFX_SENHA: 'senha-do-env' },
    promptPassword: async () => undefined,
    readFile: async (p) => {
      const v = files[p];
      if (v === undefined) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
      return new TextEncoder().encode(v);
    },
    writeFile: async (p, text) => {
      files[p] = text;
    },
    doctor: async (o): Promise<DoctorReport> => {
      calls.push(o);
      return { ok: true, checks: [{ id: 'pfx', status: 'ok', message: 'tudo certo' }] };
    },
    ...overrides,
  };
}

describe('sinete (CLI)', () => {
  test('ajuda e comando desconhecido', async () => {
    const a = io();
    expect(await main([], a)).toBe(2);
    expect(a.outLines[0]).toContain('uso: sinete doctor');
    expect(await main(['--help'], io())).toBe(0);
    expect(await main(['doctor', '--help'], io())).toBe(0);
    const b = io();
    expect(await main(['assinar'], b)).toBe(2);
    expect(b.errLines[0]).toContain('comando desconhecido');
    expect(await main(['doctor', '--nada'], io())).toBe(2);
  });

  test('validação das opções', async () => {
    for (const args of [
      [],
      ['--pfx', 'a.pfx', '--uf', 'XX'],
      ['--pfx', 'a.pfx', '--ambiente', 'teste'],
      ['--pfx', 'a.pfx', '--documento', 'cte'],
      ['--pfx', 'a.pfx', '--timeout', 'zero'],
      ['--pfx', 'nao-existe.pfx'],
      ['--pfx', 'a.pfx', '--cadeia', 'nao-existe.pem'],
    ]) {
      const x = io();
      expect(await main(['doctor', ...args], x)).toBe(2);
      expect(x.errLines[0]).toStartWith('sinete doctor:');
      expect(x.calls).toHaveLength(0);
    }
  });

  test('opções chegam ao doctor; senha do env, nunca de argumento', async () => {
    const x = io();
    const code = await main(
      [
        'doctor',
        '--pfx',
        'a.pfx',
        '--uf',
        'sp',
        '--ambiente',
        'producao',
        '--documento',
        'nfe',
        '--endpoint',
        'https://exemplo.invalid/ws',
        '--status',
        '--relogio-url',
        'https://hora.invalid/',
        '--cadeia',
        'cadeia.pem',
        '--ca',
        'ca.pem',
        '--timeout',
        '5000',
        '--allow-expired',
      ],
      x,
    );
    expect(code).toBe(0);
    const o = x.calls[0] as DoctorOptions;
    expect(new TextDecoder().decode(o.pfx)).toBe('PFX');
    expect(o).toMatchObject({
      password: 'senha-do-env',
      uf: 'SP',
      ambiente: 'producao',
      documento: 'nfe',
      endpoint: { url: 'https://exemplo.invalid/ws' },
      status: true,
      clockUrl: 'https://hora.invalid/',
      extraChainPem: 'CADEIA',
      extraCaPem: 'CA',
      timeoutMs: 5000,
      allowExpired: true,
    });
    expect(x.outLines).toEqual(['ok     pfx      tudo certo', 'doctor: nada impede o uso']);
  });

  test('senha por variável escolhida, por prompt, ou erro sem terminal', async () => {
    const a = io({ env: { OUTRA: 'x' } });
    expect(await main(['doctor', '--pfx', 'a.pfx', '--senha-env', 'OUTRA'], a)).toBe(0);
    expect(a.calls[0]?.password).toBe('x');
    const b = io({ env: {}, promptPassword: async () => 'digitada' });
    expect(await main(['doctor', '--pfx', 'a.pfx'], b)).toBe(0);
    expect(b.calls[0]?.password).toBe('digitada');
    const c = io({ env: {} });
    expect(await main(['doctor', '--pfx', 'a.pfx'], c)).toBe(2);
    expect(c.errLines[0]).toContain('SINETE_PFX_SENHA');
  });

  test('--json, código de saída de falha e erro inesperado', async () => {
    const report: DoctorReport = { ok: false, checks: [{ id: 'pfx', status: 'falha', message: 'm' }] };
    const a = io({ doctor: async () => report });
    expect(await main(['doctor', '--pfx', 'a.pfx', '--json'], a)).toBe(1);
    expect(JSON.parse(a.outLines[0] ?? '')).toEqual(report);
    const b = io({
      doctor: async () => {
        throw new Error('boom');
      },
    });
    expect(await main(['doctor', '--pfx', 'a.pfx'], b)).toBe(2);
    expect(b.errLines[0]).toContain('boom');
  });
});
