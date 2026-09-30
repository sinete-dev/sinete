/**
 * Logger estruturado e injetável.
 *
 * O padrão é não logar nada (`noopLogger`). A aplicação liga o próprio logger (pino, console, OpenTelemetry) por um
 * adaptador de poucas linhas. Mensagem curta e estável; o contexto vai em `fields`.
 *
 * Nunca passe ao logger chave privada, PIN, certificado em PFX ou PEM, nem o XML inteiro de um documento (tem CPF,
 * endereço e valores). Identifique o documento pela chave de acesso.
 */

export type NivelDeLog = 'debug' | 'info' | 'warn' | 'error';

export type CamposDeLog = Readonly<Record<string, unknown>>;

export interface Logger {
  debug(msg: string, fields?: CamposDeLog): void;
  info(msg: string, fields?: CamposDeLog): void;
  warn(msg: string, fields?: CamposDeLog): void;
  error(msg: string, fields?: CamposDeLog): void;
  /** Logger derivado que acrescenta `bindings` a toda entrada (ex.: `{ uf: 'SP', operacao: 'autorizacao' }`). */
  child(bindings: CamposDeLog): Logger;
}

const noop = (): void => {};

/** Logger que descarta tudo. É o padrão quando o chamador não injeta um. */
export const loggerSilencioso: Logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  child: (): Logger => loggerSilencioso,
};

export interface EntradaDeLog {
  readonly nivel: NivelDeLog;
  readonly mensagem: string;
  readonly campos: CamposDeLog;
}

/** Logger que guarda as entradas em memória, para asserções em teste. */
export interface LoggerEmMemoria extends Logger {
  readonly entradas: readonly EntradaDeLog[];
  limpar(): void;
}

export function loggerEmMemoria(): LoggerEmMemoria {
  const entries: EntradaDeLog[] = [];
  const make = (bindings: CamposDeLog): Logger => {
    const log =
      (level: NivelDeLog) =>
      (msg: string, fields?: CamposDeLog): void => {
        entries.push({ nivel: level, mensagem: msg, campos: { ...bindings, ...fields } });
      };
    return {
      debug: log('debug'),
      info: log('info'),
      warn: log('warn'),
      error: log('error'),
      child: (more: CamposDeLog): Logger => make({ ...bindings, ...more }),
    };
  };
  return {
    ...make({}),
    entradas: entries,
    limpar(): void {
      entries.length = 0;
    },
  };
}
