// Semantic diff between two generated IRs (what a reviewer reads when a new NT/PL arrives).
// Usage: bun src/gen/diff.ts PL_old PL_new
import { readFileSync } from "node:fs";
import type { ComplexIR, ParticleIR, SchemaIR, SimpleIR } from "./ir.ts";

const here = new URL("../..", import.meta.url).pathname;
const load = (pl: string): SchemaIR => JSON.parse(readFileSync(`${here}generated/${pl}/ir.json`, "utf8"));
const [a, b] = process.argv.slice(2).map(load);

interface Leaf { path: string; occ: string; type: string; facets: string }
function leaves(ir: SchemaIR): Map<string, Leaf> {
  const out = new Map<string, Leaf>();
  const st = (s: SimpleIR) => JSON.stringify(s.facets);
  const walkCT = (c: ComplexIR, path: string, depth: number) => {
    if (depth > 30) return;
    for (const at of c.attrs) out.set(`${path}/@${at.name}`, { path: `${path}/@${at.name}`, occ: at.required ? "1" : "0..1", type: at.type.name ?? at.type.chain[0] ?? at.type.builtin, facets: st(at.type) });
    const walkP = (p: ParticleIR, ctx: string) => {
      if (p.k === "el") {
        const pp = `${path}/${p.name}`;
        const occ = `${p.min}..${p.max === Infinity || (p.max as unknown) === "unbounded" ? "n" : p.max}${ctx}`;
        if ("ref" in p.type) {
          out.set(pp, { path: pp, occ, type: p.type.ref, facets: "" });
          walkCT(ir.complex[p.type.ref], pp, depth + 1);
        } else out.set(pp, { path: pp, occ, type: p.type.name ?? p.type.chain[0] ?? p.type.builtin, facets: st(p.type) });
        return;
      }
      const g = p.k === "choice" ? " (choice)" : "";
      for (const i of p.items) walkP(i, ctx || g);
    };
    if (c.content) walkP(c.content, "");
  };
  walkCT(a === ir ? ir.complex[ir.root.type] : ir.complex[ir.root.type], "/NFe", 0);
  return out;
}

const la = leaves(a), lb = leaves(b);
const added = [...lb.keys()].filter((k) => !la.has(k));
const removed = [...la.keys()].filter((k) => !lb.has(k));
const changed: string[] = [];
for (const [k, x] of la) {
  const y = lb.get(k);
  if (!y) continue;
  const d: string[] = [];
  if (x.occ !== y.occ) d.push(`occurs ${x.occ} -> ${y.occ}`);
  if (x.type !== y.type) d.push(`type ${x.type} -> ${y.type}`);
  if (x.facets !== y.facets) d.push(`facets ${x.facets} -> ${y.facets}`);
  if (d.length) changed.push(`${k}: ${d.join("; ")}`);
}
const collapse = (ks: string[]) => {
  // show only the top-most new/removed path of each subtree
  const s = [...ks].sort();
  return s.filter((k) => !s.some((o) => o !== k && k.startsWith(o + "/")));
};
console.log(`# ${a.pl} -> ${b.pl}`);
console.log(`leaf paths: ${la.size} -> ${lb.size}; added ${added.length}, removed ${removed.length}, changed ${changed.length}\n`);
console.log("## added (top of subtree)\n" + collapse(added).map((x) => `+ ${x} [${lb.get(x)!.occ}]`).join("\n"));
console.log("\n## removed (top of subtree)\n" + collapse(removed).map((x) => `- ${x}`).join("\n"));
console.log("\n## changed\n" + changed.map((x) => `~ ${x}`).join("\n"));
