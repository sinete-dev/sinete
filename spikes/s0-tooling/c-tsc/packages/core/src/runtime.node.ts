/** Entrada `node` (Node, Bun e Deno via npm: resolvem a condição node). */
import { randomUUID } from 'node:crypto';

export const condition: 'node' | 'default' = 'node';

export function randomId(): string {
  return randomUUID();
}
