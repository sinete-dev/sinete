/**
 * `@sinete/transport/signer`: cliente do protocolo v1 do helper `sinete-signer` (ADR 0005,
 * `docs/signer-contract/PROTOCOL.md`), que termina o mTLS com uma chave que não está no processo JS.
 *
 * Esta entrada é pura: fala o protocolo sobre qualquer `CanalSigner` (o stdio de um processo filho, um socket Unix,
 * um WebSocket até o navegador). A entrada `node` acrescenta `iniciarSigner`, que sobe o binário, e `conectarSigner`, que
 * conecta no socket Unix do helper em contêiner.
 *
 * Identidades:
 * - `abrirRemoto`: a chave fica com quem chamou, num `AssinadorTls` (A1 em `CryptoKey` não exportável, A3 em nuvem de
 *   PSC, OpenBao Transit). O helper pede `sign` no meio do handshake; este cliente aplica a política do dono da chave
 *   (host, propósito, esquema e, no modo `message`, o transcript) antes de chamar o `AssinadorTls`.
 * - `abrirPkcs11`: token local pelo helper `-p11`. O `assinadorDeDocumentos` assina XML dos DF-e pelo `dfe.sign`, que o
 *   helper valida antes de usar a chave do token.
 */

import type { IdentidadeIcp } from '@sinete/cert';
import { codificarBase64, codificarDigestInfo, decodificarBase64, identidadeIcp, lerCertificado } from '@sinete/cert';
import type {
  Assinador,
  AssinadorDeDados,
  AssinadorDeDigest,
  ContextoDaAssinatura,
  HashDaAssinatura,
  Logger,
} from '@sinete/core';
import { ErroDeConfiguracao, ErroDeTempoEsgotado, loggerSilencioso } from '@sinete/core';
import type { DadosDaFalhaDoHelper } from './classify.ts';
import { classificarFalhaDoHelper } from './classify.ts';
import { ErroPolitica, ErroSigner, ErroTransporte } from './errors.ts';
import type {
  AssinadorTls,
  ContextoAssinaturaTls,
  HelperTlsExterno,
  IdentidadeTls,
  PedidoHttpDoHelper,
  RespostaTransporte,
} from './types.ts';

/** Versão do protocolo falada por este cliente (`docs/signer-contract/PROTOCOL_VERSION`). */
export const VERSAO_PROTOCOLO_SIGNER = 1;

/** Um canal de linhas até o helper. Cada linha é um frame JSON, sem o `\n`. */
export interface CanalSigner {
  enviar(linha: string): void;
  aoReceberLinha(ouvinte: (linha: string) => void): void;
  /** Chamado uma vez quando o canal fecha (processo saiu, socket fechou). */
  aoFechar(ouvinte: (motivo: string) => void): void;
  fechar(): Promise<void>;
}

/** O que o helper disse no `hello`. */
export interface HelloDoSigner {
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

export interface ClienteSignerOpcoes {
  /** Nome e versão do cliente, só para o log do helper. */
  readonly cliente?: string;
  /** Prazo dos pedidos de controle (`hello`, `identity.open`, `stats`). Padrão: 60 000 ms (login em token é lento). */
  readonly prazoDeControleMs?: number;
  readonly logger?: Logger;
}

export interface AbrirRemotoOpcoes {
  /** Nome da identidade no helper. Padrão: `remote-<n>`. */
  readonly id?: string;
  readonly assinador: AssinadorTls;
  /**
   * Hosts em que esta chave aceita autenticar: a política do dono da chave, independente da guarda do helper.
   * Obrigatório; `hostsDoAmbiente('homologacao')` é o ponto de partida.
   */
  readonly hostsPermitidos: Iterable<string>;
  /** Prazo para o `AssinadorTls` responder, em ms. Padrão: 30 000; máximo 300 000. */
  readonly prazoDaAssinaturaMs?: number;
  /** PEMs de AC somados à confiança do servidor só desta identidade (AC de teste, proxy corporativo). */
  readonly acsAdicionais?: readonly string[];
}

export interface AbrirPkcs11Opcoes {
  readonly id?: string;
  /** Caminho absoluto do módulo PKCS#11 do fabricante. */
  readonly modulo: string;
  /** Rótulo do token. */
  readonly token: string;
  /** Número de série do token, para desempatar tokens com o mesmo rótulo. */
  readonly numeroDeSerie?: string;
  /** Rótulo do certificado no token; a chave é a de mesmo `CKA_ID`. */
  readonly rotulo?: string;
  /** `CKA_ID` do par em hexadecimal, no lugar do rótulo. */
  readonly idDaChave?: string;
  /** O PIN é pedido na hora de abrir e atravessa só o canal, nunca argv ou env. */
  readonly pin: () => Promise<string>;
  /** Intermediárias em DER que completam a cadeia (o token costuma guardar só o titular). */
  readonly cadeia?: readonly Uint8Array[];
  readonly acsAdicionais?: readonly string[];
}

/** Uma identidade aberta no helper. */
export interface IdentidadeSigner {
  readonly id: string;
  readonly backend: 'remote' | 'pkcs11';
  /** Para o `criarTransporte` e para o `@sinete/emissor` (`CertificadoAberto.identidade`). */
  readonly identidadeTls: Extract<IdentidadeTls, { tipo: 'helper' }>;
  readonly cadeia: readonly Uint8Array[];
  readonly subject: string;
  readonly notAfter: string;
  readonly cnpj: string | undefined;
  readonly cpf: string | undefined;
  /**
   * `AssinadorDeDados` do `@sinete/core` que assina XML dos DF-e com a chave do token, pelo `dfe.sign` (só `pkcs11`). Serve
   * de `CertificadoAberto.assinador` no `@sinete/emissor`. No `remote` é `undefined`: quem tem a chave assina.
   */
  readonly assinadorDeDocumentos: AssinadorDeDados | undefined;
  reiniciarPool(opcoes?: { readonly descartarSessoes?: boolean }): Promise<void>;
  fechar(): Promise<void>;
}

/** A conexão com o helper. É também o `HelperTlsExterno` que as identidades usam. */
export interface ConexaoSigner extends HelperTlsExterno {
  readonly hello: HelloDoSigner;
  abrirRemoto(opcoes: AbrirRemotoOpcoes): Promise<IdentidadeSigner>;
  abrirPkcs11(opcoes: AbrirPkcs11Opcoes): Promise<IdentidadeSigner>;
  /** Assinaturas feitas por identidade (handshakes e `dfe.sign`). */
  estatisticas(): Promise<Readonly<Record<string, { readonly signatures: number; readonly backend: string }>>>;
}

interface WireError {
  readonly code: string;
  readonly message: string;
  readonly data?: DadosDaFalhaDoHelper;
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
  readonly signer: AssinadorTls;
  readonly allowed: ReadonlySet<string>;
}

const DEFAULT_CONTROL_TIMEOUT_MS = 60_000;

function b64(bytes: Uint8Array): string {
  return codificarBase64(bytes);
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
export function lerTranscricaoTls(transcricao: Uint8Array): {
  readonly sni: string | undefined;
  readonly certificadoDoServidor: Uint8Array | undefined;
} {
  const u24 = (o: number): number =>
    ((transcricao[o] ?? 0) << 16) | ((transcricao[o + 1] ?? 0) << 8) | (transcricao[o + 2] ?? 0);
  const u16 = (b: Uint8Array, o: number): number => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
  let sni: string | undefined;
  let serverCertificate: Uint8Array | undefined;
  let off = 0;
  while (off + 4 <= transcricao.length) {
    const type = transcricao[off];
    const len = u24(off + 1);
    const body = transcricao.subarray(off + 4, off + 4 + len);
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
  return { sni, certificadoDoServidor: serverCertificate };
}

/** Converte o erro do helper no erro tipado do sinete. */
function paraErroSinete(wire: WireError, host: string | undefined, timeoutMs: number | undefined): Error {
  const where = host ?? 'sinete-signer';
  switch (wire.code) {
    case 'guard':
      return new ErroPolitica(
        `recusado pela guarda do helper: ${wire.message}`,
        host === undefined ? undefined : { host },
      );
    case 'transport':
      if (wire.data?.timeout) {
        return new ErroDeTempoEsgotado(`${where}: sem resposta em ${timeoutMs ?? '?'} ms (helper)`, timeoutMs ?? 0, {
          detalhes: { host: where, mensagemDoHelper: wire.message },
        });
      }
      return classificarFalhaDoHelper(wire.data ?? {}, wire.message, where);
    case 'sign_refused':
      return new ErroSigner('assinatura_tls_recusada', `${where}: assinatura do handshake recusada: ${wire.message}`, {
        detalhes: { host: where },
      });
    case 'sign_timeout':
      return new ErroSigner('assinatura_tls_expirou', `${where}: quem assina não respondeu: ${wire.message}`, {
        detalhes: { host: where },
      });
    case 'pkcs11':
      return new ErroSigner('pkcs11_falhou', `PKCS#11: ${wire.message}`);
    case 'dfe_refused':
      return new ErroSigner('assinatura_documento_recusada', `o helper recusou assinar o documento: ${wire.message}`);
    case 'closed':
      return new ErroSigner('signer_indisponivel', `o helper fechou o canal: ${wire.message}`);
    default:
      return new ErroSigner('signer_protocolo', `${wire.code}: ${wire.message}`, { detalhes: { codigo: wire.code } });
  }
}

/**
 * Conecta ao helper por um canal já aberto e faz o `hello`. Recusa helper de outra versão do protocolo
 * (`signer_protocolo`).
 */
export async function conectarCanalSigner(
  canal: CanalSigner,
  opcoes: ClienteSignerOpcoes = {},
): Promise<ConexaoSigner> {
  const logger = opcoes.logger ?? loggerSilencioso;
  const controlTimeout = opcoes.prazoDeControleMs ?? DEFAULT_CONTROL_TIMEOUT_MS;
  const pending = new Map<string, { resolve: (r: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  const keys = new Map<string, RemoteKey>();
  let next = 1;
  let closedReason: string | undefined;
  let identityCount = 0;

  const send = (frame: Record<string, unknown>): void => {
    canal.enviar(JSON.stringify({ v: VERSAO_PROTOCOLO_SIGNER, ...frame }));
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

  canal.aoFechar((reason) => {
    closedReason = reason;
    for (const [, p] of pending) {
      p.reject(new ErroSigner('signer_indisponivel', `o helper saiu: ${reason}`));
    }
    pending.clear();
  });

  canal.aoReceberLinha((line) => {
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
    if (f.v !== VERSAO_PROTOCOLO_SIGNER) {
      logger.warn('sinete-signer: frame de outra versão', { v: f.v });
      // Resposta de outra versão a um pedido nosso (um helper v2 respondendo ao hello): falha já, com o código certo,
      // em vez de esperar o prazo.
      const p = typeof f.id === 'string' ? pending.get(f.id) : undefined;
      if (p) {
        pending.delete(f.id);
        p.reject(
          new ErroSigner(
            'signer_protocolo',
            `o helper respondeu no protocolo ${String(f.v)}; este cliente fala ${VERSAO_PROTOCOLO_SIGNER}`,
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
      return Promise.reject(new ErroSigner('signer_indisponivel', `o helper saiu: ${closedReason}`));
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
        reject(new ErroTransporte('cancelado', `${method}: cancelado pelo chamador`, { cause: signal?.reason }));
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
        reject(new ErroDeTempoEsgotado(`${method}: o helper não respondeu em ${timeoutMs} ms`, timeoutMs));
      }, timeoutMs);
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      try {
        send({ id, method, params });
      } catch (e) {
        pending.delete(id);
        done();
        reject(
          new ErroSigner('signer_indisponivel', `${method}: o canal com o helper recusou a escrita`, { cause: e }),
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
    const context: ContextoAssinaturaTls = {
      host,
      finalidade: 'tls12-client-certificate-verify',
      idDaConexao: String(ctx.conn),
      handshake: Number(ctx.handshake),
    };
    let input: Uint8Array;
    if (key.signer.mode === 'digest') {
      input = decodificarBase64(String(p.digest ?? ''));
      if (input.length !== 32) return refuse('digest com tamanho diferente de 32 bytes');
    } else {
      input = decodificarBase64(String(p.message ?? ''));
      const sum = new Uint8Array(await crypto.subtle.digest('SHA-256', input as Uint8Array<ArrayBuffer>));
      if (b64(sum) !== p.messageSha256) return refuse('o hash do transcript não confere');
      // O transcript mostra com quem o handshake está sendo feito: SNI do ClientHello e certificado do servidor.
      // Para IP não há SNI (RFC 6066, seção 3), e o certificado tem de trazer o endereço no iPAddress do SAN.
      // A cadeia não é validada: a assinatura cobre o certificado do transcript e só serve a quem o apresentou
      // (PROTOCOL.md, "Regras para quem assina").
      const t = lerTranscricaoTls(input);
      const ip = ipLiteral(host);
      if (ip === undefined ? t.sni?.toLowerCase() !== host : t.sni !== undefined)
        return refuse(`SNI do transcript (${t.sni}) não corresponde a ${host}`);
      if (!t.certificadoDoServidor) return refuse('transcript sem o certificado do servidor');
      const cert = lerCertificado(t.certificadoDoServidor);
      if (ip !== undefined) {
        if (!cert.subjectAltNames.enderecosIp.map(unmapIp).includes(ip))
          return refuse(`o certificado do servidor não cobre o endereço ${host}`);
      } else {
        const names =
          cert.subjectAltNames.nomesDns.length > 0 ? cert.subjectAltNames.nomesDns : [cert.subject.commonName ?? ''];
        if (!names.some((n) => dnsMatches(n, host))) return refuse(`o certificado do servidor não cobre ${host}`);
      }
    }
    return key.signer.assinar(input, 'rsa_pkcs1_sha256', context);
  }

  const control = (
    method: string,
    params: Record<string, unknown>,
    onLate?: (result: Record<string, unknown>) => void,
  ): Promise<Record<string, unknown>> =>
    call(method, params, controlTimeout, undefined, onLate).catch((e: unknown) => {
      throw e instanceof RemoteError ? paraErroSinete(e.wire, undefined, undefined) : e;
    });

  let helloRaw: Record<string, unknown>;
  try {
    helloRaw = await control('hello', {
      protocol: VERSAO_PROTOCOLO_SIGNER,
      client: opcoes.cliente ?? '@sinete/transport',
    });
  } catch (e) {
    // Sem conexão devolvida, ninguém mais fecharia o canal (socket, WebSocket) nem os listeners dele. O fechamento não
    // pode prender o erro: quem sobe o canal (iniciarSigner, conectarSigner) derruba o que sobrar.
    let t: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      canal.fechar().catch(() => {}),
      new Promise<void>((resolve) => {
        t = setTimeout(resolve, 5_000);
      }),
    ]);
    clearTimeout(t);
    throw e;
  }
  if (helloRaw.protocol !== VERSAO_PROTOCOLO_SIGNER) {
    await canal.fechar();
    throw new ErroSigner(
      'signer_protocolo',
      `o helper fala o protocolo ${String(helloRaw.protocol)}; este cliente fala ${VERSAO_PROTOCOLO_SIGNER}`,
    );
  }
  const hello: HelloDoSigner = {
    protocol: VERSAO_PROTOCOLO_SIGNER,
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

  const connection: ConexaoSigner = {
    versaoDoProtocolo: VERSAO_PROTOCOLO_SIGNER,
    hello,
    async enviar(identity: string, req: PedidoHttpDoHelper, signal?: AbortSignal): Promise<RespostaTransporte> {
      const host = new URL(req.url).hostname.toLowerCase();
      let r: Record<string, unknown>;
      try {
        r = await call(
          'http.request',
          {
            identity,
            url: req.url,
            method: req.metodo,
            headers: req.cabecalhos,
            body: b64(req.corpo ?? new Uint8Array()),
            timeoutMs: req.timeoutMs,
          },
          req.timeoutMs + 5_000,
          signal,
        );
      } catch (e) {
        throw e instanceof RemoteError ? paraErroSinete(e.wire, host, req.timeoutMs) : e;
      }
      const body = decodificarBase64(String(r.body ?? ''));
      const tls = (r.tls ?? {}) as { version?: string; cipher?: string; resumed?: boolean[]; signatures?: unknown[] };
      const headers = (r.headers ?? {}) as Record<string, string>;
      return {
        status: Number(r.status),
        cabecalhos: headers,
        corpo: body,
        tls: {
          protocolo: tls.version,
          cifra: tls.cipher,
          retomada: tls.resumed?.[0],
          // O helper monta o certificado a partir da identidade em todo handshake: não há como sair sem ele.
          certificadoLocalCarregado: undefined,
          assinaturas: tls.signatures?.length ?? 0,
        },
        texto: (): string => new TextDecoder().decode(body),
      };
    },

    async abrirRemoto(o: AbrirRemotoOpcoes): Promise<IdentidadeSigner> {
      const allowed = new Set([...o.hostsPermitidos].map(hostKey));
      if (allowed.size === 0)
        throw new ErroDeConfiguracao('abrirRemoto: hostsPermitidos vazio; a chave não autenticaria em nenhum host');
      const chain = await o.assinador.cadeia();
      if (chain.length === 0) throw new ErroDeConfiguracao('abrirRemoto: o AssinadorTls devolveu cadeia vazia');
      const id = o.id ?? `remote-${++identityCount}`;
      // Id repetido não pode tocar na chave da identidade que já está aberta (nem numa abertura concorrente).
      if (keys.has(id)) {
        throw new ErroSigner('signer_protocolo', `identity_exists: a identidade ${id} já está aberta neste canal`, {
          detalhes: { codigo: 'identity_exists' },
        });
      }
      // A chave entra no mapa antes do open: o helper só pede sign depois, mas a ordem evita corrida.
      keys.set(id, { signer: o.assinador, allowed });
      try {
        const r = await control(
          'identity.open',
          {
            id,
            backend: 'remote',
            mode: o.assinador.mode,
            chain: chain.map(b64),
            ...(o.prazoDaAssinaturaMs === undefined ? {} : { signTimeoutMs: o.prazoDaAssinaturaMs }),
            ...(o.acsAdicionais === undefined ? {} : { additionalCa: [...o.acsAdicionais] }),
          },
          closeLate(id),
        );
        return identity(r, undefined);
      } catch (e) {
        keys.delete(id);
        throw e;
      }
    },

    async abrirPkcs11(o: AbrirPkcs11Opcoes): Promise<IdentidadeSigner> {
      if (!hello.backends.includes('pkcs11')) {
        throw new ErroSigner(
          'pkcs11_falhou',
          `o binário ${hello.helper} é o sabor estático, sem PKCS#11; suba o sabor -p11 (iniciarSigner com pkcs11: true)`,
        );
      }
      const id = o.id ?? `pkcs11-${++identityCount}`;
      const r = await control(
        'identity.open',
        {
          id,
          backend: 'pkcs11',
          module: o.modulo,
          token: o.token,
          pin: await o.pin(),
          ...(o.numeroDeSerie === undefined ? {} : { serial: o.numeroDeSerie }),
          ...(o.rotulo === undefined ? {} : { label: o.rotulo }),
          ...(o.idDaChave === undefined ? {} : { keyId: o.idDaChave }),
          ...(o.cadeia === undefined ? {} : { chain: o.cadeia.map(b64) }),
          ...(o.acsAdicionais === undefined ? {} : { additionalCa: [...o.acsAdicionais] }),
        },
        closeLate(id),
      );
      return identity(r, id);
    },

    async estatisticas(): Promise<Readonly<Record<string, { readonly signatures: number; readonly backend: string }>>> {
      const r = await control('stats', {});
      return (r.identities ?? {}) as Record<string, { signatures: number; backend: string }>;
    },

    async fechar(): Promise<void> {
      await canal.fechar();
    },
  };

  function identity(r: Record<string, unknown>, dfeId: string | undefined): IdentidadeSigner {
    const id = String(r.id);
    const chain = ((r.chain as string[] | undefined) ?? []).map((c) => decodificarBase64(c));
    const leaf = chain[0];
    if (!leaf) throw new ErroSigner('signer_protocolo', 'identity.open sem cadeia na resposta');
    const documentSigner: AssinadorDeDados | undefined =
      dfeId !== undefined && r.dfeSign === true
        ? {
            tipo: 'dados',
            certificadoDer: (): Promise<Uint8Array> => Promise.resolve(leaf.slice()),
            // Com o elemento, o helper confere o DigestValue e, em evento, o autor: é o que deixa o destinatário
            // assinar a manifestação, cujo Id traz a chave de outro emitente.
            assinar: async (
              data: Uint8Array,
              hash: HashDaAssinatura,
              context?: ContextoDaAssinatura,
            ): Promise<Uint8Array> => {
              const res = await control('dfe.sign', {
                identity: id,
                signedInfo: b64(data),
                hash,
                ...(context === undefined ? {} : { element: b64(context.referenciado) }),
              });
              return decodificarBase64(String(res.signature));
            },
          }
        : undefined;
    return {
      id,
      backend: r.backend === 'pkcs11' ? 'pkcs11' : 'remote',
      identidadeTls: { tipo: 'helper', helper: connection, identidade: id },
      cadeia: chain,
      subject: String(r.subject ?? ''),
      notAfter: String(r.notAfter ?? ''),
      cnpj: typeof r.cnpj === 'string' ? r.cnpj : undefined,
      cpf: typeof r.cpf === 'string' ? r.cpf : undefined,
      assinadorDeDocumentos: documentSigner,
      async reiniciarPool(o = {}): Promise<void> {
        await control('pool.reset', { identity: id, dropSessions: o.descartarSessoes === true });
      },
      async fechar(): Promise<void> {
        keys.delete(id);
        await control('identity.close', { identity: id });
      },
    };
  }

  return connection;
}

/**
 * O certificado aberto que o `@sinete/emissor` aceita no lugar do PFX (`OpcoesEmissor.certificado`): o signer dos
 * documentos, o titular lido da folha e a identidade do mTLS pelo helper. No `pkcs11`, o assinador é o `assinadorDeDocumentos`
 * (a chave do token assina pelo `dfe.sign`); no `remote`, passe o signer de quem tem a chave.
 */
export function certificadoAberto(
  identidade: IdentidadeSigner,
  opcoes: { readonly assinador?: Assinador } = {},
): { readonly assinador: Assinador; readonly titular: IdentidadeIcp; readonly identidade: IdentidadeTls } {
  const signer = opcoes.assinador ?? identidade.assinadorDeDocumentos;
  if (signer === undefined) {
    throw new ErroDeConfiguracao(
      `a identidade ${identidade.id} (${identidade.backend}) não assina documento pelo helper: passe o signer de quem tem a chave`,
    );
  }
  const leaf = identidade.cadeia[0];
  if (leaf === undefined) throw new ErroDeConfiguracao(`a identidade ${identidade.id} está sem cadeia`);
  return { assinador: signer, titular: identidadeIcp(lerCertificado(leaf)), identidade: identidade.identidadeTls };
}

/**
 * `AssinadorTls` sobre uma `CryptoKey` RSASSA-PKCS1-v1_5 com SHA-256 (não exportável serve), no modo `message`: o
 * helper manda o transcript e a chave assina a mensagem. É o caminho do A1 guardado como `CryptoKey` e da chave no
 * navegador.
 */
export function assinadorTlsDeCryptoKey(chave: CryptoKey, cadeia: readonly Uint8Array[]): AssinadorTls {
  const alg = chave.algorithm as { name?: string; hash?: { name?: string } };
  if (alg.name !== 'RSASSA-PKCS1-v1_5' || alg.hash?.name !== 'SHA-256') {
    throw new ErroDeConfiguracao('assinadorTlsDeCryptoKey: a chave precisa ser RSASSA-PKCS1-v1_5 com SHA-256');
  }
  return {
    mode: 'message',
    cadeia: (): Promise<readonly Uint8Array[]> => Promise.resolve(cadeia),
    assinar: async (input: Uint8Array): Promise<Uint8Array> =>
      new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, input as Uint8Array<ArrayBuffer>)),
  };
}

/**
 * `AssinadorTls` no modo `digest` sobre um `AssinadorDeDigest` do `@sinete/core` (PSC em RAW, OpenBao Transit com
 * `prehashed`, HSM): monta o DigestInfo SHA-256 e pede só o RSA.
 */
export function assinadorTlsDeDigest(assinador: AssinadorDeDigest, cadeia?: readonly Uint8Array[]): AssinadorTls {
  return {
    mode: 'digest',
    cadeia: async (): Promise<readonly Uint8Array[]> => cadeia ?? [await assinador.certificadoDer()],
    assinar: (input: Uint8Array): Promise<Uint8Array> =>
      assinador.assinarDigestInfo(codificarDigestInfo('SHA-256', input)),
  };
}

/** Converte linhas cruas (com `\n`) em linhas de frame, guardando o pedaço incompleto. */
export function divisorDeLinhas(aoReceberLinha: (linha: string) => void): (pedaco: string) => void {
  let buf = '';
  return (chunk: string): void => {
    buf += chunk;
    let i = buf.indexOf('\n');
    while (i >= 0) {
      aoReceberLinha(buf.slice(0, i));
      buf = buf.slice(i + 1);
      i = buf.indexOf('\n');
    }
  };
}
