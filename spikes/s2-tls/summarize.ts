// Spike S2: consolida as sondagens em out/summary.json e imprime a tabela em Markdown (colada no ADR 0004).
// Uso: bun summarize.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const hosts: { host: string; tags: string[] }[] = JSON.parse(readFileSync("hosts.json", "utf8"));
const chains: Record<string, any> = Object.fromEntries(JSON.parse(readFileSync("out/chains.json", "utf8")).map((c: any) => [c.host, c]));
const trust = Object.fromEntries(["node", "bun", "deno"].map((r) => [r, JSON.parse(readFileSync(`out/trust/${r}.json`, "utf8")).hosts]));

// Verificado com openssl -msg + requisição HTTP (HelloRequest seguido de CertificateRequest)
const RENEG_VERIFIED = new Set(["hnfe.sefaz.ba.gov.br", "homologacao.nfe.fazenda.sp.gov.br", "sefin.producaorestrita.nfse.gov.br", "homologacao.sefaz.mt.gov.br", "hom1.nfe.fazenda.gov.br", "hom.sefazvirtual.fazenda.gov.br"]);
// Sem nenhuma suíte ECDHE+AEAD em TLS 1.2 (openssl -cipher 'ECDHE+AESGCM:ECDHE+CHACHA20' falhou)
const NO_ECDHE_AEAD = new Set(["nfe.sefaz.ba.gov.br", "nfe.sefaz.go.gov.br", "nfe.sefa.pr.gov.br", "homologacao.nfe.sefa.pr.gov.br", "www.nfe.fazenda.gov.br", "hom1.nfe.fazenda.gov.br"]);

const short = (s: string) =>
  s.replace("ECDHE-RSA-", "ECDHE-").replace("DHE-RSA-", "DHE-").replace("TLS_CHACHA20_POLY1305_SHA256", "CHACHA20 (1.3)");
const alertName = (t: string) => /alert ([a-z ]+):/.exec(t)?.[1]?.replace("ssl/tls alert ", "") ?? null;

const rows: any[] = [];
for (const { host, tags } of hosts) {
  const o = JSON.parse(readFileSync(`out/openssl/${host}.json`, "utf8"));
  const full = readFileSync(`out/openssl/${host}.full.txt`, "utf8");
  const ch = chains[host] ?? {};
  const v = o.versions as Record<string, string | false>;
  const accepted = Object.entries(v).filter(([, x]) => x).map(([k]) => k);
  const initialCR = /^Client Certificate Types/m.test(full) || host.startsWith("adn."); // ADN: CertificateRequest em TLS 1.3 visto com -msg
  const tls13 = !!v["1.3"];
  let certMode: string;
  if (initialCR) certMode = tls13 ? "no handshake (1.3)" : "no handshake";
  else certMode = RENEG_VERIFIED.has(host) ? "renegociação (verificado)" : "renegociação (provável, IIS)";
  const hsAlert = /alert/.test(full) ? alertName(full.split("\n").find((l) => l.includes("alert")) ?? "") : null;
  let httpNoCert = "?";
  if (existsSync(`out/http/${host}.headers`)) {
    const h = readFileSync(`out/http/${host}.headers`, "utf8");
    const code = /^HTTP\/[\d.]+ (\d+)/m.exec(h)?.[1];
    if (code) httpNoCert = code;
  }
  let semCert: string;
  if (hsAlert) semCert = `alerta TLS: ${hsAlert}`;
  else if (["hom.nfe.sefaz.ms.gov.br", "nfe.sefaz.ms.gov.br"].includes(host)) semCert = "TCP reset após a requisição";
  else if (host === "homolog.sefaz.go.gov.br") semCert = "alerta TLS após a requisição: handshake failure";
  else if (host === "homologacao.sefaz.mt.gov.br") semCert = "TCP reset após a requisição";
  else if (host.startsWith("adn.")) semCert = "1.2: handshake failure; 1.3: bad record mac";
  else semCert = httpNoCert === "?" ? "?" : `HTTP ${httpNoCert}${httpNoCert === "200" ? " (GET ?wsdl sem cert)" : ""}`;
  const t = (r: string, k: "default" | "withIcp") => {
    const x = trust[r][host]?.[k];
    if (!x) return "?";
    if (x.ok) return "ok";
    const e = String(x.error);
    if (/UNABLE_TO_GET_ISSUER|SELF_SIGNED|UnknownIssuer/.test(e)) return "falha (CA)";
    if (/unexpected end of file/.test(e)) return "falha (cifra)";
    if (/alert|Alert|ALERT/.test(e)) return "n/a (exige cert)";
    return e.slice(0, 30);
  };
  let deno = "ok";
  if (NO_ECDHE_AEAD.has(host)) deno = "NÃO (sem ECDHE+AEAD)";
  else if (!initialCR) deno = "NÃO (renegociação)";
  rows.push({
    host,
    uso: tags.join(" "),
    tls: accepted.join(", "),
    cifra: short(o.cipher ?? "?"),
    pedeCert: certMode,
    semCert,
    raiz: ch.rootCN?.replace("Autoridade Certificadora Raiz Brasileira", "ICP-Brasil").replace("Sectigo Public Server Authentication Root R46", "Sectigo R46") ?? "?",
    intermediaria: ch.chainSent?.[1] ?? null,
    nodeDefault: t("node", "default"),
    bunDefault: t("bun", "default"),
    denoDefault: t("deno", "default"),
    nodeIcp: t("node", "withIcp"),
    bunIcp: t("bun", "withIcp"),
    denoIcp: t("deno", "withIcp"),
    denoViavel: deno,
    ocspStapling: /OCSP Response Status: successful/.test(full) ? "sim" : "não",
    ocspUrl: ch.ocsp ?? null,
    caIssuers: ch.caIssuers ?? null,
    retomada: o.resumed ? "sim" : "não",
    leafNotAfter: ch.leafNotAfter ?? null,
    peerSigType: o.peerSigType,
    requestedSigAlgs: o.requestedSigAlgs,
    clientCaNames: (o.clientCaNames as string[]).length,
  });
}
writeFileSync("out/summary.json", `${JSON.stringify(rows, null, 2)}\n`);

const cols: [string, string][] = [
  ["host", "Host"],
  ["uso", "Uso"],
  ["tls", "TLS aceitos"],
  ["cifra", "Cifra (openssl)"],
  ["pedeCert", "Pede cert"],
  ["semCert", "Sem cert"],
  ["raiz", "Raiz"],
  ["nodeDefault", "Node/Bun padrão"],
  ["denoDefault", "Deno padrão"],
  ["nodeIcp", "+ICP (N/B/D)"],
  ["denoViavel", "Deno viável"],
  ["ocspStapling", "OCSP staple"],
  ["retomada", "Retomada"],
];
console.log(`| ${cols.map((c) => c[1]).join(" | ")} |`);
console.log(`|${cols.map(() => "---").join("|")}|`);
for (const r of rows) {
  const vals = cols.map(([k]) => {
    if (k === "nodeDefault") return r.nodeDefault === r.bunDefault ? r.nodeDefault : `${r.nodeDefault}/${r.bunDefault}`;
    if (k === "nodeIcp") return [r.nodeIcp, r.bunIcp, r.denoIcp].every((x) => x === r.nodeIcp) ? r.nodeIcp : `${r.nodeIcp}/${r.bunIcp}/${r.denoIcp}`;
    if (k === "host") return `\`${r.host}\``;
    return String(r[k] ?? "");
  });
  console.log(`| ${vals.join(" | ")} |`);
}
