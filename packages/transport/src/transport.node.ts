/**
 * Transporte de Node e Bun (ADR 0004, decisão 4): uma implementação só, sobre `node:https` + `https.Agent`.
 *
 * - HTTP/1.1 sempre (o `node:https` não fala h2; o h2 do undici quebra os hosts que renegociam).
 * - Confiança somada por Agent, sem mexer no processo: `ca` = raízes da runtime (ou a loja do sistema, com
 *   `confianca: 'sistema'`) + conjunto ICP-Brasil do `@sinete/cert` + `acsAdicionais`. Nada de `NODE_EXTRA_CA_CERTS`,
 *   `setDefaultCACertificates` ou `rejectUnauthorized: false`, e `rejectUnauthorized: true` fixo no Agent, para que
 *   `NODE_TLS_REJECT_UNAUTHORIZED=0` no processo não desligue a conferência do servidor.
 * - Identidade em PEM na memória (nunca o PFX: o OpenSSL 3 recusa o legado). Renegociação iniciada pelo servidor
 *   fica permitida (é como o IIS da SEFAZ pede o certificado).
 * - Falha barulhenta: depois do handshake, o certificado local do socket tem de ser o da identidade.
 */

import https from 'node:https';
import tls from 'node:tls';
import { dersDoPem, pemTlsIcpBrasil } from '@sinete/cert';
import { ErroDeConfiguracao, ErroDeTempoEsgotado, ErroNaoSuportado } from '@sinete/core';
import { classificarFalhaDeTransporte, erroHttp403 } from './classify.ts';
import { assertSupported, audited, detectarRuntime, makeResponse, prepareRequest, sendViaHelper } from './common.ts';
import { ErroTransporte } from './errors.ts';
import type {
  CapacidadesDoTransporte,
  PedidoTransporte,
  RespostaTransporte,
  Transporte,
  TransporteOpcoes,
} from './types.ts';

export interface TransporteNodeOpcoes extends TransporteOpcoes {
  /** `embarcada` (padrão): raízes embutidas na runtime; `sistema`: loja do sistema (proxy corporativo). */
  readonly confianca?: 'embarcada' | 'sistema';
  /**
   * Algoritmos de assinatura do handshake (formato OpenSSL, ex.: `RSA+SHA256:RSA+SHA384:RSA+SHA512`). Com isso o
   * TLS fica limitado a 1.2, onde PKCS#1 v1.5 é permitido (ADR 0004, seção 5).
   */
  readonly sigalgs?: string;
  /** Padrão: `true` (pool keep-alive por host). */
  readonly manterConexao?: boolean;
}

interface LocalCert {
  raw?: Uint8Array;
}

function sameBytes(a: Uint8Array | undefined, b: Uint8Array | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function trustStore(trust: 'embarcada' | 'sistema'): string[] {
  if (trust === 'embarcada') return [...tls.rootCertificates];
  const get = (tls as { getCACertificates?: (type: string) => string[] }).getCACertificates;
  if (typeof get !== 'function') {
    throw new ErroNaoSuportado('confianca: "sistema" precisa de tls.getCACertificates (Node 22.15+ ou 23.5+)');
  }
  return get('system');
}

/**
 * Confere se o socket carregou o certificado da identidade. `undefined` quando a runtime não expõe o certificado
 * local (o transporte então não afirma nada).
 */
export function conferirCertificadoLocal(
  socket: { getCertificate?: () => LocalCert | null | undefined },
  folhaEsperada: Uint8Array,
): boolean | undefined {
  if (typeof socket.getCertificate !== 'function') return undefined;
  const local = socket.getCertificate();
  if (local === undefined) return undefined;
  return sameBytes(local?.raw ? new Uint8Array(local.raw) : undefined, folhaEsperada);
}

/** Cria o transporte de Node e Bun. */
export function criarTransporteNode(opcoes: TransporteNodeOpcoes): Transporte {
  const rt = detectarRuntime();
  const runtime = rt === 'bun' ? 'bun' : 'node';
  const capabilities: CapacidadesDoTransporte = {
    runtime,
    renegociacao: true,
    tls12Cbc: true,
    // BoringSSL (Bun) não tem suítes DHE: GO produção fica fora do Bun (achado do laboratório TLS).
    tls12Dhe: runtime === 'node',
    controleDeSigalgs: true,
    conferenciaDoCertificadoLocal: true,
  };
  const id = opcoes.identidade;
  let agent: https.Agent | undefined;
  let expectedLeaf: Uint8Array | undefined;
  if (id.tipo === 'pem') {
    expectedLeaf = dersDoPem(id.cadeia)[0];
    if (!expectedLeaf) throw new ErroDeConfiguracao('identidade pem sem certificado');
    agent = new https.Agent({
      keepAlive: opcoes.manterConexao ?? true,
      cert: id.cadeia,
      key: id.chave,
      ca: [...trustStore(opcoes.confianca ?? 'embarcada'), ...pemTlsIcpBrasil(), ...(opcoes.acsAdicionais ?? [])],
      // Explícito: sem ele, NODE_TLS_REJECT_UNAUTHORIZED=0 no processo desliga a conferência do servidor também aqui.
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      ...(opcoes.sigalgs === undefined ? {} : { sigalgs: opcoes.sigalgs, maxVersion: 'TLSv1.2' as const }),
    });
  }
  let closed = false;

  function sendPem(
    prepared: Awaited<ReturnType<typeof prepareRequest>>,
    signal: AbortSignal | undefined,
  ): Promise<RespostaTransporte> {
    return new Promise<RespostaTransporte>((resolve, reject) => {
      let loaded: boolean | undefined;
      let tlsInfo: { protocolo: string | undefined; cifra: string | undefined; retomada: boolean | undefined } = {
        protocolo: undefined,
        cifra: undefined,
        retomada: undefined,
      };
      let settled = false;
      // Prazo total da requisição. O `timeout` do https.request é só de inatividade do socket: um servidor que pinga
      // pedaços da resposta o manteria vivo para sempre.
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const fail = (e: unknown): void => {
        clearTimeout(deadline);
        if (settled) return;
        settled = true;
        reject(e);
      };
      let req: ReturnType<typeof https.request>;
      try {
        req = https.request(
          prepared.url,
          { method: prepared.method, agent, headers: prepared.headers, timeout: prepared.timeoutMs },
          (res) => {
            const chunks: Uint8Array[] = [];
            res.on('data', (d: Uint8Array) => chunks.push(d));
            res.on('error', (e) => fail(classificarFalhaDeTransporte(e, { host: prepared.host })));
            res.on('end', () => {
              if (settled) return;
              const status = res.statusCode ?? 0;
              if (status === 403 && opcoes.recusarEm403 !== false) return fail(erroHttp403(prepared.host));
              const size = chunks.reduce((n, c) => n + c.length, 0);
              const body = new Uint8Array(size);
              let o = 0;
              for (const c of chunks) {
                body.set(c, o);
                o += c.length;
              }
              const headers: Record<string, string> = {};
              for (const [k, v] of Object.entries(res.headers)) {
                if (v !== undefined) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
              }
              settled = true;
              clearTimeout(deadline);
              resolve(makeResponse(status, headers, body, { ...tlsInfo, certificadoLocalCarregado: loaded }));
            });
          },
        );
      } catch (e) {
        // Identidade inválida (chave que não casa com o certificado, PEM corrompido) estoura aqui, ao criar o contexto.
        fail(classificarFalhaDeTransporte(e, { host: prepared.host }));
        return;
      }
      // Lido logo depois do handshake: com `connection: close` o socket já foi destruído quando a resposta termina.
      const verify = (s: tls.TLSSocket): void => {
        tlsInfo = {
          protocolo: s.getProtocol?.() ?? undefined,
          cifra: s.getCipher?.()?.name,
          retomada: s.isSessionReused?.() ?? undefined,
        };
        loaded = conferirCertificadoLocal(s as never, expectedLeaf as Uint8Array);
        if (loaded === false) {
          req.destroy(
            new ErroTransporte(
              'certificado_nao_carregado',
              `${prepared.host}: o socket TLS não carregou o certificado da identidade`,
              { detalhes: { host: prepared.host } },
            ),
          );
        }
      };
      req.on('socket', (socket) => {
        const s = socket as tls.TLSSocket;
        // Socket novo: confere depois do handshake; reaproveitado do pool: já passou pelo handshake.
        if (s.connecting || !(s as { encrypted?: boolean }).encrypted || s.getProtocol?.() == null) {
          s.once('secureConnect', () => verify(s));
        } else verify(s);
      });
      const timedOut = (): void => {
        req.destroy(
          new ErroDeTempoEsgotado(`${prepared.host}: sem resposta em ${prepared.timeoutMs} ms`, prepared.timeoutMs),
        );
      };
      req.on('timeout', timedOut);
      deadline = setTimeout(timedOut, prepared.timeoutMs);
      const onAbort = (): void => {
        req.destroy(new ErroTransporte('cancelado', `${prepared.host}: envio cancelado`, { cause: signal?.reason }));
      };
      if (signal?.aborted) onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      req.on('close', () => signal?.removeEventListener('abort', onAbort));
      req.on('error', (e) => fail(classificarFalhaDeTransporte(e, { host: prepared.host })));
      req.end(prepared.body);
    });
  }

  return {
    capacidades: capabilities,
    async enviar(request: PedidoTransporte): Promise<RespostaTransporte> {
      if (closed) throw new ErroDeConfiguracao('transporte já fechado');
      const prepared = await prepareRequest(request, opcoes);
      if (id.tipo === 'pem') assertSupported(prepared, capabilities);
      return audited(runtime, prepared, opcoes, async () => {
        if (id.tipo === 'helper') {
          const res = await sendViaHelper(opcoes, prepared, request.signal);
          if (res.status === 403 && opcoes.recusarEm403 !== false) throw erroHttp403(prepared.host);
          return res;
        }
        return sendPem(prepared, request.signal);
      });
    },
    async fechar(): Promise<void> {
      closed = true;
      agent?.destroy();
    },
  };
}
