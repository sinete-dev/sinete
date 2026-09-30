import { describe, expect, test } from 'bun:test';
import { DATASET_EMBARCADO } from '../src/embarcado.ts';
import type { BundleDoDataset } from '../src/index.ts';
import { compararDatasets, formatarDiferenca, tipoDeMudanca } from '../src/index.ts';

function clone(b: BundleDoDataset): BundleDoDataset {
  return JSON.parse(JSON.stringify(b)) as BundleDoDataset;
}

/** Simula a atualização do extrator: muda registros e o sha256 da tabela no manifest. */
function touch(b: BundleDoDataset, table: string): void {
  const t = b.manifesto.tabelas.find((x) => x.nome === table) as { sha256: string } | undefined;
  if (t) t.sha256 = 'f'.repeat(64);
}

describe('diff semântico entre versões', () => {
  test('mesma versão: nada mudou', () => {
    const d = compararDatasets(DATASET_EMBARCADO, DATASET_EMBARCADO);
    expect(d.tabelas).toEqual([]);
    expect(d.inalteradas.length).toBe(DATASET_EMBARCADO.manifesto.tabelas.length);
    expect(d.formatoMudou).toBe(false);
    expect(formatarDiferenca(d)).toContain('Nenhuma tabela mudou.');
  });

  test('inclusão, remoção e alteração com tipo de mudança', () => {
    const next = clone(DATASET_EMBARCADO);
    const ct = next.tabelas.classTrib as unknown as Record<string, unknown>[];
    const target = ct.find((c) => c.codigo === '200034') as Record<string, unknown>;
    (target.vigencia as { fim: string | null }).fim = '2027-12-31';
    (target.grupos as Record<string, string>).gCredPresOper = 'permitido';
    const reductions = target.reducoes as { pRed: string; tributo: string }[];
    const cbs = reductions.find((r) => r.tributo === 'CBS');
    if (cbs) cbs.pRed = '40';
    target.descricao = 'texto novo';
    const removed = ct.shift() as { chave: string };
    ct.push({ ...target, chave: 'CBS_IBS:299999:2027-01-01', codigo: '299999' });
    touch(next, 'classTrib');
    (next.manifesto as { versaoDosDados: string }).versaoDosDados = '2026.10';
    (next.manifesto as { versaoDoFormato: number }).versaoDoFormato = 3;

    const d = compararDatasets(DATASET_EMBARCADO, next);
    expect(d.formatoMudou).toBe(true);
    const t = d.tabelas.find((x) => x.tabela === 'classTrib');
    expect(t?.incluidos).toEqual(['CBS_IBS:299999:2027-01-01']);
    expect(t?.removidos).toEqual([removed.chave]);
    const change = t?.alterados.find((c) => c.chave === target.chave);
    const kinds = Object.fromEntries((change?.campos ?? []).map((f) => [f.caminho, f.tipo]));
    expect(kinds['vigencia.fim']).toBe('fim-de-vigencia');
    expect(kinds['grupos.gCredPresOper']).toBe('indicador-de-grupo');
    expect(kinds['reducoes[CBS@2026-01-01].pRed']).toBe('reducao-ou-aliquota');
    expect(kinds.descricao).toBe('texto');
    expect(t?.tipos['fim-de-vigencia']).toBe(1);
    const md = formatarDiferenca(d, 2);
    expect(md).toContain('# ibs-cbs-dados 2026.09 -> 2026.10');
    expect(md).toContain('mudança de formato');
    expect(md).toContain('incluído `CBS_IBS:299999:2027-01-01`');
    expect(formatarDiferenca(d)).toContain('vigencia.fim: null -> "2027-12-31"');
  });

  test('tabela com hash novo e mesmo conteúdo conta como sem mudança', () => {
    const next = clone(DATASET_EMBARCADO);
    touch(next, 'cst');
    const d = compararDatasets(DATASET_EMBARCADO, next);
    expect(d.inalteradas).toContain('cst');
  });

  test('listas internas indexadas por conteúdo, com duplicatas numeradas', () => {
    const next = clone(DATASET_EMBARCADO);
    const tr = next.tabelas.tratamentos as unknown as Record<string, unknown>[];
    const first = tr[0] as { expressao: Record<string, string>; indicadores: Record<string, boolean> };
    first.expressao.tributoCalculado = 'baseCalculo*aliquotaEfetiva*2';
    touch(next, 'tratamentos');
    const d = compararDatasets(DATASET_EMBARCADO, next);
    expect(d.tabelas[0]?.alterados[0]?.campos[0]?.tipo).toBe('expressao-de-calculo');
  });

  test('tipoDeMudanca classifica caminhos', () => {
    expect(tipoDeMudanca('vigencia.inicio')).toBe('inicio-de-vigencia');
    expect(tipoDeMudanca('dfe[55@2026-01-01].vigencia.fim')).toBe('fim-de-vigencia');
    expect(tipoDeMudanca('dfe[55@2026-01-01].sigla')).toBe('dfe');
    expect(tipoDeMudanca('aliquotasFixas[CBS@2026-01-01].aliquota')).toBe('reducao-ou-aliquota');
    expect(tipoDeMudanca('percentual')).toBe('reducao-ou-aliquota');
    expect(tipoDeMudanca('indicadores.possuiAjuste')).toBe('expressao-de-calculo');
    expect(tipoDeMudanca('excecoes[100630@2026-01-01].prefixo')).toBe('aplicabilidade');
    expect(tipoDeMudanca('legal.fundamento[Art. 1@2026-01-01].texto')).toBe('texto');
    expect(tipoDeMudanca('tpRBSN')).toBe('outro');
  });

  test('corte de listas longas no resumo', () => {
    const next = clone(DATASET_EMBARCADO);
    const actors = next.tabelas.atores as unknown as Record<string, unknown>[];
    for (const a of actors) a.descricao = `${String(a.descricao)} (alterado)`;
    actors.push(
      { ...actors[0], chave: 'novo-1' },
      { ...actors[0], chave: 'novo-2' },
      { ...actors[0], chave: 'novo-3' },
    );
    touch(next, 'atores');
    const md = formatarDiferenca(compararDatasets(DATASET_EMBARCADO, next), 1);
    expect(md).toMatch(/mais \d+ omitidos/);
  });
});
