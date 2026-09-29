/**
 * Erros do `@sinete/schemas`, todos `SineteError` com `code` estável (princípio 7).
 */

import type { SineteErrorOptions } from '@sinete/core';
import { SineteError } from '@sinete/core';

/** Códigos lançados por este pacote. */
export type SchemasErrorCode = 'serializacao_invalida' | 'pl_sem_vigencia';

/** O objeto não tem a forma do tipo gerado (campo simples que não é string, grupo repetido desalinhado). */
export class SerializeError extends SineteError<'serializacao_invalida'> {
  /** Caminho do campo no XML (`/NFe/infNFe/ide/cUF`). */
  readonly path: string;

  constructor(path: string, message: string, options?: SineteErrorOptions) {
    super('serializacao_invalida', `${path}: ${message}`, { ...options, details: { ...options?.details, path } });
    this.name = 'SerializeError';
    this.path = path;
  }
}

/** Nenhum pacote de liberação da tabela de vigências cobre a data e o ambiente pedidos. */
export class VigenciaError extends SineteError<'pl_sem_vigencia'> {
  constructor(message: string, options?: SineteErrorOptions) {
    super('pl_sem_vigencia', message, options);
    this.name = 'VigenciaError';
  }
}
