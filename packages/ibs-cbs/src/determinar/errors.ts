/** Erros do `@sinete/ibs-cbs/determinar`. */
import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';

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
export class DeterminationError extends ErroSinete<'ibscbs_determinacao_invalida'> {
  readonly reason: DeterminationReason;
  readonly item: number | undefined;

  constructor(reason: DeterminationReason, message: string, item?: number, options: ErroSineteOpcoes = {}) {
    super('ibscbs_determinacao_invalida', message, {
      ...options,
      detalhes: { ...options.detalhes, reason, ...(item === undefined ? {} : { item }) },
    });
    this.name = 'DeterminationError';
    this.reason = reason;
    this.item = item;
  }
}
