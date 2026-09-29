// Spike S2: a loja de confiança padrão de cada runtime valida o servidor? E com o bundle ICP-Brasil somado?
// Sem certificado de cliente. 2 handshakes por host por runtime.
// Node/Bun: node --experimental-strip-types runtime-trust.ts | bun runtime-trust.ts
// Deno:     deno run -A runtime-trust.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { X509Certificate } from "node:crypto";

declare const Deno: any;
declare const Bun: any;
const runtime = typeof Deno !== "undefined" ? "deno" : typeof Bun !== "undefined" ? "bun" : "node";
const version = runtime === "deno" ? Deno.version.deno : runtime === "bun" ? Bun.version : process.versions.node;

const icpRoots = readFileSync("icp/icp-brasil-roots.pem", "utf8")
  .match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)!
  // v6 (Ed448) e v7 (algoritmo não suportado) quebram o parse de algumas runtimes e não emitem TLS
  .filter((p) => {
    try {
      const c = new X509Certificate(p);
      return !/v6$|v7$/.test(c.subject.split("\n").find((l: string) => l.startsWith("CN=")) ?? "");
    } catch {
      return false;
    }
  });

const hosts: string[] = (process.argv.slice(2).length ? process.argv.slice(2) : JSON.parse(readFileSync("hosts.json", "utf8")).map((h: { host: string }) => h.host));

type R = { ok: boolean; error?: string; protocol?: string | null; cipher?: string | null };

async function nodeLike(host: string, withBundle: boolean): Promise<R> {
  const tls = await import("node:tls");
  const ca = withBundle ? [...tls.rootCertificates, ...icpRoots] : undefined;
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, ca, rejectUnauthorized: false, timeout: 15000 }, () => {
      const r: R = { ok: s.authorized, error: s.authorized ? undefined : String(s.authorizationError), protocol: s.getProtocol(), cipher: s.getCipher()?.name };
      s.destroy();
      resolve(r);
    });
    s.on("error", (e) => resolve({ ok: false, error: `socket: ${e.message}` }));
    s.on("timeout", () => {
      s.destroy();
      resolve({ ok: false, error: "timeout" });
    });
  });
}

async function deno(host: string, withBundle: boolean): Promise<R> {
  try {
    const conn = await Deno.connectTls({ hostname: host, port: 443, caCerts: withBundle ? icpRoots : undefined });
    await conn.handshake();
    conn.close();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error).message).slice(0, 200) };
  }
}

const out: Record<string, unknown> = { runtime, version, at: new Date().toISOString(), rootCount: runtime === "deno" ? null : (await import("node:tls")).rootCertificates.length, hosts: {} };
for (const h of hosts) {
  const f = runtime === "deno" ? deno : nodeLike;
  const def = await f(h, false);
  const icp = await f(h, true);
  (out.hosts as Record<string, unknown>)[h] = { default: def, withIcp: icp };
  console.log(runtime, h.padEnd(36), "default:", def.ok ? "OK" : def.error, "| +ICP:", icp.ok ? "OK" : icp.error);
}
mkdirSync("out/trust", { recursive: true });
writeFileSync(`out/trust/${runtime}.json`, `${JSON.stringify(out, null, 2)}\n`);
