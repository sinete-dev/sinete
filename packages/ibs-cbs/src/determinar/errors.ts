/** Erros do `@sinete/ibs-cbs/determinar`. */
import type { SineteErrorOptions } from '@sinete/core';
import { SineteError } from '@sinete/core';

/** Motivo estável de um `DeterminationError`. */
export type DeterminationReason =
  | 'fatos_invalidos'
  | 'resolvedor_fora_dos_candidatos'
  | 'resolvedor_invalido'
  | 'resposta_fora_dos_candidatos'
  | 'determinacao_incompleta';

/**
 * A determinação não pode seguir: fatos malformados (item repetido, NCM com letras), resolvedor ou resposta que escolhe
 * código fora dos candidatos, ou `toClassified` com item sem decisão. `reason` diz qual; `item` diz onde.
 */
export class DeterminationError extends SineteError<'ibscbs_determinacao_invalida'> {
  readonly reason: DeterminationReason;
  readonly item: number | undefined;

  constructor(reason: DeterminationReason, message: string, item?: number, options: SineteErrorOptions = {}) {
    super('ibscbs_determinacao_invalida', message, {
      ...options,
      details: { ...options.details, reason, ...(item === undefined ? {} : { item }) },
    });
    this.name = 'DeterminationError';
    this.reason = reason;
    this.item = item;
  }
}
