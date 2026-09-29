/** Erros do `@sinete/ibs-cbs-dados`. */
import type { SineteErrorOptions } from '@sinete/core';
import { SineteError } from '@sinete/core';

/** Códigos lançados pelo `@sinete/ibs-cbs-dados`. */
export type IbsCbsDataErrorCode = 'ibscbs_dados_invalidos' | 'ibscbs_dados_versao_incompativel';

/**
 * Pacote de dados que não pode ser usado: formato inesperado, tabela ausente, hash que não confere com o manifest
 * (`ibscbs_dados_invalidos`), ou `dataSchemaVersion` que este código não conhece (`ibscbs_dados_versao_incompativel`).
 */
export class IbsCbsDataError extends SineteError<IbsCbsDataErrorCode> {
  constructor(code: IbsCbsDataErrorCode, message: string, options?: SineteErrorOptions) {
    super(code, message, options);
    this.name = 'IbsCbsDataError';
  }
}
