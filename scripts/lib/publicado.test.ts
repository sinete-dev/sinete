import { describe, expect, test } from 'bun:test';
import { jaPublicada } from './publicado.ts';

describe('jaPublicada', () => {
  test('409 de versão já recebida pelo registry', () => {
    const stderr =
      'npm error code E409\nnpm error 409 Conflict - PUT https://registry.npmjs.org/@sinete%2ftransport - Cannot publish over previously staged version "0.1.1".';
    expect(jaPublicada(stderr)).toBe(true);
  });

  test('403 de republicação', () => {
    const stderr =
      'npm error code E403\nnpm error 403 403 Forbidden - PUT https://registry.npmjs.org/sinete - You cannot publish over the previously published versions: 0.1.1.';
    expect(jaPublicada(stderr)).toBe(true);
  });

  test('outras falhas continuam falhas', () => {
    expect(jaPublicada('npm error code E404\nnpm error 404 Not Found - PUT https://registry.npmjs.org/sinete')).toBe(
      false,
    );
    expect(jaPublicada('npm error code E403\nnpm error 403 Forbidden - OIDC token exchange failed')).toBe(false);
    expect(jaPublicada('npm error code EOTP')).toBe(false);
  });
});
