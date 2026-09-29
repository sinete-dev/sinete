/**
 * `@sinete/transport`, entrada `node` (Node, Bun e o Deno que resolve a condição `node`).
 *
 * Igual à entrada `default`, mais o transporte sobre `node:https`. `createTransport` escolhe pela runtime: Deno usa
 * `Deno.createHttpClient` (o `node:tls` do Deno também é rustls e não renegocia), Node e Bun usam `node:https`.
 */

import type { CreateTransportOptions } from './index.ts';
import { createDenoTransport, detectRuntime } from './index.ts';
import type { NodeTransportOptions } from './transport.node.ts';
import { createNodeTransport } from './transport.node.ts';
import type { Transport } from './types.ts';

export type {
  AllowlistPolicyOptions,
  AuditEvent,
  CreateTransportOptions,
  DenoHttpApi,
  DenoTransportOptions,
  DocumentoFiscal,
  EndpointDataInfo,
  EndpointRef,
  ExternalTlsHelper,
  HelperFailureData,
  HelperHttpRequest,
  HostPolicy,
  MdfeServico,
  NfceAutorizador,
  NfceConsultaUrls,
  NfceEndpointQuery,
  NfeAutorizador,
  NfeEndpointQuery,
  NfeServico,
  NfseApi,
  PolicyRequest,
  SignerErrorCode,
  SoapFault,
  TlsIdentity,
  TlsInfo,
  TlsProfile,
  TlsSignContext,
  TlsSigner,
  Transport,
  TransportCapabilities,
  TransportErrorCode,
  TransportOptions,
  TransportRequest,
  TransportResponse,
  TransportRuntime,
} from './index.ts';
export {
  allEndpoints,
  allowlistPolicy,
  allPolicies,
  ambienteHosts,
  classifyHelperFailure,
  classifyTransportFailure,
  createDenoTransport,
  DENO_CAPABILITIES,
  detectRuntime,
  ENDPOINT_DATA,
  http403Error,
  mdfeEndpoint,
  nfceAutorizadorDaUf,
  nfceConsultaUrls,
  nfceEndpoint,
  nfeAutorizadorDaUf,
  nfeContingenciaDaUf,
  nfeEndpoint,
  nfseEndpoint,
  PolicyError,
  pemIdentity,
  SignerError,
  SOAP12_NS,
  soap12ContentType,
  soap12Envelope,
  soapBody,
  soapFault,
  TransportError,
  TransportUnsupportedError,
  tlsProfileForHost,
  tlsProfiles,
  unsupportedReasons,
} from './index.ts';
export type { NodeTransportOptions } from './transport.node.ts';
export { checkLocalCertificate, createNodeTransport } from './transport.node.ts';

/**
 * Cria o transporte da runtime atual: `node:https` em Node e Bun, `Deno.createHttpClient` no Deno. As opções de
 * Node (`trust`, `sigalgs`, `keepAlive`) são ignoradas no Deno, que não tem esses ajustes; `unknownHosts` só vale no
 * Deno.
 */
export function createTransport(options: CreateTransportOptions & NodeTransportOptions): Transport {
  if (detectRuntime() === 'deno') return createDenoTransport(options);
  return createNodeTransport(options);
}
