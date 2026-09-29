// QR: gera a partir de qrCodMDFe do corpus (e de URLs no formato NFC-e/DANFSe sintéticas), rasteriza e decodifica com zbarimg.
import { execFileSync } from "node:child_process"; import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { qrModules } from "./qr.ts"; import { toPdfRaw } from "./backends/pdf-raw.ts";
mkdirSync(".local/qr", { recursive: true });
const dir = `${process.env.HOME}/.local/state/sinete/corpus/mdfe`;
const urls: string[] = [];
for (const f of readdirSync(dir).sort()) { const m = /<qrCodMDFe>(?:<!\[CDATA\[)?([^<\]]+)/.exec(readFileSync(`${dir}/${f}`, "utf8")); if (m) urls.push(m[1].replace(/&amp;/g, "&")); if (urls.length >= 40) break; }
urls.push("https://www.nfce.fazenda.sp.gov.br/qrcode?p=35260911222333000181650010000012341123456787|3|1|1|" + "A".repeat(40));
urls.push("https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=" + "3".repeat(50));
for (const [size, dpi] of [[25, 150], [15.2, 150], [15.2, 100]] as const) {
  let ok = 0, ver = 0;
  for (const u of urls) {
    const mods = qrModules(u, "M"); ver = Math.max(ver, mods.length);
    writeFileSync(".local/qr/q.pdf", toPdfRaw({ title: "qr", pages: [{ w: 60, h: 60, ops: [{ t: "qr", x: 10, y: 10, size, modules: mods }] }] }));
    execFileSync("pdftoppm", ["-r", String(dpi), "-gray", "-png", "-singlefile", ".local/qr/q.pdf", ".local/qr/q"]);
    let out = ""; try { out = execFileSync("zbarimg", ["-q", "--raw", "-Sdisable", "-Sqrcode.enable", ".local/qr/q.png"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch {}
    if (out === u) ok++;
  }
  console.log(`QR ${size} mm @ ${dpi} dpi: ${ok}/${urls.length} decodificados, maior matriz ${ver} módulos (módulo ${(size / ver).toFixed(2)} mm)`);
}
