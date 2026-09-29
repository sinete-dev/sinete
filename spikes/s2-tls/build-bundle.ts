// Spike S2: monta o bundle ICP-Brasil (raízes + intermediárias vistas nos servidores) e analisa as cadeias.
// Uso: bun build-bundle.ts   (depois de probe-openssl.ts)
// Entrada: icp/raw/ac/*.crt (ACcompactado.zip do ITI, sha512 conferido) e out/chains/*.pem
// Saída: icp/icp-brasil-bundle.json, icp/icp-brasil-bundle.pem, out/chains.json
import { X509Certificate, createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const splitPem = (s: string) => s.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
const cn = (dn: string) => /CN=([^\n]+)/.exec(dn)?.[1] ?? dn;

// 1) raízes oficiais
const ROOTS = ["v5", "v6", "v7", "v10", "v11", "v12"];
const acDir = "icp/raw/ac";
const zipSha512 = createHash("sha512").update(readFileSync("icp/raw/ACcompactado.zip")).digest("hex");
const officialHash = readFileSync("icp/raw/ACcompactado.zip.sha512", "utf8").trim().split(/\s+/)[0];
if (zipSha512 !== officialHash) throw new Error("ACcompactado.zip não confere com hashsha512.txt do ITI");

type Entry = {
  kind: "root" | "intermediate";
  subjectCN: string;
  subject: string;
  issuerCN: string;
  sha256: string;
  notBefore: string;
  notAfter: string;
  keyType: string;
  source: string;
  seenOn?: string[];
  pem: string;
};
const keyType = (c: X509Certificate) => {
  try {
    const k = c.publicKey;
    const d = k.asymmetricKeyDetails;
    return `${k.asymmetricKeyType}${d?.modulusLength ? `-${d.modulusLength}` : d?.namedCurve ? `-${d.namedCurve}` : ""}`;
  } catch {
    const oid = /Public Key Algorithm: ([^\n]+)/.exec(c.toString())?.[1];
    return `nao-suportado-pela-runtime(${oid ?? "?"})`;
  }
};
const describe = (pem: string, kind: Entry["kind"], source: string): Entry => {
  const c = new X509Certificate(pem);
  return {
    kind,
    subjectCN: cn(c.subject),
    subject: c.subject.replace(/\n/g, ", "),
    issuerCN: cn(c.issuer),
    sha256: c.fingerprint256,
    notBefore: new Date(c.validFrom).toISOString(),
    notAfter: new Date(c.validTo).toISOString(),
    keyType: keyType(c),
    source,
    pem: pem.trim(),
  };
};
const bundle = new Map<string, Entry>();
for (const v of ROOTS) {
  const pem = readFileSync(`${acDir}/ICP-Brasil${v}.crt`, "utf8");
  const e = describe(pem, "root", `http://acraiz.icpbrasil.gov.br/credenciadas/CertificadosAC-ICP-Brasil/ACcompactado.zip#ICP-Brasil${v}.crt`);
  bundle.set(e.sha256, e);
}
// índice de todas as ACs do zip, para classificar intermediárias vistas
const acIndex = new Map<string, string>();
for (const f of readdirSync(acDir)) for (const p of splitPem(readFileSync(`${acDir}/${f}`, "utf8"))) acIndex.set(new X509Certificate(p).fingerprint256, f);

// 2) cadeias
const rootsBySubject = new Map([...bundle.values()].map((e) => [e.subject, e]));
const chains: Record<string, unknown>[] = [];
for (const f of readdirSync("out/chains").filter((f) => f.endsWith(".pem")).sort()) {
  const host = f.replace(/\.pem$/, "");
  // só o bloco "Certificate chain" do s_client: com -status o OCSP também imprime o certificado do respondedor
  const full = readFileSync(`out/openssl/${host}.full.txt`, "utf8");
  const block = /Certificate chain\n([\s\S]*?)\n---\nServer certificate/.exec(full)?.[1] ?? "";
  const certs = splitPem(block).map((p) => ({ p, c: new X509Certificate(p) }));
  writeFileSync(`out/chains/${f}`, `${certs.map((x) => x.p).join("\n")}\n`);
  if (!certs.length) continue;
  const leaf = certs[0].c;
  const last = certs[certs.length - 1].c;
  const rootSubject = last.issuer.replace(/\n/g, ", ");
  const icp = /ICP-Brasil/.test(rootSubject);
  for (const { p, c } of certs.slice(1)) {
    if (!/ICP-Brasil/.test(c.issuer) && !/ICP-Brasil/.test(c.subject)) continue;
    const isRoot = c.subject === c.issuer;
    if (isRoot) continue;
    const e = bundle.get(c.fingerprint256) ?? describe(p, "intermediate", acIndex.has(c.fingerprint256) ? `ACcompactado.zip#${acIndex.get(c.fingerprint256)}` : `servidor ${host} (não está no zip do ITI)`);
    e.seenOn = [...new Set([...(e.seenOn ?? []), host])];
    bundle.set(e.sha256, e);
  }
  const info = leaf.infoAccess ?? "";
  chains.push({
    host,
    leafCN: cn(leaf.subject),
    san: leaf.subjectAltName,
    leafNotAfter: new Date(leaf.validTo).toISOString().slice(0, 10),
    leafKey: describe(certs[0].p, "intermediate", "").keyType,
    chainSent: certs.map((x) => cn(x.c.subject)),
    rootCN: last.subject === last.issuer ? cn(last.subject) : cn(last.issuer),
    rootSentByServer: last.subject === last.issuer,
    icpBrasil: icp,
    rootInBundle: icp ? rootsBySubject.has(rootSubject) : null,
    ocsp: /OCSP - URI:([^\n]+)/.exec(info)?.[1] ?? null,
    caIssuers: /CA Issuers - URI:([^\n]+)/.exec(info)?.[1] ?? null,
  });
}
writeFileSync("out/chains.json", `${JSON.stringify(chains, null, 2)}\n`);

const entries = [...bundle.values()].sort((a, b) => (a.kind === b.kind ? a.subjectCN.localeCompare(b.subjectCN) : a.kind === "root" ? -1 : 1));
writeFileSync(
  "icp/icp-brasil-bundle.json",
  `${JSON.stringify(
    {
      $comment: "Rascunho do dado que iria em @sinete/cert. Raízes e intermediárias ICP-Brasil vistas nos servidores DF-e.",
      version: "2026.09.25",
      source: "http://acraiz.icpbrasil.gov.br/credenciadas/CertificadosAC-ICP-Brasil/ACcompactado.zip",
      sourceSha512: zipSha512,
      sourceHashUrl: "http://acraiz.icpbrasil.gov.br/credenciadas/CertificadosAC-ICP-Brasil/hashsha512.txt",
      retrievedAt: "2026-09-25",
      certificates: entries,
    },
    null,
    2,
  )}\n`,
);
writeFileSync("icp/icp-brasil-bundle.pem", `${entries.map((e) => `# ${e.kind}: ${e.subjectCN} sha256=${e.sha256}\n${e.pem}`).join("\n")}\n`);
writeFileSync("icp/icp-brasil-roots.pem", `${entries.filter((e) => e.kind === "root").map((e) => e.pem).join("\n")}\n`);
for (const e of entries) console.log(e.kind.padEnd(12), e.subjectCN.padEnd(60), e.notAfter.slice(0, 10), e.keyType, e.source.slice(0, 60), (e.seenOn ?? []).length);
