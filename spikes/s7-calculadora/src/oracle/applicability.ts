// Concordância da regra de aplicabilidade NCM x cClassTrib do dataset (applicableNcm) com o endpoint da Calculadora.
import { Database } from "bun:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applicableNcm } from "./engine";
const dir = process.argv[2]; const API = "http://127.0.0.1:18080/api";
const ncmApp = JSON.parse(readFileSync(join(dir, "tables/ncmApplicability.json"), "utf8"));
const db = new Database(`${process.env.HOME}/.local/state/sinete/s7/pkg/rootfs/calculadora/calculadora/db/calculadora-pro.db`, { readonly: true });
const allNcm: string[] = db.query("select NCM_CD c from NCM where length(NCM_CD)=8 and NCM_FIM_VIGENCIA >= '2033-12-31'").all().map((r: any) => r.c);
let s = 11; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const codes = [...new Set(ncmApp.filter((a: any) => a.family === "CBS_IBS").map((a: any) => a.cClassTrib))] as string[];
const date = "2026-09-25"; let agree = 0, n = 0; const dis: any[] = []; const t0 = performance.now();
for (let i = 0; i < 3000; i++) {
  const code = codes[Math.floor(rnd() * codes.length)];
  const rows = ncmApp.filter((a: any) => a.family === "CBS_IBS" && a.cClassTrib === code);
  // metade perto do anexo (mesmo capítulo de um prefixo), metade aleatória
  const near = rnd() < 0.6 ? allNcm.filter((x) => x.startsWith(rows[Math.floor(rnd() * rows.length)].ncmPrefix.slice(0, 2))) : allNcm;
  const ncm = near[Math.floor(rnd() * near.length)];
  const ours = applicableNcm(ncmApp, code, ncm, date);
  const r = await (await fetch(`${API}/calculadora/dados-abertos/classificacoes-tributarias/ncm-aplicavel?cClassTrib=${code}&ncm=${ncm}&dataOcorrenciaFatoGerador=${date}`)).json();
  n++; const theirs = r.valido ? "yes" : "no";
  if ((ours !== "no") === r.valido) agree++; else dis.push({ code, ncm, ours, theirs });
}
const out = { n, agree, rate: +(agree / n).toFixed(4), ms: Math.round(performance.now() - t0), disagreements: dis.slice(0, 20) };
writeFileSync("results/oracle/applicability.json", JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ ...out, disagreements: dis.length }));
