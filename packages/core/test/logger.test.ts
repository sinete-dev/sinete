import { describe, expect, test } from 'bun:test';
import { memoryLogger, noopLogger } from '../src/index.ts';

describe('noopLogger', () => {
  test('aceita tudo e não faz nada', () => {
    expect(() => {
      noopLogger.debug('a');
      noopLogger.info('b', { x: 1 });
      noopLogger.warn('c');
      noopLogger.error('d');
    }).not.toThrow();
    expect(noopLogger.child({ uf: 'SP' })).toBe(noopLogger);
  });
});

describe('memoryLogger', () => {
  test('guarda nível, mensagem e campos, com bindings dos filhos', () => {
    const log = memoryLogger();
    log.info('inicio');
    const child = log.child({ uf: 'SP' }).child({ operacao: 'autorizacao' });
    child.warn('lento', { ms: 1200 });
    child.debug('d');
    log.error('falha', { code: 'tempo_esgotado' });
    expect(log.entries).toEqual([
      { level: 'info', msg: 'inicio', fields: {} },
      { level: 'warn', msg: 'lento', fields: { uf: 'SP', operacao: 'autorizacao', ms: 1200 } },
      { level: 'debug', msg: 'd', fields: { uf: 'SP', operacao: 'autorizacao' } },
      { level: 'error', msg: 'falha', fields: { code: 'tempo_esgotado' } },
    ]);
    log.clear();
    expect(log.entries).toHaveLength(0);
  });

  test('campos da entrada vencem os bindings', () => {
    const log = memoryLogger();
    log.child({ uf: 'SP' }).info('x', { uf: 'MT' });
    expect(log.entries[0]?.fields).toEqual({ uf: 'MT' });
  });
});
