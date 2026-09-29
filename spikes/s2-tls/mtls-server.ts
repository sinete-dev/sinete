// Spike S2: servidor local que pede certificado de cliente e devolve o que recebeu.
// Uso: node mtls-server.ts (127.0.0.1:18443)
import https from "node:https";
import { readFileSync } from "node:fs";
const d = "out/throwaway";
https
  .createServer({ key: readFileSync(`${d}/server.key`), cert: readFileSync(`${d}/server.crt`), requestCert: true, rejectUnauthorized: false, minVersion: "TLSv1.2", maxVersion: "TLSv1.2" }, (req, res) => {
    const s = req.socket as import("node:tls").TLSSocket;
    const peer = s.getPeerCertificate();
    const out = { presented: !!peer?.subject, subjectCN: peer?.subject?.CN ?? null, protocol: s.getProtocol(), ua: req.headers["user-agent"] ?? null };
    console.log("[server]", JSON.stringify(out));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(out));
  })
  .listen(18443, "127.0.0.1", () => console.log("[server] 127.0.0.1:18443"));

// Porta 18444: imita o IIS das SEFAZ (BA, SP, SVAN, AN, Sefin): handshake sem CertificateRequest,
// e ao receber a requisição HTTP o servidor manda HelloRequest e renegocia pedindo o certificado.
https
  .createServer({ key: readFileSync(`${d}/server.key`), cert: readFileSync(`${d}/server.crt`), requestCert: false, minVersion: "TLSv1.2", maxVersion: "TLSv1.2" }, (req, res) => {
    const s = req.socket as import("node:tls").TLSSocket;
    const ua = req.headers["user-agent"] ?? null;
    const before = !!s.getPeerCertificate()?.subject;
    s.renegotiate({ requestCert: true, rejectUnauthorized: false }, (err) => {
      const peer = s.getPeerCertificate();
      const out = { renegotiated: !err, error: err?.message ?? null, presentedBefore: before, presented: !!peer?.subject, subjectCN: peer?.subject?.CN ?? null, ua };
      console.log("[server-reneg]", JSON.stringify(out));
      if (err) return;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(out));
    });
  })
  .listen(18444, "127.0.0.1", () => console.log("[server-reneg] 127.0.0.1:18444"));
