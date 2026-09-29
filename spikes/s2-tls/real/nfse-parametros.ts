// Operação permitida 5 (parte 1): GET parâmetros do convênio de São Paulo (3550308) na Sefin Nacional, produção restrita.
// Primeira tentativa na Sefin (/API/SefinNacional/parametros_municipais/3550308/convenio, do manual v1.0) deu 404; o caminho vigente é o do ADN.
import { mkdirSync, writeFileSync } from "node:fs";
import { loadCert } from "./cert.ts";
import { send } from "./transport.ts";
const HERE = new URL(".", import.meta.url).pathname;
const url = "https://adn.producaorestrita.nfse.gov.br/parametrizacao/3550308/convenio"; // caminho do ADN; o da Sefin (manual v1.0) deu 404
const cert = loadCert();
const r = await send(cert, { url, method: "GET", service: "NFS-e parametros_municipais/convenio (SP capital)" });
console.log(JSON.stringify({ http: r.status, error: r.error ?? null, tls: r.tls, body: r.body.slice(0, 3000) }, null, 2));
mkdirSync(`${HERE}results`, { recursive: true });
writeFileSync(`${HERE}results/nfse-parametros-3550308.json`, JSON.stringify({ at: new Date().toISOString(), url, http: r.status, error: r.error ?? null, body: r.body }, null, 2) + "\n");
