/** Entrada `default` (browser, Deno sem condição node, bundlers). Usa só Web Crypto. */
export const condition: 'node' | 'default' = 'default';

export function randomId(): string {
  return globalThis.crypto.randomUUID();
}
