// Spike S4: bateria local. Sobe os servidores do lab, abre quatro identidades no helper
// (inproc = linha de base; remote-digest = KeyObject no Bun; remote-message = WebCrypto não exportável;
// pkcs11 = SoftHSM) e mede handshake, custo por assinatura, keep-alive, retomada e renegociação.
// Uso: bun lab/run-lab.ts   (depois de lab/mkpki.sh e lab/softhsm-init.sh)
import { spawn, type ChildProcess } from "node:child_process";
import { createPrivateKey, X509Certificate } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SignerHelper } from "../keyholder.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const PKI = `${ROOT}.local/pki/`;
const N = Number(process.env.N ?? 20);
const children: ChildProcess[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function start(cmd: string, args: string[]) {
  const c = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"], cwd: PKI });
  children.push(c);
  return c;
}
const ossl = (port: number, cipher: string, extra: string[] = []) =>
  start("openssl", ["s_server", "-accept", `127.0.0.1:${port}`, "-cert", "server.crt", "-key", "server.key", "-CAfile", "ca.crt", "-Verify", "1", "-verify_return_error", "-tls1_2", "-cipher", cipher, "-www", "-quiet", ...extra]);

start("node", [`${ROOT}lab/lab-server.ts`]);
ossl(19445, "ECDHE-RSA-AES128-SHA256", ["-client_sigalgs", "RSA-PSS+SHA256:rsa_pss_rsae_sha256:RSA+SHA256:RSA+SHA1"]); // CBC-only, pede PSS primeiro
ossl(19446, "DHE-RSA-AES128-GCM-SHA256"); // GO produção
ossl(19447, "ECDHE-RSA-AES256-SHA384"); // CBC-SHA384 (o que o openssl escolhe em BA/AN)
ossl(19448, "AES128-GCM-SHA256"); // troca de chave RSA
await sleep(1500);

const der = (pem: string) => new X509Certificate(pem).raw.toString("base64");
const clientPem = readFileSync(`${PKI}client.crt`, "utf8");
const p11Pem = readFileSync(`${ROOT}.local/softhsm/client.crt`, "utf8");
const allowed = new Set(["localhost", "127.0.0.1"]);
const h = new SignerHelper({
  helper: `${ROOT}bin/sinete-signer`,
  args: ["--lab", "--roots", `${PKI}ca.crt`],
  allowedHosts: allowed,
  checkTranscript: true,
  env: { SOFTHSM2_CONF: `${ROOT}.local/softhsm/softhsm2.conf` },
  log: (s) => process.env.VERBOSE && console.error(s),
});
const hello = await h.call("hello", { protocol: 1, client: "s4-lab" });

const keyObj = createPrivateKey(readFileSync(`${PKI}client.key`));
const pkcs8 = keyObj.export({ format: "der", type: "pkcs8" });
const webKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
h.registerKey("remote-digest", { mode: "digest", key: keyObj });
h.registerKey("remote-message", { mode: "message", key: webKey });
await h.call("identity.open", { id: "inproc", backend: "inproc", keyFile: `${PKI}client.key`, chain: [der(clientPem)] });
await h.call("identity.open", { id: "remote-digest", backend: "remote", mode: "digest", chain: [der(clientPem)] });
await h.call("identity.open", { id: "remote-message", backend: "remote", mode: "message", chain: [der(clientPem)] });
await h.call("identity.open", { id: "pkcs11", backend: "pkcs11", module: "/opt/homebrew/lib/softhsm/libsofthsm2.so", token: "sinete-s4", label: "tls-client", pin: "123456" });

const b64 = (s: string) => Buffer.from(s).toString("base64");
async function req(identity: string, url: string, opts: { fresh?: boolean; method?: string } = {}) {
  const t0 = performance.now();
  try {
    const r = await h.call("http.request", { identity, url, method: opts.method ?? "GET", headers: {}, body: b64(""), freshConn: !!opts.fresh, timeoutMs: 20000 });
    const body = Buffer.from(r.body, "base64").toString("utf8");
    let server: any = null;
    try {
      server = JSON.parse(body);
    } catch {
      server = { raw: body.slice(0, 80).replace(/\s+/g, " "), clientCN: /Subject:.*?CN\s*=\s*([^\n,]+)/.exec(body)?.[1] ?? null, resumed: /Reused, /.test(body) };
    }
    return { ok: true, status: r.status, tls: r.tls, server, totalMs: performance.now() - t0, helperMs: r.ms };
  } catch (e: any) {
    return { ok: false, error: String(e.message).slice(0, 200), totalMs: performance.now() - t0 };
  }
}

const pct = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? +s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(2) : null;
};
const summary = (a: number[]) => ({ n: a.length, p50: pct(a, 50), p90: pct(a, 90), max: pct(a, 100) });

const report: any = { at: new Date().toISOString(), hello, n: N, backends: {} };
const IDS = ["inproc", "remote-digest", "remote-message", "pkcs11"];

for (const id of IDS) {
  const r: any = {};
  // A) handshake completo, sem sessão (derruba o cache a cada vez): 1 assinatura por conexão
  const hs: number[] = [], sig: number[] = [], tot: number[] = [];
  const schemes = new Set<string>();
  let fails = 0;
  for (let i = 0; i < N; i++) {
    await h.call("pool.reset", { identity: id, dropSessions: true });
    const x = await req(id, "https://localhost:19443/");
    if (!x.ok || x.server?.cn == null) { fails++; r.lastError = x.error ?? x.server; continue; }
    hs.push(x.tls.handshakeMs[0]);
    tot.push(x.totalMs);
    for (const s of x.tls.signatures) { sig.push(s.ms); schemes.add(s.scheme); }
  }
  r.fullHandshake = { handshakeMs: summary(hs), signRoundTripMs: summary(sig), requestTotalMs: summary(tot), schemes: [...schemes], fails };

  // B) keep-alive: N requisições na mesma conexão
  await h.call("pool.reset", { identity: id, dropSessions: true });
  let sigsKA = 0, conns = new Set<number>();
  for (let i = 0; i < N; i++) {
    const x = await req(id, "https://localhost:19443/");
    if (x.ok) { sigsKA += x.tls.signatures.length; conns.add(x.tls.conn); }
  }
  r.keepAlive = { requests: N, connections: conns.size, signatures: sigsKA };

  // C) retomada: conexão nova a cada requisição, cache de sessão mantido
  await h.call("pool.reset", { identity: id, dropSessions: true });
  let sigsRes = 0, resumedN = 0, serverSawCert = 0;
  const hsRes: number[] = [];
  for (let i = 0; i < N; i++) {
    const x = await req(id, "https://localhost:19443/", { fresh: true });
    if (!x.ok) continue;
    sigsRes += x.tls.signatures.length;
    if (x.tls.resumed[0]) { resumedN++; hsRes.push(x.tls.handshakeMs[0]); }
    if (x.server?.cn) serverSawCert++;
  }
  r.resumption = { newConnections: N, resumed: resumedN, signatures: sigsRes, serverSawClientCert: serverSawCert, resumedHandshakeMs: summary(hsRes) };

  // D) renegociação (estilo IIS): conexão nova com e sem sessão
  await h.call("pool.reset", { identity: id, dropSessions: true });
  const ren: any[] = [];
  for (let i = 0; i < 4; i++) {
    const x = await req(id, "https://localhost:19444/", { fresh: true });
    ren.push(x.ok ? { status: x.status, cn: x.server?.cn, renegotiatedNow: x.server?.renegotiatedNow, handshakes: x.tls.handshakes, resumed: x.tls.resumed, signatures: x.tls.signatures.length, ms: +x.totalMs.toFixed(1) } : { error: x.error });
  }
  const ka = await req(id, "https://localhost:19444/"); // reaproveita a última conexão
  ren.push(ka.ok ? { keepAlive: true, status: ka.status, renegotiatedNow: ka.server?.renegotiatedNow, handshakes: ka.tls.handshakes, signatures: ka.tls.signatures.length } : { keepAlive: true, error: ka.error });
  r.renegotiation = ren;

  // E) suítes legadas (openssl s_server exigindo certificado)
  const suite = async (url: string) => {
    await h.call("pool.reset", { identity: id, dropSessions: true });
    const x = await req(id, url);
    return x.ok ? { status: x.status, cipher: x.tls.cipher, clientCN: x.server?.clientCN ?? null, signatures: x.tls.signatures.map((s: any) => s.scheme) } : { error: x.error };
  };
  r.suites = {
    "cbc-sha256+pss-first(19445)": await suite("https://localhost:19445/"),
    "dhe-gcm(19446)": await suite("https://localhost:19446/"),
    "ecdhe-cbc-sha384(19447)": await suite("https://localhost:19447/"),
    "rsa-kx-gcm(19448, 127.0.0.1)": id === "remote-message" ? { skipped: "sem SNI em IP: a checagem de transcript recusa, por desenho" } : await suite("https://127.0.0.1:19448/"),
  };
  report.backends[id] = r;
  console.log(id, JSON.stringify(r));
}

// F) políticas: guarda do helper e política do dono da chave
report.policy = {
  helperGuardNonLoopback: await req("remote-digest", "https://hnfe.sefaz.ba.gov.br/"),
};
allowed.delete("localhost");
await h.call("pool.reset", { identity: "remote-digest", dropSessions: true });
report.policy.holderRefusesHost = await req("remote-digest", "https://localhost:19443/");
allowed.add("localhost");
report.signEventsSample = h.signEvents.filter((e) => e.mode === "message").slice(0, 2);
report.stats = await h.call("stats");
console.log("policy", JSON.stringify(report.policy));

await h.close();
for (const c of children) c.kill("SIGTERM");
mkdirSync(`${ROOT}results`, { recursive: true });
writeFileSync(`${ROOT}results/lab.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log("results/lab.json");
process.exit(0);
