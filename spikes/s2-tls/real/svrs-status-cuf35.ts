// Diagnóstico da rejeição 410 na SVRS: status de serviço (operação já permitida) com cUF=35 na SVRS homologação.
import { loadCert } from "./cert.ts";
import { nfeStatus, pick } from "./soap.ts";
import { send } from "./transport.ts";
const cert = loadCert();
const m = nfeStatus("35");
const r = await send(cert, { url: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx", body: m.body, contentType: m.contentType, service: "NfeStatusServico cUF=35 na SVRS (diagnóstico 410)" });
console.log(r.status, pick(r.body, "cStat"), pick(r.body, "xMotivo"), pick(r.body, "cUF"));
