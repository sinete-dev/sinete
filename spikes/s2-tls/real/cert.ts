// Spike S2 parte 2: carrega o e-CNPJ A1 real SÓ em memória.
// Lê via op-agentes (spawn sem shell; o segredo nunca vai para argv/env de outro processo),
// abre o PFX legado (RC2-40 + 3DES) com node-forge e devolve PEM em memória.
// Nunca grava, nunca imprime chave, PFX, PEM ou senha.
import { spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import forge from "node-forge";

const ITEM = "op://Agentes/6zjnde57clgjg55q4bohsjoqie";
const HERE = new URL(".", import.meta.url).pathname;

function opRead(field: string): string {
  const r = spawnSync("op-agentes", ["read", `${ITEM}/${field}`], {
    encoding: "utf8",
    env: { ...process.env, OP_AGENTES_NO_CACHE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1 << 22,
  });
  if (r.status !== 0) throw new Error(`op-agentes falhou (${field}): status ${r.status}; ${String(r.stderr).replace(/[^\x20-\x7e]/g, "").slice(0, 200)}`);
  return r.stdout;
}

export interface LoadedCert {
  certPem: string; // cadeia: folha + intermediárias (sem raiz)
  keyPem: string;
  pkcs8Der: Uint8Array; // para o signer WebCrypto do S3
  leafDer: Uint8Array;
  info: {
    subject: string;
    issuer: string;
    serial: string;
    notBefore: string;
    notAfter: string;
    sha256: string;
    chain: string[]; // subjects CN da folha até a raiz
    root: string | null;
    pfxBags: string[]; // CNs dos certificados que vieram no PFX
    keyBits: number;
  };
}

const cn = (dn: string) => /CN=([^\n,]+)/.exec(dn)?.[1] ?? dn;

function icpCatalog(): X509Certificate[] {
  const dir = join(HERE, "../icp/raw/ac");
  const out: X509Certificate[] = [];
  for (const f of readdirSync(dir)) {
    try {
      out.push(new X509Certificate(readFileSync(join(dir, f))));
    } catch {}
  }
  return out;
}

export function loadCert(): LoadedCert {
  const b64 = opRead("pfx_base64").replace(/\s+/g, "");
  const pass = opRead("senha").replace(/\r?\n$/, "");
  const der = forge.util.decode64(b64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der, { parseAllBytes: false }) /* o base64 do cofre traz 1 byte extra no fim */, false, pass);
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
  const key = keyBags[0]?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!key) throw new Error("PFX sem chave privada");
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const pfxCerts = certBags.map((b) => b.cert!).filter(Boolean);
  const leafForge = pfxCerts.find((c) => (c.publicKey as forge.pki.rsa.PublicKey).n.equals(key.n));
  if (!leafForge) throw new Error("nenhum certificado do PFX corresponde à chave");
  const toPem = (c: forge.pki.Certificate) => forge.pki.certificateToPem(c);
  const leaf = new X509Certificate(toPem(leafForge));

  // monta a cadeia: primeiro com o que veio no PFX, depois com o catálogo ICP do ITI
  const pool = [...pfxCerts.map((c) => new X509Certificate(toPem(c))), ...icpCatalog()];
  const chain: X509Certificate[] = [leaf];
  while (chain.length < 6) {
    const cur = chain[chain.length - 1];
    if (cur.subject === cur.issuer) break;
    const up = pool.find((p) => p.subject === cur.issuer && cur.checkIssued(p) && (() => { try { return cur.verify(p.publicKey); } catch { return false; } })());
    if (!up) break;
    chain.push(up);
  }
  const last = chain[chain.length - 1];
  const root = last.subject === last.issuer ? cn(last.subject) : null;
  const sendChain = chain.filter((c) => c.subject !== c.issuer);

  const keyPem = forge.pki.privateKeyToPem(key);
  const pkcs8 = forge.asn1.toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key))).getBytes();
  const pkcs8Der = Uint8Array.from(pkcs8, (ch) => ch.charCodeAt(0));
  return {
    certPem: sendChain.map((c) => c.toString()).join(""),
    keyPem,
    pkcs8Der,
    leafDer: new Uint8Array(leaf.raw),
    info: {
      subject: leaf.subject.replace(/\n/g, ", "),
      issuer: leaf.issuer.replace(/\n/g, ", "),
      serial: leaf.serialNumber,
      notBefore: new Date(leaf.validFrom).toISOString(),
      notAfter: new Date(leaf.validTo).toISOString(),
      sha256: leaf.fingerprint256,
      chain: chain.map((c) => cn(c.subject)),
      root,
      pfxBags: pfxCerts.map((c) => c.subject.getField("CN")?.value ?? "?"),
      keyBits: key.n.bitLength(),
    },
  };
}

if (import.meta.main) {
  const c = loadCert();
  console.log(JSON.stringify(c.info, null, 2));
}
