// Harness de regressão visual: PDF -> PNG (pdftoppm, 100 dpi, cinza) -> pixelmatch contra a golden.
// Uso: bun vr/diff.ts [--update]   (golden em vr/golden/<fixture>-<pág>.png, commitável: só fixtures sintéticas)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { PNG } from "pngjs"; import pixelmatch from "pixelmatch";
export function rasterize(pdf: string, outPrefix: string, dpi = 100): string[] {
  const dir = outPrefix.slice(0, outPrefix.lastIndexOf("/")); mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (`${dir}/${f}`.startsWith(outPrefix + "-")) rmSync(`${dir}/${f}`);
  execFileSync("pdftoppm", ["-r", String(dpi), "-gray", "-png", "-aa", "no", "-aaVector", "no", pdf, outPrefix]);
  return readdirSync(dir).filter((f) => `${dir}/${f}`.startsWith(outPrefix + "-")).sort().map((f) => `${dir}/${f}`);
}
export function diffPng(a: string, b: string, out?: string) {
  const A = PNG.sync.read(readFileSync(a)), B = PNG.sync.read(readFileSync(b));
  if (A.width !== B.width || A.height !== B.height) return { pixels: -1, ratio: 1 };
  const D = new PNG({ width: A.width, height: A.height });
  const pixels = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
  if (out && pixels) writeFileSync(out, PNG.sync.write(D));
  return { pixels, ratio: pixels / (A.width * A.height) };
}
if (import.meta.main) {
  const update = process.argv.includes("--update");
  const { FIXTURES, nfeXml } = await import("../src/fixtures.ts");
  const { danfe } = await import("../src/layout/danfe.ts"); const { toPdfRaw } = await import("../src/backends/pdf-raw.ts");
  mkdirSync("vr/golden", { recursive: true }); mkdirSync("out/vr", { recursive: true });
  let fail = 0;
  const { dacce } = await import("../src/layout/dacce.ts");
  const cases = [...FIXTURES.map((fx) => ({ name: fx.name, doc: () => danfe(nfeXml(fx)) })), { name: "dacce", doc: () => dacce(readFileSync("fixtures/cce-sintetica.xml", "utf8"), nfeXml(FIXTURES[0])) }];
  for (const fx of cases) {
    const pdf = `out/vr/${fx.name}.pdf`; writeFileSync(pdf, toPdfRaw(fx.doc()));
    const pngs = rasterize(pdf, `out/vr/${fx.name}`);
    for (const png of pngs) {
      const gold = `vr/golden/${png.split("/").pop()}`;
      if (update || !existsSync(gold)) { writeFileSync(gold, readFileSync(png)); console.log("golden", gold); continue; }
      const r = diffPng(gold, png, png.replace(".png", ".diff.png"));
      const ok = r.pixels === 0; if (!ok) fail++;
      console.log(ok ? "ok  " : "DIFF", gold, r.pixels);
    }
  }
  process.exit(fail ? 1 : 0);
}
