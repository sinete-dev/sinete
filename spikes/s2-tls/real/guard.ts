// Spike S2 parte 2: guarda dura do transporte com certificado REAL.
// Só hosts de NF-e homologação (tpAmb=2), MDF-e homologação e NFS-e Nacional produção restrita.
// Qualquer outro host lança ANTES de abrir socket. Cada uso do certificado vai para o ledger, sem segredo.
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Lista fechada, escrita à mão (não derivada de dados), conferida contra endpoints.json de 25/09/2026.
export const ALLOWED_HOSTS: ReadonlyMap<string, string> = new Map([
  // NF-e homologação: autorizadores próprios
  ["homnfe.sefaz.am.gov.br", "nfe-hom:AM"],
  ["hnfe.sefaz.ba.gov.br", "nfe-hom:BA"],
  ["homolog.sefaz.go.gov.br", "nfe-hom:GO"],
  ["hnfe.fazenda.mg.gov.br", "nfe-hom:MG"],
  ["hom.nfe.sefaz.ms.gov.br", "nfe-hom:MS"],
  ["homologacao.sefaz.mt.gov.br", "nfe-hom:MT"],
  ["nfehomolog.sefaz.pe.gov.br", "nfe-hom:PE"],
  ["homologacao.nfe.sefa.pr.gov.br", "nfe-hom:PR"],
  ["nfe-homologacao.sefazrs.rs.gov.br", "nfe-hom:RS"],
  ["homologacao.nfe.fazenda.sp.gov.br", "nfe-hom:SP"],
  // NF-e homologação: virtuais, contingência, cadastro SVRS e Ambiente Nacional
  ["hom.sefazvirtual.fazenda.gov.br", "nfe-hom:SVAN/SVC-AN"],
  ["nfe-homologacao.svrs.rs.gov.br", "nfe-hom:SVRS/SVC-RS"],
  ["cad-homologacao.svrs.rs.gov.br", "nfe-hom:SVRS-cadastro"],
  ["hom1.nfe.fazenda.gov.br", "nfe-hom:AN"],
  // MDF-e homologação
  ["mdfe-homologacao.svrs.rs.gov.br", "mdfe-hom:SVRS"],
  // NFS-e Nacional produção restrita
  ["sefin.producaorestrita.nfse.gov.br", "nfse-restrita:sefin"],
  ["adn.producaorestrita.nfse.gov.br", "nfse-restrita:adn"],
]);

export class GuardError extends Error {
  override name = "GuardError";
}

/** Lança se a URL não for https://<host permitido>[:443]/... ou se o corpo declarar tpAmb diferente de 2. */
export function assertAllowed(rawUrl: string, body?: string): { host: string; kind: string } {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new GuardError(`URL inválida: ${rawUrl}`);
  }
  if (u.protocol !== "https:") throw new GuardError(`só https: ${u.protocol}`);
  if (u.port !== "" && u.port !== "443") throw new GuardError(`porta não permitida: ${u.port}`);
  if (u.username || u.password) throw new GuardError("credencial na URL");
  const host = u.hostname.toLowerCase();
  const kind = ALLOWED_HOSTS.get(host);
  if (!kind) throw new GuardError(`host fora da allowlist (produção ou desconhecido): ${host}`);
  if (body !== undefined) {
    const amb = [...body.matchAll(/<tpAmb>\s*([^<\s]*)\s*<\/tpAmb>/g)].map((m) => m[1]);
    if (amb.some((a) => a !== "2")) throw new GuardError(`tpAmb diferente de 2 no corpo: ${amb.join(",")}`);
    if (kind.startsWith("nfe-hom") || kind.startsWith("mdfe-hom")) {
      // tpAmb dentro do XML assinado também (NF-e: <ide><tpAmb>); coberto pela regra acima.
    }
    if (kind.startsWith("nfse-restrita") && /<tpAmb>\s*1\s*<\/tpAmb>/.test(body)) throw new GuardError("DPS com tpAmb=1");
  }
  return { host, kind };
}

export const LEDGER = join(homedir(), ".local/state/sinete/cert-usage.log");

/** Uma linha por uso do certificado: ISO time, runtime, host, serviço, resultado. Nunca segredo. */
export function logUse(host: string, service: string, outcome: string, ledger = LEDGER) {
  mkdirSync(join(ledger, ".."), { recursive: true });
  const clean = (s: string) => s.replace(/[\r\n\t]+/g, " ").slice(0, 300);
  const rt = typeof (globalThis as any).Deno !== "undefined" ? "deno" : typeof (globalThis as any).Bun !== "undefined" ? "bun" : "node";
  appendFileSync(ledger, `${new Date().toISOString()}\t${rt}\t${clean(host)}\t${clean(service)}\t${clean(outcome)}\n`);
}
