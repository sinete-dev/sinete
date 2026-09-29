#!/usr/bin/env bun
/**
 * Gera os dados versionados do @sinete/transport (ADR 0004, decisão 1).
 *
 * endpoints: `packages/transport/src/data/endpoints.json`, a partir das páginas oficiais (portal nacional da NF-e de
 *   produção e homologação, portal DF-e da SVRS para o MDF-e e para a NFC-e, página de web services da NFC-e da SEF/MG)
 *   e da página de APIs da NFS-e Nacional. As páginas são baixadas na hora ou lidas de um diretório (`--raw`, com os
 *   nomes `portal-prod.html`, `portal-hom.html`, `svrs-Mdfe-Servicos.html`, `svrs-Nfce-Servicos.html` e
 *   `spedmg-nfce-ws.html`), para reproduzir uma coleta antiga.
 * perfis: `packages/transport/src/data/tls-profiles.json`, a partir do `summary.json` da sondagem TLS
 *   (`spikes/s2-tls/summarize.ts` hoje; `tools/sefaz-probe` quando existir). Cada host ganha o perfil medido que
 *   alimenta a checagem de capacidade da runtime.
 *
 * Uso:
 *   bun tools/transport-data/build.ts endpoints --retrieved-at 2026-09-25 [--raw dir]
 *   bun tools/transport-data/build.ts perfis --summary out/summary.json --probed-at 2026-09-25
 */
import path from 'node:path';
import { parseArgs } from 'node:util';

const root = path.resolve(import.meta.dir, '../..');
const dataDir = path.join(root, 'packages/transport/src/data');
const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    raw: { type: 'string' },
    'retrieved-at': { type: 'string' },
    /** Coleta das páginas da NFC-e, quando é outra que a das demais (padrão: `--retrieved-at`). */
    'nfce-retrieved-at': { type: 'string' },
    summary: { type: 'string' },
    'probed-at': { type: 'string' },
  },
});

const SOURCES = {
  nfeProducao: 'https://www.nfe.fazenda.gov.br/portal/webServices.aspx?tipoConteudo=OUC/YVNWZfo=',
  nfeHomologacao: 'https://hom.nfe.fazenda.gov.br/PORTAL/webServices.aspx?tipoConteudo=OUC/YVNWZfo=',
  mdfe: 'https://dfe-portal.svrs.rs.gov.br/Mdfe/Servicos',
  nfce: 'https://dfe-portal.svrs.rs.gov.br/Nfce/Servicos',
  nfceMg: 'https://portalsped.fazenda.mg.gov.br/spedmg/nfce/web-services/',
  nfse: 'https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao',
};

function requireDate(v: string | undefined, flag: string): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    console.error(`informe ${flag} AAAA-MM-DD`);
    process.exit(2);
  }
  return v;
}

const ENTITIES: Record<string, string> = {
  ccedil: 'ç',
  ecirc: 'ê',
  atilde: 'ã',
  aacute: 'á',
  nbsp: ' ',
  lt: '<',
  gt: '>',
};
const decode = (s: string): string =>
  s
    .replace(/&#xD;|&#xA;/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/g, (m, n: string) => ENTITIES[n] ?? m)
    .replace(/&amp;/g, '&')
    .trim();

type Services = Record<string, { versao: string; url: string }>;

function parseNfePortal(html: string): { ufMap: Record<string, string[]>; authorizers: Record<string, Services> } {
  const authorizers: Record<string, Services> = {};
  for (const m of html.matchAll(/<caption>([^<]*?)\s*<\/caption>(.*?)<\/table>/gs)) {
    const code = /\(([A-Z-]+)\)/.exec(m[1] ?? '')?.[1];
    if (!code) continue;
    const services: Services = {};
    for (const r of (m[2] ?? '').matchAll(/<td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td>/g)) {
      services[decode(r[1] ?? '')] = { versao: decode(r[2] ?? ''), url: decode(r[3] ?? '') };
    }
    authorizers[code] = services;
  }
  const text = decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  const grab = (re: RegExp): string[] =>
    (re.exec(text)?.[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const ufMap = {
    SVAN: grab(/SVAN - Sefaz Virtual do Ambiente Nacional: ([A-Z, ]+?) UF/),
    SVRS: grab(/sistema da NF-e: ([A-Z, ]+?) Autorizadores/),
    SVRS_consultaCadastro: grab(/Consulta Cadastro: ([A-Z, ]+?) -/),
    'SVC-AN': grab(/SVC-AN - Sefaz Virtual de Conting\S+ Ambiente Nacional: ([A-Z, ]+?) -/),
    'SVC-RS': grab(/SVC-RS - Sefaz Virtual de Conting\S+ Rio Grande do Sul: ([A-Z, ]+?) Autorizadores/),
  };
  for (const [k, v] of Object.entries(ufMap)) if (v.length === 0) throw new Error(`mapa ${k} vazio: a página mudou?`);
  return { ufMap, authorizers };
}

/**
 * Serviços que a SVC não oferece, mesmo quando o portal lista a URL no quadro dela: a inutilização fica para o ambiente
 * normal da UF (NT 2013.007 v1.03, item 04.5). O portal lista a inutilização no quadro da SVC-AN, cujo host é o mesmo
 * da SVAN, e não no da SVC-RS.
 */
const SVC_SEM_SERVICOS = {
  servicos: ['NfeInutilizacao'],
  source:
    'NT 2013.007 v1.03 (SVC), item 04.5: "O Serviço de Inutilização (Web Service: NFeInutilizacao) não será oferecido pela SVC"',
} as const;

function semServicosForaDaSvc<T extends { authorizers: Record<string, Services> }>(p: T): T {
  for (const svc of ['SVC-AN', 'SVC-RS']) {
    const services = p.authorizers[svc];
    if (services) for (const s of SVC_SEM_SERVICOS.servicos) delete services[s];
  }
  return p;
}

function parseMdfe(html: string): Record<'producao' | 'homologacao', Services> {
  const text = decode(html.replace(/<[^>]+>/g, '\n'))
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: Record<'producao' | 'homologacao', Services> = { producao: {}, homologacao: {} };
  let env: 'producao' | 'homologacao' | null = null;
  for (let i = 0; i < text.length; i++) {
    const t = text[i] ?? '';
    if (/\(SVRS\) - Produção/.test(t)) env = 'producao';
    if (/\(SVRS\) - Homologação/.test(t)) env = 'homologacao';
    const versao = text[i + 1] ?? '';
    const url = text[i + 2] ?? '';
    if (env && /^MDFe\w+$/.test(t) && /^\d\.\d\d$/.test(versao) && /^https:/.test(url)) out[env][t] = { versao, url };
  }
  return out;
}

/** Nome do serviço na página da NFC-e para o `NfeServico` do transporte (a SVRS escreve `NFeInutilizacao`...). */
const NFCE_SERVICOS: Record<string, string> = {
  nfeautorizacao: 'NFeAutorizacao',
  nferetautorizacao: 'NFeRetAutorizacao',
  nfeinutilizacao: 'NfeInutilizacao',
  nfeconsultaprotocolo: 'NfeConsultaProtocolo',
  nfestatusservico: 'NfeStatusServico',
  nfeconsultacadastro: 'NfeConsultaCadastro',
  recepcaoevento: 'RecepcaoEvento',
};

function servicoNfce(nome: string): string {
  const s = NFCE_SERVICOS[nome.toLowerCase()];
  if (!s) throw new Error(`serviço da NFC-e desconhecido: ${nome}`);
  return s;
}

type Ambientes<T> = Record<'producao' | 'homologacao', T>;

/** Relação de Serviços Web da NFC-e no portal DF-e da SVRS: uma tabela por autorizador e ambiente. */
function parseNfceSvrs(html: string): Ambientes<Record<string, Services>> {
  const out: Ambientes<Record<string, Services>> = { producao: {}, homologacao: {} };
  for (const m of html.matchAll(/<caption>(.*?)<\/caption>(.*?)<\/table>/gs)) {
    const cap = decode((m[1] ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
    const head = /\(([A-Z]+)\) - (Produção|Homologação)/.exec(cap);
    if (!head) continue;
    const env = head[2] === 'Produção' ? 'producao' : 'homologacao';
    const services: Services = {};
    for (const r of (m[2] ?? '').matchAll(
      /<td>\s*([A-Za-z]+)\s*<\/td>\s*<td>([^<]*)<\/td>\s*<td[^>]*>\s*(https:[^<]*)<\/td>/g,
    )) {
      services[servicoNfce(decode(r[1] ?? ''))] = { versao: decode(r[2] ?? ''), url: decode(r[3] ?? '') };
    }
    if (Object.keys(services).length === 0) throw new Error(`NFC-e ${cap}: tabela vazia, a página mudou?`);
    out[env][head[1] as string] = services;
  }
  for (const env of ['producao', 'homologacao'] as const) {
    if (!out[env].SVRS) throw new Error(`NFC-e sem a SVRS em ${env}: a página mudou?`);
  }
  return out;
}

/** Nome do serviço na página da SEF/MG para o `NfeServico`; QR Code e consulta por chave vão para `consultas`. */
const MG_SERVICOS: Record<string, string> = {
  'Recepção Evento': 'RecepcaoEvento',
  Consulta: 'NfeConsultaProtocolo',
  'Status Serviço': 'NfeStatusServico',
  Inutilização: 'NfeInutilizacao',
  Autorização: 'NFeAutorizacao',
  'Retorno Autorização': 'NFeRetAutorizacao',
};

interface Consultas {
  qrCode: string;
  consultaChave: string;
}

/** Relação dos Web Services da NFC-e de Minas Gerais (a SEF/MG publica QR Code e consulta na mesma tabela). */
function parseNfceMg(html: string): Ambientes<{ services: Services; consultas: Consultas }> {
  const lines = decode(html.replace(/<[^>]+>/g, '\n'))
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = {
    producao: { services: {} as Services, consultas: {} as Partial<Consultas> },
    homologacao: { services: {} as Services, consultas: {} as Partial<Consultas> },
  };
  let env: 'producao' | 'homologacao' | null = null;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i] ?? '';
    if (/^Ambiente de Produção/.test(t)) env = 'producao';
    else if (/^Ambiente de Homologação/.test(t)) env = 'homologacao';
    const url = lines[i + 1] ?? '';
    if (!env || !/^https:\/\//.test(url)) continue;
    const servico = MG_SERVICOS[t];
    if (servico) out[env].services[servico] = { versao: '4.00', url };
    else if (t === 'QRCode') out[env].consultas.qrCode = url;
    else if (t === 'Consulta por chave (Portal)') out[env].consultas.consultaChave = url;
  }
  const done = {} as Ambientes<{ services: Services; consultas: Consultas }>;
  for (const env of ['producao', 'homologacao'] as const) {
    const { services, consultas } = out[env];
    if (
      Object.keys(services).length !== Object.keys(MG_SERVICOS).length ||
      !consultas.qrCode ||
      !consultas.consultaChave
    ) {
      throw new Error(`NFC-e MG incompleta em ${env}: a página mudou?`);
    }
    done[env] = { services, consultas: consultas as Consultas };
  }
  return done;
}

/** UFs brasileiras, para derivar as que autorizam NFC-e na SVRS (as sem autorizador próprio nas tabelas). */
const UFS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
];

async function page(file: string, url: string): Promise<string> {
  if (args.raw) return Bun.file(path.join(args.raw, file)).text();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function endpoints(): Promise<void> {
  const retrievedAt = requireDate(args['retrieved-at'], '--retrieved-at');
  const nfceRetrievedAt = args['nfce-retrieved-at']
    ? requireDate(args['nfce-retrieved-at'], '--nfce-retrieved-at')
    : retrievedAt;
  const prod = semServicosForaDaSvc(parseNfePortal(await page('portal-prod.html', SOURCES.nfeProducao)));
  const hom = semServicosForaDaSvc(parseNfePortal(await page('portal-hom.html', SOURCES.nfeHomologacao)));
  const mdfe = parseMdfe(await page('svrs-Mdfe-Servicos.html', SOURCES.mdfe));
  const nfceSvrs = parseNfceSvrs(await page('svrs-Nfce-Servicos.html', SOURCES.nfce));
  const nfceMg = parseNfceMg(await page('spedmg-nfce-ws.html', SOURCES.nfceMg));
  const nfceEnv = (env: 'producao' | 'homologacao') => {
    const authorizers: Record<string, Services> = { ...nfceSvrs[env], MG: nfceMg[env].services };
    const proprios = Object.keys(authorizers).filter((a) => a !== 'SVRS');
    return {
      ufMap: { SVRS: UFS.filter((uf) => !proprios.includes(uf)) },
      authorizers,
      consultas: { MG: nfceMg[env].consultas },
    };
  };
  const doc = {
    $comment: 'Gerado por tools/transport-data/build.ts endpoints; não edite à mão.',
    schemaVersion: 1,
    version: (nfceRetrievedAt > retrievedAt ? nfceRetrievedAt : retrievedAt).replace(/-/g, '.'),
    nfe: {
      versao: '4.00',
      svcSemServicos: SVC_SEM_SERVICOS,
      producao: { source: SOURCES.nfeProducao, retrievedAt, ...prod },
      homologacao: { source: SOURCES.nfeHomologacao, retrievedAt, ...hom },
    },
    mdfe: { versao: '3.00', autorizador: 'SVRS', source: SOURCES.mdfe, retrievedAt, ...mdfe },
    nfce: {
      versao: '4.00',
      source: SOURCES.nfce,
      sources: { MG: SOURCES.nfceMg },
      retrievedAt: nfceRetrievedAt,
      // A relação da SVRS lista os autorizadores próprios (AM, GO, MS, MT, PR, RS, SP) e a SVRS, sem MG, que publica a
      // própria tabela. Não há lista oficial de UFs por autorizador da NFC-e: a UF sem autorizador próprio nas duas
      // tabelas autoriza na SVRS.
      ufMapRule: 'UF sem autorizador próprio na relação da SVRS nem na da SEF/MG autoriza a NFC-e na SVRS',
      // URLs do QR Code e da consulta por chave só onde a tabela oficial de web services as publica (MG).
      consultasSource: SOURCES.nfceMg,
      producao: nfceEnv('producao'),
      homologacao: nfceEnv('homologacao'),
    },
    nfse: {
      // Página HTML sem tabela estável: bases conferidas à mão na coleta e confirmadas pela sondagem (ADR 0004).
      source: SOURCES.nfse,
      sourceUpdatedAt: '2026-08-20',
      retrievedAt,
      producaoRestrita: {
        sefin: 'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional',
        adn: 'https://adn.producaorestrita.nfse.gov.br',
        adnContribuintes: 'https://adn.producaorestrita.nfse.gov.br/contribuintes',
        parametrizacao: 'https://adn.producaorestrita.nfse.gov.br/parametrizacao',
        cnc: 'https://adn.producaorestrita.nfse.gov.br/cnc',
      },
      producao: {
        sefin: 'https://sefin.nfse.gov.br/SefinNacional',
        adn: 'https://adn.nfse.gov.br',
        adnContribuintes: 'https://adn.nfse.gov.br/contribuintes',
        parametrizacao: 'https://adn.nfse.gov.br/parametrizacao',
        cnc: 'https://adn.nfse.gov.br/cnc',
      },
    },
  };
  await Bun.write(path.join(dataDir, 'endpoints.json'), `${JSON.stringify(doc, null, 2)}\n`);
  console.log(
    `endpoints.json: NF-e ${Object.keys(prod.authorizers).length} autorizadores, NFC-e ${Object.keys(doc.nfce.producao.authorizers).length}, MDF-e e NFS-e`,
  );
}

interface SummaryRow {
  host: string;
  uso: string;
  tls: string;
  cifra: string;
  pedeCert: string;
  raiz: string;
  ocspStapling: string;
  retomada: string;
}

async function perfis(): Promise<void> {
  const probedAt = requireDate(args['probed-at'], '--probed-at');
  if (!args.summary) throw new Error('informe --summary <summary.json da sondagem>');
  const rows = (await Bun.file(args.summary).json()) as SummaryRow[];
  const hosts = rows.map((r) => {
    const versions = r.tls.split(',').map((v) => v.trim());
    const aead = /GCM|CHACHA20/.test(r.cifra);
    const dhe = /^DHE-/.test(r.cifra);
    return {
      host: r.host,
      uses: r.uso.split(/\s+/),
      tlsVersions: versions,
      maxTls: versions.at(-1),
      cipher: r.cifra,
      keyExchange: dhe ? 'dhe' : 'ecdhe',
      ecdheAead: aead && !dhe,
      clientCert: r.pedeCert.startsWith('renegociação') ? 'renegotiation' : 'handshake',
      clientCertEvidence: r.pedeCert.includes('verificado')
        ? 'verificado'
        : r.pedeCert.includes('provável')
          ? 'provavel'
          : 'sondagem',
      serverRoot: r.raiz.startsWith('ICP-Brasil') ? 'icp-brasil' : 'publica',
      serverRootName: r.raiz,
      ocspStapling: r.ocspStapling === 'sim',
      sessionResumption: r.retomada === 'sim',
    };
  });
  const doc = {
    $comment:
      'Gerado por tools/transport-data/build.ts perfis a partir da sondagem TLS; não edite à mão. clientCert=renegotiation: o servidor (IIS) só pede o certificado numa renegociação iniciada depois da requisição HTTP. ecdheAead=false: o host só oferece CBC ou DHE. As duas coisas o rustls (Deno) não faz.',
    schemaVersion: 1,
    version: probedAt.replace(/-/g, '.'),
    source:
      'Sondagem TLS leve de cada host (openssl s_client), ADR 0004 seção 2; renegociação com certificado real confirmada em BA, MT, SP, SVAN e AN de homologação (seção 6)',
    probedAt,
    hosts,
  };
  await Bun.write(path.join(dataDir, 'tls-profiles.json'), `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`tls-profiles.json: ${hosts.length} hosts`);
}

if (positionals[0] === 'endpoints') await endpoints();
else if (positionals[0] === 'perfis') await perfis();
else {
  console.error('uso: bun tools/transport-data/build.ts endpoints|perfis ...');
  process.exit(2);
}
