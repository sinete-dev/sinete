/**
 * Erros do `@sinete/schemas`, todos `ErroSinete` com `code` estável (princípio 7).
 */

import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';

/** Códigos lançados por este pacote. */
export type CodigoErroSchemas = 'serializacao_invalida' | 'pl_sem_vigencia';

/** O objeto não tem a forma do tipo gerado (campo simples que não é string, grupo repetido desalinhado). */
export class ErroSerializacao extends ErroSinete<'serializacao_invalida'> {
  /** Caminho do campo no XML (`/NFe/infNFe/ide/cUF`). */
  readonly caminho: string;

  constructor(caminho: string, message: string, opcoes?: ErroSineteOpcoes) {
    super('serializacao_invalida', `${caminho}: ${message}`, {
      ...opcoes,
      detalhes: { ...opcoes?.detalhes, caminho },
    });
    this.name = 'ErroSerializacao';
    this.caminho = caminho;
  }
}

/** Nenhum pacote de liberação da tabela de vigências cobre a data e o ambiente pedidos. */
export class ErroVigencia extends ErroSinete<'pl_sem_vigencia'> {
  constructor(message: string, opcoes?: ErroSineteOpcoes) {
    super('pl_sem_vigencia', message, opcoes);
    this.name = 'ErroVigencia';
  }
}
