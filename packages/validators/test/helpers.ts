import { expect } from 'bun:test';
import { isSineteError, ValidationError } from '@sinete/core';

/** Captura o erro lançado e confere que é `ValidationError` do core com a ocorrência de código estável. */
export function expectValidationError(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  expect(isSineteError(caught, 'validacao_falhou')).toBe(true);
  expect(caught).toBeInstanceOf(ValidationError);
  expect((caught as ValidationError).issues.map((i) => i.code)).toEqual([code]);
}
