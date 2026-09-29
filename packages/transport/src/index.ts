/**
 * `@sinete/transport`: transporte mTLS dos DF-e.
 *
 * `Transport` com identidade TLS plugável, endpoints e perfis TLS por host como dados, SOAP 1.2, política de hosts e
 * erros tipados. Esta é a entrada `default` (browser, Deno sem condição `node`, bundlers): `createTransport` só cria o
 * transporte do Deno. Node e Bun resolvem a entrada `node`, que acrescenta o transporte sobre `node:https`.
 */

import { UnsupportedError } from '@sinete/core';
import { detectRuntime } from './common.ts';
import type { DenoTransportOptions } from './deno.ts';
import { createDenoTransport } from './deno.ts';
import type { Transport } from './types.ts';

export type { HelperFailureData } from './classify.ts';
export { classifyHelperFailure, classifyTransportFailure, http403Error } from './classify.ts';
export { detectRuntime, unsupportedReasons } from './common.ts';
export type { DenoHttpApi, DenoTransportOptions } from './deno.ts';
export { createDenoTransport, DENO_CAPABILITIES } from './deno.ts';
export type {
  DocumentoFiscal,
  EndpointDataInfo,
  EndpointRef,
  MdfeServico,
  NfceAutorizador,
  NfceConsultaUrls,
  NfceEndpointQuery,
  NfeAutorizador,
  NfeEndpointQuery,
  NfeServico,
  NfseApi,
  TlsProfile,
} from './endpoints.ts';
export {
  allEndpoints,
  ambienteHosts,
  ENDPOINT_DATA,
  mdfeEndpoint,
  nfceAutorizadorDaUf,
  nfceConsultaUrls,
  nfceEndpoint,
  nfeAutorizadorDaUf,
  nfeContingenciaDaUf,
  nfeEndpoint,
  nfseEndpoint,
  tlsProfileForHost,
  tlsProfiles,
} from './endpoints.ts';
export type { SignerErrorCode, TransportErrorCode } from './errors.ts';
export { PolicyError, SignerError, TransportError, TransportUnsupportedError } from './errors.ts';
export { pemIdentity } from './identity.ts';
export type { AllowlistPolicyOptions } from './policy.ts';
export { allowlistPolicy, allPolicies } from './policy.ts';
export type { SoapFault } from './soap.ts';
export { SOAP12_NS, soap12ContentType, soap12Envelope, soapBody, soapFault } from './soap.ts';
export type {
  AuditEvent,
  ExternalTlsHelper,
  HelperHttpRequest,
  HostPolicy,
  PolicyRequest,
  TlsIdentity,
  TlsInfo,
  TlsSignContext,
  TlsSigner,
  Transport,
  TransportCapabilities,
  TransportOptions,
  TransportRequest,
  TransportResponse,
  TransportRuntime,
} from './types.ts';

/** Opções aceitas por `createTransport` em qualquer entrada. */
export type CreateTransportOptions = DenoTransportOptions;

/**
 * Cria o transporte da runtime atual. Nesta entrada só há o do Deno; em outra runtime, lança `UnsupportedError` em vez
 * de cair num `fetch` genérico que ignoraria a identidade TLS.
 */
export function createTransport(options: CreateTransportOptions): Transport {
  if (detectRuntime() === 'deno') return createDenoTransport(options);
  throw new UnsupportedError(
    `sem transporte mTLS para a runtime "${detectRuntime()}" nesta entrada; em Node e Bun o pacote resolve a condição "node"`,
  );
}
