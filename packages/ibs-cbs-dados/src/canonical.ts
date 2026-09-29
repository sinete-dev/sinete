/**
 * Serialização canônica das tabelas: chaves ordenadas, um registro por linha, newline final. É a base do sha256 de
 * cada tabela no manifest, então o extrator e a verificação em runtime usam esta mesma função. O arquivo em
 * `src/data/` é o mesmo conteúdo formatado pelo Biome do repositório; o hash não depende dos bytes do arquivo.
 */

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = normalize(v);
    }
    return out;
  }
  return value;
}

export function canonicalTable(records: readonly unknown[]): string {
  if (records.length === 0) return '[]\n';
  return `[\n${records.map((r) => JSON.stringify(normalize(r))).join(',\n')}\n]\n`;
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}
