/**
 * Relógio injetável (princípio 6).
 *
 * Nenhuma função do sinete chama `new Date()` ou `Date.now()` por conta própria: quem precisa do tempo recebe um
 * `Relogio`. Este arquivo é o único do repositório autorizado a usar o global `Date` como construtor (regra do Biome).
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
 * `ContextoDeTempo` carrega os dois. Sem fato gerador explícito, vale o da emissão.
 */

import { ErroDeConfiguracao } from './errors.ts';

/** Fonte de tempo. Cada chamada devolve uma instância nova de `Date`, que o chamador pode alterar sem efeito. */
export interface Relogio {
  agora(): Date;
}

/** Relógio do sistema. Use só na borda da aplicação; bibliotecas recebem o `Relogio` de fora. */
export const relogioDoSistema: Relogio = {
  agora: (): Date => new Date(),
};

/** Instante aceito pelos relógios de teste: `Date`, epoch em milissegundos ou texto ISO 8601 com fuso. */
export type InstanteInformado = Date | number | string;

const ISO_WITH_ZONE = /(?:Z|[+-]\d{2}:\d{2})$/;

function toEpoch(instante: InstanteInformado): number {
  if (typeof instante === 'string' && !ISO_WITH_ZONE.test(instante)) {
    throw new ErroDeConfiguracao(`instante sem fuso explícito: ${JSON.stringify(instante)}; use Z ou ±hh:mm`, {
      detalhes: { instante },
    });
  }
  const ms = instante instanceof Date ? instante.getTime() : new Date(instante).getTime();
  if (!Number.isFinite(ms)) {
    throw new ErroDeConfiguracao(`instante inválido: ${JSON.stringify(String(instante))}`, {
      detalhes: { instante: String(instante) },
    });
  }
  return ms;
}

/** Relógio parado num instante. Para testes e para reprocessar um documento com o horário original. */
export function relogioFixo(instante: InstanteInformado): Relogio {
  const ms = toEpoch(instante);
  return { agora: (): Date => new Date(ms) };
}

/** Relógio de teste controlado à mão. */
export interface RelogioManual extends Relogio {
  ajustar(instante: InstanteInformado): void;
  avancar(ms: number): void;
}

export function relogioManual(inicio: InstanteInformado): RelogioManual {
  let current = toEpoch(inicio);
  return {
    agora: (): Date => new Date(current),
    ajustar(instante: InstanteInformado): void {
      current = toEpoch(instante);
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
export function formatarDataHoraComFuso(data: Date, deslocamentoMin: number): string {
  if (!Number.isInteger(deslocamentoMin) || deslocamentoMin < -720 || deslocamentoMin > 840) {
    throw new ErroDeConfiguracao(`deslocamento de fuso inválido: ${deslocamentoMin} min`, {
      detalhes: { deslocamentoMin },
    });
  }
  const ms = data.getTime();
  if (!Number.isFinite(ms)) throw new ErroDeConfiguracao('data inválida');
  const local = new Date(ms + deslocamentoMin * 60_000);
  const sign = deslocamentoMin < 0 ? '-' : '+';
  const abs = Math.abs(deslocamentoMin);
  return (
    `${pad(local.getUTCFullYear(), 4)}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}` +
    `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
