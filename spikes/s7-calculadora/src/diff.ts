// Diff semântico entre duas versões do dataset rtc-data.
// Uso: bun src/diff.ts <dirAntigo> <dirNovo> [--json saida.json]
// Cada tabela é uma lista de registros com `key` estável (código + início de vigência), ou um objeto de listas.
// Saída: por tabela, registros incluídos, removidos e alterados com o caminho de cada campo alterado,
// mais uma classificação por tipo de mudança, no formato das seções "Alterações na versão" do IT.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonical } from "./lib";

type Rec = Record<string, any>;
const [a, bDir] = process.argv.slice(2).filter((x) => !x.startsWith("--"));
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
const ma = JSON.parse(readFileSync(join(a, "manifest.json"), "utf8"));
const mb = JSON.parse(readFileSync(join(bDir, "manifest.json"), "utf8"));

function flatten(o: any, p = ""): Record<string, string> {
  if (o === null || typeof o !== "object") return { [p]: JSON.stringify(o) };
  const out: Record<string, string> = {};
  if (Array.isArray(o)) {
    // listas de sub-registros com vigência: indexa por conteúdo identificador, não por posição
    o.forEach((x, i) => {
      const id = x && typeof x === "object" ? (x.key ?? x.sigla ?? x.tributo ?? x.ncmPrefix ?? x.treatment ?? x.short ?? i) + (x.validity?.from ? "@" + x.validity.from : "") : String(i);
      Object.assign(out, flatten(x, `${p}[${id}]`));
    });
    if (o.length === 0) out[p] = "[]";
    return out;
  }
  for (const k of Object.keys(o)) Object.assign(out, flatten(o[k], p ? `${p}.${k}` : k));
  return out;
}

function diffList(A: Rec[], B: Rec[]) {
  const ia = new Map(A.map((r) => [r.key, r])), ib = new Map(B.map((r) => [r.key, r]));
  const added = [...ib.keys()].filter((k) => !ia.has(k));
  const removed = [...ia.keys()].filter((k) => !ib.has(k));
  const changed: { key: string; fields: { path: string; from?: string; to?: string }[] }[] = [];
  for (const [k, ra] of ia) {
    const rb = ib.get(k);
    if (!rb) continue;
    const fa = flatten(ra), fb = flatten(rb);
    const paths = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].filter((p) => fa[p] !== fb[p]).sort();
    if (paths.length) changed.push({ key: k, fields: paths.map((p) => ({ path: p, from: fa[p], to: fb[p] })) });
  }
  return { added, removed, changed };
}

// Regras de classificação: que tipo de mudança é essa (para o resumo humano e para política de release)
function kind(table: string, path: string): string {
  if (/validity\.to$/.test(path)) return "fim-de-vigencia";
  if (/validity\.from$/.test(path)) return "inicio-de-vigencia-alterado(retroativo?)";
  if (/^groups\./.test(path)) return "indicador-de-grupo";
  if (/^dfe\[/.test(path)) return "dfe-habilitado/desabilitado";
  if (/^reductions|pRed|aliquota/.test(path)) return "reducao/aliquota";
  if (/^expr\./.test(path)) return "expressao-de-calculo";
  if (/description|memoriaTemplate|legal/.test(path)) return "texto";
  return "outro";
}

const report: any = { from: { versaoDb: ma.sources[0].versaoDb, package: ma.packageVersion }, to: { versaoDb: mb.sources[0].versaoDb, package: mb.packageVersion }, schema: [ma.dataSchemaVersion, mb.dataSchemaVersion], tables: {} };
if (ma.dataSchemaVersion !== mb.dataSchemaVersion) report.schemaChange = true;
const unchanged: string[] = [];
for (const f of mb.files) {
  const fa = ma.files.find((x: any) => x.path === f.path);
  if (fa?.sha256 === f.sha256) { unchanged.push(f.path); continue; }
  const A = fa ? JSON.parse(readFileSync(join(a, f.path), "utf8")) : [];
  const B = JSON.parse(readFileSync(join(bDir, f.path), "utf8"));
  const pairs: [string, Rec[], Rec[]][] = Array.isArray(B)
    ? [[f.path, A, B]]
    : Object.keys({ ...A, ...B }).filter((k) => Array.isArray(B[k] ?? A[k])).map((k) => [`${f.path}#${k}`, A[k] ?? [], B[k] ?? []]);
  for (const [name, la, lb] of pairs) {
    const d = diffList(la, lb);
    if (!d.added.length && !d.removed.length && !d.changed.length) continue;
    const kinds: Record<string, number> = {};
    for (const c of d.changed) for (const x of c.fields) kinds[kind(name, x.path)] = (kinds[kind(name, x.path)] ?? 0) + 1;
    report.tables[name] = { added: d.added, removed: d.removed, changed: d.changed, changeKinds: kinds };
  }
}
report.unchangedFiles = unchanged;
if (jsonOut) writeFileSync(jsonOut, canonical(report));

// resumo legível (vai no corpo do PR de atualização do pacote)
console.log(`# rtc-data ${report.from.versaoDb} -> ${report.to.versaoDb}\n`);
for (const [t, d] of Object.entries<any>(report.tables)) {
  console.log(`## ${t}: +${d.added.length} -${d.removed.length} ~${d.changed.length} ${JSON.stringify(d.changeKinds)}`);
  for (const k of d.added.slice(0, 10)) console.log(`  + ${k}`);
  for (const k of d.removed.slice(0, 10)) console.log(`  - ${k}`);
  for (const c of d.changed.slice(0, 10)) for (const x of c.fields.slice(0, 4)) console.log(`  ~ ${c.key} ${x.path}: ${x.from} -> ${x.to}`);
}
console.log(`\nsem mudança: ${unchanged.join(", ") || "(nenhum)"}`);
