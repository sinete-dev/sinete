// Spike S2: dá para forçar RSA PKCS#1 v1.5 (sem PSS) no CertificateVerify do cliente? Relevante para A3/assinador remoto.
// 1 requisição à SVRS homologação via capture-proxy; o proxy registra o sigScheme usado.
import https from "node:https";
import tls from "node:tls";
import { readFileSync } from "node:fs";
declare const Bun: any;
const cert = readFileSync("out/throwaway/client.crt", "utf8");
const key = readFileSync("out/throwaway/client.key", "utf8");
const icp = readFileSync("icp/icp-brasil-roots.pem", "utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)!.slice(0, 4);
const agent = new https.Agent({ cert, key, ca: [...tls.rootCertificates, ...icp], sigalgs: "RSA+SHA256:RSA+SHA384:RSA+SHA512", maxVersion: "TLSv1.2", proxyEnv: { HTTPS_PROXY: "http://127.0.0.1:18080" } } as never);
const req = https.request("https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx", { method: "POST", agent, headers: { "content-type": "application/soap+xml" } }, (res) => {
  res.resume();
  res.on("end", () => console.log(typeof Bun !== "undefined" ? "bun" : "node", "sigalgs=RSA+SHA*", res.statusCode));
});
req.on("error", (e) => console.log("ERR", e.message));
req.end("<x/>");
