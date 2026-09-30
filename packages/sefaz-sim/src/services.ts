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
export type AutorizadorSim = 'uf' | 'svc' | 'an';

/** Serviços do MDF-e que o simulador atende (a distribuição de DF-e do MDF-e fica de fora). */
export type MdfeServicoSim = Exclude<MdfeServico, 'MDFeDistribuicaoDFe'>;

/** Serviço atendido pelo simulador: da NF-e ou do MDF-e, com os nomes que o `@sinete/transport` usa. */
export type ServicoSim = NfeServico | MdfeServicoSim;

export interface DefinicaoDeServico {
  readonly servico: ServicoSim;
  /** Nome do serviço no WSDL (`NFeAutorizacao4`); também é o fim do namespace e do caminho. */
  readonly wsdl: string;
  /** Operação do WSDL; a `action` do SOAP 1.2 é `<namespace>/<operação>`. */
  readonly operacao: string;
  /**
   * `resultMsg`: `nfeDadosMsg` no pedido e `nfeResultMsg` na resposta (serviços 4.00).
   * `operacao`: o elemento da operação envolve `nfeDadosMsg` e a resposta é `<operação>Response/<operação>Result`
   * (NFeDistribuicaoDFe do AN).
   * `mdfe`: `mdfeDadosMsg` no pedido e `<operação>Result` na resposta (MDF-e 3.00).
   */
  readonly estilo: 'resultMsg' | 'operacao' | 'mdfe';
  readonly autorizadores: readonly AutorizadorSim[];
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

export const SERVICOS_NFE: Readonly<Record<NfeServico, DefinicaoDeServico>> = {
  NfeStatusServico: {
    servico: 'NfeStatusServico',
    wsdl: 'NFeStatusServico4',
    operacao: 'nfeStatusServicoNF',
    estilo: 'resultMsg',
    autorizadores: ['uf', 'svc'],
  },
  NFeAutorizacao: {
    servico: 'NFeAutorizacao',
    wsdl: 'NFeAutorizacao4',
    operacao: 'nfeAutorizacaoLote',
    estilo: 'resultMsg',
    autorizadores: ['uf', 'svc'],
  },
  NFeRetAutorizacao: {
    servico: 'NFeRetAutorizacao',
    wsdl: 'NFeRetAutorizacao4',
    operacao: 'nfeRetAutorizacaoLote',
    estilo: 'resultMsg',
    autorizadores: ['uf', 'svc'],
  },
  NfeConsultaProtocolo: {
    servico: 'NfeConsultaProtocolo',
    wsdl: 'NFeConsultaProtocolo4',
    operacao: 'nfeConsultaNF',
    estilo: 'resultMsg',
    autorizadores: ['uf', 'svc'],
  },
  RecepcaoEvento: {
    servico: 'RecepcaoEvento',
    wsdl: 'NFeRecepcaoEvento4',
    operacao: 'nfeRecepcaoEvento',
    estilo: 'resultMsg',
    autorizadores: ['uf', 'svc', 'an'],
  },
  NfeInutilizacao: {
    servico: 'NfeInutilizacao',
    wsdl: 'NFeInutilizacao4',
    operacao: 'nfeInutilizacaoNF',
    estilo: 'resultMsg',
    autorizadores: ['uf'],
  },
  NfeConsultaCadastro: {
    servico: 'NfeConsultaCadastro',
    wsdl: 'CadConsultaCadastro4',
    operacao: 'consultaCadastro',
    estilo: 'resultMsg',
    autorizadores: ['uf'],
    operacaoEm: ['MT'],
  },
  NFeDistribuicaoDFe: {
    servico: 'NFeDistribuicaoDFe',
    wsdl: 'NFeDistribuicaoDFe',
    operacao: 'nfeDistDFeInteresse',
    estilo: 'operacao',
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

function mdfeDef(servico: MdfeServicoSim, operation: string, compactado = false): DefinicaoDeServico {
  return {
    servico,
    wsdl: servico,
    operacao: operation,
    estilo: 'mdfe',
    autorizadores: ['uf'],
    namespace: `${MDFE_WSDL_BASE}${servico}`,
    ...(compactado ? { compactado } : {}),
  };
}

export const SERVICOS_MDFE: Readonly<Record<MdfeServicoSim, DefinicaoDeServico>> = {
  MDFeRecepcaoSinc: mdfeDef('MDFeRecepcaoSinc', 'mdfeRecepcao', true),
  MDFeConsulta: mdfeDef('MDFeConsulta', 'mdfeConsultaMDF'),
  MDFeConsNaoEnc: mdfeDef('MDFeConsNaoEnc', 'mdfeConsNaoEnc'),
  MDFeStatusServico: mdfeDef('MDFeStatusServico', 'mdfeStatusServicoMDF'),
  MDFeRecepcaoEvento: mdfeDef('MDFeRecepcaoEvento', 'mdfeRecepcaoEvento'),
};

const ALL_SERVICES: Readonly<Record<ServicoSim, DefinicaoDeServico>> = { ...SERVICOS_NFE, ...SERVICOS_MDFE };

/** Definição de um serviço da NF-e ou do MDF-e. */
export function definicaoDoServico(servico: ServicoSim): DefinicaoDeServico {
  const def = ALL_SERVICES[servico];
  if (def === undefined) throw new ErroDeConfiguracao(`serviço desconhecido: ${String(servico)}`);
  return def;
}

/** O serviço é do MDF-e. */
export function ehServicoMdfe(servico: string): servico is MdfeServicoSim {
  return Object.hasOwn(SERVICOS_MDFE, servico);
}

/** Namespace do WSDL do serviço. */
export function namespaceDoWsdl(definicao: DefinicaoDeServico): string {
  return definicao.namespace ?? `${WSDL_BASE}${definicao.wsdl}`;
}

/** `action` do SOAP 1.2 da operação, como vai no `Content-Type`. */
export function acaoSoap(definicao: DefinicaoDeServico): string {
  return `${namespaceDoWsdl(definicao)}/${definicao.operacao}`;
}

/** Caminho do serviço no simulador. */
export function caminhoDoServico(servico: ServicoSim, autorizador: AutorizadorSim): string {
  return `/${autorizador}/ws/${definicaoDoServico(servico).wsdl}`;
}

/** Resolve um caminho recebido; `undefined` se não for de nenhum serviço atendido por aquele autorizador. */
export function rotaDe(
  caminho: string,
): { readonly definicao: DefinicaoDeServico; readonly autorizador: AutorizadorSim } | undefined {
  const m = /^\/(uf|svc|an)\/ws\/([A-Za-z0-9]+)\/?(?:\?.*)?$/.exec(caminho);
  if (!m) return undefined;
  const autorizador = m[1] as AutorizadorSim;
  const def = Object.values(ALL_SERVICES).find((d) => d.wsdl === m[2]);
  return def?.autorizadores.includes(autorizador) ? { definicao: def, autorizador } : undefined;
}
