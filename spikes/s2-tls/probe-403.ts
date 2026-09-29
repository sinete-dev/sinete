// Spike S2: corpo completo da recusa com e sem certificado descartável (1 requisição cada), e alerta num host que exige cert no handshake.
import https from "node:https";
import tls from "node:tls";
import { readFileSync } from "node:fs";
const cert = readFileSync("out/throwaway/client.crt", "utf8");
const key = readFileSync("out/throwaway/client.key", "utf8");
const icp = readFileSync("icp/icp-brasil-roots.pem", "utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)!.slice(0, 4);
const ca = [...tls.rootCertificates, ...icp];
const url = process.argv[2];
const withCert = process.argv[3] === "cert";
const agent = new https.Agent({ ca, ...(withCert ? { cert, key } : {}), proxyEnv: { HTTPS_PROXY: "http://127.0.0.1:18080" } } as never);
const req = https.request(url, { method: "POST", agent, headers: { "content-type": "application/soap+xml; charset=utf-8" } }, (res) => {
  let b = "";
  res.on("data", (d) => (b += d));
  res.on("end", () => console.log(withCert ? "cert" : "nocert", res.statusCode, res.headers.server, (b.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/(HTTP Error )?403[^<]{0,140}/) ?? [b.slice(0, 200)])[0]));
});
req.on("error", (e) => console.log(withCert ? "cert" : "nocert", "ERR", e.message));
req.end("<x/>");
