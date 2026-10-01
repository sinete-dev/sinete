/**
 * O `signal` do emissor: o mesmo `AbortSignal` das opções dos clientes dos documentos (`EnvioOpcoes`).
 *
 * Contrato (ADR 0010, decisão 8): enquanto a chamada não gravou bytes nem começou a enviar, o abort lança o
 * `ErroTransporte` com `code: 'cancelado'` e nada muda no store; a trava, se já foi tomada, é solta no fim da chamada.
 * Depois de gravar ou de começar a enviar, o abort cancela a requisição em curso e conta como envio sem resposta: o
 * emissor não consulta nem reenvia mais nada, os bytes ficam gravados, a trava é solta, e o desfecho é `pendente` com
 * `motivo: 'sem-resposta'` e o erro `cancelado` em `causa`. `retomar` (ou a retomada automática) continua com os
 * mesmos bytes.
 */

import { ehErroSinete } from '@sinete/core';
import { ErroTransporte } from '@sinete/transport';
import { semResposta } from './desfecho.ts';

/** Opções de toda chamada do emissor que vai à rede, com o mesmo `signal` dos clientes dos documentos. */
export interface EnvioOpcoes {
  /** Cancela a chamada (veja o contrato no README: antes de gravar, lança; depois, `pendente`). */
  readonly signal?: AbortSignal;
}

/** O erro do abort, como o transporte o lança: `ErroTransporte` com `code: 'cancelado'`. */
export function erroCancelado(signal: AbortSignal, onde: string): ErroTransporte {
  return new ErroTransporte('cancelado', `${onde}: cancelado pelo chamador`, { cause: signal.reason });
}

/** Lança o `cancelado` se o sinal já disparou. */
export function conferirSinal(signal: AbortSignal | undefined, onde: string): void {
  if (signal?.aborted === true) throw erroCancelado(signal, onde);
}

/**
 * O erro de um envio que pode ter chegado (`semResposta`), ou `undefined` se o erro é outro. A espera entre consultas
 * do recibo rejeita com o `reason` do sinal, que não é um erro do sinete: vira o `cancelado`.
 */
export function falhaSemResposta(e: unknown, signal: AbortSignal | undefined): unknown {
  if (signal?.aborted === true && e === signal.reason && !ehErroSinete(e, 'cancelado')) {
    return erroCancelado(signal, 'espera');
  }
  return semResposta(e) ? e : undefined;
}

/** O sinal disparou: o emissor não começa outra chamada à rede. */
export const abortado = (signal: AbortSignal | undefined): signal is AbortSignal => signal?.aborted === true;
