/**
 * Endpoints e perfis TLS como dados (ADR 0004, decisão 1; princípio 4: nunca `if (uf === 'SP')`).
 *
 * `data/endpoints.json` sai das páginas oficiais (portal nacional da NF-e, portal DF-e da SVRS para MDF-e e NFC-e,
 * página de web services da NFC-e da SEF/MG, página de APIs da NFS-e Nacional) e `data/tls-profiles.json` da sondagem TLS por host, os dois por `tools/transport-data/build.ts`.
 * O mapa UF para autorizador é por ambiente: o PI, por exemplo, usa SVC-AN em produção e SVC-RS em homologação.
 */

import type { Ambiente, Uf } from '@sinete/core';
import { ConfigError, isUf, ServicoNaoOferecidoError } from '@sinete/core';
import endpointsData from './data/endpoints.json' with { type: 'json' };
import profilesData from './data/tls-profiles.json' with { type: 'json' };

export type DocumentoFiscal = 'nfe' | 'nfce' | 'mdfe' | 'nfse';

/** Autorizador de NF-e: UF com sefaz própria, virtual (SVAN, SVRS), contingência (SVC-AN, SVC-RS) ou AN. */
export type NfeAutorizador =
  | 'AM'
  | 'BA'
  | 'GO'
  | 'MG'
  | 'MS'
  | 'MT'
  | 'PE'
  | 'PR'
  | 'RS'
  | 'SP'
  | 'SVAN'
  | 'SVRS'
  | 'SVC-AN'
  | 'SVC-RS'
  | 'AN';

/** Serviços NF-e 4.00 como o portal nacional os nomeia. */
export type NfeServico =
  | 'NFeAutorizacao'
  | 'NFeRetAutorizacao'
  | 'NfeConsultaProtocolo'
  | 'NfeInutilizacao'
  | 'NfeStatusServico'
  | 'NfeConsultaCadastro'
  | 'RecepcaoEvento'
  | 'NFeDistribuicaoDFe';

/**
 * Autorizador de NFC-e (modelo 65): UF com ambiente próprio da NFC-e ou a SVRS. Não há SVC para a NFC-e: a
 * contingência dela é off-line (tpEmis 9) e a nota vai depois ao mesmo autorizador.
 */
export type NfceAutorizador = 'AM' | 'GO' | 'MG' | 'MS' | 'MT' | 'PR' | 'RS' | 'SP' | 'SVRS';

/** URLs públicas da NFC-e por UF, só onde a tabela oficial de web services as publica. */
export interface NfceConsultaUrls {
  /** Endereço do QR Code do DANFE NFC-e. */
  readonly qrCode: string;
  /** Consulta pública por chave de acesso. */
  readonly consultaChave: string;
  readonly source: string;
}

export type MdfeServico =
  | 'MDFeRecepcaoSinc'
  | 'MDFeConsulta'
  | 'MDFeStatusServico'
  | 'MDFeRecepcaoEvento'
  | 'MDFeConsNaoEnc'
  | 'MDFeDistribuicaoDFe';

/**
 * APIs REST da NFS-e Nacional. Em homologação, o ambiente é a produção restrita. A API de geração do DANFSe do ADN foi
 * suspensa em 03/08/2026 (NT SE/CGNFS-e 008/2026 v1.02, 1) e saiu da lista: o DANFSe é gerado pelo `@sinete/da/nfse`.
 */
export type NfseApi = 'sefin' | 'adn' | 'adnContribuintes' | 'parametrizacao' | 'cnc';

/** Perfil TLS medido de um host. */
export interface TlsProfile {
  readonly host: string;
  readonly uses: readonly string[];
  readonly tlsVersions: readonly string[];
  readonly maxTls: string;
  readonly cipher: string;
  readonly keyExchange: 'ecdhe' | 'dhe';
  /** Oferece ao menos uma suíte ECDHE com AEAD (GCM ou ChaCha20). */
  readonly ecdheAead: boolean;
  /** `renegotiation`: o certificado só é pedido numa renegociação depois da requisição HTTP. */
  readonly clientCert: 'handshake' | 'renegotiation';
  readonly clientCertEvidence: 'verificado' | 'provavel' | 'sondagem';
  readonly serverRoot: 'icp-brasil' | 'publica';
  readonly serverRootName: string;
  readonly ocspStapling: boolean;
  readonly sessionResumption: boolean;
}

/** Endpoint resolvido: para onde vai, de onde veio o dado e o perfil TLS do host. */
export interface EndpointRef {
  readonly documento: DocumentoFiscal;
  readonly ambiente: Ambiente;
  readonly autorizador: string;
  readonly servico: string;
  readonly versao: string | undefined;
  readonly url: string;
  readonly host: string;
  readonly source: string;
  readonly tls: TlsProfile | undefined;
}

export interface EndpointDataInfo {
  readonly endpointsVersion: string;
  readonly tlsProfilesVersion: string;
  readonly tlsProfilesSource: string;
}

export const ENDPOINT_DATA: EndpointDataInfo = {
  endpointsVersion: endpointsData.version,
  tlsProfilesVersion: profilesData.version,
  tlsProfilesSource: profilesData.source,
};

const PROFILES: ReadonlyMap<string, TlsProfile> = new Map(
  profilesData.hosts.map((h) => [h.host, h as unknown as TlsProfile]),
);

/** Perfil TLS medido do host, ou `undefined` para host fora dos dados. */
export function tlsProfileForHost(host: string): TlsProfile | undefined {
  return PROFILES.get(host.toLowerCase());
}

/** Todos os perfis conhecidos. */
export function tlsProfiles(): readonly TlsProfile[] {
  return [...PROFILES.values()];
}

interface ServiceEntry {
  readonly versao: string;
  readonly url: string;
}
type Services = Readonly<Record<string, ServiceEntry>>;
interface NfeEnv {
  readonly source: string;
  readonly ufMap: Readonly<Record<string, readonly string[]>>;
  readonly authorizers: Readonly<Record<string, Services>>;
}

const nfeEnv = (ambiente: Ambiente): NfeEnv => endpointsData.nfe[ambiente] as NfeEnv;

function ref(
  documento: DocumentoFiscal,
  ambiente: Ambiente,
  autorizador: string,
  servico: string,
  entry: { versao?: string; url: string },
  source: string,
): EndpointRef {
  const host = new URL(entry.url).hostname;
  return {
    documento,
    ambiente,
    autorizador,
    servico,
    versao: entry.versao,
    url: entry.url,
    host,
    source,
    tls: tlsProfileForHost(host),
  };
}

interface NfceEnv {
  readonly ufMap: { readonly SVRS: readonly string[] };
  readonly authorizers: Readonly<Record<string, Services>>;
  readonly consultas: Readonly<Record<string, { readonly qrCode: string; readonly consultaChave: string }>>;
}

const nfceEnv = (ambiente: Ambiente): NfceEnv => endpointsData.nfce[ambiente] as NfceEnv;

/** Fonte de um autorizador de NFC-e: a página da SEF/MG para MG, a relação da SVRS para os demais. */
function nfceSource(autorizador: string): string {
  return (endpointsData.nfce.sources as Readonly<Record<string, string>>)[autorizador] ?? endpointsData.nfce.source;
}

/** Autorizador normal de NF-e da UF no ambiente (sem contingência). */
export function nfeAutorizadorDaUf(uf: Uf, ambiente: Ambiente): NfeAutorizador {
  const env = nfeEnv(ambiente);
  // Dado, não regra: a UF tem autorizador próprio quando o portal a lista como autorizador (chave de `authorizers`).
  if (env.authorizers[uf]) return uf as NfeAutorizador;
  if (env.ufMap.SVAN?.includes(uf)) return 'SVAN';
  if (env.ufMap.SVRS?.includes(uf)) return 'SVRS';
  throw new ConfigError(`UF ${uf} sem autorizador de NF-e nos dados de ${ambiente}`, { details: { uf, ambiente } });
}

/** Autorizador de contingência (SVC) da UF no ambiente. */
export function nfeContingenciaDaUf(uf: Uf, ambiente: Ambiente): 'SVC-AN' | 'SVC-RS' {
  const env = nfeEnv(ambiente);
  if (env.ufMap['SVC-AN']?.includes(uf)) return 'SVC-AN';
  if (env.ufMap['SVC-RS']?.includes(uf)) return 'SVC-RS';
  throw new ConfigError(`UF ${uf} sem SVC nos dados de ${ambiente}`, { details: { uf, ambiente } });
}

export interface NfeEndpointQuery {
  readonly ambiente: Ambiente;
  readonly servico: NfeServico;
  /** UF do emitente (ou do interessado). Dispensável com `autorizador` explícito ou para serviços do AN. */
  readonly uf?: Uf;
  /** Força o autorizador (ex.: `AN` para a manifestação do destinatário, `SVRS` para exclusivo de IBS/CBS). */
  readonly autorizador?: NfeAutorizador;
  /** `svc`: usa a contingência SVC-AN ou SVC-RS da UF. */
  readonly contingencia?: 'svc';
}

const SVC: ReadonlySet<string> = new Set(['SVC-AN', 'SVC-RS']);

/** Resolve o endpoint de um serviço de NF-e 4.00. */
export function nfeEndpoint(query: NfeEndpointQuery): EndpointRef {
  const { ambiente, servico } = query;
  const env = nfeEnv(ambiente);
  if (query.uf !== undefined && !isUf(query.uf)) throw new ConfigError(`UF inválida: ${String(query.uf)}`);
  let autorizador: NfeAutorizador;
  if (query.autorizador) autorizador = query.autorizador;
  else if (servico === 'NFeDistribuicaoDFe') autorizador = 'AN';
  else {
    if (!query.uf) throw new ConfigError(`informe a UF (ou o autorizador) para ${servico}`);
    // A consulta cadastro de toda UF autorizada pela SVRS vai para a SVRS. O portal lista só parte delas na linha de
    // consulta cadastro (`ufMap.SVRS_consultaCadastro`), mas o serviço da SVRS responde pelas outras: em produção, em
    // 2026, respondeu consultas do DF com 259 e 264 (contribuinte não cadastrado), que são respostas de cadastro da
    // UF. Recusar aqui tiraria do integrador uma consulta que funciona; a UF que a SVRS não atender responde com a
    // rejeição dela, que chega como desfecho.
    autorizador =
      query.contingencia === 'svc' ? nfeContingenciaDaUf(query.uf, ambiente) : nfeAutorizadorDaUf(query.uf, ambiente);
  }
  const entry = env.authorizers[autorizador]?.[servico];
  if (!entry) {
    // A SVC não oferece a inutilização, mesmo com a URL no portal: ela fica para o ambiente normal da UF.
    const semNaSvc = SVC.has(autorizador) && (endpointsData.nfe.svcSemServicos.servicos as string[]).includes(servico);
    const source = semNaSvc ? endpointsData.nfe.svcSemServicos.source : env.source;
    throw new ServicoNaoOferecidoError(`${autorizador} não oferece ${servico} em ${ambiente}`, {
      details: { autorizador, servico, ...(query.uf ? { uf: query.uf } : {}), ambiente, source },
    });
  }
  return ref('nfe', ambiente, autorizador, servico, entry, env.source);
}

/**
 * Autorizador de NFC-e da UF no ambiente. As tabelas oficiais listam os autorizadores com ambiente próprio da NFC-e
 * (relação da SVRS e página da SEF/MG); a UF que não tem um autoriza na SVRS (`nfce.ufMapRule` nos dados).
 */
export function nfceAutorizadorDaUf(uf: Uf, ambiente: Ambiente): NfceAutorizador {
  if (!isUf(uf)) throw new ConfigError(`UF inválida: ${String(uf)}`);
  const env = nfceEnv(ambiente);
  if (env.authorizers[uf]) return uf as NfceAutorizador;
  if (env.ufMap.SVRS.includes(uf)) return 'SVRS';
  throw new ConfigError(`UF ${uf} sem autorizador de NFC-e nos dados de ${ambiente}`, { details: { uf, ambiente } });
}

export interface NfceEndpointQuery {
  readonly ambiente: Ambiente;
  readonly servico: NfeServico;
  /** UF do emitente. Dispensável com `autorizador` explícito. */
  readonly uf?: Uf;
  readonly autorizador?: NfceAutorizador;
}

/**
 * Resolve o endpoint de um serviço da NFC-e 4.00 (modelo 65). Em várias UFs o host é outro que o da NF-e (SP, MG, PR,
 * RS, a SVRS). A NFC-e não tem Distribuição DF-e nem SVC, e a consulta cadastro só existe onde a tabela a lista.
 */
export function nfceEndpoint(query: NfceEndpointQuery): EndpointRef {
  const { ambiente, servico } = query;
  let autorizador: NfceAutorizador;
  if (query.autorizador) autorizador = query.autorizador;
  else {
    if (!query.uf) throw new ConfigError(`informe a UF (ou o autorizador) para ${servico} da NFC-e`);
    autorizador = nfceAutorizadorDaUf(query.uf, ambiente);
  }
  const entry = nfceEnv(ambiente).authorizers[autorizador]?.[servico];
  const source = nfceSource(autorizador);
  if (!entry) {
    throw new ServicoNaoOferecidoError(`${autorizador} não oferece ${servico} da NFC-e em ${ambiente}`, {
      details: { autorizador, servico, ...(query.uf ? { uf: query.uf } : {}), ambiente, source },
    });
  }
  return ref('nfce', ambiente, autorizador, servico, entry, source);
}

/**
 * URLs do QR Code e da consulta por chave da NFC-e da UF, quando a tabela oficial de web services do autorizador as
 * publica (hoje, MG). `undefined` nas demais: a UF publica essas URLs fora das tabelas de web services.
 */
export function nfceConsultaUrls(uf: Uf, ambiente: Ambiente): NfceConsultaUrls | undefined {
  const c = nfceEnv(ambiente).consultas[uf];
  return c === undefined ? undefined : { ...c, source: endpointsData.nfce.consultasSource };
}

/** Resolve o endpoint de um serviço de MDF-e 3.00 (sempre SVRS). */
export function mdfeEndpoint(query: { readonly ambiente: Ambiente; readonly servico: MdfeServico }): EndpointRef {
  const services = endpointsData.mdfe[query.ambiente] as Services;
  const entry = services[query.servico];
  if (!entry) throw new ConfigError(`MDF-e sem ${query.servico} em ${query.ambiente}`);
  return ref('mdfe', query.ambiente, endpointsData.mdfe.autorizador, query.servico, entry, endpointsData.mdfe.source);
}

/** Base REST de uma API da NFS-e Nacional. `homologacao` é a produção restrita. */
export function nfseEndpoint(query: { readonly ambiente: Ambiente; readonly api: NfseApi }): EndpointRef {
  const env = query.ambiente === 'producao' ? endpointsData.nfse.producao : endpointsData.nfse.producaoRestrita;
  const url = (env as Readonly<Record<string, string>>)[query.api];
  if (!url) throw new ConfigError(`NFS-e Nacional sem a API ${query.api}`);
  return ref('nfse', query.ambiente, 'NFS-e Nacional', query.api, { url }, endpointsData.nfse.source);
}

/** Todos os endpoints de um ambiente, para montar allowlists e sondar hosts. */
export function allEndpoints(ambiente: Ambiente): EndpointRef[] {
  const out: EndpointRef[] = [];
  const env = nfeEnv(ambiente);
  for (const [aut, services] of Object.entries(env.authorizers)) {
    for (const [servico, entry] of Object.entries(services))
      out.push(ref('nfe', ambiente, aut, servico, entry, env.source));
  }
  for (const [aut, services] of Object.entries(nfceEnv(ambiente).authorizers)) {
    for (const [servico, entry] of Object.entries(services))
      out.push(ref('nfce', ambiente, aut, servico, entry, nfceSource(aut)));
  }
  for (const [servico, entry] of Object.entries(endpointsData.mdfe[ambiente] as Services)) {
    out.push(ref('mdfe', ambiente, 'SVRS', servico, entry, endpointsData.mdfe.source));
  }
  const nfse = ambiente === 'producao' ? endpointsData.nfse.producao : endpointsData.nfse.producaoRestrita;
  for (const [api, url] of Object.entries(nfse)) {
    out.push(ref('nfse', ambiente, 'NFS-e Nacional', api, { url }, endpointsData.nfse.source));
  }
  return out;
}

/** Hosts distintos de um ambiente (base para a allowlist de homologação, por exemplo). */
export function ambienteHosts(ambiente: Ambiente): string[] {
  return [...new Set(allEndpoints(ambiente).map((e) => e.host))].sort();
}
