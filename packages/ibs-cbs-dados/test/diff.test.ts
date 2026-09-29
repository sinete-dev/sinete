import { describe, expect, test } from 'bun:test';
import { BUNDLED_DATASET } from '../src/bundled.ts';
import type { DatasetBundle } from '../src/index.ts';
import { changeKind, diffDatasets, formatDiff } from '../src/index.ts';

function clone(b: DatasetBundle): DatasetBundle {
  return JSON.parse(JSON.stringify(b)) as DatasetBundle;
}

/** Simula a atualização do extrator: muda registros e o sha256 da tabela no manifest. */
function touch(b: DatasetBundle, table: string): void {
  const t = b.manifest.tables.find((x) => x.name === table) as { sha256: string } | undefined;
  if (t) t.sha256 = 'f'.repeat(64);
}

describe('diff semântico entre versões', () => {
  test('mesma versão: nada mudou', () => {
    const d = diffDatasets(BUNDLED_DATASET, BUNDLED_DATASET);
    expect(d.tables).toEqual([]);
    expect(d.unchanged.length).toBe(BUNDLED_DATASET.manifest.tables.length);
    expect(d.schemaChanged).toBe(false);
    expect(formatDiff(d)).toContain('Nenhuma tabela mudou.');
  });

  test('inclusão, remoção e alteração com tipo de mudança', () => {
    const next = clone(BUNDLED_DATASET);
    const ct = next.tables.classTrib as unknown as Record<string, unknown>[];
    const target = ct.find((c) => c.code === '200034') as Record<string, unknown>;
    (target.validity as { to: string | null }).to = '2027-12-31';
    (target.groups as Record<string, string>).gCredPresOper = 'allowed';
    const reductions = target.reductions as { pRed: string; tributo: string }[];
    const cbs = reductions.find((r) => r.tributo === 'CBS');
    if (cbs) cbs.pRed = '40';
    target.description = 'texto novo';
    const removed = ct.shift() as { key: string };
    ct.push({ ...target, key: 'CBS_IBS:299999:2027-01-01', code: '299999' });
    touch(next, 'classTrib');
    (next.manifest as { dataVersion: string }).dataVersion = '2026.10';
    (next.manifest as { dataSchemaVersion: number }).dataSchemaVersion = 2;

    const d = diffDatasets(BUNDLED_DATASET, next);
    expect(d.schemaChanged).toBe(true);
    const t = d.tables.find((x) => x.table === 'classTrib');
    expect(t?.added).toEqual(['CBS_IBS:299999:2027-01-01']);
    expect(t?.removed).toEqual([removed.key]);
    const change = t?.changed.find((c) => c.key === target.key);
    const kinds = Object.fromEntries((change?.fields ?? []).map((f) => [f.path, f.kind]));
    expect(kinds['validity.to']).toBe('fim-de-vigencia');
    expect(kinds['groups.gCredPresOper']).toBe('indicador-de-grupo');
    expect(kinds['reductions[CBS@2026-01-01].pRed']).toBe('reducao-ou-aliquota');
    expect(kinds.description).toBe('texto');
    expect(t?.kinds['fim-de-vigencia']).toBe(1);
    const md = formatDiff(d, 2);
    expect(md).toContain('# ibs-cbs-dados 2026.09 -> 2026.10');
    expect(md).toContain('mudança de formato');
    expect(md).toContain('incluído `CBS_IBS:299999:2027-01-01`');
    expect(formatDiff(d)).toContain('validity.to: null -> "2027-12-31"');
  });

  test('tabela com hash novo e mesmo conteúdo conta como sem mudança', () => {
    const next = clone(BUNDLED_DATASET);
    touch(next, 'cst');
    const d = diffDatasets(BUNDLED_DATASET, next);
    expect(d.unchanged).toContain('cst');
  });

  test('listas internas indexadas por conteúdo, com duplicatas numeradas', () => {
    const next = clone(BUNDLED_DATASET);
    const tr = next.tables.treatments as unknown as Record<string, unknown>[];
    const first = tr[0] as { expr: Record<string, string>; flags: Record<string, boolean> };
    first.expr.tributoCalculado = 'baseCalculo*aliquotaEfetiva*2';
    touch(next, 'treatments');
    const d = diffDatasets(BUNDLED_DATASET, next);
    expect(d.tables[0]?.changed[0]?.fields[0]?.kind).toBe('expressao-de-calculo');
  });

  test('changeKind classifica caminhos', () => {
    expect(changeKind('validity.from')).toBe('inicio-de-vigencia');
    expect(changeKind('dfe[55@2026-01-01].validity.to')).toBe('fim-de-vigencia');
    expect(changeKind('dfe[55@2026-01-01].sigla')).toBe('dfe');
    expect(changeKind('fixedRates[CBS@2026-01-01].rate')).toBe('reducao-ou-aliquota');
    expect(changeKind('percent')).toBe('reducao-ou-aliquota');
    expect(changeKind('flags.possuiAjuste')).toBe('expressao-de-calculo');
    expect(changeKind('exceptions[100630@2026-01-01].prefix')).toBe('aplicabilidade');
    expect(changeKind('legal.basis[Art. 1@2026-01-01].text')).toBe('texto');
    expect(changeKind('tpRBSN')).toBe('outro');
  });

  test('corte de listas longas no resumo', () => {
    const next = clone(BUNDLED_DATASET);
    const actors = next.tables.actors as unknown as Record<string, unknown>[];
    for (const a of actors) a.description = `${String(a.description)} (alterado)`;
    actors.push({ ...actors[0], key: 'novo-1' }, { ...actors[0], key: 'novo-2' }, { ...actors[0], key: 'novo-3' });
    touch(next, 'actors');
    const md = formatDiff(diffDatasets(BUNDLED_DATASET, next), 1);
    expect(md).toMatch(/mais \d+ omitidos/);
  });
});
