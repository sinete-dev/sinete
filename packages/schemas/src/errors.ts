/**
 * Erros do `@sinete/schemas`, todos `SineteError` com `code` estável (princípio 7).
 */

import type { ErroSineteOpcoes } from '@sinete/core';
import { ErroSinete } from '@sinete/core';

/** Códigos lançados por este pacote. */
export type SchemasErrorCode = 'serializacao_invalida' | 'pl_sem_vigencia';

/** O objeto não tem a forma do tipo gerado (campo simples que não é string, grupo repetido desalinhado). */
export class SerializeError extends ErroSinete<'serializacao_invalida'> {
  /** Caminho do campo no XML (`/NFe/infNFe/ide/cUF`). */
  readonly path: string;

  constructor(path: string, message: string, options?: ErroSineteOpcoes) {
    super('serializacao_invalida', `${path}: ${message}`, { ...options, detalhes: { ...options?.detalhes, path } });
    this.name = 'SerializeError';
    this.path = path;
  }
}

/** Nenhum pacote de liberação da tabela de vigências cobre a data e o ambiente pedidos. */
export class VigenciaError extends ErroSinete<'pl_sem_vigencia'> {
  constructor(message: string, options?: ErroSineteOpcoes) {
    super('pl_sem_vigencia', message, options);
    this.name = 'VigenciaError';
  }
}
