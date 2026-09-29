// Decodifica o Code-128C da chave com zbarimg (leitor independente) em fixtures e numa amostra do corpus. Só agregados.
import { execFileSync } from "node:child_process"; import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { danfe } from "./layout/danfe.ts"; import { toPdfRaw } from "./backends/pdf-raw.ts";
mkdirSync(".local/bc", { recursive: true });
const base = `${process.env.HOME}/.local/state/sinete/corpus`;
const files = [...readdirSync("fixtures").map((f) => `fixtures/${f}`), ...readdirSync(`${base}/nfe-proprias`).sort().filter((_, i) => i % 21 === 0).map((f) => `${base}/nfe-proprias/${f}`), ...readdirSync(`${base}/nfe-importadas`).sort().filter((_, i) => i % 15 === 0).map((f) => `${base}/nfe-importadas/${f}`)];
let ok = 0, bad = 0;
for (const dpi of [150, 300]) {
  ok = 0; bad = 0;
  for (const f of files) {
    const xml = readFileSync(f, "utf8"); const chave = /Id="NFe(\d{44})"/.exec(xml)![1];
    writeFileSync(".local/bc/x.pdf", toPdfRaw(danfe(xml)));
    execFileSync("pdftoppm", ["-r", String(dpi), "-gray", "-png", "-f", "1", "-l", "1", "-singlefile", ".local/bc/x.pdf", ".local/bc/x"]);
    let out = ""; try { out = execFileSync("zbarimg", ["-q", "--raw", "-Scode128.enable", ".local/bc/x.png"]).toString(); } catch {}
    out.split("\n").includes(chave) ? ok++ : bad++;
  }
  console.log(`${dpi} dpi: ${ok}/${ok + bad} chaves decodificadas corretamente`);
}
