// Spike S2: sondagem TLS leve via openssl s_client, sem certificado de cliente.
// Por host: 1 handshake completo (-showcerts -status), 1 retomada de sessão, 4 handshakes de versão (1.0 a 1.3).
// Uso: bun probe-openssl.ts [host...]   (sem args: todos de hosts.json)
// Saída: out/openssl/<host>.json e out/chains/<host>.pem
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";

mkdirSync("out/openssl", { recursive: true });
mkdirSync("out/chains", { recursive: true });

function sclient(host: string, extra: string[], stdin = "", timeoutMs = 20000) {
  const r = spawnSync(
    "openssl",
    ["s_client", "-connect", `${host}:443`, "-servername", host, ...extra],
    { input: stdin, timeout: timeoutMs, encoding: "utf8" },
  );
  return `${r.stdout ?? ""}\n${r.stderr ?? ""}${r.error ? `\nSPAWN_ERROR ${r.error.message}` : ""}`;
}

const field = (out: string, re: RegExp) => re.exec(out)?.[1]?.trim() ?? null;

function probe(host: string) {
  const res: Record<string, unknown> = { host, probedAt: new Date().toISOString() };

  // 1) handshake completo com cadeia, pedido de OCSP stapling e sessão salva
  const sess = `/tmp/s2-${host}.sess`;
  const full = sclient(host, ["-showcerts", "-status", "-sess_out", sess], "", 25000);
  writeFileSync(`out/openssl/${host}.full.txt`, full);
  res.connected = /CONNECTED\(/.test(full) && /Cipher is|Cipher    :/.test(full);
  res.protocol = field(full, /Protocol\s*:\s*(\S+)/) ?? field(full, /New, (TLSv[\d.]+)/);
  res.cipher = field(full, /Cipher is (\S+)/);
  res.peerSigType = field(full, /Peer signature type: (\S+)/);
  res.tempKey = field(full, /(?:Peer|Server) Temp Key: ([^\n]+)/);
  res.serverKey = field(full, /Server public key is (\d+) bit/);
  res.secureRenegotiation = /Secure Renegotiation IS supported/.test(full);
  res.alpn = field(full, /ALPN protocol: (\S+)/);
  res.ocspStapled = /OCSP Response Status: successful/.test(full)
    ? true
    : /OCSP response: no response sent/.test(full)
      ? false
      : null;
  res.sessionTicketHint = field(full, /TLS session ticket lifetime hint: (\d+)/);
  const caBlock = /Acceptable client certificate CA names\n([\s\S]*?)\n(?:Client Certificate Types|Requested Signature Algorithms)/.exec(full);
  res.certificateRequest = /Acceptable client certificate CA names|No client certificate CA names sent|Client Certificate Types/.test(full);
  res.clientCaNames = caBlock ? caBlock[1].split("\n").map((s) => s.trim()).filter(Boolean) : [];
  res.clientCertTypes = field(full, /Client Certificate Types: ([^\n]+)/);
  res.requestedSigAlgs = field(full, /\nRequested Signature Algorithms: ([^\n]+)/);
  res.verifyReturn = field(full, /Verify return code: ([^\n]+)/);
  const chain: { s: string; i: string; key: string | null; validity: string | null }[] = [];
  for (const m of full.matchAll(/ \d+ s:([^\n]+)\n\s+i:([^\n]+)(?:\n\s+a:([^\n]+))?(?:\n\s+v:([^\n]+))?/g))
    chain.push({ s: m[1], i: m[2], key: m[3] ?? null, validity: m[4] ?? null });
  res.chain = chain;
  const chainBlock = /Certificate chain\n([\s\S]*?)\n---\nServer certificate/.exec(full)?.[1] ?? "";
  const pems = chainBlock.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
  writeFileSync(`out/chains/${host}.pem`, `${pems.join("\n")}\n`);
  if (!res.connected) res.error = full.split("\n").filter((l) => /error|errno|refused|timed out|SPAWN_ERROR/i.test(l)).slice(0, 5);

  // 2) retomada de sessão (ticket ou session id)
  if (res.connected) {
    const again = sclient(host, ["-sess_in", sess], "", 20000);
    res.resumed = /^Reused, /m.test(again);
  }
  rmSync(sess, { force: true });

  // 3) versões aceitas
  const versions: Record<string, string | boolean> = {};
  for (const [v, flag] of [["1.0", "-tls1"], ["1.1", "-tls1_1"], ["1.2", "-tls1_2"], ["1.3", "-tls1_3"]] as const) {
    const args = [flag];
    if (v === "1.0" || v === "1.1") args.push("-cipher", "DEFAULT:@SECLEVEL=0");
    const o = sclient(host, args, "", 15000);
    const ok = /Cipher is (?!\(NONE\))(\S+)/.exec(o);
    versions[v] = ok ? ok[1] : false;
  }
  res.versions = versions;
  writeFileSync(`out/openssl/${host}.json`, `${JSON.stringify(res, null, 2)}\n`);
  return res;
}

const hosts: string[] = process.argv.slice(2).length
  ? process.argv.slice(2)
  : JSON.parse(readFileSync("hosts.json", "utf8")).map((h: { host: string }) => h.host);
for (const h of hosts) {
  const r = probe(h);
  console.log(h, r.connected, r.protocol, r.cipher, `certReq=${r.certificateRequest}(${(r.clientCaNames as string[]).length})`, JSON.stringify(r.versions), `resumed=${r.resumed}`);
}
