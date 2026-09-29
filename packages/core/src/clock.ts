/**
 * Relógio injetável (princípio 6).
 *
 * Nenhuma função do sinete chama `new Date()` ou `Date.now()` por conta própria: quem precisa do tempo recebe um
 * `Clock`. Este arquivo é o único do repositório autorizado a usar o global `Date` como construtor (regra do Biome).
 *
 * Existem dois relógios, e eles não se confundem:
 *
 * - **emissão**: o instante em que o documento é gerado e transmitido. Alimenta `dhEmi`, `dhEvento`, prazos de
 *   cancelamento, timeouts, entrada em contingência e a escolha do pacote de liberação (PL) vigente. Em produção é o
 *   relógio do sistema.
 * - **fato gerador**: a data do fato que a nota documenta (a venda, a prestação). Decide qual regra tributária se
 *   aplica, como as alíquotas e as classificações de IBS/CBS com vigência. Pode ser anterior à emissão (nota emitida
 *   hoje de uma operação de ontem, ou reemissão em contingência).
 *
 * `TimeContext` carrega os dois. Sem fato gerador explícito, vale o da emissão.
 */

import { ConfigError } from './errors.ts';

/** Fonte de tempo. Cada chamada devolve uma instância nova de `Date`, que o chamador pode alterar sem efeito. */
export interface Clock {
  now(): Date;
}

/** Relógio do sistema. Use só na borda da aplicação; bibliotecas recebem o `Clock` de fora. */
export const systemClock: Clock = {
  now: (): Date => new Date(),
};

/** Instante aceito pelos relógios de teste: `Date`, epoch em milissegundos ou texto ISO 8601 com fuso. */
export type Instant = Date | number | string;

const ISO_WITH_ZONE = /(?:Z|[+-]\d{2}:\d{2})$/;

function toEpoch(at: Instant): number {
  if (typeof at === 'string' && !ISO_WITH_ZONE.test(at)) {
    throw new ConfigError(`instante sem fuso explícito: ${JSON.stringify(at)}; use Z ou ±hh:mm`, {
      details: { instant: at },
    });
  }
  const ms = at instanceof Date ? at.getTime() : new Date(at).getTime();
  if (!Number.isFinite(ms)) {
    throw new ConfigError(`instante inválido: ${JSON.stringify(String(at))}`, { details: { instant: String(at) } });
  }
  return ms;
}

/** Relógio parado num instante. Para testes e para reprocessar um documento com o horário original. */
export function fixedClock(at: Instant): Clock {
  const ms = toEpoch(at);
  return { now: (): Date => new Date(ms) };
}

/** Relógio de teste controlado à mão. */
export interface ManualClock extends Clock {
  set(at: Instant): void;
  advance(ms: number): void;
}

export function manualClock(start: Instant): ManualClock {
  let current = toEpoch(start);
  return {
    now: (): Date => new Date(current),
    set(at: Instant): void {
      current = toEpoch(at);
    },
    advance(ms: number): void {
      if (!Number.isFinite(ms)) throw new ConfigError(`avanço inválido: ${ms}`);
      current += ms;
    },
  };
}

/** Os dois relógios de uma operação fiscal. */
export interface TimeContext {
  readonly emissao: Clock;
  readonly fatoGerador: Clock;
}

export function timeContext(clocks: { readonly emissao: Clock; readonly fatoGerador?: Clock }): TimeContext {
  return { emissao: clocks.emissao, fatoGerador: clocks.fatoGerador ?? clocks.emissao };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/**
 * Formata no padrão `TDateTimeUTC` dos leiautes (`AAAA-MM-DDThh:mm:ss±hh:mm`), no deslocamento pedido em minutos
 * (`-180` para Brasília). O deslocamento vem do chamador, porque ele depende do local do emitente e não da máquina.
 */
export function formatDateTimeOffset(date: Date, offsetMinutes: number): string {
  if (!Number.isInteger(offsetMinutes) || offsetMinutes < -720 || offsetMinutes > 840) {
    throw new ConfigError(`deslocamento de fuso inválido: ${offsetMinutes} min`, { details: { offsetMinutes } });
  }
  const ms = date.getTime();
  if (!Number.isFinite(ms)) throw new ConfigError('data inválida');
  const local = new Date(ms + offsetMinutes * 60_000);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return (
    `${pad(local.getUTCFullYear(), 4)}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
