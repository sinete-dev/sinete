/**
 * `@sinete/core`: a base de todos os pacotes do sinete.
 *
 * Erros tipados, desfechos discriminados da SEFAZ, relógio injetável, logger estruturado, ambiente e tabela de UFs.
 * Sem dependências e sem API de runtime: roda igual em Node, Bun, Deno e no browser.
 */

export type { Ambiente, TpAmb } from './ambiente.ts';
export { AMBIENTES, ambienteOfTpAmb, isAmbiente, tpAmbOf } from './ambiente.ts';
export type { GrupoDeCaminho, TabelaDeRotulos } from './caminho.ts';
export { criarRotuloDoCaminho, normalizarCaminho } from './caminho.ts';
export type { Clock, Instant, ManualClock, TimeContext } from './clock.ts';
export { fixedClock, formatDateTimeOffset, manualClock, systemClock, timeContext } from './clock.ts';
export type {
  CoreErrorCode,
  ErrorDetails,
  OrigemOcorrencia,
  SefazErrorCode,
  SerializedError,
  SineteErrorOptions,
  ValidationIssue,
} from './errors.ts';
export {
  ConfigError,
  isSineteError,
  ProtocolError,
  paginaDoErro,
  SefazError,
  ServicoNaoOferecidoError,
  SineteError,
  TimeoutError,
  UnsupportedError,
  ValidationError,
} from './errors.ts';
export type { LogEntry, LogFields, Logger, LogLevel, MemoryLogger } from './logger.ts';
export { memoryLogger, noopLogger } from './logger.ts';
export type {
  Authorized,
  Denied,
  OutcomeHandlers,
  Pending,
  Rejected,
  RejectionHint,
  Result,
  SefazOutcome,
  SefazOutcomeStatus,
  SefazStatus,
} from './result.ts';
export {
  authorized,
  denied,
  err,
  isAuthorized,
  isCStat,
  isDenied,
  isPending,
  isRejected,
  matchOutcome,
  ok,
  pending,
  rejected,
  unwrapAuthorized,
} from './result.ts';
export type { DataSigner, DigestSigner, SignatureHash, SignContext, Signer, SignerKind } from './signer.ts';
export type { CUf, DataSource, Regiao, Uf, UfInfo, UfTableInfo } from './uf.ts';
export { isCUf, isUf, UF_TABLE, UFS, ufByCUf, ufBySigla } from './uf.ts';
export { formatarVerProc } from './verproc.ts';
