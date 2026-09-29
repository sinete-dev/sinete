// Spike S2: cada runtime apresenta o certificado de cliente? Certificado autoassinado descartável, nunca um real.
// Alvos:
//   local -> https://127.0.0.1:18443/ (mtls-server.ts devolve o que recebeu)
//   svrs  -> StatusServico da SVRS homologação, via capture-proxy.ts (CONNECT em 127.0.0.1:18080)
// Uso: node mtls-clients.ts <local|svrs> | bun mtls-clients.ts <local|svrs> | deno run -A mtls-clients.ts <local|svrs>
import { readFileSync } from "node:fs";

declare const Deno: any;
declare const Bun: any;
const runtime = typeof Deno !== "undefined" ? "deno" : typeof Bun !== "undefined" ? "bun" : "node";
const target = (typeof Deno !== "undefined" ? Deno.args[0] : process.argv[2]) ?? "local";
const only = typeof Deno !== "undefined" ? Deno.args[1] : process.argv[3];
const PROXY = "http://127.0.0.1:18080";

const cert = readFileSync("out/throwaway/client.crt", "utf8");
const key = readFileSync("out/throwaway/client.key", "utf8");
const pems = (s: string) => s.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g)!;
const icp = pems(readFileSync("icp/icp-brasil-roots.pem", "utf8")).slice(0, 4); // v5, v10, v11, v12 (sem v6/v7)
const localCa = readFileSync("out/throwaway/localca.crt", "utf8");

const SVRS = "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx";
const TARGETS: Record<string, string> = {
  local: "https://127.0.0.1:18443/",
  "local-reneg": "https://127.0.0.1:18444/",
  svrs: SVRS, // pede certificado no handshake inicial; testado via capture-proxy
  // os três abaixo NÃO pedem certificado no handshake inicial: IIS manda HelloRequest e renegocia após ver a requisição
  ba: "https://hnfe.sefaz.ba.gov.br/webservices/NFeStatusServico4/NFeStatusServico4.asmx",
  sp: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx",
  sefin: "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/nfse",
};
const url = TARGETS[target];
const body =
  '<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>2</tpAmb><cUF>43</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>';
const headers = { "content-type": "application/soap+xml; charset=utf-8" };

async function nodeTlsModule() {
  const tls = await import("node:tls");
  return [...tls.rootCertificates, ...icp];
}
const caFor = async () => (target.startsWith("local") ? [localCa] : await nodeTlsModule());

type Case = { name: string; run: () => Promise<{ status: number | string; body: string }> };
const cases: Case[] = [];

const summarize = async (r: Response) => ({ status: r.status, body: (await r.text()).slice(0, 300) });

// ---------- node:https (Node, Bun e Deno têm) ----------
cases.push({
  name: `${runtime}:node:https Agent{cert,key,ca}${target === "svrs" ? " +proxyEnv" : ""}`,
  run: async () => {
    const https = await import("node:https");
    const ca = await caFor();
    const opts: Record<string, unknown> = { cert, key, ca };
    if (target === "svrs") opts.proxyEnv = { HTTPS_PROXY: PROXY };
    const agent = new https.Agent(opts as never);
    return new Promise((resolve) => {
      const req = https.request(url, { method: "POST", agent, headers }, (res) => {
        let b = "";
        res.on("data", (d) => (b += d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: b.slice(0, 300) }));
      });
      req.on("error", (e) => resolve({ status: `ERR ${e.message}`, body: "" }));
      req.end(body);
    });
  },
});

if (runtime === "node") {
  cases.push({
    name: "node:fetch + undici Agent{connect:{cert,key,ca}}",
    run: async () => {
      const undici = await import("undici");
      const ca = await caFor();
      const dispatcher =
        target === "svrs"
          ? new undici.ProxyAgent({ uri: PROXY, requestTls: { cert, key, ca } })
          : new undici.Agent({ allowH2: process.env.H2 === "1", connect: { cert, key, ca } });
      const r = await undici.fetch(url, { method: "POST", body, headers, dispatcher });
      return { status: r.status, body: (await r.text()).slice(0, 300) };
    },
  });
  cases.push({
    name: "node:globalThis.fetch + dispatcher do pacote undici",
    run: async () => {
      const undici = await import("undici");
      const ca = await caFor();
      const dispatcher =
        target === "svrs"
          ? new undici.ProxyAgent({ uri: PROXY, requestTls: { cert, key, ca } })
          : new undici.Agent({ allowH2: process.env.H2 === "1", connect: { cert, key, ca } });
      return summarize(await fetch(url, { method: "POST", body, headers, dispatcher } as RequestInit));
    },
  });
  cases.push({
    name: "node:globalThis.fetch com opção Bun-only tls{cert,key,ca} (bug do brafis)",
    run: async () => {
      // Para o fetch conseguir validar o servidor sem a opção tls, a CA vem por NODE_EXTRA_CA_CERTS (ver run-mtls.sh)
      // e o proxy por NODE_USE_ENV_PROXY=1 + HTTPS_PROXY.
      const ca = await caFor();
      return summarize(await fetch(url, { method: "POST", body, headers, tls: { cert, key, ca } } as RequestInit));
    },
  });
}

if (runtime === "bun") {
  cases.push({
    name: "bun:fetch tls{cert,key,ca}",
    run: async () => {
      const ca = await caFor();
      const init: Record<string, unknown> = { method: "POST", body, headers, tls: { cert, key, ca } };
      if (target === "svrs") init.proxy = PROXY;
      return summarize(await fetch(url, init as RequestInit));
    },
  });
}

if (runtime === "deno") {
  cases.push({
    name: "deno:fetch + Deno.createHttpClient{cert,key,caCerts}",
    run: async () => {
      const client = Deno.createHttpClient({
        cert,
        key,
        caCerts: target.startsWith("local") ? [localCa] : icp,
        ...(process.env.H2 === "1" ? {} : { http2: false, http1: true }),
        ...(target === "svrs" ? { proxy: { url: PROXY } } : {}),
      });
      try {
        return summarize(await fetch(url, { method: "POST", body, headers, client } as RequestInit));
      } finally {
        client.close();
      }
    },
  });
}

for (const c of cases) {
  if (only && !c.name.includes(only)) continue;
  try {
    const r = await c.run();
    console.log(`[client] ${c.name} -> ${r.status} ${r.body.replace(/\s+/g, " ").slice(0, 200)}`);
  } catch (e) {
    const err = e as Error & { cause?: Error };
    console.log(`[client] ${c.name} -> THROW ${err.message}${err.cause ? ` / cause: ${err.cause.message}` : ""}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
