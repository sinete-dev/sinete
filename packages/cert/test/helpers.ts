import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Senhas dos PFX sintéticos gerados por fixtures/gerar.ts. */
export const SENHA = 'sinete-teste';
export const SENHA_ACENTUADA = 'Açaí#2026';

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(import.meta.dir, 'fixtures', name)));
}
