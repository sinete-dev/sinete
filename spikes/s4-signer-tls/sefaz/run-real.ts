// S4, passo 3: e-CNPJ A1 REAL, chave SÓ na memória deste processo Bun. O helper recebe só a cadeia pública
// e pede cada assinatura por stdio. Guarda dura no helper (homologação, só StatusServico) e política de hosts aqui.
// Nada de chave, PFX, PEM ou senha em disco, argv, env do helper, log ou saída.
// Fases: A) digest (KeyObject) em 6 hosts: nova conexão, keep-alive, nova conexão com sessão (retomada)
//        B) message (WebCrypto não exportável + checagem do transcript) em SVRS e SP
//        C) latência artificial de 3 s e 10 s por assinatura (simula PSC) em SVRS e SP
import { createPrivateKey, X509Certificate } from "node:crypto";
import { writeFileSync } from "node:fs";
import { loadCert } from "../../s2-tls/real/cert.ts";
import { SignerHelper } from "../keyholder.ts";
import { ROOT, S2, TARGETS, cStat, statusRequest } from "./common.ts";

const cert = loadCert();
const chain = (cert.certPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? []).map((p) => new X509Certificate(p).raw.toString("base64"));
const h = new SignerHelper({ helper: `${ROOT}bin/sinete-signer`, args: ["--roots", `${S2}icp/icp-brasil-roots.pem`], allowedHosts: new Set(TARGETS.map((t) => t.host)), checkTranscript: true });
h.registerKey("a1-digest", { mode: "digest", key: createPrivateKey(cert.keyPem) });
h.registerKey("a1-message", { mode: "message", key: await crypto.subtle.importKey("pkcs8", cert.pkcs8Der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]) });
const idInfo = await h.call("identity.open", { id: "a1-digest", backend: "remote", mode: "digest", chain });
await h.call("identity.open", { id: "a1-message", backend: "remote", mode: "message", chain });
console.log(`identidade: ${idInfo.subject.replace(/.*CN=/, "CN=")} cadeia=${idInfo.chainLen}`);

const out: any = { at: new Date().toISOString(), cert: { subject: cert.info.subject.replace(/.*CN=/, "CN="), serial: cert.info.serial, root: cert.info.root, chainSent: idInfo.chainLen }, phaseA: [], phaseB: [], phaseC: [] };
const pause = () => new Promise((r) => setTimeout(r, 700));

async function one(identity: string, t: (typeof TARGETS)[number], fresh: boolean) {
  const t0 = performance.now();
  const before = h.signEvents.length;
  try {
    const r = await h.call("http.request", { identity, url: t.url, ...statusRequest(t.cUF), freshConn: fresh, timeoutMs: 60000 });
    const ev = h.signEvents.slice(before);
    return {
      http: r.status, ...cStat(r.body), ms: +(performance.now() - t0).toFixed(0),
      tls: { cipher: r.tls.cipher, conn: r.tls.conn, connReused: r.tls.connReused, handshakes: r.tls.handshakes, renegotiations: r.tls.renegotiations, resumed: r.tls.resumed, handshakeMs: r.tls.handshakeMs, signatures: r.tls.signatures },
      holder: ev.map((e) => ({ scheme: e.scheme, mode: e.mode, handshake: e.handshake, holderMs: +e.holderMs.toFixed(2), transcriptBytes: e.transcriptBytes, sni: e.sni, serverCertCN: e.serverCertCN })),
    };
  } catch (e: any) {
    return { error: String(e.message).slice(0, 240), ms: +(performance.now() - t0).toFixed(0), holder: h.signEvents.slice(before).map((e) => ({ scheme: e.scheme, handshake: e.handshake })) };
  }
}
const line = (tag: string, uf: string, r: any) =>
  console.log(`${tag} ${uf.padEnd(4)} ${r.error ? `ERRO ${r.error}` : `HTTP ${r.http} cStat=${r.cStat} ${r.xMotivo ?? r.head ?? ""} | ${r.tls.cipher} conn=${r.tls.conn} reused=${r.tls.connReused} hs=${r.tls.handshakes} reneg=${r.tls.renegotiations} resumed=${JSON.stringify(r.tls.resumed)} sigs=${r.tls.signatures.map((s: any) => `${s.scheme}@${s.ms}ms`).join(",") || 0}`} ${r.ms}ms`);

const RECOUNT = process.argv.includes("recount");
if (RECOUNT) {
  // rodada curta, depois da correção do contador de renegociação: 1 conexão nova por host
  const rc: any[] = [];
  for (const t of TARGETS) {
    await h.call("pool.reset", { identity: "a1-digest", dropSessions: true });
    const r = await one("a1-digest", t, false);
    line("R ", t.uf, r);
    rc.push({ uf: t.uf, host: t.host, note: t.note, ...r });
    await pause();
  }
  await h.close();
  writeFileSync(`${ROOT}results/sefaz-real-recount.json`, `${JSON.stringify({ at: new Date().toISOString(), cert: out.cert, results: rc }, null, 2)}\n`);
  process.exit(0);
}

for (const t of TARGETS) {
  await h.call("pool.reset", { identity: "a1-digest", dropSessions: true });
  const steps: any = { uf: t.uf, host: t.host, note: t.note };
  steps.first = await one("a1-digest", t, false); line("A1", t.uf, steps.first); await pause();
  steps.keepAlive = await one("a1-digest", t, false); line("A2", t.uf, steps.keepAlive); await pause();
  steps.resume = await one("a1-digest", t, true); line("A3", t.uf, steps.resume); await pause();
  out.phaseA.push(steps);
}

for (const t of TARGETS.filter((x) => x.uf === "SVRS" || x.uf === "SP")) {
  const r = await one("a1-message", t, true);
  line("B ", t.uf, r);
  out.phaseB.push({ uf: t.uf, ...r });
  await pause();
}

for (const delay of [3000, 10000]) {
  h.signDelayMs = delay;
  for (const t of TARGETS.filter((x) => x.uf === "SVRS" || x.uf === "SP")) {
    await h.call("pool.reset", { identity: "a1-digest", dropSessions: true });
    const r = await one("a1-digest", t, true);
    line(`C${delay / 1000}s`, t.uf, r);
    out.phaseC.push({ uf: t.uf, delayMs: delay, ...r });
    await pause();
  }
}
h.signDelayMs = 0;
out.stats = await h.call("stats");
await h.close();
writeFileSync(`${ROOT}results/sefaz-real.json`, `${JSON.stringify(out, null, 2)}\n`);
console.log("results/sefaz-real.json", JSON.stringify(out.stats));
process.exit(0);
