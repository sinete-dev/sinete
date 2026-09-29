// Importa os bundles de browser em Node/Deno/Bun, renderiza a fixture e imprime sha256 + tempo.
const xml = await (typeof Deno !== "undefined" ? Deno.readTextFile("fixtures/muitos-itens.xml") : (await import("node:fs/promises")).readFile("fixtures/muitos-itens.xml", "utf8"));
const rt = typeof Deno !== "undefined" ? "deno " + Deno.version.deno : typeof Bun !== "undefined" ? "bun " + Bun.version : "node " + process.version;
const hex = async (u) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", u))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
for (const e of ["raw", "pdflib", "pdfkit", "jspdf"]) {
  try {
    const m = await import(`../out/bundle/${e}/${e}.js`);
    const fn = e === "raw" ? (x) => m.toPdfRaw(m.danfe(x)) : m.render;
    await fn(xml); const t = performance.now(); let out; for (let i = 0; i < 20; i++) out = await fn(xml);
    console.log(rt.padEnd(14), e.padEnd(7), "ok", ((performance.now() - t) / 20).toFixed(2), "ms", await hex(out));
  } catch (err) { console.log(rt.padEnd(14), e.padEnd(7), "ERRO", String(err.message ?? err).slice(0, 80)); }
}
