// Spike S4: lado JS do protocolo v1. Sobe o helper (sinete-signer), fala NDJSON por stdio,
// e responde aos pedidos "sign" com uma chave que só este processo tem.
// Dois modos de chave:
//   digest  -> KeyObject do node:crypto (privateEncrypt sobre DigestInfo): A1 em memória, igual a PSC/OpenBao/PKCS#11
//   message -> CryptoKey WebCrypto NÃO exportável: o helper manda o transcript e este lado assina a mensagem
// No modo message, este lado confere o próprio transcript (SNI e certificado do servidor) antes de assinar:
// a política não depende só do helper.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants, createHash, privateEncrypt, X509Certificate, type KeyObject } from "node:crypto";

export type KeySigner =
  | { mode: "digest"; key: KeyObject }
  | { mode: "message"; key: CryptoKey };

export interface HolderOptions {
  helper: string;
  args?: string[];
  /** Hosts em que esta chave aceita autenticar (política do dono da chave, independente do helper). */
  allowedHosts: ReadonlySet<string>;
  /** Exigir que o certificado do servidor no transcript cubra o host (modo message). */
  checkTranscript?: boolean;
  log?: (s: string) => void;
  /** Variáveis extras para o helper (ex.: SOFTHSM2_CONF). Nunca segredo. */
  env?: Record<string, string>;
}

const DIGEST_INFO: Record<string, Buffer> = {
  rsa_pkcs1_sha256: Buffer.from("3031300d060960864801650304020105000420", "hex"),
  rsa_pkcs1_sha1: Buffer.from("3021300906052b0e03021a05000414", "hex"),
};

export interface SignEvent {
  identity: string;
  scheme: string;
  mode: string;
  host: string;
  conn: number;
  handshake: number;
  holderMs: number;
  transcriptBytes?: number;
  sni?: string | null;
  serverCertCN?: string | null;
}

export class SignerHelper {
  private proc: ChildProcessWithoutNullStreams;
  private next = 1;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private keys = new Map<string, KeySigner>();
  private buf = "";
  readonly signEvents: SignEvent[] = [];
  /** Latência artificial por assinatura (simula PSC/HSM remoto). */
  signDelayMs = 0;

  constructor(private opts: HolderOptions) {
    // env mínimo: nada do processo pai (segredos de outras ferramentas) vai para o helper
    this.proc = spawn(opts.helper, opts.args ?? [], { stdio: ["pipe", "pipe", "pipe"], env: { PATH: "/usr/bin:/bin", HOME: process.env.HOME ?? "", ...(opts.env ?? {}) } });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (d: string) => this.onData(d));
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (d: string) => opts.log?.(d.trimEnd()));
  }

  private send(f: object) {
    this.proc.stdin.write(`${JSON.stringify({ v: 1, ...f })}\n`);
  }

  private onData(d: string) {
    this.buf += d;
    let i: number;
    while ((i = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 1);
      if (!line.trim()) continue;
      const f = JSON.parse(line);
      if (f.method) void this.onRequest(f);
      else {
        const p = this.pending.get(f.id);
        if (!p) continue;
        this.pending.delete(f.id);
        f.error ? p.reject(Object.assign(new Error(`${f.error.code}: ${f.error.message}`), { code: f.error.code })) : p.resolve(f.result);
      }
    }
  }

  call<T = any>(method: string, params: object = {}): Promise<T> {
    const id = `c${this.next++}`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ id, method, params });
    });
  }

  registerKey(identity: string, k: KeySigner) {
    this.keys.set(identity, k);
  }

  private async onRequest(f: any) {
    try {
      if (f.method !== "sign") throw Object.assign(new Error(f.method), { code: "unknown_method" });
      const result = await this.sign(f.params);
      this.send({ id: f.id, result });
    } catch (e: any) {
      this.send({ id: f.id, error: { code: e.code ?? "sign_refused", message: String(e.message ?? e) } });
    }
  }

  private async sign(p: any): Promise<{ signature: string }> {
    const t0 = performance.now();
    const k = this.keys.get(p.identity);
    if (!k) throw Object.assign(new Error(`sem chave para ${p.identity}`), { code: "unknown_identity" });
    const ctx = p.context ?? {};
    if (ctx.purpose !== "tls12-client-certificate-verify") throw Object.assign(new Error(`propósito recusado: ${ctx.purpose}`), { code: "sign_refused" });
    if (!this.opts.allowedHosts.has(String(ctx.host))) throw Object.assign(new Error(`host fora da política do dono da chave: ${ctx.host}`), { code: "sign_refused" });
    if (!(p.scheme in DIGEST_INFO)) throw Object.assign(new Error(`esquema recusado: ${p.scheme}`), { code: "sign_refused" });
    if (p.mode !== k.mode) throw Object.assign(new Error(`modo ${p.mode} não bate com a chave (${k.mode})`), { code: "sign_refused" });
    const ev: SignEvent = { identity: p.identity, scheme: p.scheme, mode: p.mode, host: ctx.host, conn: ctx.conn, handshake: ctx.handshake, holderMs: 0 };
    let sig: Uint8Array;
    if (k.mode === "digest") {
      const digest = Buffer.from(p.digest, "base64");
      const want = p.scheme === "rsa_pkcs1_sha256" ? 32 : 20;
      if (digest.length !== want) throw Object.assign(new Error("digest com tamanho errado"), { code: "sign_refused" });
      sig = privateEncrypt({ key: k.key, padding: constants.RSA_PKCS1_PADDING }, Buffer.concat([DIGEST_INFO[p.scheme], digest]));
    } else {
      if (p.scheme !== "rsa_pkcs1_sha256") throw Object.assign(new Error("WebCrypto importado para SHA-256"), { code: "sign_refused" });
      const msg = Buffer.from(p.message, "base64");
      if (createHash("sha256").update(msg).digest("base64") !== p.messageSha256) throw Object.assign(new Error("hash do transcript não confere"), { code: "sign_refused" });
      const t = parseTranscript(msg);
      ev.transcriptBytes = msg.length;
      ev.sni = t.sni;
      ev.serverCertCN = t.serverCert ? /CN=([^\n,]+)/.exec(t.serverCert.subject)?.[1] ?? null : null;
      if (this.opts.checkTranscript) {
        // O transcript tem o ClientHello (SNI) e o Certificate do servidor em claro (TLS 1.2).
        // Um helper comprometido não consegue fazer esta chave autenticar em outro servidor sem que isso apareça aqui.
        if (t.sni !== ctx.host) throw Object.assign(new Error(`SNI do transcript (${t.sni}) != host do contexto (${ctx.host})`), { code: "sign_refused" });
        if (!t.serverCert || !t.serverCert.checkHost(ctx.host) && !t.serverCert.checkIP(ctx.host)) throw Object.assign(new Error("certificado do servidor no transcript não cobre o host"), { code: "sign_refused" });
      }
      sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k.key, msg));
    }
    if (this.signDelayMs > 0) await new Promise((r) => setTimeout(r, this.signDelayMs));
    ev.holderMs = performance.now() - t0;
    this.signEvents.push(ev);
    return { signature: Buffer.from(sig).toString("base64") };
  }

  async close() {
    this.proc.stdin.end();
    await new Promise((r) => this.proc.once("exit", r));
  }
}

/** Lê as mensagens de handshake TLS 1.2 do transcript: SNI do ClientHello e folha do Certificate do servidor. */
export function parseTranscript(b: Uint8Array): { sni: string | null; serverCert: X509Certificate | null; types: number[] } {
  const buf = Buffer.from(b);
  let off = 0;
  let sni: string | null = null;
  let serverCert: X509Certificate | null = null;
  const types: number[] = [];
  while (off + 4 <= buf.length) {
    const type = buf[off];
    const len = buf.readUIntBE(off + 1, 3);
    const body = buf.subarray(off + 4, off + 4 + len);
    types.push(type);
    if (type === 1) {
      let o = 2 + 32;
      o += 1 + body[o];
      o += 2 + body.readUInt16BE(o);
      o += 1 + body[o];
      if (o + 2 <= body.length) {
        const end = o + 2 + body.readUInt16BE(o);
        o += 2;
        while (o + 4 <= end) {
          const et = body.readUInt16BE(o);
          const el = body.readUInt16BE(o + 2);
          if (et === 0) {
            const nl = body.readUInt16BE(o + 4 + 3);
            sni = body.subarray(o + 4 + 5, o + 4 + 5 + nl).toString("latin1");
          }
          o += 4 + el;
        }
      }
    } else if (type === 11 && !serverCert) {
      const first = body.readUIntBE(3, 3);
      serverCert = new X509Certificate(body.subarray(6, 6 + first));
    }
    off += 4 + len;
  }
  return { sni, serverCert, types };
}
