/**
 * Utilitários das checagens locais sobre o corpus (ADR 0002). O corpus tem dado pessoal e fiscal: fica em
 * `~/.local/state/sinete/corpus/` (ou `SINETE_CORPUS`), nunca entra no repo, e estes scripts só imprimem agregados
 * (contagens, códigos e caminhos de schema), nunca conteúdo, nome de arquivo ou chave de acesso. Não rodam no CI.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const corpusDir: string = process.env.SINETE_CORPUS ?? path.join(homedir(), '.local/state/sinete/corpus');
export const stateDir: string = path.join(homedir(), '.local/state/sinete');

export function runtimeName(): string {
  const g = globalThis as { Bun?: { version: string }; Deno?: { version: { deno: string } } };
  if (g.Bun) return `bun ${g.Bun.version}`;
  if (g.Deno) return `deno ${g.Deno.version.deno}`;
  return `node ${process.version}`;
}

/** Arquivos XML de uma pasta do corpus, em ordem estável. Devolve só o conteúdo, nunca o nome. */
export function* corpusDocs(dir: string): Generator<string> {
  const full = path.join(corpusDir, dir);
  for (const f of readdirSync(full).sort()) if (f.endsWith('.xml')) yield readFileSync(path.join(full, f), 'utf8');
}

export function inc(m: Record<string, number>, k: string, n = 1): void {
  m[k] = (m[k] ?? 0) + n;
}

/** Caminho de schema sem índices (`/nfeProc/NFe/infNFe/det/prod`), para agregar. */
export function schemaPath(p: string): string {
  return p.replace(/\[\d+\]/g, '');
}

export function writeResult(name: string, data: unknown): string {
  const dir = path.join(stateDir, 'results');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.json`);
  writeFileSync(file, `${JSON.stringify(data, null, 1)}\n`);
  return file;
}
