import { expect } from 'bun:test';
import { ErroDeValidacao, ehErroSinete } from '@sinete/core';

/** Captura o erro lançado e confere que é `ErroDeValidacao` do core com a ocorrência de código estável. */
export function expectValidationError(fn: () => unknown, code: string): void {
  let caught: unknown;
  try {
    fn();
  } catch (e) {
    caught = e;
  }
  expect(ehErroSinete(caught, 'validacao_falhou')).toBe(true);
  expect(caught).toBeInstanceOf(ErroDeValidacao);
  expect((caught as ErroDeValidacao).ocorrencias.map((i) => i.code)).toEqual([code]);
}
