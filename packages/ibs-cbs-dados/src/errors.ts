/** Erros do `@sinete/ibs-cbs-dados`. */
import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';

/** Códigos lançados pelo `@sinete/ibs-cbs-dados`. */
export type CodigoErroDadosIbsCbs = 'ibscbs_dados_invalidos' | 'ibscbs_dados_versao_incompativel';

/**
 * Pacote de dados que não pode ser usado: formato inesperado, tabela ausente, hash que não confere com o manifest
 * (`ibscbs_dados_invalidos`), ou `versaoDoFormato` que este código não conhece (`ibscbs_dados_versao_incompativel`).
 */
export class ErroDadosIbsCbs extends ErroSinete<CodigoErroDadosIbsCbs> {
  constructor(code: CodigoErroDadosIbsCbs, message: string, opcoes?: ErroSineteOpcoes) {
    super(code, message, opcoes);
    this.name = 'ErroDadosIbsCbs';
  }
}
