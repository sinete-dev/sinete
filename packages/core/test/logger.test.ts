import { describe, expect, test } from 'bun:test';
import { loggerEmMemoria, loggerSilencioso } from '../src/index.ts';

describe('loggerSilencioso', () => {
  test('aceita tudo e não faz nada', () => {
    expect(() => {
      loggerSilencioso.debug('a');
      loggerSilencioso.info('b', { x: 1 });
      loggerSilencioso.warn('c');
      loggerSilencioso.error('d');
    }).not.toThrow();
    expect(loggerSilencioso.child({ uf: 'SP' })).toBe(loggerSilencioso);
  });
});

describe('loggerEmMemoria', () => {
  test('guarda nível, mensagem e campos, com bindings dos filhos', () => {
    const log = loggerEmMemoria();
    log.info('inicio');
    const child = log.child({ uf: 'SP' }).child({ operacao: 'autorizacao' });
    child.warn('lento', { ms: 1200 });
    child.debug('d');
    log.error('falha', { code: 'tempo_esgotado' });
    expect(log.entradas).toEqual([
      { nivel: 'info', mensagem: 'inicio', campos: {} },
      { nivel: 'warn', mensagem: 'lento', campos: { uf: 'SP', operacao: 'autorizacao', ms: 1200 } },
      { nivel: 'debug', mensagem: 'd', campos: { uf: 'SP', operacao: 'autorizacao' } },
      { nivel: 'error', mensagem: 'falha', campos: { code: 'tempo_esgotado' } },
    ]);
    log.limpar();
    expect(log.entradas).toHaveLength(0);
  });

  test('campos da entrada vencem os bindings', () => {
    const log = loggerEmMemoria();
    log.child({ uf: 'SP' }).info('x', { uf: 'MT' });
    expect(log.entradas[0]?.campos).toEqual({ uf: 'MT' });
  });
});
