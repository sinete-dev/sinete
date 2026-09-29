// Spike S2: proxy HTTP CONNECT que só repassa bytes e registra o handshake TLS 1.2 em claro.
// Em TLS 1.2 a mensagem Certificate do cliente trafega sem cifra, então dá para provar
// se a runtime APRESENTOU o certificado ao servidor real, sem MITM.
// Uso: node capture-proxy.ts  (escuta em 127.0.0.1:18080, grava out/capture/<ts>.json por conexão)
import net from "node:net";
import { X509Certificate } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("out/capture", { recursive: true });
const PORT = Number(process.env.PORT ?? 18080);
const HS: Record<number, string> = { 1: "ClientHello", 2: "ServerHello", 4: "NewSessionTicket", 11: "Certificate", 12: "ServerKeyExchange", 13: "CertificateRequest", 14: "ServerHelloDone", 15: "CertificateVerify", 16: "ClientKeyExchange", 20: "Finished" };
const ALERTS: Record<number, string> = { 0: "close_notify", 40: "handshake_failure", 42: "bad_certificate", 43: "unsupported_certificate", 45: "certificate_expired", 46: "certificate_unknown", 48: "unknown_ca", 70: "protocol_version", 116: "certificate_required" };

type Ev = Record<string, unknown>;
function tap(dir: "c2s" | "s2c", events: Ev[]) {
  let buf = Buffer.alloc(0);
  let encrypted = false;
  return (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 5) {
      const type = buf[0];
      const len = buf.readUInt16BE(3);
      if (buf.length < 5 + len) break;
      const body = buf.subarray(5, 5 + len);
      buf = buf.subarray(5 + len);
      if (type === 20) {
        events.push({ dir, rec: "ChangeCipherSpec" });
        encrypted = true;
        continue;
      }
      if (type === 21) {
        events.push({ dir, rec: "Alert", ...(encrypted ? { encrypted: true } : { level: body[0], desc: ALERTS[body[1]] ?? body[1] }) });
        continue;
      }
      if (type === 23) {
        events.push({ dir, rec: "ApplicationData", len });
        continue;
      }
      if (type !== 22 || encrypted) {
        events.push({ dir, rec: type === 22 ? "Handshake(encrypted)" : `type${type}`, len });
        continue;
      }
      let off = 0;
      while (off + 4 <= body.length) {
        const ht = body[off];
        const hl = body.readUIntBE(off + 1, 3);
        const msg = body.subarray(off + 4, off + 4 + hl);
        off += 4 + hl;
        const ev: Ev = { dir, hs: HS[ht] ?? ht, len: hl };
        if (ht === 11) {
          // certificate_list<0..2^24-1>
          const listLen = msg.readUIntBE(0, 3);
          const certs: string[] = [];
          let p = 3;
          while (p < 3 + listLen) {
            const cl = msg.readUIntBE(p, 3);
            const der = msg.subarray(p + 3, p + 3 + cl);
            try {
              certs.push(new X509Certificate(der).subject.replace(/\n/g, ", "));
            } catch {
              certs.push(`<${cl} bytes>`);
            }
            p += 3 + cl;
          }
          ev.certCount = certs.length;
          ev.subjects = certs;
        }
        if (ht === 15) ev.sigScheme = `0x${msg.readUInt16BE(0).toString(16).padStart(4, "0")}`;
        if (ht === 2) {
          ev.version = `0x${msg.readUInt16BE(0).toString(16)}`;
          const sidLen = msg[34];
          ev.cipherSuite = `0x${msg.readUInt16BE(35 + sidLen).toString(16).padStart(4, "0")}`;
        }
        events.push(ev);
      }
    }
  };
}

net
  .createServer((client) => {
    let head = Buffer.alloc(0);
    const onData = (d: Buffer) => {
      head = Buffer.concat([head, d]);
      const idx = head.indexOf("\r\n\r\n");
      if (idx < 0) return;
      client.off("data", onData);
      const line = head.subarray(0, idx).toString().split("\r\n")[0];
      const m = /^CONNECT ([^:\s]+):(\d+)/.exec(line);
      if (!m) {
        client.end("HTTP/1.1 405 Only CONNECT\r\n\r\n");
        return;
      }
      const events: Ev[] = [];
      const started = new Date().toISOString();
      const ua = /user-agent: ([^\r\n]+)/i.exec(head.toString())?.[1] ?? null;
      const upstream = net.connect(Number(m[2]), m[1], () => {
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        const rest = head.subarray(idx + 4);
        const c2s = tap("c2s", events);
        const s2c = tap("s2c", events);
        if (rest.length) {
          c2s(rest);
          upstream.write(rest);
        }
        client.on("data", (d) => {
          c2s(d);
          upstream.write(d);
        });
        upstream.on("data", (d) => {
          s2c(d);
          client.write(d);
        });
      });
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        const f = `out/capture/${started.replace(/[:.]/g, "-")}-${m[1]}.json`;
        writeFileSync(f, `${JSON.stringify({ target: `${m[1]}:${m[2]}`, ua, started, events }, null, 2)}\n`);
        const cert = events.find((e) => e.hs === "Certificate" && e.dir === "c2s");
        console.log(`[proxy] ${m[1]} clientCert=${cert ? `${cert.certCount} ${JSON.stringify(cert.subjects)}` : "no Certificate msg"} certVerify=${events.some((e) => e.hs === "CertificateVerify")} alerts=${JSON.stringify(events.filter((e) => e.rec === "Alert"))}`);
        client.destroy();
        upstream.destroy();
      };
      upstream.on("close", done);
      upstream.on("error", done);
      client.on("error", () => upstream.destroy());
      client.on("close", () => upstream.destroy());
    };
    client.on("data", onData);
  })
  .listen(PORT, "127.0.0.1", () => console.log(`[proxy] listening 127.0.0.1:${PORT}`));
