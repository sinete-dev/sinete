/**
 * Logger estruturado e injetável.
 *
 * O padrão é não logar nada (`noopLogger`). A aplicação liga o próprio logger (pino, console, OpenTelemetry) por um
 * adaptador de poucas linhas. Mensagem curta e estável; o contexto vai em `fields`.
 *
 * Nunca passe ao logger chave privada, PIN, certificado em PFX ou PEM, nem o XML inteiro de um documento (tem CPF,
 * endereço e valores). Identifique o documento pela chave de acesso.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** Logger derivado que acrescenta `bindings` a toda entrada (ex.: `{ uf: 'SP', operacao: 'autorizacao' }`). */
  child(bindings: LogFields): Logger;
}

const noop = (): void => {};

/** Logger que descarta tudo. É o padrão quando o chamador não injeta um. */
export const noopLogger: Logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  child: (): Logger => noopLogger,
};

export interface LogEntry {
  readonly level: LogLevel;
  readonly msg: string;
  readonly fields: LogFields;
}

/** Logger que guarda as entradas em memória, para asserções em teste. */
export interface MemoryLogger extends Logger {
  readonly entries: readonly LogEntry[];
  clear(): void;
}

export function memoryLogger(): MemoryLogger {
  const entries: LogEntry[] = [];
  const make = (bindings: LogFields): Logger => {
    const log =
      (level: LogLevel) =>
      (msg: string, fields?: LogFields): void => {
        entries.push({ level, msg, fields: { ...bindings, ...fields } });
      };
    return {
      debug: log('debug'),
      info: log('info'),
      warn: log('warn'),
      error: log('error'),
      child: (more: LogFields): Logger => make({ ...bindings, ...more }),
    };
  };
  return {
    ...make({}),
    entries,
    clear(): void {
      entries.length = 0;
    },
  };
}
