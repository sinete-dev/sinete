// Deno (rustls não renegocia nem faz CBC) usando o helper: chave WebCrypto não exportável no Deno, modo message.
import { Buffer } from "node:buffer";
(globalThis as any).Buffer ??= Buffer;
const { X509Certificate, createPrivateKey } = await import("node:crypto");
const { readFileSync } = await import("node:fs");
const { SignerHelper } = await import("../keyholder.ts");
const P = new URL("../.local/pki/", import.meta.url).pathname;
const h = new SignerHelper({ helper: new URL("../bin/sinete-signer", import.meta.url).pathname, args: ["--lab", "--roots", `${P}ca.crt`], allowedHosts: new Set(["localhost"]), checkTranscript: true });
const pkcs8 = createPrivateKey(readFileSync(`${P}client.key`)).export({ format: "der", type: "pkcs8" });
h.registerKey("k", { mode: "message", key: await crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]) });
await h.call("identity.open", { id: "k", backend: "remote", mode: "message", chain: [new X509Certificate(readFileSync(`${P}client.crt`)).raw.toString("base64")] });
for (const u of ["https://localhost:19444/", "https://localhost:19445/"]) {
  try {
    const r = await h.call("http.request", { identity: "k", url: u, method: "GET", headers: {}, body: "", freshConn: true });
    const body = Buffer.from(r.body, "base64").toString();
    console.log("deno", u, r.status, r.tls.cipher, `hs=${r.tls.handshakes} reneg=${r.tls.renegotiations}`, body.includes("sinete-s4-throwaway-client") ? "cert do cliente visto pelo servidor" : body.slice(0, 60));
  } catch (e) { console.log("deno", u, "ERRO", (e as Error).message); }
}
await h.close();
Deno.exit(0);
