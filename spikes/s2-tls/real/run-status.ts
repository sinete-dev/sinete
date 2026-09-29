// Operação permitida 1: NfeStatusServico em todos os autorizadores de homologação + MDF-e status.
// Uma chamada por alvo por runtime. Uso: bun run-status.ts | node run-status.ts [trace] | deno run -A run-status.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadCert } from "./cert.ts";
import { mdfeStatus, nfeStatus, pick } from "./soap.ts";
import { runtime, send } from "./transport.ts";

declare const Deno: any;
const args: string[] = typeof Deno !== "undefined" ? Deno.args : process.argv.slice(2);
const trace = args.includes("trace");
const HERE = new URL(".", import.meta.url).pathname;
const ep = JSON.parse(readFileSync(`${HERE}../endpoints.json`, "utf8"));
const hom = ep.nfe.homologacao.authorizers;
const stripWsdl = (u: string) => u.replace(/\?wsdl$/i, "");

const targets: { label: string; url: string; cUF?: string; mdfe?: boolean }[] = [
  ["AM", "13"], ["BA", "29"], ["GO", "52"], ["MG", "31"], ["MS", "50"], ["MT", "51"], ["PE", "26"], ["PR", "41"], ["RS", "43"], ["SP", "35"],
  ["SVAN", "21"], ["SVRS", "42"], ["SVC-AN", "35"], ["SVC-RS", "52"],
].map(([a, cUF]) => ({ label: `NF-e ${a} (cUF ${cUF})`, url: stripWsdl(hom[a].NfeStatusServico.url), cUF }));
targets.push({ label: "MDF-e SVRS", url: ep.mdfe.homologacao.MDFeStatusServico.url, mdfe: true });

// Deno (rustls): sem renegociação, sem CBC/DHE. Recusa explícita, sem tentar.
const DENO_INCOMPATIBLE = new Set(["hnfe.sefaz.ba.gov.br", "homologacao.sefaz.mt.gov.br", "homologacao.nfe.sefa.pr.gov.br", "homologacao.nfe.fazenda.sp.gov.br", "hom.sefazvirtual.fazenda.gov.br", "hom1.nfe.fazenda.gov.br"]);

const cert = loadCert();
console.log(`[${runtime}] cert ${cert.info.subject.replace(/.*CN=/, "CN=")} serial=${cert.info.serial} raiz=${cert.info.root}`);
const results: any[] = [];
for (const t of targets) {
  const host = new URL(t.url).hostname;
  if (runtime === "deno" && DENO_INCOMPATIBLE.has(host)) {
    results.push({ ...t, skipped: "incompatível com rustls (renegociação ou só CBC/DHE)" });
    console.log(`[deno] ${t.label}: recusado pelo transporte (incompatível)`);
    continue;
  }
  const msg = t.mdfe ? mdfeStatus() : nfeStatus(t.cUF!);
  if (trace) process.stderr.write(`\n@@REQ ${t.label} ${host}\n`);
  const r = await send(cert, { url: t.url, body: msg.body, contentType: msg.contentType, service: t.mdfe ? "MDFeStatusServico" : "NfeStatusServico", trace });
  const out = {
    label: t.label,
    host,
    http: r.status,
    error: r.error ?? null,
    cStat: pick(r.body, "cStat"),
    xMotivo: pick(r.body, "xMotivo"),
    verAplic: pick(r.body, "verAplic"),
    tMed: pick(r.body, "tMed"),
    fault: /Fault/.test(r.body) ? (pick(r.body, "soap:Text") ?? pick(r.body, "Text") ?? pick(r.body, "faultstring") ?? r.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200)) : null,
    tls: r.tls ?? null,
    ms: r.ms,
    bodyHead: r.status && !pick(r.body, "cStat") ? r.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 160) : undefined,
  };
  results.push(out);
  console.log(`[${runtime}] ${t.label}: HTTP ${out.http} cStat=${out.cStat} ${out.xMotivo ?? out.error ?? out.fault ?? out.bodyHead ?? ""} ${out.tls ? `${out.tls.protocol} ${out.tls.cipher}` : ""} ${r.ms}ms`);
  await new Promise((res) => setTimeout(res, 500));
}
mkdirSync(`${HERE}results`, { recursive: true });
writeFileSync(`${HERE}results/status-${runtime}.json`, `${JSON.stringify({ runtime, at: new Date().toISOString(), cert: { subject: cert.info.subject, serial: cert.info.serial, root: cert.info.root, chain: cert.info.chain }, results }, null, 2)}\n`);
