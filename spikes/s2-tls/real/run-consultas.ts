// Operações permitidas 2 e 3: ConsultaCadastro (SP e RS, CNPJ da própria empresa) e DistDFe no AN, distNSU 0, uma chamada.
import { mkdirSync, writeFileSync } from "node:fs";
import { loadCert } from "./cert.ts";
import { consultaCadastro, distDFe, pick, pickAll } from "./soap.ts";
import { runtime, send } from "./transport.ts";

const CNPJ = "59554465000137";
const HERE = new URL(".", import.meta.url).pathname;
const cert = loadCert();
if (!cert.info.subject.includes(`:${CNPJ}`)) throw new Error("certificado não é do CNPJ esperado");

const calls = [
  { label: "ConsultaCadastro SP", url: "https://homologacao.nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx", msg: consultaCadastro("SP", CNPJ), service: "NfeConsultaCadastro" },
  { label: "ConsultaCadastro RS (SVRS)", url: "https://cad-homologacao.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx", msg: consultaCadastro("RS", CNPJ), service: "NfeConsultaCadastro" },
  { label: "DistDFe AN distNSU 0", url: "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx", msg: distDFe("35", CNPJ), service: "NFeDistribuicaoDFe" },
];
const out: any[] = [];
for (const c of calls) {
  const r = await send(cert, { url: c.url, body: c.msg.body, contentType: c.msg.contentType, service: c.service });
  const o = {
    label: c.label,
    http: r.status,
    error: r.error ?? null,
    cStat: pick(r.body, "cStat"),
    xMotivo: pick(r.body, "xMotivo"),
    ultNSU: pick(r.body, "ultNSU"),
    maxNSU: pick(r.body, "maxNSU"),
    docZip: pickAll(r.body, "docZip").length,
    infCad: /<infCad>/.test(r.body) ? { IE: pick(r.body, "IE"), cSit: pick(r.body, "cSit"), xNome: pick(r.body, "xNome") } : null,
    tls: r.tls ?? null,
    fault: /Fault/.test(r.body) ? r.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300) : null,
  };
  out.push(o);
  console.log(`[${runtime}] ${c.label}: HTTP ${o.http} cStat=${o.cStat} ${o.xMotivo ?? o.error ?? o.fault ?? ""} ${o.ultNSU ? `ultNSU=${o.ultNSU} maxNSU=${o.maxNSU} docZip=${o.docZip}` : ""}${o.infCad ? ` infCad=${JSON.stringify(o.infCad)}` : ""}`);
  await new Promise((res) => setTimeout(res, 500));
}
mkdirSync(`${HERE}results`, { recursive: true });
writeFileSync(`${HERE}results/consultas-${runtime}.json`, `${JSON.stringify({ runtime, at: new Date().toISOString(), out }, null, 2)}\n`);
