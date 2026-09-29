// Descoberta read-only: histórico de alíquotas por cTribNac em São Paulo (3550308), ADN produção restrita.
import { loadCert } from "./cert.ts";
import { send } from "./transport.ts";
import { writeFileSync } from "node:fs";
const cert = loadCert();
const base = "https://adn.producaorestrita.nfse.gov.br/parametrizacao/3550308";
const paths = process.argv.slice(2);
const out: any[] = [];
for (const p of paths) {
  const r = await send(cert, { url: `${base}/${p}`, method: "GET", service: `NFS-e parametrizacao ${p} (leitura)` });
  out.push({ p, http: r.status, body: r.body.slice(0, 1500) });
  console.log(p, r.status, r.body.replace(/\s+/g, " ").slice(0, 400));
  await new Promise((res) => setTimeout(res, 300));
}
writeFileSync(`results/nfse-discover-${Date.now()}.json`, JSON.stringify(out, null, 2) + "\n");
