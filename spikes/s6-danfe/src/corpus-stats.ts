// Agregados do corpus (sem imprimir dados pessoais): tamanhos e contagens.
import { XMLParser } from "fast-xml-parser";
import { readdirSync, readFileSync } from "node:fs";
const base = `${process.env.HOME}/.local/state/sinete/corpus`;
const p = new XMLParser({ ignoreAttributes: false, parseTagValue: false, isArray: (n) => ["det", "dup", "vol", "pag", "detPag", "obsCont", "NFref", "infCTe", "infNFe", "infMunDescarga", "detEvento"].includes(n) && false });
const pct = (a: number[], q: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
for (const dir of ["nfe-proprias", "nfe-importadas"]) {
  const files = readdirSync(`${base}/${dir}`).filter((f) => f.endsWith(".xml"));
  const det: number[] = [], xprod: number[] = [], infcpl: number[] = [], infadprod: number[] = [], dups: number[] = [];
  const tpImp: Record<string, number> = {}, mod: Record<string, number> = {}, tpEmis: Record<string, number> = {}, root: Record<string, number> = {};
  let nonLatin1 = 0, withRefs = 0, withTransp = 0, withISSQN = 0, withIBSCBS = 0, cancel = 0;
  for (const f of files) {
    const s = readFileSync(`${base}/${dir}/${f}`, "utf8");
    if (/[^\u0000-ÿ]/.test(s)) nonLatin1++;
    const o = p.parse(s);
    const r = Object.keys(o).find((k) => k !== "?xml")!; root[r] = (root[r] ?? 0) + 1;
    const inf = (o.nfeProc?.NFe ?? o.NFe)?.infNFe; if (!inf) continue;
    const d = [inf.det].flat(); det.push(d.length);
    for (const x of d) { xprod.push(String(x.prod.xProd).length); if (x.infAdProd) infadprod.push(String(x.infAdProd).length); if (x.imposto?.IBSCBS) withIBSCBS++; }
    infcpl.push(String(inf.infAdic?.infCpl ?? "").length + String(inf.infAdic?.infAdFisco ?? "").length);
    dups.push(inf.cobr?.dup ? [inf.cobr.dup].flat().length : 0);
    const ide = inf.ide; tpImp[ide.tpImp] = (tpImp[ide.tpImp] ?? 0) + 1; mod[ide.mod] = (mod[ide.mod] ?? 0) + 1; tpEmis[ide.tpEmis] = (tpEmis[ide.tpEmis] ?? 0) + 1;
    if (ide.NFref) withRefs++; if (inf.transp?.transporta) withTransp++; if (inf.total?.ISSQNtot) withISSQN++;
  }
  const stat = (n: string, a: number[]) => console.log(`  ${n}: n=${a.length} p50=${pct(a, .5)} p95=${pct(a, .95)} p99=${pct(a, .99)} max=${Math.max(...a)}`);
  console.log(dir, files.length, "roots", root);
  stat("det/nota", det); stat("xProd chars", xprod); stat("infAdProd chars", infadprod); stat("infCpl+infAdFisco chars", infcpl); stat("dup/nota", dups);
  console.log("  tpImp", tpImp, "mod", mod, "tpEmis", tpEmis, { nonLatin1, withRefs, withTransp, withISSQN, detComIBSCBS: withIBSCBS });
}
