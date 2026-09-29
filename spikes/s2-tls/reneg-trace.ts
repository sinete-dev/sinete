// Spike S2: trace TLS do lado do cliente Node (SSL_trace via enableTrace) contra um host que renegocia (IIS).
// Mostra, decifrado, se o cliente manda a mensagem Certificate na renegociação. 1 requisição.
import https from "node:https";
import tls from "node:tls";
import { readFileSync } from "node:fs";
const cert = readFileSync("out/throwaway/client.crt", "utf8");
const key = readFileSync("out/throwaway/client.key", "utf8");
const icp = readFileSync("icp/icp-brasil-roots.pem", "utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)!.slice(0, 4);
const localCa = readFileSync("out/throwaway/localca.crt", "utf8");
const url = process.argv[2];
const ca = url.includes("127.0.0.1") ? [localCa] : [...tls.rootCertificates, ...icp];
const agent = new https.Agent({ cert, key, ca });
const req = https.request(url, { method: "POST", agent, headers: { "content-type": "application/soap+xml; charset=utf-8" } }, (res) => {
  let b = "";
  res.on("data", (d) => (b += d));
  res.on("end", () => console.error(`RESULT ${res.statusCode} ${b.slice(0, 120).replace(/\s+/g, " ")}`));
});
req.on("socket", (s) => (s as tls.TLSSocket).enableTrace());
req.on("error", (e) => console.error(`RESULT ERR ${e.message}`));
req.end("<x/>");
