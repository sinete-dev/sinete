// Spike S4: servidores locais do lab (rodar com node, que tem renegotiate()).
// 19443: pede certificado no handshake e VALIDA contra a CA descartável (assinatura errada = handshake falha).
// 19444: imita o IIS das SEFAZ: sem CertificateRequest inicial; na requisição HTTP renegocia pedindo e validando o cert.
// Os dois devolvem JSON com o que o servidor viu (CN do cliente, retomada, renegociação).
import https from "node:https";
import { readFileSync } from "node:fs";
import type { TLSSocket } from "node:tls";

const D = new URL("../.local/pki/", import.meta.url).pathname;
const base = { key: readFileSync(`${D}server.key`), cert: readFileSync(`${D}server.crt`), ca: readFileSync(`${D}ca.crt`), minVersion: "TLSv1.2" as const, maxVersion: "TLSv1.2" as const };

const reply = (res: any, s: TLSSocket, extra: object) => {
  const peer = s.getPeerCertificate();
  const out = { cn: peer?.subject?.CN ?? null, authorized: s.authorized, resumed: s.isSessionReused(), protocol: s.getProtocol(), cipher: s.getCipher()?.name, ...extra };
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(out));
};

https.createServer({ ...base, requestCert: true, rejectUnauthorized: true }, (req, res) => reply(res, req.socket as TLSSocket, { mode: "handshake" })).listen(19443, "127.0.0.1");

const renegotiated = new WeakSet<TLSSocket>();
https
  .createServer({ ...base, requestCert: false }, (req, res) => {
    const s = req.socket as TLSSocket;
    if (renegotiated.has(s)) return reply(res, s, { mode: "renegotiation", renegotiatedNow: false });
    s.renegotiate({ requestCert: true, rejectUnauthorized: true }, (err) => {
      if (err) {
        res.statusCode = 403;
        return res.end(JSON.stringify({ error: err.message }));
      }
      renegotiated.add(s);
      reply(res, s, { mode: "renegotiation", renegotiatedNow: true });
    });
  })
  .listen(19444, "127.0.0.1");

console.log("lab-server pronto 19443 19444");
