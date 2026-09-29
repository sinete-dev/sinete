import { describe, expect, test } from 'bun:test';
import { formatarVerProc } from '../src/index.ts';

describe('formatarVerProc', () => {
  test('monta "nome versão" quando cabe no limite', () => {
    expect(formatarVerProc('sinete', '0.4.2')).toBe('sinete 0.4.2');
  });

  test('exatamente 20 caracteres não corta', () => {
    const v = formatarVerProc('sinete', '1234567890123'); // 'sinete ' (7) + 13 = 20
    expect(v).toBe('sinete 1234567890123');
    expect(v).toHaveLength(20);
  });

  test('versão longa é cortada para caber em 20 caracteres', () => {
    const v = formatarVerProc('sinete', '1.2.3-alpha.456+build.789012345');
    expect(v.length).toBeLessThanOrEqual(20);
    expect(v.startsWith('sinete ')).toBe(true);
    expect(v.endsWith(' ')).toBe(false);
  });

  test('nome maior que o limite ainda gera texto válido (1 a 20, sem espaço na ponta)', () => {
    const v = formatarVerProc('nome-de-aplicativo-bem-grande-mesmo', '1.0.0');
    expect(v.length).toBeGreaterThan(0);
    expect(v.length).toBeLessThanOrEqual(20);
    expect(v.endsWith(' ')).toBe(false);
  });

  test('versão vazia devolve só o nome', () => {
    expect(formatarVerProc('sinete', '')).toBe('sinete');
  });
});
