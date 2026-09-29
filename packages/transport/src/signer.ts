/**
 * `@sinete/transport/signer`: cliente do protocolo v1 do helper `sinete-signer` (ADR 0005,
 * `docs/signer-contract/PROTOCOL.md`), que termina o mTLS com uma chave que não está no processo JS.
 *
 * Esta entrada é pura: fala o protocolo sobre qualquer `SignerChannel` (o stdio de um processo filho, um socket Unix,
 * um WebSocket até o navegador). A entrada `node` acrescenta `startSigner`, que sobe o binário, e `connectSigner`, que
 * conecta no socket Unix do helper em contêiner.
 *
 * Identidades:
 * - `openRemote`: a chave fica com quem chamou, num `TlsSigner` (A1 em `CryptoKey` não exportável, A3 em nuvem de
 *   PSC, OpenBao Transit). O helper pede `sign` no meio do handshake; este cliente aplica a política do dono da chave
 *   (host, propósito, esquema e, no modo `message`, o transcript) antes de chamar o `TlsSigner`.
 * - `openPkcs11`: token local pelo helper `-p11`. O `documentSigner` assina XML dos DF-e pelo `dfe.sign`, que o
 *   helper valida antes de usar a chave do token.
 */

import type { IcpIdentity } from '@sinete/cert';
import { base64ToBytes, bytesToBase64, encodeDigestInfo, icpIdentity, parseCertificate } from '@sinete/cert';
import type { DataSigner, DigestSigner, Logger, SignatureHash, SignContext, Signer } from '@sinete/core';
import { ConfigError, noopLogger, TimeoutError } from '@sinete/core';
import type { HelperFailureData } from './classify.ts';
import { classifyHelperFailure } from './classify.ts';
import { PolicyError, SignerError, TransportError } from './errors.ts';
import type {
  ExternalTlsHelper,
  HelperHttpRequest,
  TlsIdentity,
  TlsSignContext,
  TlsSigner,
  TransportResponse,
} from './types.ts';

/** Versão do protocolo falada por este cliente (`docs/signer-contract/PROTOCOL_VERSION`). */
export const SIGNER_PROTOCOL_VERSION = 1;

/** Um canal de linhas até o helper. Cada linha é um frame JSON, sem o `\n`. */
export interface SignerChannel {
  send(line: string): void;
  onLine(listener: (line: string) => void): void;
  /** Chamado uma vez quando o canal fecha (processo saiu, socket fechou). */
  onClose(listener: (reason: string) => void): void;
  close(): Promise<void>;
}

/** O que o helper disse no `hello`. */
export interface SignerHello {
  readonly protocol: number;
  readonly helper: string;
  readonly lab: boolean;
  readonly ambientes: readonly string[];
  readonly backends: readonly ('remote' | 'pkcs11')[];
  readonly signModes: readonly string[];
  readonly schemes: readonly string[];
  readonly methods: readonly string[];
  readonly dataVersion: string | undefined;
}

export interface SignerClientOptions {
  /** Nome e versão do cliente, só para o log do helper. */
  readonly client?: string;
  /** Prazo dos pedidos de controle (`hello`, `identity.open`, `stats`). Padrão: 60 000 ms (login em token é lento). */
  readonly controlTimeoutMs?: number;
  readonly logger?: Logger;
}

export interface OpenRemoteOptions {
  /** Nome da identidade no helper. Padrão: `remote-<n>`. */
  readonly id?: string;
  readonly signer: TlsSigner;
  /**
   * Hosts em que esta chave aceita autenticar: a política do dono da chave, independente da guarda do helper.
   * Obrigatório; `ambienteHosts('homologacao')` é o ponto de partida.
   */
  readonly allowedHosts: Iterable<string>;
  /** Prazo para o `TlsSigner` responder, em ms. Padrão: 30 000; máximo 300 000. */
  readonly signTimeoutMs?: number;
  /** PEMs de AC somados à confiança do servidor só desta identidade (AC de teste, proxy corporativo). */
  readonly additionalCa?: readonly string[];
}

export interface OpenPkcs11Options {
  readonly id?: string;
  /** Caminho absoluto do módulo PKCS#11 do fabricante. */
  readonly module: string;
  /** Rótulo do token. */
  readonly token: string;
  /** Número de série do token, para desempatar tokens com o mesmo rótulo. */
  readonly serial?: string;
  /** Rótulo do certificado no token; a chave é a de mesmo `CKA_ID`. */
  readonly label?: string;
  /** `CKA_ID` do par em hexadecimal, no lugar do rótulo. */
  readonly keyId?: string;
  /** O PIN é pedido na hora de abrir e atravessa só o canal, nunca argv ou env. */
  readonly pin: () => Promise<string>;
  /** Intermediárias em DER que completam a cadeia (o token costuma guardar só o titular). */
  readonly chain?: readonly Uint8Array[];
  readonly additionalCa?: readonly string[];
}

/** Uma identidade aberta no helper. */
export interface SignerIdentity {
  readonly id: string;
  readonly backend: 'remote' | 'pkcs11';
  /** Para o `createTransport` e para o `@sinete/emissor` (`CertificadoAberto.identidade`). */
  readonly tlsIdentity: Extract<TlsIdentity, { kind: 'helper' }>;
  readonly chain: readonly Uint8Array[];
  readonly subject: string;
  readonly notAfter: string;
  readonly cnpj: string | undefined;
  readonly cpf: string | undefined;
  /**
   * `DataSigner` do `@sinete/core` que assina XML dos DF-e com a chave do token, pelo `dfe.sign` (só `pkcs11`). Serve
   * de `CertificadoAberto.signer` no `@sinete/emissor`. No `remote` é `undefined`: quem tem a chave assina.
   */
  readonly documentSigner: DataSigner | undefined;
  resetPool(options?: { readonly dropSessions?: boolean }): Promise<void>;
  close(): Promise<void>;
}

/** A conexão com o helper. É também o `ExternalTlsHelper` que as identidades usam. */
export interface SignerConnection extends ExternalTlsHelper {
  readonly hello: SignerHello;
  openRemote(options: OpenRemoteOptions): Promise<SignerIdentity>;
  openPkcs11(options: OpenPkcs11Options): Promise<SignerIdentity>;
  /** Assinaturas feitas por identidade (handshakes e `dfe.sign`). */
  stats(): Promise<Readonly<Record<string, { readonly signatures: number; readonly backend: string }>>>;
}

interface WireError {
  readonly code: string;
  readonly message: string;
  readonly data?: HelperFailureData;
}

interface Frame {
  readonly v: number;
  readonly id: string;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
  readonly result?: Record<string, unknown>;
  readonly error?: WireError;
}

/** Erro que veio do helper, antes de virar erro tipado do sinete. */
class RemoteError extends Error {
  readonly wire: WireError;
  constructor(wire: WireError) {
    super(`${wire.code}: ${wire.message}`);
    this.wire = wire;
  }
}

interface RemoteKey {
  readonly signer: TlsSigner;
  readonly allowed: ReadonlySet<string>;
}

const DEFAULT_CONTROL_TIMEOUT_MS = 60_000;

function b64(bytes: Uint8Array): string {
  return bytesToBase64(bytes);
}

/**
 * Forma única de um host para comparar a política do dono da chave com o contexto do helper: nome em minúsculas, IP
 * na forma de `ipLiteral` (o `URL.hostname` dá `[::1]`, o helper manda `::1`).
 */
function hostKey(host: string): string {
  return ipLiteral(host) ?? host.toLowerCase();
}

/**
 * O host é um endereço IP? Devolve a forma que o `@sinete/cert` usa no iPAddress do SAN (IPv4 com pontos, IPv6 na forma
 * curta da RFC 5952, a mesma do WHATWG URL), ou `undefined` para nome DNS.
 */
function ipLiteral(host: string): string | undefined {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  if (!host.includes(':')) return undefined;
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  try {
    return unmapIp(new URL(`https://[${bare}]/`).hostname.slice(1, -1));
  } catch {
    return undefined;
  }
}

/**
 * IPv4 mapeado em IPv6 (`::ffff:a.b.c.d`, RFC 4291, seção 2.5.5.2) é o próprio IPv4, como no `net.IP` do Go: o host e
 * o iPAddress do SAN passam por aqui antes de comparar.
 */
function unmapIp(ip: string): string {
  const m = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
  if (!m) return ip;
  const hi = Number.parseInt(m[1] ?? '0', 16);
  const lo = Number.parseInt(m[2] ?? '0', 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

/** Nome DNS do certificado cobre o host (RFC 6125, seção 6.4.3: curinga só no rótulo mais à esquerda). */
function dnsMatches(pattern: string, host: string): boolean {
  const p = pattern.toLowerCase();
  const h = host.toLowerCase();
  if (!p.startsWith('*.')) return p === h;
  const rest = p.slice(1);
  return h.endsWith(rest) && !h.slice(0, h.length - rest.length).includes('.') && h.length > rest.length;
}

/**
 * Lê do transcript TLS 1.2 o SNI do ClientHello e o primeiro certificado da mensagem Certificate do servidor. O
 * transcript é a sequência de mensagens de handshake (tipo, 3 bytes de tamanho, corpo), RFC 5246, seção 7.4.
 */
export function parseTlsTranscript(transcript: Uint8Array): {
  readonly sni: string | undefined;
  readonly serverCertificate: Uint8Array | undefined;
} {
  const u24 = (o: number): number =>
    ((transcript[o] ?? 0) << 16) | ((transcript[o + 1] ?? 0) << 8) | (transcript[o + 2] ?? 0);
  const u16 = (b: Uint8Array, o: number): number => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
  let sni: string | undefined;
  let serverCertificate: Uint8Array | undefined;
  let off = 0;
  while (off + 4 <= transcript.length) {
    const type = transcript[off];
    const len = u24(off + 1);
    const body = transcript.subarray(off + 4, off + 4 + len);
    if (type === 1 && sni === undefined) {
      // ClientHello: versão (2) + random (32) + session_id + cipher_suites + compression + extensões.
      let o = 34;
      o += 1 + (body[o] ?? 0);
      o += 2 + u16(body, o);
      o += 1 + (body[o] ?? 0);
      const end = o + 2 + u16(body, o);
      o += 2;
      while (o + 4 <= end && o + 4 <= body.length) {
        const ext = u16(body, o);
        const extLen = u16(body, o + 2);
        if (ext === 0) {
          // server_name: lista (2) + tipo (1) + tamanho (2) + nome.
          const nameLen = u16(body, o + 4 + 3);
          sni = new TextDecoder().decode(body.subarray(o + 4 + 5, o + 4 + 5 + nameLen));
        }
        o += 4 + extLen;
      }
    } else if (type === 11 && serverCertificate === undefined) {
      const first = ((body[3] ?? 0) << 16) | ((body[4] ?? 0) << 8) | (body[5] ?? 0);
      serverCertificate = body.subarray(6, 6 + first);
    }
    off += 4 + len;
  }
  return { sni, serverCertificate };
}

/** Converte o erro do helper no erro tipado do sinete. */
function toSineteError(wire: WireError, host: string | undefined, timeoutMs: number | undefined): Error {
  const where = host ?? 'sinete-signer';
  switch (wire.code) {
    case 'guard':
      return new PolicyError(
        `recusado pela guarda do helper: ${wire.message}`,
        host === undefined ? undefined : { host },
      );
    case 'transport':
      if (wire.data?.timeout) {
        return new TimeoutError(`${where}: sem resposta em ${timeoutMs ?? '?'} ms (helper)`, timeoutMs ?? 0, {
          details: { host: where, helper: wire.message },
        });
      }
      return classifyHelperFailure(wire.data ?? {}, wire.message, where);
    case 'sign_refused':
      return new SignerError('assinatura_tls_recusada', `${where}: assinatura do handshake recusada: ${wire.message}`, {
        details: { host: where },
      });
    case 'sign_timeout':
      return new SignerError('assinatura_tls_expirou', `${where}: quem assina não respondeu: ${wire.message}`, {
        details: { host: where },
      });
    case 'pkcs11':
      return new SignerError('pkcs11_falhou', `PKCS#11: ${wire.message}`);
    case 'dfe_refused':
      return new SignerError('assinatura_documento_recusada', `o helper recusou assinar o documento: ${wire.message}`);
    case 'closed':
      return new SignerError('signer_indisponivel', `o helper fechou o canal: ${wire.message}`);
    default:
      return new SignerError('signer_protocolo', `${wire.code}: ${wire.message}`, { details: { code: wire.code } });
  }
}

/**
 * Conecta ao helper por um canal já aberto e faz o `hello`. Recusa helper de outra versão do protocolo
 * (`signer_protocolo`).
 */
export async function connectSignerChannel(
  channel: SignerChannel,
  options: SignerClientOptions = {},
): Promise<SignerConnection> {
  const logger = options.logger ?? noopLogger;
  const controlTimeout = options.controlTimeoutMs ?? DEFAULT_CONTROL_TIMEOUT_MS;
  const pending = new Map<string, { resolve: (r: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  const keys = new Map<string, RemoteKey>();
  let next = 1;
  let closedReason: string | undefined;
  let identityCount = 0;

  const send = (frame: Record<string, unknown>): void => {
    channel.send(JSON.stringify({ v: SIGNER_PROTOCOL_VERSION, ...frame }));
  };
  // Resposta a um pedido do helper: com o canal fechado (ou um send que lança), não há a quem responder, e o erro não
  // pode escapar de um answer que ninguém espera.
  const reply = (frame: Record<string, unknown>): void => {
    if (closedReason !== undefined) return;
    try {
      send(frame);
    } catch (e) {
      logger.warn('sinete-signer: resposta ao helper não saiu', { error: e instanceof Error ? e.message : String(e) });
    }
  };

  channel.onClose((reason) => {
    closedReason = reason;
    for (const [, p] of pending) {
      p.reject(new SignerError('signer_indisponivel', `o helper saiu: ${reason}`));
    }
    pending.clear();
  });

  channel.onLine((line) => {
    if (line.trim() === '') return;
    let f: Frame;
    try {
      f = JSON.parse(line) as Frame;
    } catch {
      logger.warn('sinete-signer: linha que não é frame', { line: line.slice(0, 200) });
      return;
    }
    // JSON válido que não é objeto (null, número, lista) não é frame: vira aviso, nunca exceção no evento do stream.
    if (typeof f !== 'object' || f === null || Array.isArray(f)) {
      logger.warn('sinete-signer: linha que não é frame', { line: line.slice(0, 200) });
      return;
    }
    if (f.v !== SIGNER_PROTOCOL_VERSION) {
      logger.warn('sinete-signer: frame de outra versão', { v: f.v });
      // Resposta de outra versão a um pedido nosso (um helper v2 respondendo ao hello): falha já, com o código certo,
      // em vez de esperar o prazo.
      const p = typeof f.id === 'string' ? pending.get(f.id) : undefined;
      if (p) {
        pending.delete(f.id);
        p.reject(
          new SignerError(
            'signer_protocolo',
            `o helper respondeu no protocolo ${String(f.v)}; este cliente fala ${SIGNER_PROTOCOL_VERSION}`,
          ),
        );
      }
      return;
    }
    if (f.method !== undefined) {
      void answer(f);
      return;
    }
    const p = pending.get(f.id);
    if (!p) return;
    pending.delete(f.id);
    if (f.error) p.reject(new RemoteError(f.error));
    else p.resolve(f.result ?? {});
  });

  function call(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
    signal?: AbortSignal,
    onLate?: (result: Record<string, unknown>) => void,
  ): Promise<Record<string, unknown>> {
    if (closedReason !== undefined) {
      return Promise.reject(new SignerError('signer_indisponivel', `o helper saiu: ${closedReason}`));
    }
    const id = `c${next++}`;
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let sent = false;
      const done = (): void => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = (): void => {
        pending.delete(id);
        done();
        // O helper também desiste (método cancel): sem isso ele seguiria o handshake e o envio depois do cancelado.
        if (sent && closedReason === undefined) call('cancel', { id }, controlTimeout).catch(() => {});
        reject(new TransportError('cancelado', `${method}: cancelado pelo chamador`, { cause: signal?.reason }));
      };
      pending.set(id, {
        resolve: (r: Record<string, unknown>): void => {
          done();
          resolve(r);
        },
        reject: (e: Error): void => {
          done();
          reject(e);
        },
      });
      // Folga sobre o prazo do próprio helper, para o erro de prazo vir dele (com estágio) quando for o caso.
      timer = setTimeout(() => {
        pending.delete(id);
        // Com onLate, a resposta que chegar depois do prazo ainda é entregue a ele (para desfazer o que o helper fez).
        if (onLate) pending.set(id, { resolve: onLate, reject: () => {} });
        done();
        reject(new TimeoutError(`${method}: o helper não respondeu em ${timeoutMs} ms`, timeoutMs));
      }, timeoutMs);
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        send({ id, method, params });
      } catch (e) {
        pending.delete(id);
        done();
        reject(
          new SignerError('signer_indisponivel', `${method}: o canal com o helper recusou a escrita`, { cause: e }),
        );
        return;
      }
      sent = true;
    });
  }

  async function answer(f: Frame): Promise<void> {
    try {
      if (f.method !== 'sign')
        throw new RemoteError({ code: 'unknown_method', message: `método desconhecido: ${f.method}` });
      const signature = await signFor(f.params ?? {});
      reply({ id: f.id, result: { signature: b64(signature) } });
    } catch (e) {
      const wire =
        e instanceof RemoteError
          ? e.wire
          : { code: 'sign_refused', message: e instanceof Error ? e.message : String(e) };
      logger.warn('sinete-signer: sign recusado', { code: wire.code, message: wire.message });
      reply({ id: f.id, error: { code: wire.code, message: wire.message } });
    }
  }

  const refuse = (message: string): never => {
    throw new RemoteError({ code: 'sign_refused', message });
  };

  /** Política do dono da chave, aplicada aqui e não no helper (PROTOCOL.md, "Regras para quem assina"). */
  async function signFor(p: Record<string, unknown>): Promise<Uint8Array> {
    const identity = String(p.identity);
    const key = keys.get(identity);
    if (!key) return refuse(`sem chave para a identidade ${identity}`);
    const ctx = (p.context ?? {}) as { purpose?: unknown; host?: unknown; conn?: unknown; handshake?: unknown };
    const host = hostKey(String(ctx.host ?? ''));
    if (ctx.purpose !== 'tls12-client-certificate-verify') return refuse(`propósito recusado: ${String(ctx.purpose)}`);
    if (!key.allowed.has(host)) return refuse(`host fora da política do dono da chave: ${host}`);
    if (p.scheme !== 'rsa_pkcs1_sha256') return refuse(`esquema recusado: ${String(p.scheme)}`);
    if (p.mode !== key.signer.mode) return refuse(`modo ${String(p.mode)} diferente do da chave (${key.signer.mode})`);
    const context: TlsSignContext = {
      host,
      purpose: 'tls12-client-certificate-verify',
      connectionId: String(ctx.conn),
      handshake: Number(ctx.handshake),
    };
    let input: Uint8Array;
    if (key.signer.mode === 'digest') {
      input = base64ToBytes(String(p.digest ?? ''));
      if (input.length !== 32) return refuse('digest com tamanho diferente de 32 bytes');
    } else {
      input = base64ToBytes(String(p.message ?? ''));
      const sum = new Uint8Array(await crypto.subtle.digest('SHA-256', input as Uint8Array<ArrayBuffer>));
      if (b64(sum) !== p.messageSha256) return refuse('o hash do transcript não confere');
      // O transcript mostra com quem o handshake está sendo feito: SNI do ClientHello e certificado do servidor.
      // Para IP não há SNI (RFC 6066, seção 3), e o certificado tem de trazer o endereço no iPAddress do SAN.
      // A cadeia não é validada: a assinatura cobre o certificado do transcript e só serve a quem o apresentou
      // (PROTOCOL.md, "Regras para quem assina").
      const t = parseTlsTranscript(input);
      const ip = ipLiteral(host);
      if (ip === undefined ? t.sni?.toLowerCase() !== host : t.sni !== undefined)
        return refuse(`SNI do transcript (${t.sni}) não corresponde a ${host}`);
      if (!t.serverCertificate) return refuse('transcript sem o certificado do servidor');
      const cert = parseCertificate(t.serverCertificate);
      if (ip !== undefined) {
        if (!cert.subjectAltNames.ipAddresses.map(unmapIp).includes(ip))
          return refuse(`o certificado do servidor não cobre o endereço ${host}`);
      } else {
        const names =
          cert.subjectAltNames.dnsNames.length > 0 ? cert.subjectAltNames.dnsNames : [cert.subject.commonName ?? ''];
        if (!names.some((n) => dnsMatches(n, host))) return refuse(`o certificado do servidor não cobre ${host}`);
      }
    }
    return key.signer.sign(input, 'rsa_pkcs1_sha256', context);
  }

  const control = (
    method: string,
    params: Record<string, unknown>,
    onLate?: (result: Record<string, unknown>) => void,
  ): Promise<Record<string, unknown>> =>
    call(method, params, controlTimeout, undefined, onLate).catch((e: unknown) => {
      throw e instanceof RemoteError ? toSineteError(e.wire, undefined, undefined) : e;
    });

  let helloRaw: Record<string, unknown>;
  try {
    helloRaw = await control('hello', {
      protocol: SIGNER_PROTOCOL_VERSION,
      client: options.client ?? '@sinete/transport',
    });
  } catch (e) {
    // Sem conexão devolvida, ninguém mais fecharia o canal (socket, WebSocket) nem os listeners dele. O fechamento não
    // pode prender o erro: quem sobe o canal (startSigner, connectSigner) derruba o que sobrar.
    let t: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      channel.close().catch(() => {}),
      new Promise<void>((resolve) => {
        t = setTimeout(resolve, 5_000);
      }),
    ]);
    clearTimeout(t);
    throw e;
  }
  if (helloRaw.protocol !== SIGNER_PROTOCOL_VERSION) {
    await channel.close();
    throw new SignerError(
      'signer_protocolo',
      `o helper fala o protocolo ${String(helloRaw.protocol)}; este cliente fala ${SIGNER_PROTOCOL_VERSION}`,
    );
  }
  const hello: SignerHello = {
    protocol: SIGNER_PROTOCOL_VERSION,
    helper: String(helloRaw.helper),
    lab: helloRaw.lab === true,
    ambientes: (helloRaw.ambientes as string[] | undefined) ?? [],
    backends: (helloRaw.backends as ('remote' | 'pkcs11')[] | undefined) ?? [],
    signModes: (helloRaw.signModes as string[] | undefined) ?? [],
    schemes: (helloRaw.schemes as string[] | undefined) ?? [],
    methods: (helloRaw.methods as string[] | undefined) ?? [],
    dataVersion: typeof helloRaw.dataVersion === 'string' ? helloRaw.dataVersion : undefined,
  };

  // identity.open que respondeu depois do prazo: quem chamou já recebeu o erro e não tem a identidade para fechar, e
  // ela prenderia o id e a sessão do token até o canal fechar. Fecha assim que a resposta chega.
  const closeLate =
    (id: string) =>
    (r: Record<string, unknown>): void => {
      if (r.id === undefined) return;
      logger.warn('sinete-signer: identity.open respondeu depois do prazo; fechando a identidade', { identity: id });
      call('identity.close', { identity: id }, controlTimeout).catch(() => {});
    };

  const connection: SignerConnection = {
    protocolVersion: SIGNER_PROTOCOL_VERSION,
    hello,
    async request(identity: string, req: HelperHttpRequest, signal?: AbortSignal): Promise<TransportResponse> {
      const host = new URL(req.url).hostname.toLowerCase();
      let r: Record<string, unknown>;
      try {
        r = await call(
          'http.request',
          {
            identity,
            url: req.url,
            method: req.method,
            headers: req.headers,
            body: b64(req.body ?? new Uint8Array()),
            timeoutMs: req.timeoutMs,
          },
          req.timeoutMs + 5_000,
          signal,
        );
      } catch (e) {
        throw e instanceof RemoteError ? toSineteError(e.wire, host, req.timeoutMs) : e;
      }
      const body = base64ToBytes(String(r.body ?? ''));
      const tls = (r.tls ?? {}) as { version?: string; cipher?: string; resumed?: boolean[]; signatures?: unknown[] };
      const headers = (r.headers ?? {}) as Record<string, string>;
      return {
        status: Number(r.status),
        headers,
        body,
        tls: {
          protocol: tls.version,
          cipher: tls.cipher,
          resumed: tls.resumed?.[0],
          // O helper monta o certificado a partir da identidade em todo handshake: não há como sair sem ele.
          clientCertificateLoaded: undefined,
          signatures: tls.signatures?.length ?? 0,
        },
        text: (): string => new TextDecoder().decode(body),
      };
    },

    async openRemote(o: OpenRemoteOptions): Promise<SignerIdentity> {
      const allowed = new Set([...o.allowedHosts].map(hostKey));
      if (allowed.size === 0)
        throw new ConfigError('openRemote: allowedHosts vazio; a chave não autenticaria em nenhum host');
      const chain = await o.signer.certificateChain();
      if (chain.length === 0) throw new ConfigError('openRemote: o TlsSigner devolveu cadeia vazia');
      const id = o.id ?? `remote-${++identityCount}`;
      // Id repetido não pode tocar na chave da identidade que já está aberta (nem numa abertura concorrente).
      if (keys.has(id)) {
        throw new SignerError('signer_protocolo', `identity_exists: a identidade ${id} já está aberta neste canal`, {
          details: { code: 'identity_exists' },
        });
      }
      // A chave entra no mapa antes do open: o helper só pede sign depois, mas a ordem evita corrida.
      keys.set(id, { signer: o.signer, allowed });
      try {
        const r = await control(
          'identity.open',
          {
            id,
            backend: 'remote',
            mode: o.signer.mode,
            chain: chain.map(b64),
            ...(o.signTimeoutMs === undefined ? {} : { signTimeoutMs: o.signTimeoutMs }),
            ...(o.additionalCa === undefined ? {} : { additionalCa: [...o.additionalCa] }),
          },
          closeLate(id),
        );
        return identity(r, undefined);
      } catch (e) {
        keys.delete(id);
        throw e;
      }
    },

    async openPkcs11(o: OpenPkcs11Options): Promise<SignerIdentity> {
      if (!hello.backends.includes('pkcs11')) {
        throw new SignerError(
          'pkcs11_falhou',
          `o binário ${hello.helper} é o sabor estático, sem PKCS#11; suba o sabor -p11 (startSigner com pkcs11: true)`,
        );
      }
      const id = o.id ?? `pkcs11-${++identityCount}`;
      const r = await control(
        'identity.open',
        {
          id,
          backend: 'pkcs11',
          module: o.module,
          token: o.token,
          pin: await o.pin(),
          ...(o.serial === undefined ? {} : { serial: o.serial }),
          ...(o.label === undefined ? {} : { label: o.label }),
          ...(o.keyId === undefined ? {} : { keyId: o.keyId }),
          ...(o.chain === undefined ? {} : { chain: o.chain.map(b64) }),
          ...(o.additionalCa === undefined ? {} : { additionalCa: [...o.additionalCa] }),
        },
        closeLate(id),
      );
      return identity(r, id);
    },

    async stats(): Promise<Readonly<Record<string, { readonly signatures: number; readonly backend: string }>>> {
      const r = await control('stats', {});
      return (r.identities ?? {}) as Record<string, { signatures: number; backend: string }>;
    },

    async close(): Promise<void> {
      await channel.close();
    },
  };

  function identity(r: Record<string, unknown>, dfeId: string | undefined): SignerIdentity {
    const id = String(r.id);
    const chain = ((r.chain as string[] | undefined) ?? []).map((c) => base64ToBytes(c));
    const leaf = chain[0];
    if (!leaf) throw new SignerError('signer_protocolo', 'identity.open sem cadeia na resposta');
    const documentSigner: DataSigner | undefined =
      dfeId !== undefined && r.dfeSign === true
        ? {
            kind: 'data',
            certificateDer: (): Promise<Uint8Array> => Promise.resolve(leaf.slice()),
            // Com o elemento, o helper confere o DigestValue e, em evento, o autor: é o que deixa o destinatário
            // assinar a manifestação, cujo Id traz a chave de outro emitente.
            sign: async (data: Uint8Array, hash: SignatureHash, context?: SignContext): Promise<Uint8Array> => {
              const res = await control('dfe.sign', {
                identity: id,
                signedInfo: b64(data),
                hash,
                ...(context === undefined ? {} : { element: b64(context.referenced) }),
              });
              return base64ToBytes(String(res.signature));
            },
          }
        : undefined;
    return {
      id,
      backend: r.backend === 'pkcs11' ? 'pkcs11' : 'remote',
      tlsIdentity: { kind: 'helper', helper: connection, identity: id },
      chain,
      subject: String(r.subject ?? ''),
      notAfter: String(r.notAfter ?? ''),
      cnpj: typeof r.cnpj === 'string' ? r.cnpj : undefined,
      cpf: typeof r.cpf === 'string' ? r.cpf : undefined,
      documentSigner,
      async resetPool(o = {}): Promise<void> {
        await control('pool.reset', { identity: id, dropSessions: o.dropSessions === true });
      },
      async close(): Promise<void> {
        keys.delete(id);
        await control('identity.close', { identity: id });
      },
    };
  }

  return connection;
}

/**
 * O certificado aberto que o `@sinete/emissor` aceita no lugar do PFX (`OpcoesEmissor.certificado`): o signer dos
 * documentos, o titular lido da folha e a identidade do mTLS pelo helper. No `pkcs11`, o signer é o `documentSigner`
 * (a chave do token assina pelo `dfe.sign`); no `remote`, passe o signer de quem tem a chave.
 */
export function certificadoAberto(
  identity: SignerIdentity,
  options: { readonly signer?: Signer } = {},
): { readonly signer: Signer; readonly titular: IcpIdentity; readonly identidade: TlsIdentity } {
  const signer = options.signer ?? identity.documentSigner;
  if (signer === undefined) {
    throw new ConfigError(
      `a identidade ${identity.id} (${identity.backend}) não assina documento pelo helper: passe o signer de quem tem a chave`,
    );
  }
  const leaf = identity.chain[0];
  if (leaf === undefined) throw new ConfigError(`a identidade ${identity.id} está sem cadeia`);
  return { signer, titular: icpIdentity(parseCertificate(leaf)), identidade: identity.tlsIdentity };
}

/**
 * `TlsSigner` sobre uma `CryptoKey` RSASSA-PKCS1-v1_5 com SHA-256 (não exportável serve), no modo `message`: o
 * helper manda o transcript e a chave assina a mensagem. É o caminho do A1 guardado como `CryptoKey` e da chave no
 * navegador.
 */
export function cryptoKeyTlsSigner(key: CryptoKey, chain: readonly Uint8Array[]): TlsSigner {
  const alg = key.algorithm as { name?: string; hash?: { name?: string } };
  if (alg.name !== 'RSASSA-PKCS1-v1_5' || alg.hash?.name !== 'SHA-256') {
    throw new ConfigError('cryptoKeyTlsSigner: a chave precisa ser RSASSA-PKCS1-v1_5 com SHA-256');
  }
  return {
    mode: 'message',
    certificateChain: (): Promise<readonly Uint8Array[]> => Promise.resolve(chain),
    sign: async (input: Uint8Array): Promise<Uint8Array> =>
      new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, input as Uint8Array<ArrayBuffer>)),
  };
}

/**
 * `TlsSigner` no modo `digest` sobre um `DigestSigner` do `@sinete/core` (PSC em RAW, OpenBao Transit com
 * `prehashed`, HSM): monta o DigestInfo SHA-256 e pede só o RSA.
 */
export function digestTlsSigner(signer: DigestSigner, chain?: readonly Uint8Array[]): TlsSigner {
  return {
    mode: 'digest',
    certificateChain: async (): Promise<readonly Uint8Array[]> => chain ?? [await signer.certificateDer()],
    sign: (input: Uint8Array): Promise<Uint8Array> => signer.signDigestInfo(encodeDigestInfo('SHA-256', input)),
  };
}

/** Converte linhas cruas (com `\n`) em linhas de frame, guardando o pedaço incompleto. */
export function lineSplitter(onLine: (line: string) => void): (chunk: string) => void {
  let buf = '';
  return (chunk: string): void => {
    buf += chunk;
    let i = buf.indexOf('\n');
    while (i >= 0) {
      onLine(buf.slice(0, i));
      buf = buf.slice(i + 1);
      i = buf.indexOf('\n');
    }
  };
}
