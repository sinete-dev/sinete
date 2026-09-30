/**
 * Os web services da NF-e 4.00 que o simulador atende, com os nomes e as operações dos WSDL oficiais (portal nacional
 * da NF-e, "Relação de Serviços Web"). A chave é o nome do serviço como o `@sinete/transport` usa nos dados de
 * endpoints (`NfeServico`), para que o consumidor troque só a URL.
 *
 * O simulador responde por três autorizadores com o mesmo estado: a SEFAZ da UF (`uf`), a SEFAZ Virtual de
 * Contingência (`svc`, só com contingência ativa) e o Ambiente Nacional (`an`, manifestação do destinatário e
 * distribuição de DF-e). O caminho é `/<autorizador>/ws/<serviço WSDL>`.
 */

import { ErroDeConfiguracao } from '@sinete/core';
import type { MdfeServico, NfeServico } from '@sinete/transport';

export const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
export const WSDL_BASE = 'http://www.portalfiscal.inf.br/nfe/wsdl/';

/** Autorizador simulado: SEFAZ da UF, SVC (contingência) ou Ambiente Nacional. */
export type SimAutorizador = 'uf' | 'svc' | 'an';

/** Serviços do MDF-e que o simulador atende (a distribuição de DF-e do MDF-e fica de fora). */
export type MdfeServicoSim = Exclude<MdfeServico, 'MDFeDistribuicaoDFe'>;

/** Serviço atendido pelo simulador: da NF-e ou do MDF-e, com os nomes que o `@sinete/transport` usa. */
export type SimServico = NfeServico | MdfeServicoSim;

export interface ServiceDef {
  readonly servico: SimServico;
  /** Nome do serviço no WSDL (`NFeAutorizacao4`); também é o fim do namespace e do caminho. */
  readonly wsdl: string;
  /** Operação do WSDL; a `action` do SOAP 1.2 é `<namespace>/<operação>`. */
  readonly operation: string;
  /**
   * `resultMsg`: `nfeDadosMsg` no pedido e `nfeResultMsg` na resposta (serviços 4.00).
   * `operacao`: o elemento da operação envolve `nfeDadosMsg` e a resposta é `<operação>Response/<operação>Result`
   * (NFeDistribuicaoDFe do AN).
   * `mdfe`: `mdfeDadosMsg` no pedido e `<operação>Result` na resposta (MDF-e 3.00).
   */
  readonly style: 'resultMsg' | 'operacao' | 'mdfe';
  readonly autorizadores: readonly SimAutorizador[];
  /** Namespace do WSDL quando não é `WSDL_BASE` + `wsdl` (os serviços do MDF-e). */
  readonly namespace?: string;
  /** A área de dados vai em GZip e Base64 como texto de `mdfeDadosMsg` (recepção do MDF-e). */
  readonly compactado?: boolean;
  /**
   * UFs da consulta que, num serviço `resultMsg`, exigem `nfeDadosMsg` dentro do elemento da operação e respondem com
   * `<operação>Result` dentro de `nfeResultMsg` (consulta cadastro do MT, visto em homologação em 28/09/2026). O
   * simulador lê a UF do próprio pedido; nas outras, aceita as duas formas e responde na forma recebida.
   */
  readonly operacaoEm?: readonly string[];
}

export const NFE_SERVICES: Readonly<Record<NfeServico, ServiceDef>> = {
  NfeStatusServico: {
    servico: 'NfeStatusServico',
    wsdl: 'NFeStatusServico4',
    operation: 'nfeStatusServicoNF',
    style: 'resultMsg',
    autorizadores: ['uf', 'svc'],
  },
  NFeAutorizacao: {
    servico: 'NFeAutorizacao',
    wsdl: 'NFeAutorizacao4',
    operation: 'nfeAutorizacaoLote',
    style: 'resultMsg',
    autorizadores: ['uf', 'svc'],
  },
  NFeRetAutorizacao: {
    servico: 'NFeRetAutorizacao',
    wsdl: 'NFeRetAutorizacao4',
    operation: 'nfeRetAutorizacaoLote',
    style: 'resultMsg',
    autorizadores: ['uf', 'svc'],
  },
  NfeConsultaProtocolo: {
    servico: 'NfeConsultaProtocolo',
    wsdl: 'NFeConsultaProtocolo4',
    operation: 'nfeConsultaNF',
    style: 'resultMsg',
    autorizadores: ['uf', 'svc'],
  },
  RecepcaoEvento: {
    servico: 'RecepcaoEvento',
    wsdl: 'NFeRecepcaoEvento4',
    operation: 'nfeRecepcaoEvento',
    style: 'resultMsg',
    autorizadores: ['uf', 'svc', 'an'],
  },
  NfeInutilizacao: {
    servico: 'NfeInutilizacao',
    wsdl: 'NFeInutilizacao4',
    operation: 'nfeInutilizacaoNF',
    style: 'resultMsg',
    autorizadores: ['uf'],
  },
  NfeConsultaCadastro: {
    servico: 'NfeConsultaCadastro',
    wsdl: 'CadConsultaCadastro4',
    operation: 'consultaCadastro',
    style: 'resultMsg',
    autorizadores: ['uf'],
    operacaoEm: ['MT'],
  },
  NFeDistribuicaoDFe: {
    servico: 'NFeDistribuicaoDFe',
    wsdl: 'NFeDistribuicaoDFe',
    operation: 'nfeDistDFeInteresse',
    style: 'operacao',
    autorizadores: ['an'],
  },
};

/**
 * Os web services do MDF-e 3.00 (MOC MDF-e 3.00b Visão Geral, itens 3.4.1 e 4.2 a 5.1), todos na SVRS, que o
 * simulador atende pelo autorizador `uf`. O elemento da resposta (`<operação>Result`) segue o padrão dos WSDL do
 * MDF-e; o cliente do `@sinete/mdfe` procura o retorno pelo nome, então a escolha não o afeta.
 */
export const MDFE_NS = 'http://www.portalfiscal.inf.br/mdfe';
const MDFE_WSDL_BASE = 'http://www.portalfiscal.inf.br/mdfe/wsdl/';

function mdfeDef(servico: MdfeServicoSim, operation: string, compactado = false): ServiceDef {
  return {
    servico,
    wsdl: servico,
    operation,
    style: 'mdfe',
    autorizadores: ['uf'],
    namespace: `${MDFE_WSDL_BASE}${servico}`,
    ...(compactado ? { compactado } : {}),
  };
}

export const MDFE_SERVICES: Readonly<Record<MdfeServicoSim, ServiceDef>> = {
  MDFeRecepcaoSinc: mdfeDef('MDFeRecepcaoSinc', 'mdfeRecepcao', true),
  MDFeConsulta: mdfeDef('MDFeConsulta', 'mdfeConsultaMDF'),
  MDFeConsNaoEnc: mdfeDef('MDFeConsNaoEnc', 'mdfeConsNaoEnc'),
  MDFeStatusServico: mdfeDef('MDFeStatusServico', 'mdfeStatusServicoMDF'),
  MDFeRecepcaoEvento: mdfeDef('MDFeRecepcaoEvento', 'mdfeRecepcaoEvento'),
};

const ALL_SERVICES: Readonly<Record<SimServico, ServiceDef>> = { ...NFE_SERVICES, ...MDFE_SERVICES };

/** Definição de um serviço da NF-e ou do MDF-e. */
export function serviceDef(servico: SimServico): ServiceDef {
  const def = ALL_SERVICES[servico];
  if (def === undefined) throw new ErroDeConfiguracao(`serviço desconhecido: ${String(servico)}`);
  return def;
}

/** O serviço é do MDF-e. */
export function isMdfeServico(servico: string): servico is MdfeServicoSim {
  return Object.hasOwn(MDFE_SERVICES, servico);
}

/** Namespace do WSDL do serviço. */
export function wsdlNamespace(def: ServiceDef): string {
  return def.namespace ?? `${WSDL_BASE}${def.wsdl}`;
}

/** `action` do SOAP 1.2 da operação, como vai no `Content-Type`. */
export function soapAction(def: ServiceDef): string {
  return `${wsdlNamespace(def)}/${def.operation}`;
}

/** Caminho do serviço no simulador. */
export function servicePath(servico: SimServico, autorizador: SimAutorizador): string {
  return `/${autorizador}/ws/${serviceDef(servico).wsdl}`;
}

/** Resolve um caminho recebido; `undefined` se não for de nenhum serviço atendido por aquele autorizador. */
export function routeOf(path: string): { readonly def: ServiceDef; readonly autorizador: SimAutorizador } | undefined {
  const m = /^\/(uf|svc|an)\/ws\/([A-Za-z0-9]+)\/?(?:\?.*)?$/.exec(path);
  if (!m) return undefined;
  const autorizador = m[1] as SimAutorizador;
  const def = Object.values(ALL_SERVICES).find((d) => d.wsdl === m[2]);
  return def?.autorizadores.includes(autorizador) ? { def, autorizador } : undefined;
}
