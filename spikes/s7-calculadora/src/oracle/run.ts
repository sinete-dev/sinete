// Harness diferencial: gera operações VÁLIDAS segundo o dataset, chama POST /regime-geral no container offline,
// compara com o calculate() ingênuo (duas variantes de arredondamento) e categoriza as divergências.
// Uso: bun src/oracle/run.ts <datasetDir> [--n 400] [--seed 7] [--api http://127.0.0.1:18080/api]
import { Database } from "bun:sqlite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { canonical } from "../lib";
import { makeEngine, fmtX, applicableNcm, type Op, type Item } from "./engine";

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => (argv.includes("--" + k) ? argv[argv.indexOf("--" + k) + 1] : d);
const dir = argv[0];
const N = Number(opt("n", "400")), API = opt("api", "http://127.0.0.1:18080/api");
const T = (n: string) => JSON.parse(readFileSync(join(dir, "tables", n + ".json"), "utf8"));
const ds = { classTrib: T("classTrib"), cst: T("cst"), treatments: T("treatments"), rates: T("rates") };
const ncmApp = T("ncmApplicability"), nbsApp = T("nbsApplicability"), nfseNbs = T("nfseNbsClassTrib");
const isNcm = new Set(T("rates").adValoremPorNcm.map((r: any) => r.ncm.slice(0, 4)));
const ledger = JSON.parse(readFileSync("src/oracle/ledger.json", "utf8"));
const db = new Database(opt("db", `${process.env.HOME}/.local/state/sinete/s7/pkg/rootfs/calculadora/calculadora/db/calculadora-pro.db`), { readonly: true });
const allNcm: string[] = db.query("select NCM_CD c from NCM where length(NCM_CD)=8 and NCM_FIM_VIGENCIA >= '2033-12-31'").all().map((r: any) => r.c);
const allNbs: string[] = db.query("select NBS_CD c from NBS where length(NBS_CD)=9 and coalesce(NBS_FIM_VIGENCIA,'9999-12-31') >= '2033-12-31'").all().map((r: any) => r.c);

// PRNG determinístico (mulberry32)
let s = Number(opt("seed", "7")) >>> 0;
const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const inForce = (v: any, d: string) => v.from <= d && (!v.to || v.to >= d);

// Perfis: produtor rural / agro (NF-e) e empresa de serviços (NFS-e). Pesos maiores nos códigos do público-alvo.
const RURAL = ["000001", "200003", "200014", "200034", "200036", "200038", "410014", "410001", "410002", "410004", "515001", "510001", "550001"];
const SERV = ["000001", "011001", "200029", "200030", "200032", "200040", "200043", "410004", "410027", "410999"];

function itemFor(code: string, date: string, dfeModel: number, n: number, nominal?: Item["aliquotasNominais"]): Item | null {
  const ct = ds.classTrib.find((c: any) => c.family === "CBS_IBS" && c.code === code && inForce(c.validity, date));
  if (!ct || !ct.dfe.some((x: any) => x.modelo === dfeModel && inForce(x.validity, date))) return null;
  let ncm: string | undefined, nbs: string | undefined;
  const year = Number(date.slice(0, 4));
  if (dfeModel === 91) {
    const rows = nfseNbs.filter((r: any) => r.cClassTrib === code && r.onerosa && !r.adquirenteExterior && inForce(r.validity, date));
    if (!rows.length) return null;
    nbs = pick(rows).nbs;
  } else {
    // candidatos: NCM completos; filtra pela regra de aplicabilidade do dataset e, a partir de 2027, fora do IS
    const nApp = ncmApp.filter((a: any) => a.family === "CBS_IBS" && a.cClassTrib === code && inForce(a.validity, date));
    const pool = nApp.length ? allNcm.filter((x) => nApp.some((a: any) => x.startsWith(a.ncmPrefix))) : allNcm;
    for (let t = 0; t < 30 && !ncm; t++) {
      const c = pick(pool); if (!c) break;
      if (year >= 2027 && isNcm.has(c.slice(0, 4))) continue;
      if (applicableNcm(ncmApp, code, c, date) !== "no") ncm = c;
    }
    if (!ncm) return null;
  }
  // bases: centavos aleatórios + bordas de arredondamento (x5 com 0,1% dá meio centavo exato)
  const edge = rnd() < 0.3;
  const base = edge ? (5 + 10 * Math.floor(rnd() * 200)).toFixed(2) : (rnd() < 0.5 ? rnd() * 100 : rnd() * 100000).toFixed(2);
  const cst = ct.cst;
  const trId = ct.treatments.find((t: any) => inForce(t.validity, date))?.treatment;
  const tr = ds.treatments.find((t: any) => t.id === trId);
  const tributacaoRegular = tr?.flags.exigeGrupoTribRegular ? { cst: "000", cClassTrib: "000001" } : undefined;
  return { numero: n, cst, cClassTrib: code, baseCalculo: base, quantidade: "1", ncm, nbs, ...(nominal ? { aliquotasNominais: nominal } : {}), ...(tributacaoRegular ? { tributacaoRegular } : {}) } as Item;
}

function genOp(i: number): Op | null {
  const y = rnd() < 0.75 ? 2026 : pick([2027, 2028]);
  const date = `${y}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`;
  const serv = rnd() < 0.4;
  const model = serv ? 91 : 55;
  const pool = rnd() < 0.8 ? (serv ? SERV : RURAL) : ds.classTrib.filter((c: any) => c.family === "CBS_IBS").map((c: any) => c.code);
  const nominal = y >= 2027 ? { cbs: pick(["8.8", "8.7", "9.25"]), ibsEstadual: "0.05", ibsMunicipal: "0.05" } : undefined;
  const itens: Item[] = [];
  for (let k = 0; k < 1 + Math.floor(rnd() * 3) && itens.length < 3; k++) {
    for (let tries = 0; tries < 10; tries++) { const it = itemFor(pick(pool), date, model, itens.length + 1, nominal); if (it) { itens.push(it); break; } }
  }
  if (!itens.length) return null;
  return { date, tpDoc: model, compraGov: rnd() < 0.05, itens };
}

const toApi = (op: Op, i: number) => ({
  id: `s7-${i}`, versao: "0.0.1", dhFatoGerador: `${op.date}T10:00:00-03:00`, municipio: 4314902, uf: "RS", tpDoc: op.tpDoc,
  ...(op.compraGov ? { gCompraGov: { tpEnteGov: 1 } } : {}),
  itens: op.itens.map((it) => ({ ...it, baseCalculo: Number(it.baseCalculo), quantidade: 1, unidade: "UN" })),
});

// ---------- comparação ----------
const K: Record<string, [string, string]> = { IBSUF: ["gIBSUF", "IBSUF"], IBSMun: ["gIBSMun", "IBSMun"], CBS: ["gCBS", "CBS"] };
function compare(engine: any, oracle: any): { field: string; ours: string | null; theirs: string | null }[] {
  const diffs: any[] = [];
  const near = (a: string | null, b: string | null, tol: number) => (a === null || b === null ? a === b : Math.abs(Number(a) - Number(b)) <= tol + 1e-9);
  const push = (field: string, ours: any, theirs: any, tol: number) => { const o = ours ?? null, t = theirs ?? null; if (!near(o, t, tol)) diffs.push({ field, ours: o, theirs: t }); };
  for (const it of engine.itens) {
    const ob = oracle.objetos.find((o: any) => o.nObj === it.numero)?.tribCalc?.IBSCBS;
    const og = ob?.gIBSCBS ?? null;
    if (!!it.gIBSCBS !== !!og) { diffs.push({ field: `item${it.numero}.gIBSCBS.presenca`, ours: String(!!it.gIBSCBS), theirs: String(!!og) }); continue; }
    if (!og) continue;
    push(`item.vBC`, fmtX(it.gIBSCBS.vBC, 2, "HALF_EVEN"), og.vBC, 0.01);
    for (const [trib, [grp, sfx]] of Object.entries(K)) {
      const e = it.gIBSCBS.entes[trib], o = og[grp];
      push(`item.${trib}.p`, fmtX(e.p, 4, "HALF_EVEN"), o?.[`p${sfx}`], 0.0001);
      push(`item.${trib}.v`, e.vOut, o?.[`v${sfx}`], 0.01);
      push(`item.${trib}.pRedAliq`, e.pRed === null ? null : fmtX(e.pRed, 2, "HALF_EVEN"), o?.gRed?.pRedAliq ?? null, 0.0001);
      push(`item.${trib}.pAliqEfet`, e.pAliqEfet === null ? null : fmtX(e.pAliqEfet, 4, "HALF_EVEN"), o?.gRed?.pAliqEfet ?? null, 0.0001);
      push(`item.${trib}.vDif`, e.vDif === null ? null : fmtX(e.vDif, 2, "HALF_EVEN"), o?.gDif?.vDif ?? null, 0.01);
    }
  }
  const t = oracle.total?.tribCalc?.IBSCBSTot;
  if (t) {
    push("total.vCBS", engine.totalOut.CBS, t.gCBS?.vCBS, 0.01);
    push("total.vIBSUF", engine.totalOut.IBSUF, t.gIBS?.gIBSUF?.vIBSUF, 0.01);
  }
  return diffs;
}

// igualdade exata (tolerância zero) dos valores monetários por item, para medir o efeito do modo de arredondamento
function exactEqual(engine: any, oracle: any) {
  for (const it of engine.itens) {
    const og = oracle.objetos.find((o: any) => o.nObj === it.numero)?.tribCalc?.IBSCBS?.gIBSCBS;
    if (!og || !it.gIBSCBS) continue;
    for (const [trib, [grp, sfx]] of Object.entries(K)) if (it.gIBSCBS.entes[trib].vOut !== og[grp]?.[`v${sfx}`]) return false;
  }
  return true;
}
// categoria de uma divergência: primeiro o ledger (conhecidas), depois heurísticas
function categorize(op: Op, d: any, variant: string): string {
  for (const L of ledger.entries) {
    const m = L.match;
    if (m.oracleError) continue;
    if (m.compraGov !== undefined && !!op.compraGov !== m.compraGov) continue;
    if (m.cClassTrib && !op.itens.some((i) => m.cClassTrib.includes(i.cClassTrib))) continue;
    if (m.field && !new RegExp(m.field).test(d.field)) continue;
    if (m.yearFrom && Number(op.date.slice(0, 4)) < m.yearFrom) continue;
    if (m.variant && m.variant !== variant) continue;
    return `ledger:${L.id}`;
  }
  if (/\.v$|total/.test(d.field) && d.ours && d.theirs && Math.abs(Number(d.ours) - Number(d.theirs)) <= 0.0100001) return "arredondamento-1-centavo";
  if (/presenca/.test(d.field)) return "presenca-de-grupo";
  if (/pRedAliq|pAliqEfet/.test(d.field)) return "reducao";
  if (/\.p$/.test(d.field)) return "aliquota";
  return "outro";
}

mkdirSync("results/oracle", { recursive: true });
const engines = { HALF_EVEN: makeEngine(ds, "HALF_EVEN"), HALF_UP: makeEngine(ds, "HALF_UP") };
const summary: any = { n: 0, oracleErrors: {}, unsupported: {}, variants: {} as any, ledgerHits: {} as Record<string, number> };
const cases: any[] = [];
let i = 0, attempts = 0;
const t0 = performance.now();
while (summary.n < N && attempts < N * 5) {
  attempts++;
  const op = genOp(i++); if (!op) continue;
  const res = await fetch(`${API}/calculadora/regime-geral`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(toApi(op, i)) });
  const body = await res.json().catch(() => null);
  summary.n++;
  if (!res.ok) {
    const msg = String(body?.detail ?? body?.title ?? body?.erros?.[0]?.mensagem ?? JSON.stringify(body)).slice(0, 140);
    const L = ledger.entries.find((L: any) => L.match.oracleError && msg.includes(L.match.oracleError));
    const key = L ? `ledger:${L.id}` : msg;
    summary.oracleErrors[key] = (summary.oracleErrors[key] ?? 0) + 1;
    if (L) summary.ledgerHits[`oracle:${key}`] = (summary.ledgerHits[`oracle:${key}`] ?? 0) + 1;
    cases.push({ op, oracle: { status: res.status, body } });
    continue;
  }
  const c: any = { op, oracle: body, results: {} };
  for (const [name, calc] of Object.entries(engines)) {
    const v = (summary.variants[name] ??= { compared: 0, agree: 0, divergentOps: 0, byCategory: {} });
    const r = calc(op);
    if (r.kind === "unsupported") { if (name === "HALF_EVEN") summary.unsupported[r.reason] = (summary.unsupported[r.reason] ?? 0) + 1; c.results[name] = r; continue; }
    // formatação de saída por variante (é aqui que HALF_UP e HALF_EVEN se separam)
    for (const it of r.itens) if (it.gIBSCBS) for (const e of Object.values<any>(it.gIBSCBS.entes)) e.vOut = fmtX(e.v, 2, name as any);
    (r as any).totalOut = Object.fromEntries(["CBS", "IBSUF", "IBSMun"].map((k) => [k, fmtX(r.itens.reduce((a: bigint, it: any) => a + (it.gIBSCBS ? BigInt(Math.round(Number(it.gIBSCBS.entes[k].vOut) * 100)) * 10n ** 28n : 0n), 0n), 2, "HALF_EVEN")]));
    const diffs = compare(r, body);
    v.compared++;
    if (!diffs.length) v.agree++; else v.divergentOps++;
    if (!diffs.length && exactEqual(r, body)) v.exact = (v.exact ?? 0) + 1;
    const cats = diffs.map((d) => ({ ...d, category: categorize(op, d, name) }));
    for (const d of cats) { v.byCategory[d.category] = (v.byCategory[d.category] ?? 0) + 1; if (d.category.startsWith("ledger:")) summary.ledgerHits[`${name}:${d.category}`] = (summary.ledgerHits[`${name}:${d.category}`] ?? 0) + 1; }
    c.results[name] = { diffs: cats };
  }
  cases.push(c);
}
summary.elapsedMs = Math.round(performance.now() - t0);
for (const v of Object.values<any>(summary.variants)) { v.agreementRate = v.compared ? +(v.agree / v.compared).toFixed(4) : null; v.exactRate = v.compared ? +((v.exact ?? 0) / v.compared).toFixed(4) : null; }
summary.compraGovOps = cases.filter((c) => c.op.compraGov).length;
// entradas do ledger que não dispararam nenhuma vez: candidatas a remoção (no CI isto falha)
summary.staleLedger = ledger.entries.filter((L: any) => !Object.keys(summary.ledgerHits).some((k) => k.endsWith(`ledger:${L.id}`)) && L.expectHits).map((L: any) => L.id);
writeFileSync("results/oracle/summary.json", canonical(summary));
writeFileSync(`${process.env.HOME}/.local/state/sinete/s7/oracle-cases.json`, canonical(cases));
const div = cases.filter((c) => c.results?.HALF_EVEN?.diffs?.some((d: any) => !d.category.startsWith("ledger:")));
writeFileSync("results/oracle/unexplained-HALF_EVEN.json", canonical(div.slice(0, 30)));
console.log(JSON.stringify(summary, null, 1));
