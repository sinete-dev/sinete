#!/usr/bin/env bun
/**
 * Diff semântico entre duas IRs (o que o revisor lê quando chega uma NT nova): caminhos de elemento e atributo
 * adicionados, removidos e com ocorrência (inclusive a dos grupos em volta), tipo, faceta, ordem, namespace, unique,
 * fixed, conteúdo simples ou anyAttribute alterados.
 *
 * Uso: bun src/diff.ts nfe/PL_010e nfe/PL_010f   (subpaths de ir/)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ComplexIR, ParticleIR, SchemaIR, SimpleIR } from './ir.ts';

const irDir = path.resolve(import.meta.dir, '../ir');

interface Leaf {
  /** Ocorrência do elemento seguida dos grupos em volta que mudam a cardinalidade (sequence não 1..1, choice e ramo). */
  readonly occ: string;
  /** Tipo nomeado e o embutido na raiz (um tipo que troca de base sem trocar de nome aparece). */
  readonly type: string;
  readonly facets: string;
  /** Namespace, xs:unique, fixed, conteúdo simples e anyAttribute, quando houver. */
  readonly extra: string;
  /** Ordem dos elementos filhos (tipo complexo): comparada só entre os nomes que existem nos dois lados. */
  readonly order?: readonly string[];
}

function leaves(ir: SchemaIR): Map<string, Leaf> {
  const out = new Map<string, Leaf>();
  const facets = (s: SimpleIR): string => JSON.stringify(s.facets);
  const typeName = (s: SimpleIR): string => `${s.name ?? s.chain[0] ?? s.builtin} (${s.builtin})`;
  const max = (m: number | string): string => (m === 'unbounded' || m === Number.POSITIVE_INFINITY ? 'n' : String(m));
  const card = (p: { min: number; max: number }): string => `${p.min}..${max(p.max)}`;
  const childOrder = (p: ParticleIR | undefined, acc: string[]): string[] => {
    if (!p) return acc;
    if (p.k === 'el') acc.push(p.name);
    else if (p.k === 'any') acc.push('*');
    else for (const i of p.items) childOrder(i, acc);
    return acc;
  };
  const walkCT = (c: ComplexIR | undefined, base: string, depth: number): void => {
    if (!c || depth > 40) return;
    for (const a of c.attrs) {
      out.set(`${base}/@${a.name}`, {
        occ: a.required ? '1' : '0..1',
        type: typeName(a.type),
        facets: facets(a.type),
        extra: a.fixed === undefined ? '' : `fixed=${a.fixed}`,
      });
    }
    const walkP = (p: ParticleIR, ctx: string): void => {
      if (p.k === 'any') {
        out.set(`${base}/*`, { occ: `${card(p)}${ctx}`, type: 'xs:any', facets: '', extra: '' });
        return;
      }
      if (p.k === 'el') {
        const pp = `${base}/${p.name}`;
        const occ = `${card(p)}${ctx}`;
        const extra = [p.ns === c.ns ? '' : `ns=${p.ns}`, p.unique ? `unique=${p.unique.join(',')}` : '']
          .filter(Boolean)
          .join(' ');
        if ('ref' in p.type) {
          const t = ir.complex[p.type.ref];
          const ct = [
            extra,
            t?.text ? `texto=${typeName(t.text)} ${facets(t.text)}` : '',
            t?.anyAttribute ? 'anyAttribute' : '',
          ]
            .filter(Boolean)
            .join(' ');
          out.set(pp, { occ, type: p.type.ref, facets: '', extra: ct, order: childOrder(t?.content, []) });
          walkCT(t, pp, depth + 1);
        } else out.set(pp, { occ, type: typeName(p.type), facets: facets(p.type), extra });
        return;
      }
      p.items.forEach((item, k) => {
        const g =
          p.k === 'choice'
            ? ` choice[${card(p)}] ramo ${k + 1}`
            : p.min === 1 && p.max === 1
              ? ''
              : ` sequence[${card(p)}]`;
        walkP(item, `${ctx}${g}`);
      });
    };
    if (c.content) walkP(c.content, '');
  };
  for (const r of ir.roots) {
    const t = ir.complex[r.type];
    out.set(`/${r.name}`, {
      occ: '1',
      type: r.type,
      facets: '',
      extra: `ns=${r.ns}`,
      order: childOrder(t?.content, []),
    });
    walkCT(t, `/${r.name}`, 0);
  }
  return out;
}

const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error('uso: bun src/diff.ts <subpath antigo> <subpath novo>');
  process.exit(2);
}
const load = (s: string): SchemaIR => JSON.parse(readFileSync(path.join(irDir, `${s}.json`), 'utf8')) as SchemaIR;
const a = load(from);
const b = load(to);
const la = leaves(a);
const lb = leaves(b);
const added = [...lb.keys()].filter((k) => !la.has(k));
const removed = [...la.keys()].filter((k) => !lb.has(k));
const changed: string[] = [];
for (const [k, x] of la) {
  const y = lb.get(k);
  if (!y) continue;
  const d: string[] = [];
  if (x.occ !== y.occ) d.push(`ocorrência ${x.occ} -> ${y.occ}`);
  if (x.type !== y.type) d.push(`tipo ${x.type} -> ${y.type}`);
  if (x.facets !== y.facets) d.push(`facetas ${x.facets} -> ${y.facets}`);
  if (x.extra !== y.extra) d.push(`${x.extra || '(nada)'} -> ${y.extra || '(nada)'}`);
  const common = (o: readonly string[] | undefined, other: readonly string[] | undefined): string[] =>
    (o ?? []).filter((n) => other?.includes(n));
  const oa = common(x.order, y.order).join(',');
  const ob = common(y.order, x.order).join(',');
  if (oa !== ob) d.push(`ordem dos filhos ${oa} -> ${ob}`);
  if (d.length > 0) changed.push(`${k}: ${d.join('; ')}`);
}
/** Só o caminho mais alto de cada subárvore nova ou removida. */
const top = (ks: string[]): string[] => {
  const s = [...ks].sort();
  return s.filter((k) => !s.some((o) => o !== k && k.startsWith(`${o}/`)));
};
console.log(`# ${a.pl} (${from}) -> ${b.pl} (${to})`);
console.log(
  `caminhos: ${la.size} -> ${lb.size}; adicionados ${added.length}, removidos ${removed.length}, alterados ${changed.length}\n`,
);
console.log(
  `## adicionados (topo da subárvore)\n${top(added)
    .map((x) => `+ ${x} [${lb.get(x)?.occ}]`)
    .join('\n')}`,
);
console.log(
  `\n## removidos (topo da subárvore)\n${top(removed)
    .map((x) => `- ${x}`)
    .join('\n')}`,
);
console.log(`\n## alterados\n${changed.map((x) => `~ ${x}`).join('\n')}`);
