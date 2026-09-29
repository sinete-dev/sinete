// Spike S2: monta endpoints.json a partir das páginas oficiais salvas em raw/.
// Uso: bun build-endpoints.ts
// Fontes: portal nacional da NF-e (prod e hom), portal DF-e SVRS (MDF-e), gov.br/nfse (NFS-e Nacional).
import { readFileSync, writeFileSync } from "node:fs";

const RETRIEVED = "2026-09-25";

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#xD;|&#xA;/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&ccedil;/g, "ç")
    .replace(/&ecirc;/g, "ê")
    .replace(/&atilde;/g, "ã")
    .replace(/&aacute;/g, "á")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

function parseNfePortal(file: string) {
  const html = readFileSync(file, "utf8");
  const authorizers: Record<string, Record<string, { versao: string; url: string }>> = {};
  const tableRe = /<caption>([^<]*?)\s*<\/caption>(.*?)<\/table>/gs;
  for (const m of html.matchAll(tableRe)) {
    const code = /\(([A-Z-]+)\)/.exec(m[1])?.[1];
    if (!code) continue;
    const services: Record<string, { versao: string; url: string }> = {};
    for (const r of m[2].matchAll(/<td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td>/g)) {
      services[decode(r[1])] = { versao: decode(r[2]), url: decode(r[3]) };
    }
    authorizers[code] = services;
  }
  // Mapa UF -> autorizador (texto do cabeçalho da página)
  const text = decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const grab = (re: RegExp) => (re.exec(text)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const map = {
    SVAN: grab(/SVAN - Sefaz Virtual do Ambiente Nacional: ([A-Z, ]+?) UF/),
    SVRS_consultaCadastro: grab(/Consulta Cadastro: ([A-Z, ]+?) -/),
    SVRS: grab(/sistema da NF-e: ([A-Z, ]+?) Autorizadores/),
    "SVC-AN": grab(/SVC-AN - Sefaz Virtual de Conting\S+ Ambiente Nacional: ([A-Z, ]+?) -/),
    "SVC-RS": grab(/SVC-RS - Sefaz Virtual de Conting\S+ Rio Grande do Sul: ([A-Z, ]+?) Autorizadores/),
  };
  return { ufMap: map, authorizers };
}

function parseMdfe(file: string) {
  const html = readFileSync(file, "utf8");
  const text = decode(html.replace(/<[^>]+>/g, "\n")).split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const out: Record<string, Record<string, { versao: string; url: string }>> = { producao: {}, homologacao: {} };
  let env: "producao" | "homologacao" | null = null;
  for (let i = 0; i < text.length; i++) {
    if (/\(SVRS\) - Produção/.test(text[i])) env = "producao";
    if (/\(SVRS\) - Homologação/.test(text[i])) env = "homologacao";
    if (env && /^MDFe\w+$/.test(text[i]) && /^\d\.\d\d$/.test(text[i + 1] ?? "") && /^https:/.test(text[i + 2] ?? "")) {
      out[env][text[i]] = { versao: text[i + 1], url: text[i + 2] };
    }
  }
  return out;
}

const prod = parseNfePortal("raw/portal-prod.html");
const hom = parseNfePortal("raw/portal-hom.html");
const mdfe = parseMdfe("raw/svrs-Mdfe-Servicos.html");

const doc = {
  $comment:
    "Gerado por spikes/s2-tls/build-endpoints.ts a partir das páginas oficiais. Dado de spike, não é a versão final de @sinete/transport.",
  retrievedAt: RETRIEVED,
  nfe: {
    versao: "4.00",
    producao: {
      source: "https://www.nfe.fazenda.gov.br/portal/webServices.aspx?tipoConteudo=OUC/YVNWZfo=",
      ...prod,
    },
    homologacao: {
      source: "https://hom.nfe.fazenda.gov.br/PORTAL/webServices.aspx?tipoConteudo=OUC/YVNWZfo=",
      ...hom,
    },
  },
  mdfe: {
    versao: "3.00",
    autorizador: "SVRS",
    source: "https://dfe-portal.svrs.rs.gov.br/Mdfe/Servicos",
    ...mdfe,
  },
  nfse: {
    source: "https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao",
    sourceUpdatedAt: "2026-08-20",
    $comment: "Bases REST. Caminhos das operações vêm dos Swagger de cada serviço (docs/index).",
    producaoRestrita: {
      sefin: "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional",
      adn: "https://adn.producaorestrita.nfse.gov.br",
      adnContribuintes: "https://adn.producaorestrita.nfse.gov.br/contribuintes",
      parametrizacao: "https://adn.producaorestrita.nfse.gov.br/parametrizacao",
      danfse: "https://adn.producaorestrita.nfse.gov.br/danfse",
      cnc: "https://adn.producaorestrita.nfse.gov.br/cnc",
    },
    producao: {
      sefin: "https://sefin.nfse.gov.br/SefinNacional",
      adn: "https://adn.nfse.gov.br",
      adnContribuintes: "https://adn.nfse.gov.br/contribuintes",
      parametrizacao: "https://adn.nfse.gov.br/parametrizacao",
      danfse: "https://adn.nfse.gov.br/danfse",
      cnc: "https://adn.nfse.gov.br/cnc",
    },
  },
};

writeFileSync("endpoints.json", `${JSON.stringify(doc, null, 2)}\n`);

// Lista de hosts únicos para a sondagem TLS
const hosts = new Map<string, Set<string>>();
const add = (url: string, tag: string) => {
  const h = new URL(url).host;
  if (!hosts.has(h)) hosts.set(h, new Set());
  hosts.get(h)!.add(tag);
};
for (const [env, d] of [["prod", prod], ["hom", hom]] as const)
  for (const [aut, svcs] of Object.entries(d.authorizers))
    for (const s of Object.values(svcs)) add(s.url, `nfe:${env}:${aut}`);
for (const [env, svcs] of Object.entries(mdfe)) for (const s of Object.values(svcs)) add(s.url, `mdfe:${env}`);
for (const [env, d] of Object.entries(doc.nfse).filter(([k]) => k.startsWith("produc")))
  for (const u of Object.values(d as Record<string, string>)) add(u, `nfse:${env}`);
const list = [...hosts].map(([host, tags]) => ({ host, tags: [...tags].sort() }));
writeFileSync("hosts.json", `${JSON.stringify(list, null, 2)}\n`);
console.log(`${list.length} hosts`);
for (const [env, d] of [["prod", prod], ["hom", hom]] as const)
  console.log(env, Object.keys(d.authorizers).join(" "), JSON.stringify(d.ufMap));
console.log("mdfe", Object.keys(mdfe.producao).length, Object.keys(mdfe.homologacao).length);
