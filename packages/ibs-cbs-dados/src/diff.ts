/**
 * Diff semântico entre duas versões do dataset (desenho §7, passo 3; ADR 0007, "Diff entre versões").
 *
 * Compara tabela a tabela pela `key` estável de cada registro (família, código, início de vigência). Registros
 * incluídos e removidos aparecem pela chave; registros alterados trazem o caminho de cada campo, com o valor antigo e
 * o novo. Listas internas com vigência (reduções, DF-e, tratamentos) são indexadas pelo conteúdo que as identifica, não
 * pela posição, para que a inclusão de um item não pareça alteração de todos os seguintes. Cada campo alterado recebe
 * um tipo de mudança, no espírito das seções "Alterações na versão" do IT, para o resumo humano do PR de atualização.
 */
import type { DatasetBundle, TableName } from './types.ts';

export type ChangeKind =
  | 'fim-de-vigencia'
  | 'inicio-de-vigencia'
  | 'indicador-de-grupo'
  | 'dfe'
  | 'reducao-ou-aliquota'
  | 'expressao-de-calculo'
  | 'aplicabilidade'
  | 'texto'
  | 'outro';

export interface FieldChange {
  readonly path: string;
  readonly kind: ChangeKind;
  /** Valor serializado em JSON; `undefined` quando o campo não existia. */
  readonly from?: string;
  readonly to?: string;
}

export interface RecordChange {
  readonly key: string;
  readonly fields: readonly FieldChange[];
}

export interface TableDiff {
  readonly table: TableName;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly RecordChange[];
  readonly kinds: Readonly<Partial<Record<ChangeKind, number>>>;
}

export interface DatasetDiff {
  readonly from: { readonly dataVersion: string; readonly datasetSha256: string; readonly sources: readonly string[] };
  readonly to: { readonly dataVersion: string; readonly datasetSha256: string; readonly sources: readonly string[] };
  readonly schemaChanged: boolean;
  readonly tables: readonly TableDiff[];
  readonly unchanged: readonly TableName[];
}

type Rec = Readonly<Record<string, unknown>>;

/** Identificador de um item de lista interna, pelo conteúdo. */
function itemId(x: unknown, i: number): string {
  if (x === null || x === undefined) return String(i);
  if (typeof x !== 'object') return String(x);
  const o = x as Rec;
  const id = o.key ?? o.tributo ?? o.modelo ?? o.treatment ?? o.prefix ?? o.short ?? i;
  const validity = o.validity as { from?: string } | undefined;
  return `${String(id)}${validity?.from ? `@${validity.from}` : ''}`;
}

function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(prefix, '[]');
    const seen = new Map<string, number>();
    value.forEach((x, i) => {
      let id = itemId(x, i);
      const n = (seen.get(id) ?? 0) + 1;
      seen.set(id, n);
      if (n > 1) id = `${id}#${n}`;
      flatten(x, `${prefix}[${id}]`, out);
    });
    return;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) out.set(prefix, '{}');
    for (const k of keys) flatten((value as Rec)[k], prefix ? `${prefix}.${k}` : k, out);
    return;
  }
  out.set(prefix, JSON.stringify(value));
}

export function changeKind(path: string): ChangeKind {
  if (/validity\.to$/.test(path)) return 'fim-de-vigencia';
  if (/validity\.from$/.test(path)) return 'inicio-de-vigencia';
  if (/^groups\./.test(path)) return 'indicador-de-grupo';
  if (/^dfe(\[|$)/.test(path)) return 'dfe';
  if (/^(reductions|fixedRates)(\[|$)|pRed|^rate|pRedutor|percent/.test(path)) return 'reducao-ou-aliquota';
  if (/^expr\.|^flags\.|^treatments(\[|$)/.test(path)) return 'expressao-de-calculo';
  if (/^(prefix|exceptions|annexItem|nbs|cIndOp)/.test(path)) return 'aplicabilidade';
  if (/description|name|legal|memoriaTemplate|text|note|title/.test(path)) return 'texto';
  return 'outro';
}

function diffTable(table: TableName, a: readonly Rec[], b: readonly Rec[]): TableDiff | undefined {
  const ia = new Map(a.map((r) => [String(r.key), r]));
  const ib = new Map(b.map((r) => [String(r.key), r]));
  const added = [...ib.keys()].filter((k) => !ia.has(k)).sort();
  const removed = [...ia.keys()].filter((k) => !ib.has(k)).sort();
  const changed: RecordChange[] = [];
  const kinds: Partial<Record<ChangeKind, number>> = {};
  for (const [key, ra] of [...ia].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) {
    const rb = ib.get(key);
    if (!rb) continue;
    const fa = new Map<string, string>();
    const fb = new Map<string, string>();
    flatten(ra, '', fa);
    flatten(rb, '', fb);
    const paths = [...new Set([...fa.keys(), ...fb.keys()])].filter((p) => fa.get(p) !== fb.get(p)).sort();
    if (paths.length === 0) continue;
    const fields = paths.map((path): FieldChange => {
      const kind = changeKind(path);
      kinds[kind] = (kinds[kind] ?? 0) + 1;
      const from = fa.get(path);
      const to = fb.get(path);
      return { path, kind, ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) };
    });
    changed.push({ key, fields });
  }
  if (!added.length && !removed.length && !changed.length) return undefined;
  return { table, added, removed, changed, kinds };
}

export function diffDatasets(a: DatasetBundle, b: DatasetBundle): DatasetDiff {
  const shaA = new Map(a.manifest.tables.map((t) => [t.name, t.sha256]));
  const tables: TableDiff[] = [];
  const unchanged: TableName[] = [];
  const names = [...new Set([...a.manifest.tables.map((t) => t.name), ...b.manifest.tables.map((t) => t.name)])];
  for (const name of names) {
    const tb = b.manifest.tables.find((t) => t.name === name);
    if (tb && shaA.get(name) === tb.sha256) {
      unchanged.push(name);
      continue;
    }
    const ta = (a.tables as unknown as Record<string, readonly Rec[] | undefined>)[name] ?? [];
    const tbRecords = (b.tables as unknown as Record<string, readonly Rec[] | undefined>)[name] ?? [];
    const d = diffTable(name, ta, tbRecords);
    if (d) tables.push(d);
    else unchanged.push(name);
  }
  const side = (x: DatasetBundle): DatasetDiff['from'] => ({
    dataVersion: x.manifest.dataVersion,
    datasetSha256: x.manifest.datasetSha256,
    sources: x.manifest.sources.map((s) => `${s.id} ${s.version}`),
  });
  return {
    from: side(a),
    to: side(b),
    schemaChanged: a.manifest.dataSchemaVersion !== b.manifest.dataSchemaVersion,
    tables,
    unchanged,
  };
}

/** Resumo em Markdown do diff, para o corpo do PR de atualização do pacote. `limit` corta cada lista. */
export function formatDiff(diff: DatasetDiff, limit = 20): string {
  const out: string[] = [];
  out.push(`# ibs-cbs-dados ${diff.from.dataVersion} -> ${diff.to.dataVersion}`, '');
  out.push(`- de: ${diff.from.sources.join(', ')} (${diff.from.datasetSha256.slice(0, 12)})`);
  out.push(`- para: ${diff.to.sources.join(', ')} (${diff.to.datasetSha256.slice(0, 12)})`);
  if (diff.schemaChanged) out.push('- **mudança de formato (dataSchemaVersion)**');
  out.push('');
  if (diff.tables.length === 0) out.push('Nenhuma tabela mudou.');
  for (const t of diff.tables) {
    const kinds = Object.entries(t.kinds)
      .map(([k, n]) => `${k} ${n}`)
      .join(', ');
    out.push(
      `## ${t.table}: +${t.added.length} -${t.removed.length} ~${t.changed.length}${kinds ? ` (${kinds})` : ''}`,
    );
    for (const k of t.added.slice(0, limit)) out.push(`- incluído \`${k}\``);
    for (const k of t.removed.slice(0, limit)) out.push(`- removido \`${k}\``);
    for (const c of t.changed.slice(0, limit)) {
      for (const f of c.fields.slice(0, limit)) {
        out.push(`- \`${c.key}\` ${f.path}: ${f.from ?? '(ausente)'} -> ${f.to ?? '(ausente)'}`);
      }
    }
    const hidden = Math.max(0, t.added.length - limit) + Math.max(0, t.removed.length - limit);
    const hiddenChanged = Math.max(0, t.changed.length - limit);
    if (hidden || hiddenChanged) out.push(`- (mais ${hidden + hiddenChanged} omitidos; veja o JSON)`);
    out.push('');
  }
  out.push(`Sem mudança: ${diff.unchanged.join(', ') || '(nenhuma)'}`);
  return `${out.join('\n')}\n`;
}
