import { describe, expect, test } from 'bun:test';
import type { DoctorOpcoes, EntradaSaidaCli, RelatorioDoDoctor } from '../src/index.ts';
import { main } from '../src/index.ts';

function io(
  overrides: Partial<EntradaSaidaCli> = {},
): EntradaSaidaCli & { outLines: string[]; errLines: string[]; calls: DoctorOpcoes[] } {
  const outLines: string[] = [];
  const errLines: string[] = [];
  const calls: DoctorOpcoes[] = [];
  const files: Record<string, string> = { 'a.pfx': 'PFX', 'cadeia.pem': 'CADEIA', 'ca.pem': 'CA' };
  return {
    outLines,
    errLines,
    calls,
    saida: (l) => outLines.push(l),
    erro: (l) => errLines.push(l),
    env: { SINETE_PFX_SENHA: 'senha-do-env' },
    pedirSenha: async () => undefined,
    lerArquivo: async (p) => {
      const v = files[p];
      if (v === undefined) throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
      return new TextEncoder().encode(v);
    },
    gravarArquivo: async (p, text) => {
      files[p] = text;
    },
    doctor: async (o): Promise<RelatorioDoDoctor> => {
      calls.push(o);
      return { ok: true, verificacoes: [{ id: 'pfx', situacao: 'ok', mensagem: 'tudo certo' }] };
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
        '--ac',
        'ca.pem',
        '--timeout',
        '5000',
        '--aceitar-vencido',
      ],
      x,
    );
    expect(code).toBe(0);
    const o = x.calls[0] as DoctorOpcoes;
    expect(new TextDecoder().decode(o.pfx)).toBe('PFX');
    expect(o).toMatchObject({
      senha: 'senha-do-env',
      uf: 'SP',
      ambiente: 'producao',
      documento: 'nfe',
      endpoint: { url: 'https://exemplo.invalid/ws' },
      consultarStatus: true,
      urlDoRelogio: 'https://hora.invalid/',
      cadeiaAdicionalPem: 'CADEIA',
      acsAdicionaisPem: 'CA',
      timeoutMs: 5000,
      aceitarVencido: true,
    });
    expect(x.outLines).toEqual(['ok     pfx      tudo certo', 'doctor: nada impede o uso']);
  });

  test('senha por variável escolhida, por prompt, ou erro sem terminal', async () => {
    const a = io({ env: { OUTRA: 'x' } });
    expect(await main(['doctor', '--pfx', 'a.pfx', '--senha-env', 'OUTRA'], a)).toBe(0);
    expect(a.calls[0]?.senha).toBe('x');
    const b = io({ env: {}, pedirSenha: async () => 'digitada' });
    expect(await main(['doctor', '--pfx', 'a.pfx'], b)).toBe(0);
    expect(b.calls[0]?.senha).toBe('digitada');
    const c = io({ env: {} });
    expect(await main(['doctor', '--pfx', 'a.pfx'], c)).toBe(2);
    expect(c.errLines[0]).toContain('SINETE_PFX_SENHA');
  });

  test('--json, código de saída de falha e erro inesperado', async () => {
    const report: RelatorioDoDoctor = { ok: false, verificacoes: [{ id: 'pfx', situacao: 'falha', mensagem: 'm' }] };
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
