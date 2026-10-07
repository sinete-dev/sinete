/**
 * Ordem do push das tags de um release (#65). O GitHub não cria evento de push de tag quando mais de três tags vão no
 * mesmo push, e o job `release` do CI só roda por esse evento. O `scripts/release.ts` publica todos os pacotes
 * pendentes num run só, então basta uma tag chegar sozinha: as dos pacotes vão juntas e a do guarda-chuva
 * (`sinete@<versão>`) vai depois, num push só dela.
 */

/** Tag de release que o `changeset git-tag` cria: `@sinete/<pacote>@<versão>` ou `sinete@<versão>`. */
export function ehTagDeRelease(tag: string): boolean {
  return /^(@sinete\/[a-z0-9-]+|sinete)@\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(tag);
}

export interface PlanoDoPush {
  /** Tags que vão juntas no primeiro push (pode ser vazio). */
  readonly juntas: readonly string[];
  /** A tag que vai sozinha no último push e dispara o job `release`; `undefined` quando não há nada a empurrar. */
  readonly sozinha: string | undefined;
}

/**
 * Plano do push a partir das tags locais do commit e das que o remoto já tem (nome para objeto). Tag do remoto com o
 * mesmo nome e outro objeto é erro: o script nunca faz force-push nem apaga tag.
 */
export function planejarPush(locais: ReadonlyMap<string, string>, remotas: ReadonlyMap<string, string>): PlanoDoPush {
  const pendentes: string[] = [];
  for (const [tag, objeto] of [...locais].sort(([a], [b]) => a.localeCompare(b))) {
    if (!ehTagDeRelease(tag)) continue;
    const remoto = remotas.get(tag);
    if (remoto === undefined) pendentes.push(tag);
    else if (remoto !== objeto) throw new Error(`${tag}: o remoto tem outro objeto (${remoto}, local ${objeto})`);
  }
  if (pendentes.length === 0) return { juntas: [], sozinha: undefined };
  const sozinha = pendentes.find((t) => t.startsWith('sinete@')) ?? (pendentes.at(-1) as string);
  return { juntas: pendentes.filter((t) => t !== sozinha), sozinha };
}

/** Lê a saída do `git ls-remote --tags`: nome da tag para o objeto da própria tag (ignora as linhas `^{}`). */
export function lerLsRemote(saida: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const linha of saida.split('\n')) {
    const [objeto, ref] = linha.trim().split(/\s+/);
    if (objeto === undefined || ref === undefined || !ref.startsWith('refs/tags/') || ref.endsWith('^{}')) continue;
    tags.set(ref.slice('refs/tags/'.length), objeto);
  }
  return tags;
}
