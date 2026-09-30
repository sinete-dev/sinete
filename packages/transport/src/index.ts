/**
 * `@sinete/transport`: transporte mTLS dos DF-e.
 *
 * `Transporte` com identidade TLS plugável, endpoints e perfis TLS por host como dados, SOAP 1.2, política de hosts e
 * erros tipados. Esta é a entrada `default` (browser, Deno sem condição `node`, bundlers): `criarTransporte` só cria o
 * transporte do Deno. Node e Bun resolvem a entrada `node`, que acrescenta o transporte sobre `node:https`.
 */

import { ErroNaoSuportado } from '@sinete/core';
import { detectarRuntime } from './common.ts';
import type { TransporteDenoOpcoes } from './deno.ts';
import { criarTransporteDeno } from './deno.ts';
import type { Transporte } from './types.ts';

export type { DadosDaFalhaDoHelper } from './classify.ts';
export { classificarFalhaDeTransporte, classificarFalhaDoHelper, erroHttp403 } from './classify.ts';
export { detectarRuntime, motivosNaoSuportado } from './common.ts';
export type { ApiHttpDeno, TransporteDenoOpcoes } from './deno.ts';
export { CAPACIDADES_DENO, criarTransporteDeno } from './deno.ts';
export type {
  BuscaEndpointNfce,
  BuscaEndpointNfe,
  DescricaoDadosDeEndpoints,
  DocumentoFiscal,
  EndpointResolvido,
  MdfeServico,
  NfceAutorizador,
  NfeAutorizador,
  NfeServico,
  NfseApi,
  PerfilTls,
  UrlsConsultaNfce,
} from './endpoints.ts';
export {
  DADOS_DE_ENDPOINTS,
  hostsDoAmbiente,
  mdfeEndpoint,
  nfceAutorizadorDaUf,
  nfceEndpoint,
  nfeAutorizadorDaUf,
  nfeContingenciaDaUf,
  nfeEndpoint,
  nfseEndpoint,
  perfilTlsDoHost,
  perfisTls,
  todosOsEndpoints,
  urlsConsultaNfce,
} from './endpoints.ts';
export type { CodigoErroSigner, CodigoErroTransporte } from './errors.ts';
export { ErroPolitica, ErroSigner, ErroTransporte, ErroTransporteNaoSuportado } from './errors.ts';
export { identidadePem } from './identity.ts';
export type { PoliticaDeHostsPermitidosOpcoes } from './policy.ts';
export { politicaDeHostsPermitidos, todasAsPoliticas } from './policy.ts';
export type { SoapFault } from './soap.ts';
export { contentTypeSoap12, envelopeSoap12, lerBodySoap, lerSoapFault, SOAP12_NS } from './soap.ts';
export type {
  AssinadorTls,
  CapacidadesDoTransporte,
  ContextoAssinaturaTls,
  DescricaoTls,
  EventoDeAuditoria,
  HelperTlsExterno,
  IdentidadeTls,
  PedidoHttpDoHelper,
  PedidoParaPolitica,
  PedidoTransporte,
  PoliticaDeHosts,
  RespostaTransporte,
  RuntimeDoTransporte,
  Transporte,
  TransporteOpcoes,
} from './types.ts';

/** Opções aceitas por `criarTransporte` em qualquer entrada. */
export type CriarTransporteOpcoes = TransporteDenoOpcoes;

/**
 * Cria o transporte da runtime atual. Nesta entrada só há o do Deno; em outra runtime, lança `ErroNaoSuportado` em vez
 * de cair num `fetch` genérico que ignoraria a identidade TLS.
 */
export function criarTransporte(opcoes: CriarTransporteOpcoes): Transporte {
  if (detectarRuntime() === 'deno') return criarTransporteDeno(opcoes);
  throw new ErroNaoSuportado(
    `sem transporte mTLS para a runtime "${detectarRuntime()}" nesta entrada; em Node e Bun o pacote resolve a condição "node"`,
  );
}
