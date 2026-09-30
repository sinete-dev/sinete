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

import { ErroDeConfiguracao } from './errors.ts';

/** Fonte de tempo. Cada chamada devolve uma instância nova de `Date`, que o chamador pode alterar sem efeito. */
export interface Relogio {
  agora(): Date;
}

/** Relógio do sistema. Use só na borda da aplicação; bibliotecas recebem o `Clock` de fora. */
export const relogioDoSistema: Relogio = {
  agora: (): Date => new Date(),
};

/** Instante aceito pelos relógios de teste: `Date`, epoch em milissegundos ou texto ISO 8601 com fuso. */
export type InstanteInformado = Date | number | string;

const ISO_WITH_ZONE = /(?:Z|[+-]\d{2}:\d{2})$/;

function toEpoch(at: InstanteInformado): number {
  if (typeof at === 'string' && !ISO_WITH_ZONE.test(at)) {
    throw new ErroDeConfiguracao(`instante sem fuso explícito: ${JSON.stringify(at)}; use Z ou ±hh:mm`, {
      detalhes: { instant: at },
    });
  }
  const ms = at instanceof Date ? at.getTime() : new Date(at).getTime();
  if (!Number.isFinite(ms)) {
    throw new ErroDeConfiguracao(`instante inválido: ${JSON.stringify(String(at))}`, {
      detalhes: { instant: String(at) },
    });
  }
  return ms;
}

/** Relógio parado num instante. Para testes e para reprocessar um documento com o horário original. */
export function relogioFixo(at: InstanteInformado): Relogio {
  const ms = toEpoch(at);
  return { agora: (): Date => new Date(ms) };
}

/** Relógio de teste controlado à mão. */
export interface RelogioManual extends Relogio {
  ajustar(at: InstanteInformado): void;
  avancar(ms: number): void;
}

export function relogioManual(start: InstanteInformado): RelogioManual {
  let current = toEpoch(start);
  return {
    agora: (): Date => new Date(current),
    ajustar(at: InstanteInformado): void {
      current = toEpoch(at);
    },
    avancar(ms: number): void {
      if (!Number.isFinite(ms)) throw new ErroDeConfiguracao(`avanço inválido: ${ms}`);
      current += ms;
    },
  };
}

/** Os dois relógios de uma operação fiscal. */
export interface ContextoDeTempo {
  readonly emissao: Relogio;
  readonly fatoGerador: Relogio;
}

export function contextoDeTempo(clocks: {
  readonly emissao: Relogio;
  readonly fatoGerador?: Relogio;
}): ContextoDeTempo {
  return { emissao: clocks.emissao, fatoGerador: clocks.fatoGerador ?? clocks.emissao };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/**
 * Formata no padrão `TDateTimeUTC` dos leiautes (`AAAA-MM-DDThh:mm:ss±hh:mm`), no deslocamento pedido em minutos
 * (`-180` para Brasília). O deslocamento vem do chamador, porque ele depende do local do emitente e não da máquina.
 */
export function formatarDataHoraComFuso(date: Date, offsetMinutes: number): string {
  if (!Number.isInteger(offsetMinutes) || offsetMinutes < -720 || offsetMinutes > 840) {
    throw new ErroDeConfiguracao(`deslocamento de fuso inválido: ${offsetMinutes} min`, {
      detalhes: { offsetMinutes },
    });
  }
  const ms = date.getTime();
  if (!Number.isFinite(ms)) throw new ErroDeConfiguracao('data inválida');
  const local = new Date(ms + offsetMinutes * 60_000);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return (
    `${pad(local.getUTCFullYear(), 4)}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
