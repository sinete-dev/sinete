// Lê os PFX de teste (.local/pfx/*.pfx) com três caminhos e prova que a chave extraída assina.
// Uso: <runtime> bench/pfx.ts
import { readdirSync, readFileSync } from 'node:fs';
import tls from 'node:tls';
import forge from 'node-forge';
import * as pkijs from 'pkijs';
import { spkiFromCert } from '../src/dsig.ts';

const runtime = 'Deno' in globalThis ? 'deno' : 'Bun' in globalThis ? 'bun' : 'node';
const DIR = '.local/pfx';
const subtle = globalThis.crypto.subtle;
pkijs.setEngine('sinete', new pkijs.CryptoEngine({ name: 'sinete', crypto: globalThis.crypto }));
const msg = new TextEncoder().encode('<SignedInfo>teste</SignedInfo>');

async function provaAssinatura(pkcs8: Uint8Array, certDer: Uint8Array): Promise<boolean> {
  const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' };
  const k = await subtle.importKey('pkcs8', pkcs8, alg, false, ['sign']);
  const s = await subtle.sign(alg.name, k, msg);
  const pub = await subtle.importKey('spki', spkiFromCert(certDer), alg, false, ['verify']);
  return subtle.verify(alg.name, pub, s, msg);
}

function viaTls(buf: Uint8Array, pw: string): string {
  try {
    tls.createSecureContext({ pfx: Buffer.from(buf), passphrase: pw });
    return 'ok (só TLS, sem extrair chave)';
  } catch (e) {
    return 'FALHA: ' + String((e as Error).message ?? e).slice(0, 50);
  }
}

async function viaForge(buf: Uint8Array, pw: string): Promise<string> {
  try {
    const t0 = performance.now();
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.binary.raw.encode(buf)), pw);
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
    const key = keyBags[0]?.key;
    if (!key) return 'FALHA: sem chave';
    const pk8 = forge.asn1.toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(key))).getBytes();
    // folha = cert cujo módulo bate com a chave
    const leaf = certBags.find((b) => (b.cert!.publicKey as forge.pki.rsa.PublicKey).n.equals((key as forge.pki.rsa.PrivateKey).n))!;
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(leaf.cert!)).getBytes();
    const ms = performance.now() - t0;
    const ok = await provaAssinatura(forge.util.binary.raw.decode(pk8), forge.util.binary.raw.decode(certDer));
    return `${ok ? 'ok' : 'FALHA assinatura'} (${certBags.length} certs, ${ms.toFixed(1)} ms)`;
  } catch (e) {
    return 'FALHA: ' + String((e as Error).message ?? e).slice(0, 50);
  }
}

async function viaPkijs(buf: Uint8Array, pw: string): Promise<string> {
  try {
    const t0 = performance.now();
    const password = new TextEncoder().encode(pw).buffer;
    const pfx = pkijs.PFX.fromBER(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    await pfx.parseInternalValues({ password, checkIntegrity: true });
    const auth = pfx.parsedValue!.authenticatedSafe!;
    await auth.parseInternalValues({ safeContents: auth.safeContents.map(() => ({ password })) });
    let pk8: Uint8Array | undefined;
    const certs: Uint8Array[] = [];
    for (const sc of auth.parsedValue!.safeContents) {
      for (const bag of sc.value.safeBags) {
        if (bag.bagId === '1.2.840.113549.1.12.10.1.2') {
          await (bag.bagValue as pkijs.PKCS8ShroudedKeyBag).parseInternalValues({ password });
          pk8 = new Uint8Array((bag.bagValue as pkijs.PKCS8ShroudedKeyBag).parsedValue!.toSchema().toBER());
        } else if (bag.bagId === '1.2.840.113549.1.12.10.1.3') {
          certs.push(new Uint8Array((bag.bagValue as pkijs.CertBag).parsedValue.toSchema().toBER()));
        }
      }
    }
    const ms = performance.now() - t0;
    if (!pk8) return 'FALHA: sem chave';
    let ok = false;
    for (const c of certs) if (await provaAssinatura(pk8, c).catch(() => false)) ok = true;
    return `${ok ? 'ok' : 'FALHA assinatura'} (${certs.length} certs, ${ms.toFixed(1)} ms)`;
  } catch (e) {
    return 'FALHA: ' + String((e as Error).message ?? e).slice(0, 50);
  }
}

const rows: Record<string, Record<string, string>> = {};
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.pfx')).sort()) {
  const buf = new Uint8Array(readFileSync(`${DIR}/${f}`));
  const pw = f.includes('acentuada') ? 'Açaí#2019' : 'teste123';
  rows[f] = { tls: viaTls(buf, pw), forge: await viaForge(buf, pw), pkijs: await viaPkijs(buf, pw) };
}
console.log(runtime);
console.table(rows);
