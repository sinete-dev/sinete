import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ALLOWED_HOSTS, assertAllowed, GuardError, logUse } from "./guard.ts";

const prodHosts = [
  "nfe.fazenda.sp.gov.br",
  "nfe.sefaz.am.gov.br",
  "nfe.svrs.rs.gov.br",
  "cad.svrs.rs.gov.br",
  "www.sefazvirtual.fazenda.gov.br",
  "www1.nfe.fazenda.gov.br",
  "www.nfe.fazenda.gov.br",
  "mdfe.svrs.rs.gov.br",
  "sefin.nfse.gov.br",
  "adn.nfse.gov.br",
  "nfe.fazenda.mg.gov.br",
];

describe("guard", () => {
  test("todo host de produção de endpoints.json é recusado", () => {
    const ep = JSON.parse(readFileSync(join(import.meta.dir, "../endpoints.json"), "utf8"));
    const urls: string[] = [];
    for (const svcs of Object.values(ep.nfe.producao.authorizers) as any[]) for (const s of Object.values(svcs) as any[]) urls.push(s.url);
    for (const s of Object.values(ep.mdfe.producao) as any[]) urls.push(s.url);
    for (const u of Object.values(ep.nfse.producao) as string[]) urls.push(u);
    expect(urls.length).toBeGreaterThan(90);
    for (const u of urls) expect(() => assertAllowed(u)).toThrow(GuardError);
  });
  test("hosts de produção conhecidos recusados", () => {
    for (const h of prodHosts) expect(() => assertAllowed(`https://${h}/x`)).toThrow(GuardError);
  });
  test("todo host de homologação de endpoints.json é aceito", () => {
    const ep = JSON.parse(readFileSync(join(import.meta.dir, "../endpoints.json"), "utf8"));
    for (const svcs of Object.values(ep.nfe.homologacao.authorizers) as any[])
      for (const s of Object.values(svcs) as any[]) expect(assertAllowed(s.url).kind).toMatch(/^nfe-hom/);
    for (const s of Object.values(ep.mdfe.homologacao) as any[]) expect(assertAllowed(s.url).kind).toBe("mdfe-hom:SVRS");
    expect(assertAllowed(`${ep.nfse.producaoRestrita.sefin}/nfse`).kind).toBe("nfse-restrita:sefin");
    expect(assertAllowed(`${ep.nfse.producaoRestrita.adn}/parametrizacao/1/convenio`).kind).toBe("nfse-restrita:adn");
  });
  test("truques de URL", () => {
    const bad = [
      "http://homologacao.nfe.fazenda.sp.gov.br/ws/x",
      "https://homologacao.nfe.fazenda.sp.gov.br:8443/ws/x",
      "https://homologacao.nfe.fazenda.sp.gov.br.evil.com/ws/x",
      "https://evil.com/homologacao.nfe.fazenda.sp.gov.br",
      "https://user:pw@homologacao.nfe.fazenda.sp.gov.br/ws",
      "https://nfe.fazenda.sp.gov.br@homologacao.nfe.fazenda.sp.gov.br/ws",
      "not a url",
      "https://127.0.0.1/",
    ];
    for (const u of bad) expect(() => assertAllowed(u)).toThrow(GuardError);
    expect(assertAllowed("https://HOMOLOGACAO.nfe.fazenda.sp.gov.br:443/ws/x").host).toBe("homologacao.nfe.fazenda.sp.gov.br");
  });
  test("tpAmb=1 no corpo é recusado mesmo em host permitido", () => {
    const u = "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx";
    expect(() => assertAllowed(u, "<a><tpAmb>1</tpAmb></a>")).toThrow(GuardError);
    expect(() => assertAllowed(u, "<a><tpAmb>2</tpAmb><b><tpAmb>1</tpAmb></b></a>")).toThrow(GuardError);
    expect(assertAllowed(u, "<a><tpAmb>2</tpAmb></a>").kind).toBe("nfe-hom:SP");
    expect(assertAllowed(u, "<ConsCad><infCons/></ConsCad>").kind).toBe("nfe-hom:SP");
  });
  test("allowlist não contém nada com cara de produção", () => {
    for (const h of ALLOWED_HOSTS.keys()) expect(h).toMatch(/hom|^hnfe\.|producaorestrita/);
  });
  test("ledger grava uma linha sem quebra", () => {
    const f = join(mkdtempSync(join(tmpdir(), "s2g-")), "l.log");
    logUse("h\nx", "svc", "ok\tfim", f);
    const lines = readFileSync(f, "utf8").trim().split("\n");
    expect(lines.length).toBe(1);
    expect(lines[0].split("\t").length).toBe(5);
  });
});
