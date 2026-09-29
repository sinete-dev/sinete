// Verificação cruzada: dataset extraído do SQLite, projetado numa data, contra a API dados-abertos do container.
// Opcionalmente compara também offline x online numa amostra pequena (poucas chamadas, só leitura).
// Uso: bun src/crosscheck.ts <datasetDir> [--api http://127.0.0.1:18080/api] [--online N]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonical } from "./lib";

const dir = process.argv[2];
const api = process.argv.includes("--api") ? process.argv[process.argv.indexOf("--api") + 1] : "http://127.0.0.1:18080/api";
const onlineN = process.argv.includes("--online") ? Number(process.argv[process.argv.indexOf("--online") + 1]) : 0;
const ONLINE = "https://piloto-cbs.tributos.gov.br/servico/calculadora-consumo/api";
const T = (n: string) => JSON.parse(readFileSync(join(dir, "tables", n + ".json"), "utf8"));
const classTrib = T("classTrib"), cst = T("cst");
const inForce = (v: any, d: string) => v.from <= d && (!v.to || v.to >= d);
const num = (x: any) => (x === null || x === undefined ? null : Number(x));
const get = async (base: string, p: string) => { const r = await fetch(base + p); return r.ok ? r.json() : { __status: r.status }; };

const dates = ["2026-01-01", "2026-09-25", "2026-12-31", "2027-01-01", "2028-06-01", "2029-01-01", "2033-01-01"];
const report: any = { dates: {}, online: null };
for (const d of dates) {
  const apiList: any[] = await get(api, `/calculadora/dados-abertos/classificacoes-tributarias/cbs-ibs?data=${d}`);
  const apiCst: any[] = await get(api, `/calculadora/dados-abertos/situacoes-tributarias/cbs-ibs?data=${d}`);
  const local = classTrib.filter((c: any) => c.family === "CBS_IBS" && inForce(c.validity, d));
  const la = new Map(local.map((c: any) => [c.code, c]));
  const aa = new Map(apiList.map((c: any) => [c.codigo, c]));
  const mism: string[] = [];
  for (const k of new Set([...la.keys(), ...aa.keys()])) {
    const L: any = la.get(k), A: any = aa.get(k);
    if (!L || !A) { mism.push(`${k}: presente só em ${L ? "dataset" : "api"}`); continue; }
    const red = (t: string) => num(L.reductions.find((r: any) => r.tributo === t && inForce(r.validity, d))?.pRed ?? 0);
    const checks: [string, any, any][] = [
      ["tipoAliquota", L.rateKind, A.tipoAliquota], ["nomenclatura", L.nomenclature, A.nomenclatura],
      ["pRedCBS", red("CBS"), num(A.percentualReducaoCbs)], ["pRedIBSUF", red("IBSUF"), num(A.percentualReducaoIbsUf)], ["pRedIBSMun", red("IBSMun"), num(A.percentualReducaoIbsMun)],
      ["credAdqCbs", L.credit.buyerCbs, A.indicaApropriacaoCreditoAdquirenteCbs], ["credPresForn", L.credit.presumedSupplier, A.indicaCreditoPresumidoFornecedor],
      ["dfe", L.dfe.filter((x: any) => inForce(x.validity, d)).map((x: any) => x.modelo).sort().join(","), (A.tiposDfeClassificacao ?? []).map((x: any) => x.tipo).sort().join(",")],
    ];
    for (const [f, l, r] of checks) if (l !== r) mism.push(`${k}.${f}: dataset=${l} api=${r}`);
  }
  const localCst = cst.filter((c: any) => c.family === "CBS_IBS" && inForce(c.validity, d)).map((c: any) => c.code).sort().join(",");
  const apiCstCodes = apiCst.map((c: any) => c.codigo).sort().join(",");
  report.dates[d] = { classTribApi: apiList.length, classTribDataset: local.length, mismatches: mism.length, sample: mism.slice(0, 8), cstEqual: localCst === apiCstCodes, cstDataset: localCst, cstApi: apiCstCodes };
  console.log(d, JSON.stringify({ api: apiList.length, dataset: local.length, mismatches: mism.length, cstEqual: localCst === apiCstCodes }), mism.slice(0, 3).join(" | "));
}

if (onlineN > 0) {
  // amostra pequena e espaçada: o FAQ diz que a online não é API de integração; isto é só uma checagem de paridade
  const paths = [
    "/calculadora/dados-abertos/versao",
    "/calculadora/dados-abertos/classificacoes-tributarias/cbs-ibs?data=2026-09-25",
    "/calculadora/dados-abertos/situacoes-tributarias/cbs-ibs?data=2026-09-25&siglaDfe=NFE",
    "/calculadora/dados-abertos/aliquota-uniao?data=2026-09-25",
    "/calculadora/dados-abertos/classificacoes-tributarias/ncm-aplicavel?cClassTrib=200003&ncm=12019000&dataOcorrenciaFatoGerador=2026-09-25",
    "/calculadora/dados-abertos/classificacoes-tributarias/cbs-ibs/por-atores?data=2026-09-25&fornecedor=14&adquirente=22&siglaDfe=NFE",
  ].slice(0, onlineN);
  report.online = [];
  for (const p of paths) {
    const [o, n] = [await get(api, p), await get(ONLINE, p)];
    const eq = canonical({ ...o, ambiente: undefined, versaoApp: undefined }) === canonical({ ...n, ambiente: undefined, versaoApp: undefined });
    report.online.push({ path: p, equal: eq, offline: Array.isArray(o) ? o.length : o, online: Array.isArray(n) ? n.length : n });
    console.log("online", eq ? "IGUAL" : "DIFERENTE", p);
    await Bun.sleep(1500);
  }
}
writeFileSync("results/crosscheck.json", canonical(report));
