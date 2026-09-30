/** Erros do `@sinete/ibs-cbs/determinar`. */
import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';

/** Motivo estável de um `ErroDeterminacao`. */
export type MotivoErroDeterminacao =
  | 'fatos_invalidos'
  | 'resolvedor_fora_dos_candidatos'
  | 'resolvedor_invalido'
  | 'resposta_fora_dos_candidatos'
  | 'determinacao_incompleta';

/**
 * A determinação não pode seguir: fatos malformados (item repetido, NCM com letras), resolvedor ou resposta que escolhe
 * código fora dos candidatos, ou `paraClassificado` com item sem decisão. `motivo` diz qual; `item` diz onde.
 */
export class ErroDeterminacao extends ErroSinete<'ibscbs_determinacao_invalida'> {
  readonly motivo: MotivoErroDeterminacao;
  readonly item: number | undefined;

  constructor(motivo: MotivoErroDeterminacao, message: string, item?: number, opcoes: ErroSineteOpcoes = {}) {
    super('ibscbs_determinacao_invalida', message, {
      ...opcoes,
      detalhes: { ...opcoes.detalhes, motivo, ...(item === undefined ? {} : { item }) },
    });
    this.name = 'ErroDeterminacao';
    this.motivo = motivo;
    this.item = item;
  }
}
