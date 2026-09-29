/**
 * Contrato do transporte (ADR 0004, decisão 4, estendido pelo ADR 0005, decisão 6).
 *
 * O `Transport` recebe bytes e devolve bytes: não sabe de NF-e nem de SOAP. Quem monta a mensagem é o pacote do
 * documento; quem decide para onde vai são os dados de endpoints. As opções são objetos fechados e tipados, para que
 * nenhuma opção de uma runtime seja ignorada em silêncio por outra (o bug do `fetch` com `tls` do Bun no Node).
 */

import type { Logger } from '@sinete/core';
import type { EndpointRef } from './endpoints.ts';

export type TransportRuntime = 'node' | 'bun' | 'deno' | 'custom';

/** O que a implementação consegue fazer. O perfil TLS de cada host diz o que ele exige. */
export interface TransportCapabilities {
  readonly runtime: TransportRuntime;
  /** Aceita a renegociação TLS 1.2 iniciada pelo servidor (IIS pedindo o certificado depois da requisição). */
  readonly renegotiation: boolean;
  /** Fala TLS 1.2 com suítes CBC (PR, BA produção, AN). */
  readonly tls12Cbc: boolean;
  /** Fala TLS 1.2 com troca DHE (GO produção). O BoringSSL do Bun não tem nenhuma suíte DHE. */
  readonly tls12Dhe: boolean;
  /** Permite fixar os algoritmos de assinatura do handshake (`sigalgs`), o que importa para A3. */
  readonly sigalgsControl: boolean;
  /** Confere, depois do handshake, que o certificado local no socket é o da identidade. */
  readonly clientCertificateCheck: boolean;
}

export interface TransportRequest {
  readonly url: string;
  /** Padrão: `POST` com corpo, `GET` sem. */
  readonly method?: 'POST' | 'GET';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: Uint8Array | string;
  readonly signal?: AbortSignal;
  /** Sobrepõe o prazo do transporte para esta requisição. */
  readonly timeoutMs?: number;
  /** Endpoint resolvido pelos dados, para a política e o perfil TLS. Opcional para URLs avulsas. */
  readonly endpoint?: EndpointRef;
}

export interface TlsInfo {
  readonly protocol: string | undefined;
  readonly cipher: string | undefined;
  readonly resumed: boolean | undefined;
  /** `true` quando o transporte conferiu que o certificado da identidade estava no socket. */
  readonly clientCertificateLoaded: boolean | undefined;
  /**
   * Assinaturas de handshake pedidas durante esta requisição (0 numa conexão reaproveitada; 1 ou mais num handshake
   * completo ou numa renegociação). Só o helper `sinete-signer` informa: é a contabilidade da cota de um PSC.
   */
  readonly signatures?: number;
}

export interface TransportResponse {
  readonly status: number;
  /** Cabeçalhos com nome em minúsculas. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array;
  readonly tls: TlsInfo;
  /** Corpo decodificado como UTF-8. */
  text(): string;
}

export interface Transport {
  readonly capabilities: TransportCapabilities;
  send(request: TransportRequest): Promise<TransportResponse>;
  /** Fecha conexões em keep-alive e libera o cliente. */
  close(): Promise<void>;
}

/** Contexto de uma assinatura pedida pelo helper `sinete-signer` durante o handshake (ADR 0005). */
export interface TlsSignContext {
  readonly host: string;
  /** Sempre o CertificateVerify de um handshake TLS 1.2 que o helper iniciou. */
  readonly purpose: 'tls12-client-certificate-verify';
  /** Número da conexão no helper. */
  readonly connectionId: string;
  /** 1: handshake inicial; 2: renegociação pedida pelo servidor. */
  readonly handshake: number;
}

/**
 * Quem assina o CertificateVerify fora do processo TLS (A1 em `CryptoKey` não exportável, A3 em nuvem de PSC,
 * OpenBao Transit, chave no navegador). O helper pede, o cliente do `@sinete/transport/signer` aplica a política do
 * dono da chave (host, propósito, esquema e, no modo `message`, o transcript) e só então chama `sign`.
 */
export interface TlsSigner {
  /**
   * `digest`: `sign` recebe o SHA-256 do transcript (32 bytes) e devolve RSA PKCS#1 v1.5 sobre o DigestInfo.
   * `message`: `sign` recebe o transcript inteiro e devolve RSASSA-PKCS1-v1_5 com SHA-256 sobre ele.
   */
  readonly mode: 'digest' | 'message';
  /** Cadeia em DER, titular primeiro, sem a raiz. */
  certificateChain(): Promise<readonly Uint8Array[]>;
  sign(input: Uint8Array, scheme: 'rsa_pkcs1_sha256', context: TlsSignContext): Promise<Uint8Array>;
}

/** Requisição HTTP entregue ao helper, já aprovada pela política. */
export interface HelperHttpRequest {
  readonly url: string;
  readonly method: 'POST' | 'GET';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Uint8Array | undefined;
  readonly timeoutMs: number;
}

/**
 * Conexão com o helper nativo `sinete-signer` (ADR 0005), que termina o mTLS com uma chave que não está no processo.
 * O cliente do protocolo v1 é o `@sinete/transport/signer` (`startSigner`, `connectSigner`); o `Transport` aplica a
 * política e delega a requisição.
 */
export interface ExternalTlsHelper {
  /** Versão do protocolo NDJSON falado com o helper (`v` dos frames). */
  readonly protocolVersion: number;
  request(identity: string, request: HelperHttpRequest, signal?: AbortSignal): Promise<TransportResponse>;
  close(): Promise<void>;
}

/**
 * Identidade TLS do cliente. `pem` roda em processo; `helper` passa pelo `sinete-signer` do ADR 0005, e é o que
 * `openRemote` e `openPkcs11` do `@sinete/transport/signer` devolvem (A3 em token, A3 em nuvem, OpenBao, `CryptoKey`
 * não exportável).
 */
export type TlsIdentity =
  /** A1 em memória: cadeia (titular primeiro) e chave PKCS#8 em PEM, como saem de `A1KeyStore.tlsPem()`. */
  | { readonly kind: 'pem'; readonly certChain: string; readonly key: string }
  /** Identidade aberta no helper; o transporte só manda a requisição e nunca vê a chave. */
  | { readonly kind: 'helper'; readonly helper: ExternalTlsHelper; readonly identity: string };

/** Pedido que a política examina antes de qualquer socket. */
export interface PolicyRequest {
  readonly url: URL;
  readonly method: 'POST' | 'GET';
  readonly body: Uint8Array | string | undefined;
  readonly endpoint: EndpointRef | undefined;
}

/** Política de hosts: lança `PolicyError` para recusar. Roda antes de abrir socket, em todo envio. */
export interface HostPolicy {
  check(request: PolicyRequest): void | Promise<void>;
}

/** Um uso do certificado, para auditoria (o app grava onde quiser). Sem segredo e sem corpo. */
export interface AuditEvent {
  readonly runtime: TransportRuntime;
  readonly host: string;
  readonly path: string;
  readonly method: 'POST' | 'GET';
  readonly status: number | undefined;
  readonly errorCode: string | undefined;
  readonly durationMs: number;
}

/** Opções comuns às implementações. */
export interface TransportOptions {
  readonly identity: TlsIdentity;
  /** Política de hosts (allowlist, ambiente). Sem política, só as travas fixas: https e sem credencial na URL. */
  readonly policy?: HostPolicy;
  /** PEMs de AC somados ao conjunto de confiança (ex.: a AC de um servidor de teste local). */
  readonly additionalCa?: readonly string[];
  /** Prazo por requisição, em ms. Padrão: 60 000. */
  readonly timeoutMs?: number;
  /** HTTP 403 vira `certificado_ausente_ou_recusado` (é o que o IIS da SEFAZ responde). Padrão: `true`. */
  readonly rejectOn403?: boolean;
  readonly logger?: Logger;
  readonly audit?: (event: AuditEvent) => void;
}
