/**
 * `@sinete/transport`, entrada `node` (Node, Bun e o Deno que resolve a condição `node`).
 *
 * Igual à entrada `default`, mais o transporte sobre `node:https`. `criarTransporte` escolhe pela runtime: Deno usa
 * `Deno.createHttpClient` (o `node:tls` do Deno também é rustls e não renegocia), Node e Bun usam `node:https`.
 */

import type { CriarTransporteOpcoes } from './index.ts';
import { criarTransporteDeno, detectarRuntime } from './index.ts';
import type { TransporteNodeOpcoes } from './transport.node.ts';
import { criarTransporteNode } from './transport.node.ts';
import type { Transporte } from './types.ts';

export type {
  ApiHttpDeno,
  AssinadorTls,
  BuscaEndpointNfce,
  BuscaEndpointNfe,
  CapacidadesDoTransporte,
  CodigoErroSigner,
  CodigoErroTransporte,
  ContextoAssinaturaTls,
  CriarTransporteOpcoes,
  DadosDaFalhaDoHelper,
  DescricaoDadosDeEndpoints,
  DescricaoTls,
  DocumentoFiscal,
  EndpointResolvido,
  EventoDeAuditoria,
  HelperTlsExterno,
  IdentidadeTls,
  MdfeServico,
  NfceAutorizador,
  NfeAutorizador,
  NfeServico,
  NfseApi,
  PedidoHttpDoHelper,
  PedidoParaPolitica,
  PedidoTransporte,
  PerfilTls,
  PoliticaDeHosts,
  PoliticaDeHostsPermitidosOpcoes,
  RespostaTransporte,
  RuntimeDoTransporte,
  SoapFault,
  Transporte,
  TransporteDenoOpcoes,
  TransporteOpcoes,
  UrlsConsultaNfce,
} from './index.ts';
export {
  CAPACIDADES_DENO,
  classificarFalhaDeTransporte,
  classificarFalhaDoHelper,
  contentTypeSoap12,
  criarTransporteDeno,
  DADOS_DE_ENDPOINTS,
  detectarRuntime,
  ErroPolitica,
  ErroSigner,
  ErroTransporte,
  ErroTransporteNaoSuportado,
  envelopeSoap12,
  erroHttp403,
  hostsDoAmbiente,
  identidadePem,
  lerBodySoap,
  lerSoapFault,
  mdfeEndpoint,
  motivosNaoSuportado,
  nfceAutorizadorDaUf,
  nfceEndpoint,
  nfeAutorizadorDaUf,
  nfeContingenciaDaUf,
  nfeEndpoint,
  nfseEndpoint,
  perfilTlsDoHost,
  perfisTls,
  politicaDeHostsPermitidos,
  SOAP12_NS,
  todasAsPoliticas,
  todosOsEndpoints,
  urlsConsultaNfce,
} from './index.ts';
export type { TransporteNodeOpcoes } from './transport.node.ts';
export { conferirCertificadoLocal, criarTransporteNode } from './transport.node.ts';

/**
 * Cria o transporte da runtime atual: `node:https` em Node e Bun, `Deno.createHttpClient` no Deno. As opções de
 * Node (`confianca`, `sigalgs`, `manterConexao`) são ignoradas no Deno, que não tem esses ajustes; `hostsDesconhecidos` só vale no
 * Deno.
 */
export function criarTransporte(opcoes: CriarTransporteOpcoes & TransporteNodeOpcoes): Transporte {
  if (detectarRuntime() === 'deno') return criarTransporteDeno(opcoes);
  return criarTransporteNode(opcoes);
}
