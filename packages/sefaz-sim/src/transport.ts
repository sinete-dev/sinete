/**
 * `Transporte` do `@sinete/transport` atendido em processo pelo simulador, para os testes de unidade de outros pacotes:
 * mesma interface, sem socket. As falhas injetadas viram os mesmos erros tipados do transporte real (queda de conexão
 * é `conexao_recusada`; sem resposta é `ErroDeTempoEsgotado` no prazo da requisição).
 */

import { ErroDeConfiguracao, ErroDeTempoEsgotado } from '@sinete/core';
import type {
  EndpointResolvido,
  PedidoTransporte,
  PoliticaDeHosts,
  RespostaTransporte,
  Transporte,
} from '@sinete/transport';
import { ErroTransporte, erroHttp403 } from '@sinete/transport';
import type { SimHandler } from './handler.ts';
import type { SimAutorizador, SimServico } from './services.ts';
import { isMdfeServico, NFE_SERVICES, servicePath } from './services.ts';
import type { SimResult } from './sim.ts';

/** Origem fictícia das URLs do transporte em processo. */
export const SIM_BASE_URL = 'https://sefaz-sim.invalid';

export interface SimTransportOptions {
  /** Certificado do canal (DER) que o simulador vê como apresentado no TLS. */
  readonly clientCertificate?: Uint8Array;
  /** Política de hosts, aplicada antes do envio como no transporte real. */
  readonly policy?: PoliticaDeHosts;
  /** Prazo por requisição em ms (tempo real). Padrão: 60 000. */
  readonly timeoutMs?: number;
  /** HTTP 403 vira `certificado_ausente_ou_recusado`, como no transporte real. Padrão: `true`. */
  readonly rejectOn403?: boolean;
}

// Função, e não `signal?.aborted` direto: o tsc estreita a propriedade e não enxerga o cancelamento durante um await.
const abortado = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

const cancelado = (signal: AbortSignal): ErroTransporte =>
  new ErroTransporte('cancelado', 'envio cancelado', { cause: signal.reason });

/**
 * Prazo e cancelamento do pedido inteiro, do atendimento no simulador ao fim da espera, como no transporte real: o
 * que o simulador já começou a processar continua (e muda o estado) mesmo que o cliente desista.
 */
interface Guard {
  run<T>(p: Promise<T>): Promise<T>;
  /** Espera `ms` dentro do prazo. */
  sleep(ms: number): Promise<void>;
  /** Espera até o prazo acabar (ou o sinal cancelar) e rejeita. */
  expire(): Promise<never>;
  dispose(): void;
}

function guard(timeoutMs: number, host: string, signal: AbortSignal | undefined): Guard {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nap: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const stop = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ErroDeTempoEsgotado(`${host}: sem resposta em ${timeoutMs} ms`, timeoutMs)),
      timeoutMs,
    );
    if (signal?.aborted === true) reject(cancelado(signal));
    else if (signal !== undefined) {
      onAbort = (): void => reject(cancelado(signal));
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
  stop.catch(() => undefined);
  return {
    run<T>(p: Promise<T>): Promise<T> {
      p.catch(() => undefined);
      return Promise.race([p, stop]);
    },
    sleep(ms: number): Promise<void> {
      return Promise.race([new Promise<void>((resolve) => (nap = setTimeout(resolve, ms))), stop]);
    },
    expire: (): Promise<never> => stop,
    dispose(): void {
      clearTimeout(timer);
      clearTimeout(nap);
      if (onAbort !== undefined) signal?.removeEventListener('abort', onAbort);
    },
  };
}

/** Cria o transporte em processo. As URLs são `SIM_BASE_URL` + `sim.path(...)`. */
export function simTransport(sim: SimHandler, options: SimTransportOptions = {}): Transporte {
  let closed = false;
  return {
    capacidades: {
      runtime: 'personalizada',
      renegociacao: true,
      tls12Cbc: true,
      tls12Dhe: true,
      controleDeSigalgs: false,
      conferenciaDoCertificadoLocal: false,
    },
    async enviar(request: PedidoTransporte): Promise<RespostaTransporte> {
      if (closed) throw new ErroDeConfiguracao('transporte já fechado');
      if (abortado(request.signal)) throw cancelado(request.signal as AbortSignal);
      const url = new URL(request.url);
      const method = request.metodo ?? (request.corpo === undefined ? 'GET' : 'POST');
      await options.policy?.conferir({ url, metodo: method, corpo: request.corpo, endpoint: request.endpoint });
      // Cancelado enquanto a política decidia: o pedido não chega ao simulador.
      if (abortado(request.signal)) throw cancelado(request.signal as AbortSignal);
      const timeoutMs = request.timeoutMs ?? options.timeoutMs ?? 60_000;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(request.cabecalhos ?? {})) headers[k.toLowerCase()] = v;
      const g = guard(timeoutMs, url.hostname, request.signal);
      let result: SimResult;
      try {
        result = await g.run(
          sim.handle({
            method,
            path: `${url.pathname}${url.search}`,
            headers,
            ...(request.corpo === undefined ? {} : { body: request.corpo }),
            ...(options.clientCertificate === undefined ? {} : { clientCertificate: options.clientCertificate }),
          }),
        );
        if (result.delayMs > 0) await g.sleep(result.delayMs);
        if (result.effect === 'hang') await g.expire();
      } finally {
        g.dispose();
      }
      if (result.effect === 'drop') {
        throw new ErroTransporte('conexao_recusada', `${url.hostname}: conexão encerrada sem resposta`, {
          detalhes: { host: url.hostname },
        });
      }
      if (result.status === 403 && options.rejectOn403 !== false) throw erroHttp403(url.hostname);
      const body = new TextEncoder().encode(result.body);
      return {
        status: result.status,
        cabecalhos: result.headers,
        corpo: body,
        tls: { protocolo: undefined, cifra: undefined, retomada: undefined, certificadoLocalCarregado: undefined },
        texto: (): string => result.body,
      };
    },
    async fechar(): Promise<void> {
      closed = true;
    },
  };
}

/**
 * Autorizador simulado de um endpoint dos dados do `@sinete/transport`: o Ambiente Nacional (`AN`), a contingência
 * (`SVC-AN`, `SVC-RS`) ou, em qualquer outro caso, o autorizador da UF (UF própria, SVAN, SVRS, inclusive os da NFC-e).
 */
export function simAutorizadorOf(endpoint: EndpointResolvido): SimAutorizador {
  if (endpoint.autorizador === 'AN') return 'an';
  if (endpoint.autorizador === 'SVC-AN' || endpoint.autorizador === 'SVC-RS') return 'svc';
  return 'uf';
}

/**
 * Envolve um `Transporte` (o real, por HTTPS com mTLS, ou o `simTransport`) para mandar ao simulador os pedidos que um
 * cliente de documento resolveu pelos dados de endpoints: a URL de cada pedido vira `baseUrl` + o caminho do serviço
 * no autorizador simulado, e o `endpoint` segue com a URL e o host novos, sem o perfil TLS do host real. Assim o
 * cliente (o `@sinete/nfe`, por exemplo) roda sem saber do simulador. Pedido sem `endpoint`, ou de serviço que o
 * simulador não atende, é `ErroDeConfiguracao`: nada escapa para a SEFAZ real.
 */
export function redirectToSim(transport: Transporte, baseUrl: string): Transporte {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new ErroDeConfiguracao(`baseUrl do simulador precisa ser https: ${baseUrl}`);
  const origin = base.origin;
  return {
    capacidades: transport.capacidades,
    enviar(request: PedidoTransporte): Promise<RespostaTransporte> {
      const ep = request.endpoint;
      if (ep === undefined) {
        return Promise.reject(
          new ErroDeConfiguracao(`pedido sem endpoint não é redirecionado ao simulador: ${request.url}`),
        );
      }
      const nfe = (ep.documento === 'nfe' || ep.documento === 'nfce') && Object.hasOwn(NFE_SERVICES, ep.servico);
      const mdfe = ep.documento === 'mdfe' && isMdfeServico(ep.servico);
      if (!nfe && !mdfe) {
        return Promise.reject(
          new ErroDeConfiguracao(`o simulador não atende ${ep.documento} ${ep.servico}`, {
            detalhes: { documento: ep.documento, servico: ep.servico },
          }),
        );
      }
      const url = `${origin}${servicePath(ep.servico as SimServico, simAutorizadorOf(ep))}`;
      const endpoint: EndpointResolvido = { ...ep, url, host: base.hostname, tls: undefined };
      return transport.enviar({ ...request, url, endpoint });
    },
    fechar: (): Promise<void> => transport.fechar(),
  };
}
