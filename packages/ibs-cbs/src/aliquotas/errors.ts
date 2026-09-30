/** Erros do `@sinete/ibs-cbs/aliquotas`. */
import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';
import type { IsoDate, RateTributo } from './types.ts';

/**
 * A alíquota pedida ainda não foi publicada (estado `unknown`). O cálculo não segue com zero nem com um palpite: quem
 * precisa simular informa a alíquota com `withOverrides`, e o resultado sai marcado como simulado.
 */
export class RateUnknownError extends ErroSinete<'ibscbs_aliquota_desconhecida'> {
  readonly tributo: RateTributo;
  readonly date: IsoDate;

  constructor(tributo: RateTributo, date: IsoDate, message: string, options?: ErroSineteOpcoes) {
    super('ibscbs_aliquota_desconhecida', message, options);
    this.name = 'RateUnknownError';
    this.tributo = tributo;
    this.date = date;
  }
}

/** Tabela de alíquotas inconsistente (vigências sobrepostas, valor fora do domínio, formato desconhecido). */
export class RatesDataError extends ErroSinete<'ibscbs_aliquotas_invalidas'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('ibscbs_aliquotas_invalidas', message, options);
    this.name = 'RatesDataError';
  }
}
