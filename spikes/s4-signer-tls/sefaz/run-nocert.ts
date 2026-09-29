// S4, passo 2: helper (fora do lab, com guarda e ledger) contra homologação com o certificado DESCARTÁVEL do lab.
// A SEFAZ tem que recusar; o que se mede é até onde o handshake vai e se o helper pediu assinatura ao processo JS.
import { createPrivateKey, X509Certificate } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { SignerHelper } from "../keyholder.ts";
import { ROOT, S2, TARGETS, cStat, statusRequest } from "./common.ts";

const PKI = `${ROOT}.local/pki/`;
const h = new SignerHelper({ helper: `${ROOT}bin/sinete-signer`, args: ["--roots", `${S2}icp/icp-brasil-roots.pem`], allowedHosts: new Set(TARGETS.map((t) => t.host)) });
h.registerKey("throwaway", { mode: "digest", key: createPrivateKey(readFileSync(`${PKI}client.key`)) });
await h.call("identity.open", { id: "throwaway", backend: "remote", mode: "digest", chain: [new X509Certificate(readFileSync(`${PKI}client.crt`)).raw.toString("base64")] });
const out: any[] = [];
for (const t of TARGETS) {
  try {
    const r = await h.call("http.request", { identity: "throwaway", url: t.url, ...statusRequest(t.cUF), timeoutMs: 30000 });
    out.push({ uf: t.uf, host: t.host, status: r.status, ...cStat(r.body), tls: { cipher: r.tls.cipher, handshakes: r.tls.handshakes, certRequests: r.tls.certRequests, signatures: r.tls.signatures } });
  } catch (e: any) {
    out.push({ uf: t.uf, host: t.host, error: String(e.message).slice(0, 220), signEvents: h.signEvents.filter((s) => s.host === t.host).map((s) => ({ scheme: s.scheme, handshake: s.handshake })) });
  }
  console.log(JSON.stringify(out.at(-1)));
  await new Promise((r) => setTimeout(r, 600));
}
// guarda: produção e operação fora da lista têm que ser recusadas antes do socket
const neg: any = {};
for (const [k, url, req] of [
  ["producao", "https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx", statusRequest("35")],
  ["operacaoForaDaLista", TARGETS[0].url, { ...statusRequest("35"), headers: { "content-type": 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"' } }],
  ["tpAmb1", TARGETS[0].url, { ...statusRequest("35"), body: Buffer.from(Buffer.from(statusRequest("35").body, "base64").toString().replace("<tpAmb>2<", "<tpAmb>1<")).toString("base64") }],
] as const) {
  try { await h.call("http.request", { identity: "throwaway", url, ...req }); neg[k] = "PASSOU (erro!)"; } catch (e: any) { neg[k] = e.message; }
}
console.log(JSON.stringify(neg));
await h.close();
writeFileSync(`${ROOT}results/sefaz-nocert.json`, `${JSON.stringify({ at: new Date().toISOString(), results: out, guard: neg }, null, 2)}\n`);
