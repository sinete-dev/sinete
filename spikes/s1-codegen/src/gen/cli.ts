// bun src/gen/cli.ts : regenerate every PL under xsd/ into generated/<PL>/
import { mkdirSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildIR } from "./xsd.ts";
import { emitModule } from "./emit.ts";

const here = new URL("../..", import.meta.url).pathname;
const pls = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(join(here, "xsd")).filter((d) => d.startsWith("PL_"));
for (const pl of pls) {
  const nfe = join(here, "xsd", pl, "nfe_v4.00.xsd");
  const mdfe = join(here, "xsd", pl, "procMDFe_v3.00.xsd");
  const t0 = performance.now();
  let ir;
  if (existsSync(nfe)) ir = buildIR(pl, nfe, [{ element: "NFe" }, { type: "TNfeProc" }]);
  else if (existsSync(mdfe)) {
    const modals = ["mdfeModalRodoviario_v3.00.xsd", "mdfeModalAereo_v3.00.xsd", "mdfeModalAquaviario_v3.00.xsd", "mdfeModalFerroviario_v3.00.xsd"].map((f) => join(here, "xsd", pl, f));
    ir = buildIR(pl, mdfe, [{ element: "mdfeProc" }], { extraEntries: modals, anyBindings: { "TMDFe.infMDFe.infModal": ["rodo", "aereo", "aquav", "ferrov"] } });
  } else continue;
  const { code, stats } = emitModule(ir, "../../src/runtime/desc.ts");
  const dir = join(here, "generated", pl);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, existsSync(nfe) ? "nfe.ts" : "mdfe.ts"), code);
  writeFileSync(join(dir, "ir.json"), JSON.stringify(ir, (_k, v) => (v === Infinity ? "unbounded" : v), 1) + "\n");
  console.log(pl, { ...stats, ms: Math.round(performance.now() - t0), unsupported: ir.unsupported });
}
