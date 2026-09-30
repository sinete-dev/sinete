/**
 * Endpoints e perfis TLS como dados (ADR 0004, decisão 1; princípio 4: nunca `if (uf === 'SP')`).
 *
 * `data/endpoints.json` sai das páginas oficiais (portal nacional da NF-e, portal DF-e da SVRS para MDF-e e NFC-e,
 * página de web services da NFC-e da SEF/MG, página de APIs da NFS-e Nacional) e `data/tls-profiles.json` da sondagem TLS por host, os dois por `tools/transport-data/build.ts`.
 * O mapa UF para autorizador é por ambiente: o PI, por exemplo, usa SVC-AN em produção e SVC-RS em homologação.
 */

import type { Ambiente, Uf } from '@sinete/core';
import { ErroDeConfiguracao, ErroServicoNaoOferecido, ehUf } from '@sinete/core';
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
export interface UrlsConsultaNfce {
  /** Endereço do QR Code do DANFE NFC-e. */
  readonly qrCode: string;
  /** Consulta pública por chave de acesso. */
  readonly consultaChave: string;
  readonly fonte: string;
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
export interface PerfilTls {
  readonly host: string;
  readonly usos: readonly string[];
  readonly versoesTls: readonly string[];
  readonly tlsMaximo: string;
  readonly cifra: string;
  readonly trocaDeChaves: 'ecdhe' | 'dhe';
  /** Oferece ao menos uma suíte ECDHE com AEAD (GCM ou ChaCha20). */
  readonly ecdheAead: boolean;
  /** `renegociacao`: o certificado só é pedido numa renegociação depois da requisição HTTP. */
  readonly certificadoDoCliente: 'handshake' | 'renegociacao';
  readonly evidenciaDoCertificadoDoCliente: 'verificado' | 'provavel' | 'sondagem';
  readonly raizDoServidor: 'icp-brasil' | 'publica';
  readonly nomeDaRaizDoServidor: string;
  readonly ocspStapling: boolean;
  readonly retomadaDeSessao: boolean;
}

/** Endpoint resolvido: para onde vai, de onde veio o dado e o perfil TLS do host. */
export interface EndpointResolvido {
  readonly documento: DocumentoFiscal;
  readonly ambiente: Ambiente;
  readonly autorizador: string;
  readonly servico: string;
  readonly versao: string | undefined;
  readonly url: string;
  readonly host: string;
  readonly fonte: string;
  readonly tls: PerfilTls | undefined;
}

export interface DescricaoDadosDeEndpoints {
  readonly versaoDosEndpoints: string;
  readonly versaoDosPerfisTls: string;
  readonly fonteDosPerfisTls: string;
}

export const DADOS_DE_ENDPOINTS: DescricaoDadosDeEndpoints = {
  versaoDosEndpoints: endpointsData.versao,
  versaoDosPerfisTls: profilesData.versao,
  fonteDosPerfisTls: profilesData.fonte,
};

const PROFILES: ReadonlyMap<string, PerfilTls> = new Map(
  profilesData.hosts.map((h) => [h.host, h as unknown as PerfilTls]),
);

/** Perfil TLS medido do host, ou `undefined` para host fora dos dados. */
export function perfilTlsDoHost(host: string): PerfilTls | undefined {
  return PROFILES.get(host.toLowerCase());
}

/** Todos os perfis conhecidos. */
export function perfisTls(): readonly PerfilTls[] {
  return [...PROFILES.values()];
}

interface ServiceEntry {
  readonly versao: string;
  readonly url: string;
}
type Services = Readonly<Record<string, ServiceEntry>>;
interface NfeEnv {
  readonly fonte: string;
  readonly mapaDeUfs: Readonly<Record<string, readonly string[]>>;
  readonly autorizadores: Readonly<Record<string, Services>>;
}

const nfeEnv = (ambiente: Ambiente): NfeEnv => endpointsData.nfe[ambiente] as NfeEnv;

function ref(
  documento: DocumentoFiscal,
  ambiente: Ambiente,
  autorizador: string,
  servico: string,
  entry: { versao?: string; url: string },
  source: string,
): EndpointResolvido {
  const host = new URL(entry.url).hostname;
  return {
    documento,
    ambiente,
    autorizador,
    servico,
    versao: entry.versao,
    url: entry.url,
    host,
    fonte: source,
    tls: perfilTlsDoHost(host),
  };
}

interface NfceEnv {
  readonly mapaDeUfs: { readonly SVRS: readonly string[] };
  readonly autorizadores: Readonly<Record<string, Services>>;
  readonly consultas: Readonly<Record<string, { readonly qrCode: string; readonly consultaChave: string }>>;
}

const nfceEnv = (ambiente: Ambiente): NfceEnv => endpointsData.nfce[ambiente] as NfceEnv;

/** Fonte de um autorizador de NFC-e: a página da SEF/MG para MG, a relação da SVRS para os demais. */
function nfceSource(autorizador: string): string {
  return (endpointsData.nfce.fontes as Readonly<Record<string, string>>)[autorizador] ?? endpointsData.nfce.fonte;
}

/** Autorizador normal de NF-e da UF no ambiente (sem contingência). */
export function nfeAutorizadorDaUf(uf: Uf, ambiente: Ambiente): NfeAutorizador {
  const env = nfeEnv(ambiente);
  // Dado, não regra: a UF tem autorizador próprio quando o portal a lista como autorizador (chave de `autorizadores`).
  if (env.autorizadores[uf]) return uf as NfeAutorizador;
  if (env.mapaDeUfs.SVAN?.includes(uf)) return 'SVAN';
  if (env.mapaDeUfs.SVRS?.includes(uf)) return 'SVRS';
  throw new ErroDeConfiguracao(`UF ${uf} sem autorizador de NF-e nos dados de ${ambiente}`, {
    detalhes: { uf, ambiente },
  });
}

/** Autorizador de contingência (SVC) da UF no ambiente. */
export function nfeContingenciaDaUf(uf: Uf, ambiente: Ambiente): 'SVC-AN' | 'SVC-RS' {
  const env = nfeEnv(ambiente);
  if (env.mapaDeUfs['SVC-AN']?.includes(uf)) return 'SVC-AN';
  if (env.mapaDeUfs['SVC-RS']?.includes(uf)) return 'SVC-RS';
  throw new ErroDeConfiguracao(`UF ${uf} sem SVC nos dados de ${ambiente}`, { detalhes: { uf, ambiente } });
}

export interface BuscaEndpointNfe {
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
export function nfeEndpoint(busca: BuscaEndpointNfe): EndpointResolvido {
  const { ambiente, servico } = busca;
  const env = nfeEnv(ambiente);
  if (busca.uf !== undefined && !ehUf(busca.uf)) throw new ErroDeConfiguracao(`UF inválida: ${String(busca.uf)}`);
  let autorizador: NfeAutorizador;
  if (busca.autorizador) autorizador = busca.autorizador;
  else if (servico === 'NFeDistribuicaoDFe') autorizador = 'AN';
  else {
    if (!busca.uf) throw new ErroDeConfiguracao(`informe a UF (ou o autorizador) para ${servico}`);
    // A consulta cadastro de toda UF autorizada pela SVRS vai para a SVRS. O portal lista só parte delas na linha de
    // consulta cadastro (`mapaDeUfs.SVRS_consultaCadastro`), mas o serviço da SVRS responde pelas outras: em produção, em
    // 2026, respondeu consultas do DF com 259 e 264 (contribuinte não cadastrado), que são respostas de cadastro da
    // UF. Recusar aqui tiraria do integrador uma consulta que funciona; a UF que a SVRS não atender responde com a
    // rejeição dela, que chega como desfecho.
    autorizador =
      busca.contingencia === 'svc' ? nfeContingenciaDaUf(busca.uf, ambiente) : nfeAutorizadorDaUf(busca.uf, ambiente);
  }
  const entry = env.autorizadores[autorizador]?.[servico];
  if (!entry) {
    // A SVC não oferece a inutilização, mesmo com a URL no portal: ela fica para o ambiente normal da UF.
    const semNaSvc = SVC.has(autorizador) && (endpointsData.nfe.svcSemServicos.servicos as string[]).includes(servico);
    const source = semNaSvc ? endpointsData.nfe.svcSemServicos.fonte : env.fonte;
    throw new ErroServicoNaoOferecido(`${autorizador} não oferece ${servico} em ${ambiente}`, {
      detalhes: { autorizador, servico, ...(busca.uf ? { uf: busca.uf } : {}), ambiente, fonte: source },
    });
  }
  return ref('nfe', ambiente, autorizador, servico, entry, env.fonte);
}

/**
 * Autorizador de NFC-e da UF no ambiente. As tabelas oficiais listam os autorizadores com ambiente próprio da NFC-e
 * (relação da SVRS e página da SEF/MG); a UF que não tem um autoriza na SVRS (`nfce.regraDoMapaDeUfs` nos dados).
 */
export function nfceAutorizadorDaUf(uf: Uf, ambiente: Ambiente): NfceAutorizador {
  if (!ehUf(uf)) throw new ErroDeConfiguracao(`UF inválida: ${String(uf)}`);
  const env = nfceEnv(ambiente);
  if (env.autorizadores[uf]) return uf as NfceAutorizador;
  if (env.mapaDeUfs.SVRS.includes(uf)) return 'SVRS';
  throw new ErroDeConfiguracao(`UF ${uf} sem autorizador de NFC-e nos dados de ${ambiente}`, {
    detalhes: { uf, ambiente },
  });
}

export interface BuscaEndpointNfce {
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
export function nfceEndpoint(busca: BuscaEndpointNfce): EndpointResolvido {
  const { ambiente, servico } = busca;
  let autorizador: NfceAutorizador;
  if (busca.autorizador) autorizador = busca.autorizador;
  else {
    if (!busca.uf) throw new ErroDeConfiguracao(`informe a UF (ou o autorizador) para ${servico} da NFC-e`);
    autorizador = nfceAutorizadorDaUf(busca.uf, ambiente);
  }
  const entry = nfceEnv(ambiente).autorizadores[autorizador]?.[servico];
  const source = nfceSource(autorizador);
  if (!entry) {
    throw new ErroServicoNaoOferecido(`${autorizador} não oferece ${servico} da NFC-e em ${ambiente}`, {
      detalhes: { autorizador, servico, ...(busca.uf ? { uf: busca.uf } : {}), ambiente, fonte: source },
    });
  }
  return ref('nfce', ambiente, autorizador, servico, entry, source);
}

/**
 * URLs do QR Code e da consulta por chave da NFC-e da UF, quando a tabela oficial de web services do autorizador as
 * publica (hoje, MG). `undefined` nas demais: a UF publica essas URLs fora das tabelas de web services.
 */
export function urlsConsultaNfce(uf: Uf, ambiente: Ambiente): UrlsConsultaNfce | undefined {
  const c = nfceEnv(ambiente).consultas[uf];
  return c === undefined ? undefined : { ...c, fonte: endpointsData.nfce.fonteDasConsultas };
}

/** Resolve o endpoint de um serviço de MDF-e 3.00 (sempre SVRS). */
export function mdfeEndpoint(busca: { readonly ambiente: Ambiente; readonly servico: MdfeServico }): EndpointResolvido {
  const services = endpointsData.mdfe[busca.ambiente] as Services;
  const entry = services[busca.servico];
  if (!entry) throw new ErroDeConfiguracao(`MDF-e sem ${busca.servico} em ${busca.ambiente}`);
  return ref('mdfe', busca.ambiente, endpointsData.mdfe.autorizador, busca.servico, entry, endpointsData.mdfe.fonte);
}

/** Base REST de uma API da NFS-e Nacional. `homologacao` é a produção restrita. */
export function nfseEndpoint(busca: { readonly ambiente: Ambiente; readonly api: NfseApi }): EndpointResolvido {
  const env = busca.ambiente === 'producao' ? endpointsData.nfse.producao : endpointsData.nfse.producaoRestrita;
  const url = (env as Readonly<Record<string, string>>)[busca.api];
  if (!url) throw new ErroDeConfiguracao(`NFS-e Nacional sem a API ${busca.api}`);
  return ref('nfse', busca.ambiente, 'NFS-e Nacional', busca.api, { url }, endpointsData.nfse.fonte);
}

/** Todos os endpoints de um ambiente, para montar allowlists e sondar hosts. */
export function todosOsEndpoints(ambiente: Ambiente): EndpointResolvido[] {
  const out: EndpointResolvido[] = [];
  const env = nfeEnv(ambiente);
  for (const [aut, services] of Object.entries(env.autorizadores)) {
    for (const [servico, entry] of Object.entries(services))
      out.push(ref('nfe', ambiente, aut, servico, entry, env.fonte));
  }
  for (const [aut, services] of Object.entries(nfceEnv(ambiente).autorizadores)) {
    for (const [servico, entry] of Object.entries(services))
      out.push(ref('nfce', ambiente, aut, servico, entry, nfceSource(aut)));
  }
  for (const [servico, entry] of Object.entries(endpointsData.mdfe[ambiente] as Services)) {
    out.push(ref('mdfe', ambiente, 'SVRS', servico, entry, endpointsData.mdfe.fonte));
  }
  const nfse = ambiente === 'producao' ? endpointsData.nfse.producao : endpointsData.nfse.producaoRestrita;
  for (const [api, url] of Object.entries(nfse)) {
    out.push(ref('nfse', ambiente, 'NFS-e Nacional', api, { url }, endpointsData.nfse.fonte));
  }
  return out;
}

/** Hosts distintos de um ambiente (base para a allowlist de homologação, por exemplo). */
export function hostsDoAmbiente(ambiente: Ambiente): string[] {
  return [...new Set(todosOsEndpoints(ambiente).map((e) => e.host))].sort();
}
