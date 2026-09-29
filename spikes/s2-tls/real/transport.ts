// Spike S2 parte 2: transporte mTLS com guarda. Node e Bun: node:https. Deno: Deno.createHttpClient.
// A guarda roda antes de qualquer socket; cada uso do certificado vai para o ledger.
import { readFileSync } from "node:fs";
import { assertAllowed, logUse } from "./guard.ts";
import type { LoadedCert } from "./cert.ts";

declare const Deno: any;
declare const Bun: any;
export const runtime = typeof Deno !== "undefined" ? "deno" : typeof Bun !== "undefined" ? "bun" : "node";

const HERE = new URL(".", import.meta.url).pathname;
const icpRoots = readFileSync(`${HERE}../icp/icp-brasil-roots.pem`, "utf8").match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)!.slice(0, 4);

export interface SendResult {
  status: number | null;
  body: string;
  error?: string;
  tls?: { protocol: string | null; cipher: string | null; localCertLoaded: boolean };
  ms: number;
}

export async function send(cert: LoadedCert, opts: { url: string; body?: string; method?: "POST" | "GET"; contentType?: string; service: string; trace?: boolean }): Promise<SendResult> {
  const { host } = assertAllowed(opts.url, opts.body); // lança antes de abrir socket
  const t0 = Date.now();
  let r: SendResult;
  try {
    r = runtime === "deno" ? await sendDeno(cert, opts) : await sendNodeHttps(cert, opts);
  } catch (e) {
    r = { status: null, body: "", error: String((e as Error).message ?? e), ms: 0 };
  }
  r.ms = Date.now() - t0;
  const cStat = /<cStat>(\d+)<\/cStat>/.exec(r.body)?.[1];
  logUse(host, opts.service, r.error ? `ERR ${r.error}` : `HTTP ${r.status}${cStat ? ` cStat=${cStat}` : ""}`);
  return r;
}

async function sendNodeHttps(cert: LoadedCert, opts: { url: string; body?: string; method?: string; contentType?: string; trace?: boolean }): Promise<SendResult> {
  const https = await import("node:https");
  const tls = await import("node:tls");
  const agent = new https.Agent({
    cert: cert.certPem,
    key: cert.keyPem,
    ca: [...tls.rootCertificates, ...icpRoots],
    minVersion: "TLSv1.2",
    keepAlive: false,
  });
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["content-type"] = opts.contentType ?? "application/soap+xml; charset=utf-8";
    let tlsInfo: SendResult["tls"];
    const req = https.request(opts.url, { method: opts.method ?? "POST", agent, headers, timeout: 60000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        agent.destroy();
        resolve({ status: res.statusCode ?? null, body: Buffer.concat(chunks).toString("utf8"), tls: tlsInfo, ms: 0 });
      });
    });
    req.on("socket", (s: any) => {
      if (opts.trace && typeof s.enableTrace === "function") s.enableTrace();
      s.once("secureConnect", () => {
        // falha barulhenta: a identidade tem de estar no contexto
        const local = typeof s.getCertificate === "function" ? s.getCertificate() : undefined;
        tlsInfo = { protocol: s.getProtocol?.() ?? null, cipher: s.getCipher?.()?.name ?? null, localCertLoaded: !!(local && Object.keys(local).length) };
        if (local !== undefined && !tlsInfo.localCertLoaded) req.destroy(new Error("certificado de cliente NÃO carregado no contexto TLS"));
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout 60s")));
    req.on("error", (e) => {
      agent.destroy();
      resolve({ status: null, body: "", error: e.message, tls: tlsInfo, ms: 0 });
    });
    req.end(opts.body);
  });
}

async function sendDeno(cert: LoadedCert, opts: { url: string; body?: string; method?: string; contentType?: string }): Promise<SendResult> {
  const client = Deno.createHttpClient({ cert: cert.certPem, key: cert.keyPem, caCerts: icpRoots, http2: false, http1: true });
  try {
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["content-type"] = opts.contentType ?? "application/soap+xml; charset=utf-8";
    const res = await fetch(opts.url, { method: opts.method ?? "POST", body: opts.body, headers, client } as RequestInit);
    return { status: res.status, body: await res.text(), ms: 0 };
  } finally {
    client.close();
  }
}
