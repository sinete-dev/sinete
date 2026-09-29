import type { Item } from './extrair.ts';
import type { Fonte } from './fontes.ts';

/** O que o `estado.json` guarda de cada fonte: só a lista de itens, sem data, para o diff ser só do que mudou. */
export interface Estado {
  readonly fontes: Record<string, { readonly titulo: string; readonly url: string; readonly itens: readonly Item[] }>;
}

export interface Mudanca {
  readonly fonte: Fonte;
  readonly novos: readonly Item[];
  readonly removidos: readonly Item[];
  readonly renomeados: readonly { readonly id: string; readonly antes: string; readonly depois: string }[];
  /** Fonte que ainda não estava no `estado.json`. */
  readonly primeiraLeitura: boolean;
}

export interface Leitura {
  readonly fonte: Fonte;
  readonly itens?: readonly Item[];
  readonly erro?: string;
}

export function comparar(
  fonte: Fonte,
  anterior: Estado['fontes'][string] | undefined,
  itens: readonly Item[],
): Mudanca {
  const antes = new Map((anterior?.itens ?? []).map((i) => [i.id, i]));
  const agora = new Map(itens.map((i) => [i.id, i]));
  const novos = itens.filter((i) => !antes.has(i.id));
  const removidos = [...antes.values()].filter((i) => !agora.has(i.id));
  const renomeados = itens.flatMap((i) => {
    const a = antes.get(i.id);
    return a && a.titulo !== i.titulo ? [{ id: i.id, antes: a.titulo, depois: i.titulo }] : [];
  });
  return { fonte, novos, removidos, renomeados, primeiraLeitura: anterior === undefined };
}

export function mudou(m: Mudanca): boolean {
  return m.primeiraLeitura || m.novos.length > 0 || m.removidos.length > 0 || m.renomeados.length > 0;
}

/** Estado novo: as fontes lidas com sucesso trocam de lista; as que falharam mantêm a anterior. */
export function proximoEstado(anterior: Estado, leituras: readonly Leitura[]): Estado {
  const fontes: Record<string, Estado['fontes'][string]> = {};
  for (const l of leituras) {
    const velho = anterior.fontes[l.fonte.id];
    if (l.itens) fontes[l.fonte.id] = { titulo: l.fonte.titulo, url: l.fonte.url, itens: [...l.itens] };
    else if (velho) fontes[l.fonte.id] = velho;
  }
  return { fontes };
}

function lista(itens: readonly Item[], max = 30): string[] {
  const linhas = itens.slice(0, max).map((i) => `  - ${i.titulo} (\`${i.id}\`)`);
  if (itens.length > max) linhas.push(`  - e mais ${itens.length - max}`);
  return linhas;
}

/** Relatório em Markdown, para a issue e para o resumo do job. */
export function relatorio(mudancas: readonly Mudanca[], falhas: readonly Leitura[]): string {
  const out: string[] = [];
  const reais = mudancas.filter(mudou);
  if (reais.length === 0 && falhas.length === 0) return 'Nenhuma fonte oficial mudou.\n';
  if (reais.length > 0) {
    out.push(
      'As fontes oficiais abaixo publicaram algo diferente do que está em `tools/fontes-oficiais/estado.json`.',
      '',
    );
    for (const m of reais) {
      out.push(`### ${m.fonte.titulo}`, '', `Página: ${m.fonte.url}`, `Afeta: ${m.fonte.afeta}`, '');
      if (m.primeiraLeitura) out.push('- Fonte nova no vigia: sem estado anterior para comparar.');
      if (m.novos.length) out.push(`- Novos (${m.novos.length}):`, ...lista(m.novos));
      if (m.renomeados.length) {
        out.push(`- Título mudou (${m.renomeados.length}):`);
        for (const r of m.renomeados.slice(0, 30)) out.push(`  - ${r.antes} → ${r.depois} (\`${r.id}\`)`);
      }
      if (m.removidos.length) out.push(`- Saíram da página (${m.removidos.length}):`, ...lista(m.removidos));
      out.push('');
    }
    out.push(
      '## Como fechar',
      '',
      'Traga o que for relevante pelo caminho de cada fonte (ADR 0002 para esquemas, ADR 0007 para a Calculadora e as tabelas) e, no mesmo PR, rode `bun tools/fontes-oficiais/src/vigiar.ts --gravar` para registrar o estado lido. Esta issue fecha sozinha quando o estado versionado alcançar as páginas.',
      '',
    );
  }
  if (falhas.length > 0) {
    out.push('## Fontes que não deu para ler', '');
    for (const f of falhas) out.push(`- ${f.fonte.titulo}: ${f.erro}`);
    out.push('');
  }
  return out.join('\n');
}
