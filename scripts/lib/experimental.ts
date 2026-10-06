/**
 * Marca de subpath experimental (ADR 0016, seção 5) para o gerador do guarda-chuva (`scripts/umbrella.ts`): a marca é
 * lida do comentário de módulo da fonte, e o README do `sinete` declara os experimentais numa frase escrita à mão.
 */
import type { ExportTarget } from './workspace.ts';

/** O arquivo de tipos de um alvo de `exports` (a condição `types`, ou a do `default` quando há condições de runtime). */
export function tiposDoAlvo(t: ExportTarget | undefined): string | undefined {
  if (t === undefined || t === null || typeof t === 'string') return undefined;
  if (typeof t.types === 'string') return t.types;
  return tiposDoAlvo(t.default);
}

/** A fonte (`src/x.ts`) de um arquivo de tipos do `dist` (`./dist/x.d.ts`). */
export function fonteDosTipos(tipos: string): string {
  return tipos.replace(/^\.\/dist\//, 'src/').replace(/\.d\.ts$/, '.ts');
}

/** Se o comentário de módulo (o primeiro bloco JSDoc do arquivo) traz `@experimental`. */
export function moduloExperimental(fonte: string): boolean {
  const modulo = /\/\*\*[\s\S]*?\*\//.exec(fonte)?.[0] ?? '';
  return /@experimental\b/.test(modulo);
}

/** Início da frase do README do `sinete` que declara os subpaths experimentais. */
export const FRASE_EXPERIMENTAIS = 'Os subpaths experimentais';

/**
 * O que diverge entre a frase dos experimentais do README e os subpaths marcados na fonte: cada experimental que a
 * frase não cita e cada citado que não é experimental.
 */
export function divergenciasDoReadme(readme: string, experimentais: readonly string[]): string[] {
  const frase = readme.split('\n').find((l) => l.startsWith(FRASE_EXPERIMENTAIS)) ?? '';
  const citados = new Set([...frase.matchAll(/`(sinete\/[^`]+)`/g)].map((m) => m[1] as string));
  return [
    ...experimentais.filter((e) => !citados.has(e)).map((e) => `falta ${e} entre os experimentais`),
    ...[...citados].filter((c) => !experimentais.includes(c)).map((c) => `${c} não é experimental (sobra)`),
  ];
}
