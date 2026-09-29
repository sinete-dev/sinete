/**
 * Desfechos discriminados de uma chamada à SEFAZ (princípio 7).
 *
 * Toda operação que chega a uma resposta da SEFAZ devolve um `SefazOutcome`, nunca lança por causa do `cStat`. Quem
 * decide o que é autorizado, rejeitado, denegado ou pendente é o pacote do documento (`@sinete/nfe` e afins), a partir
 * de tabelas versionadas de `cStat`; aqui fica só a forma do resultado.
 *
 * Os campos `cStat` e `xMotivo` têm os nomes e o formato lexical do leiaute (string de 3 ou 4 dígitos, `TStat` no XSD; texto oficial).
 * Na NFS-e Nacional, que responde com os códigos de erro dos Anexos I e II (`E0312`), o `cStat` da rejeição é esse
 * código.
 */

import { ProtocolError, SefazError } from './errors.ts';

/** Status oficial devolvido pela SEFAZ. */
export interface SefazStatus {
  /** Código de status, 3 ou 4 dígitos como no XML (`'100'`, `'539'`, `'1001'`), ou o código de erro da NFS-e Nacional (`'E0312'`). */
  readonly cStat: string;
  /** Mensagem oficial da SEFAZ, sem tradução nem ajuste. */
  readonly xMotivo: string;
}

/** Diagnóstico de uma rejeição, preenchido pelo `@sinete/rejeicoes` quando o `cStat` está no catálogo. */
export interface RejectionHint {
  readonly probableCause: string;
  readonly suggestedFix: string;
  /** Origem da regra: item do MOC, NT ou regra de validação (ex.: `MOC 7.0, RV G02-10`). */
  readonly source: string;
}

/** Documento ou evento autorizado; `value` traz o protocolo e o que mais o pacote do documento devolver. */
export interface Authorized<T> extends SefazStatus {
  readonly status: 'authorized';
  readonly value: T;
}

/** Recusado pela SEFAZ; o documento não existe para o fisco e pode ser corrigido e reenviado. */
export interface Rejected extends SefazStatus {
  readonly status: 'rejected';
  readonly hint?: RejectionHint;
}

/**
 * Uso denegado (irregularidade do emitente ou do destinatário). Diferente da rejeição, a denegação é registrada na
 * SEFAZ e o número fica consumido; `value` traz o protocolo de denegação.
 */
export interface Denied<T> extends SefazStatus {
  readonly status: 'denied';
  readonly value: T;
}

/** A SEFAZ recebeu e ainda não processou (lote em processamento, recibo a consultar). */
export interface Pending extends SefazStatus {
  readonly status: 'pending';
  /** Referência para consultar depois (número do recibo, protocolo de lote). */
  readonly ref?: string;
  /** Espera mínima sugerida antes de consultar de novo, em milissegundos. */
  readonly retryAfterMs?: number;
}

/** Desfecho de uma chamada à SEFAZ. `D` é o tipo do valor na denegação, por padrão o mesmo da autorização. */
export type SefazOutcome<T, D = T> = Authorized<T> | Rejected | Denied<D> | Pending;

export type SefazOutcomeStatus = SefazOutcome<unknown>['status'];

const CSTAT = /^(?:\d{3,4}|E\d{4})$/;

/**
 * Confere o formato lexical do `cStat`: 3 ou 4 dígitos, como o `TStat` do XSD, ou `E` e 4 dígitos, o código de erro
 * da NFS-e Nacional (Anexo I e Anexo II do leiaute, coluna "CÓD. ERRO").
 */
export function isCStat(value: unknown): value is string {
  return typeof value === 'string' && CSTAT.test(value);
}

function checkStatus(s: SefazStatus): void {
  if (!isCStat(s.cStat)) {
    throw new ProtocolError(`cStat inválido: ${JSON.stringify(s.cStat)}`, { details: { cStat: s.cStat } });
  }
}

export function authorized<T>(status: SefazStatus, value: T): Authorized<T> {
  checkStatus(status);
  return { status: 'authorized', cStat: status.cStat, xMotivo: status.xMotivo, value };
}

export function rejected(status: SefazStatus, hint?: RejectionHint): Rejected {
  checkStatus(status);
  return hint === undefined
    ? { status: 'rejected', cStat: status.cStat, xMotivo: status.xMotivo }
    : { status: 'rejected', cStat: status.cStat, xMotivo: status.xMotivo, hint };
}

export function denied<D>(status: SefazStatus, value: D): Denied<D> {
  checkStatus(status);
  return { status: 'denied', cStat: status.cStat, xMotivo: status.xMotivo, value };
}

export function pending(status: SefazStatus, options: { ref?: string; retryAfterMs?: number } = {}): Pending {
  checkStatus(status);
  return {
    status: 'pending',
    cStat: status.cStat,
    xMotivo: status.xMotivo,
    ...(options.ref === undefined ? {} : { ref: options.ref }),
    ...(options.retryAfterMs === undefined ? {} : { retryAfterMs: options.retryAfterMs }),
  };
}

export function isAuthorized<T, D>(o: SefazOutcome<T, D>): o is Authorized<T> {
  return o.status === 'authorized';
}

export function isRejected<T, D>(o: SefazOutcome<T, D>): o is Rejected {
  return o.status === 'rejected';
}

export function isDenied<T, D>(o: SefazOutcome<T, D>): o is Denied<D> {
  return o.status === 'denied';
}

export function isPending<T, D>(o: SefazOutcome<T, D>): o is Pending {
  return o.status === 'pending';
}

/** Tratadores exaustivos: o compilador exige os quatro desfechos. */
export interface OutcomeHandlers<T, D, R> {
  authorized(o: Authorized<T>): R;
  rejected(o: Rejected): R;
  denied(o: Denied<D>): R;
  pending(o: Pending): R;
}

export function matchOutcome<T, D, R>(o: SefazOutcome<T, D>, handlers: OutcomeHandlers<T, D, R>): R {
  switch (o.status) {
    case 'authorized':
      return handlers.authorized(o);
    case 'rejected':
      return handlers.rejected(o);
    case 'denied':
      return handlers.denied(o);
    case 'pending':
      return handlers.pending(o);
  }
}

/** Devolve o valor autorizado ou lança `SefazError` com o código do desfecho e o `cStat` oficial. */
export function unwrapAuthorized<T, D>(o: SefazOutcome<T, D>): T {
  switch (o.status) {
    case 'authorized':
      return o.value;
    case 'rejected':
      return throwSefaz('sefaz_rejeitou', o);
    case 'denied':
      return throwSefaz('sefaz_denegou', o);
    case 'pending':
      return throwSefaz('sefaz_pendente', o);
  }
}

function throwSefaz(code: 'sefaz_rejeitou' | 'sefaz_denegou' | 'sefaz_pendente', o: SefazOutcome<unknown>): never {
  throw new SefazError(code, o.cStat, o.xMotivo, { details: { status: o.status } });
}

/** Resultado genérico para operações locais que podem falhar sem exceção (parse tolerante, validação). */
export type Result<T, E = Error> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}
