import { describe, expect, test } from 'bun:test';
import {
  ConfigError,
  isSineteError,
  ProtocolError,
  SefazError,
  SineteError,
  TimeoutError,
  UnsupportedError,
  ValidationError,
} from '../src/index.ts';

describe('SineteError', () => {
  test('carrega code, mensagem, detalhes e cause', () => {
    const cause = new TypeError('socket fechado');
    const e = new SineteError('algo_falhou', 'falhou', { cause, details: { host: 'x' } });
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('SineteError');
    expect(e.code).toBe('algo_falhou');
    expect(e.message).toBe('falhou');
    expect(e.cause).toBe(cause);
    expect(e.details).toEqual({ host: 'x' });
    expect(e.stack).toContain('falhou');
    expect(e.docs).toBe('erros/algo_falhou.md');
    expect(Object.keys(e)).toContain('docs');
  });

  test('sem cause não define a propriedade', () => {
    const e = new SineteError('x', 'y');
    expect('cause' in e).toBe(false);
    expect(e.details).toBeUndefined();
  });

  test('cause explicitamente undefined é preservada como propriedade', () => {
    const e = new SineteError('x', 'y', { cause: undefined });
    expect('cause' in e).toBe(true);
  });

  test('toJSON serializa cause de SineteError, Error e valor qualquer', () => {
    const inner = new ConfigError('opção ausente', { details: { opcao: 'uf' } });
    expect(new SineteError('a', 'b', { cause: inner }).toJSON()).toEqual({
      name: 'SineteError',
      code: 'a',
      message: 'b',
      docs: 'erros/a.md',
      cause: {
        name: 'ConfigError',
        code: 'config_invalida',
        message: 'opção ausente',
        docs: 'erros/config_invalida.md',
        details: { opcao: 'uf' },
      },
    });
    expect(new SineteError('a', 'b', { cause: new RangeError('r') }).toJSON().cause).toEqual({
      name: 'RangeError',
      message: 'r',
    });
    expect(new SineteError('a', 'b', { cause: 42 }).toJSON().cause).toBe('42');
    expect(JSON.parse(JSON.stringify(new SineteError('a', 'b')))).toEqual({
      name: 'SineteError',
      code: 'a',
      message: 'b',
      docs: 'erros/a.md',
    });
  });
});

describe('subclasses com código estável', () => {
  const cases: [SineteError, string, string][] = [
    [new ConfigError('m'), 'ConfigError', 'config_invalida'],
    [new ValidationError('m', []), 'ValidationError', 'validacao_falhou'],
    [new UnsupportedError('m'), 'UnsupportedError', 'nao_suportado'],
    [new TimeoutError('m', 1000), 'TimeoutError', 'tempo_esgotado'],
    [new ProtocolError('m'), 'ProtocolError', 'resposta_invalida'],
    [new SefazError('sefaz_rejeitou', '539', 'Duplicidade'), 'SefazError', 'sefaz_rejeitou'],
  ];
  for (const [e, name, code] of cases) {
    test(`${name} -> ${code}`, () => {
      expect(e).toBeInstanceOf(SineteError);
      expect(e.name).toBe(name);
      expect(e.code).toBe(code);
      expect(isSineteError(e, code)).toBe(true);
    });
  }

  test('ValidationError guarda todas as ocorrências e as serializa', () => {
    const issues = [
      { path: 'emit.CNPJ', code: 'cnpj_invalido', message: 'dígito verificador' },
      { path: 'dest.IE', code: 'ie_invalida', message: 'formato' },
    ];
    const e = new ValidationError('2 ocorrências', issues, { details: { doc: 'nfe' } });
    expect(e.issues).toEqual(issues);
    expect(e.toJSON().details).toEqual({ doc: 'nfe', issues });
  });

  test('TimeoutError guarda o prazo', () => {
    expect(new TimeoutError('m', 30_000).timeoutMs).toBe(30_000);
  });

  test('SefazError monta a mensagem com cStat oficial e serializa cStat e xMotivo', () => {
    const e = new SefazError('sefaz_denegou', '302', 'Uso Denegado');
    expect(e.message).toBe('SEFAZ 302: Uso Denegado');
    expect(e.cStat).toBe('302');
    expect(e.toJSON().details).toEqual({ cStat: '302', xMotivo: 'Uso Denegado' });
  });
});

describe('isSineteError', () => {
  test('recusa o que não é erro do sinete', () => {
    expect(isSineteError(new Error('x'))).toBe(false);
    expect(isSineteError(null)).toBe(false);
    expect(isSineteError('config_invalida')).toBe(false);
    expect(isSineteError({ code: 'config_invalida' })).toBe(false);
  });

  test('reconhece erro de outra cópia do pacote pela marca global', () => {
    const foreign = { [Symbol.for('sinete.error')]: true, code: 'nao_suportado', message: 'x' };
    expect(isSineteError(foreign)).toBe(true);
    expect(isSineteError(foreign, 'nao_suportado')).toBe(true);
    expect(isSineteError(foreign, 'config_invalida')).toBe(false);
  });
});
