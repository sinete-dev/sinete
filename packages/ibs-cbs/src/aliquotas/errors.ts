/** Erros do `@sinete/ibs-cbs/aliquotas`. */
import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';
import type { DataIso, TributoDaAliquota } from './types.ts';

/**
 * A alíquota pedida ainda não foi publicada (estado `desconhecida`). O cálculo não segue com zero nem com um palpite: quem
 * precisa simular informa a alíquota com `comAliquotasInformadas`, e o resultado sai marcado como simulado.
 */
export class ErroAliquotaDesconhecida extends ErroSinete<'ibscbs_aliquota_desconhecida'> {
  readonly tributo: TributoDaAliquota;
  readonly data: DataIso;

  constructor(tributo: TributoDaAliquota, data: DataIso, message: string, opcoes?: ErroSineteOpcoes) {
    super('ibscbs_aliquota_desconhecida', message, opcoes);
    this.name = 'ErroAliquotaDesconhecida';
    this.tributo = tributo;
    this.data = data;
  }
}

/** Tabela de alíquotas inconsistente (vigências sobrepostas, valor fora do domínio, formato desconhecido). */
export class ErroDadosDeAliquotas extends ErroSinete<'ibscbs_aliquotas_invalidas'> {
  constructor(message: string, opcoes?: ErroSineteOpcoes) {
    super('ibscbs_aliquotas_invalidas', message, opcoes);
    this.name = 'ErroDadosDeAliquotas';
  }
}
