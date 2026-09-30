/**
 * Transporte do Deno (ADR 0004, decisões 4 e 5): `fetch` com `Deno.createHttpClient({ cert, key, caCerts,
 * http2: false })`. O rustls não renegocia nem fala CBC ou DHE, e nenhuma opção contorna isso; então o transporte
 * recusa, antes de abrir socket e com `ErroTransporteNaoSuportado`, os hosts cujo perfil medido exige uma dessas
 * coisas (SP, BA, PR, GO produção, SVAN, SVC-AN, AN, MT homologação e a Sefin da NFS-e).
 *
 * `caCerts` do Deno soma à loja padrão (verificado no S2), então basta passar o conjunto ICP-Brasil.
 */

import { pemTlsIcpBrasil } from '@sinete/cert';
import { ErroDeConfiguracao, ErroDeTempoEsgotado, ErroNaoSuportado } from '@sinete/core';
import { classificarFalhaDeTransporte, erroHttp403 } from './classify.ts';
import { assertSupported, audited, makeResponse, prepareRequest, sendViaHelper } from './common.ts';
import { ErroTransporte, ErroTransporteNaoSuportado } from './errors.ts';
import type {
  CapacidadesDoTransporte,
  PedidoTransporte,
  RespostaTransporte,
  Transporte,
  TransporteOpcoes,
} from './types.ts';

/** O pedaço da API do Deno que o transporte usa (injetável nos testes). */
export interface ApiHttpDeno {
  createHttpClient(options: { cert?: string; key?: string; caCerts?: string[]; http1?: boolean; http2?: boolean }): {
    close(): void;
  };
}

export interface TransporteDenoOpcoes extends TransporteOpcoes {
  /** `recusar`: recusa host sem perfil TLS nos dados. Padrão: `permitir` (endpoint próprio do chamador). */
  readonly hostsDesconhecidos?: 'permitir' | 'recusar';
  /** Para testes: a API do Deno e o `fetch`. Padrão: os globais. */
  readonly deno?: ApiHttpDeno;
  readonly fetch?: typeof fetch;
}

export const CAPACIDADES_DENO: CapacidadesDoTransporte = {
  runtime: 'deno',
  renegociacao: false,
  tls12Cbc: false,
  tls12Dhe: false,
  controleDeSigalgs: false,
  conferenciaDoCertificadoLocal: false,
};

/** Cria o transporte do Deno. Fora do Deno, só com `deno` e `fetch` injetados. */
export function criarTransporteDeno(opcoes: TransporteDenoOpcoes): Transporte {
  const deno = opcoes.deno ?? (globalThis as { Deno?: ApiHttpDeno }).Deno;
  const doFetch = opcoes.fetch ?? globalThis.fetch;
  if (!deno || typeof deno.createHttpClient !== 'function') {
    throw new ErroNaoSuportado('Deno.createHttpClient não existe nesta runtime');
  }
  const id = opcoes.identidade;
  const client =
    id.tipo === 'pem'
      ? deno.createHttpClient({
          cert: id.cadeia,
          key: id.chave,
          caCerts: [...pemTlsIcpBrasil(), ...(opcoes.acsAdicionais ?? [])],
          http1: true,
          http2: false,
        })
      : undefined;
  let closed = false;

  async function send(request: PedidoTransporte): Promise<RespostaTransporte> {
    if (closed) throw new ErroDeConfiguracao('transporte já fechado');
    const prepared = await prepareRequest(request, opcoes);
    if (id.tipo === 'pem') assertSupported(prepared, CAPACIDADES_DENO);
    if (id.tipo === 'pem' && !prepared.profile && opcoes.hostsDesconhecidos === 'recusar') {
      throw new ErroTransporteNaoSuportado(
        prepared.host,
        ['host sem perfil TLS nos dados do sinete'],
        'Passe hostsDesconhecidos: "permitir" para aceitar endpoints próprios.',
      );
    }
    return audited('deno', prepared, opcoes, async () => {
      if (id.tipo === 'helper') {
        const res = await sendViaHelper(opcoes, prepared, request.signal);
        if (res.status === 403 && opcoes.recusarEm403 !== false) throw erroHttp403(prepared.host);
        return res;
      }
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), prepared.timeoutMs);
      const signal = request.signal ? AbortSignal.any([request.signal, timeout.signal]) : timeout.signal;
      try {
        const res = await doFetch(prepared.url.href, {
          method: prepared.method,
          // Redirecionamento não é seguido: a política e a trava de https só valeram para a URL original, e um 307/308
          // reenviaria o documento fiscal para outro destino. O 3xx volta como resposta para quem chamou.
          redirect: 'manual',
          headers: prepared.headers,
          body: prepared.body as Uint8Array<ArrayBuffer> | undefined,
          signal,
          client,
        } as RequestInit);
        const body = new Uint8Array(await res.arrayBuffer());
        if (res.status === 403 && opcoes.recusarEm403 !== false) throw erroHttp403(prepared.host);
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          headers[k.toLowerCase()] = v;
        });
        return makeResponse(res.status, headers, body, {
          protocolo: undefined,
          cifra: undefined,
          retomada: undefined,
          certificadoLocalCarregado: undefined,
        });
      } catch (e) {
        if (request.signal?.aborted) {
          throw new ErroTransporte('cancelado', `${prepared.host}: envio cancelado`, { cause: e });
        }
        if (timeout.signal.aborted) {
          throw new ErroDeTempoEsgotado(
            `${prepared.host}: sem resposta em ${prepared.timeoutMs} ms`,
            prepared.timeoutMs,
            {
              cause: e,
            },
          );
        }
        throw classificarFalhaDeTransporte(e, { host: prepared.host });
      } finally {
        clearTimeout(timer);
      }
    });
  }

  return {
    capacidades: CAPACIDADES_DENO,
    enviar: send,
    async fechar(): Promise<void> {
      if (closed) return;
      closed = true;
      // A conexão com o helper é do chamador, que a fecha quando quiser.
      client?.close();
    },
  };
}
