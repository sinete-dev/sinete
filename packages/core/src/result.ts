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

import { ErroRespostaInvalida, ErroSefaz } from './errors.ts';

/** Status oficial devolvido pela SEFAZ. */
export interface StatusSefaz {
  /** Código de status, 3 ou 4 dígitos como no XML (`'100'`, `'539'`, `'1001'`), ou o código de erro da NFS-e Nacional (`'E0312'`). */
  readonly cStat: string;
  /** Mensagem oficial da SEFAZ, sem tradução nem ajuste. */
  readonly xMotivo: string;
}

/** Diagnóstico de uma rejeição, preenchido pelo `@sinete/rejeicoes` quando o `cStat` está no catálogo. */
export interface DicaRejeicao {
  readonly causaProvavel: string;
  readonly comoCorrigir: string;
  /** Origem da regra: item do MOC, NT ou regra de validação (ex.: `MOC 7.0, RV G02-10`). */
  readonly fonte: string;
}

/** Documento ou evento autorizado; `value` traz o protocolo e o que mais o pacote do documento devolver. */
export interface Autorizado<T> extends StatusSefaz {
  readonly tipo: 'autorizado';
  readonly valor: T;
}

/** Recusado pela SEFAZ; o documento não existe para o fisco e pode ser corrigido e reenviado. */
export interface Recusado extends StatusSefaz {
  readonly tipo: 'recusado';
  readonly dica?: DicaRejeicao;
}

/**
 * Uso denegado (irregularidade do emitente ou do destinatário). Diferente da rejeição, a denegação é registrada na
 * SEFAZ e o número fica consumido; `value` traz o protocolo de denegação.
 */
export interface Denegado<T> extends StatusSefaz {
  readonly tipo: 'denegado';
  readonly valor: T;
}

/** A SEFAZ recebeu e ainda não processou (lote em processamento, recibo a consultar). */
export interface Pendente extends StatusSefaz {
  readonly tipo: 'pendente';
  /** Referência para consultar depois (número do recibo, protocolo de lote). */
  readonly referencia?: string;
  /** Espera mínima sugerida antes de consultar de novo, em milissegundos. */
  readonly aguardarMs?: number;
}

/** Desfecho de uma chamada à SEFAZ. `D` é o tipo do valor na denegação, por padrão o mesmo da autorização. */
export type ResultadoSefaz<T, D = T> = Autorizado<T> | Recusado | Denegado<D> | Pendente;

export type TipoResultadoSefaz = ResultadoSefaz<unknown>['tipo'];

const CSTAT = /^(?:\d{3,4}|E\d{4})$/;

/**
 * Confere o formato lexical do `cStat`: 3 ou 4 dígitos, como o `TStat` do XSD, ou `E` e 4 dígitos, o código de erro
 * da NFS-e Nacional (Anexo I e Anexo II do leiaute, coluna "CÓD. ERRO").
 */
export function ehCStat(value: unknown): value is string {
  return typeof value === 'string' && CSTAT.test(value);
}

function checkStatus(s: StatusSefaz): void {
  if (!ehCStat(s.cStat)) {
    throw new ErroRespostaInvalida(`cStat inválido: ${JSON.stringify(s.cStat)}`, { detalhes: { cStat: s.cStat } });
  }
}

export function criarAutorizado<T>(status: StatusSefaz, value: T): Autorizado<T> {
  checkStatus(status);
  return { tipo: 'autorizado', cStat: status.cStat, xMotivo: status.xMotivo, valor: value };
}

export function criarRecusado(status: StatusSefaz, hint?: DicaRejeicao): Recusado {
  checkStatus(status);
  return hint === undefined
    ? { tipo: 'recusado', cStat: status.cStat, xMotivo: status.xMotivo }
    : { tipo: 'recusado', cStat: status.cStat, xMotivo: status.xMotivo, dica: hint };
}

export function criarDenegado<D>(status: StatusSefaz, value: D): Denegado<D> {
  checkStatus(status);
  return { tipo: 'denegado', cStat: status.cStat, xMotivo: status.xMotivo, valor: value };
}

export function criarPendente(
  status: StatusSefaz,
  options: { referencia?: string; aguardarMs?: number } = {},
): Pendente {
  checkStatus(status);
  return {
    tipo: 'pendente',
    cStat: status.cStat,
    xMotivo: status.xMotivo,
    ...(options.referencia === undefined ? {} : { referencia: options.referencia }),
    ...(options.aguardarMs === undefined ? {} : { aguardarMs: options.aguardarMs }),
  };
}

export function autorizado<T, D>(o: ResultadoSefaz<T, D>): o is Autorizado<T> {
  return o.tipo === 'autorizado';
}

export function recusado<T, D>(o: ResultadoSefaz<T, D>): o is Recusado {
  return o.tipo === 'recusado';
}

export function denegado<T, D>(o: ResultadoSefaz<T, D>): o is Denegado<D> {
  return o.tipo === 'denegado';
}

export function pendente<T, D>(o: ResultadoSefaz<T, D>): o is Pendente {
  return o.tipo === 'pendente';
}

/** Tratadores exaustivos: o compilador exige os quatro desfechos. */
export interface TratadoresDeResultado<T, D, R> {
  autorizado(o: Autorizado<T>): R;
  recusado(o: Recusado): R;
  denegado(o: Denegado<D>): R;
  pendente(o: Pendente): R;
}

export function tratarResultado<T, D, R>(o: ResultadoSefaz<T, D>, handlers: TratadoresDeResultado<T, D, R>): R {
  switch (o.tipo) {
    case 'autorizado':
      return handlers.autorizado(o);
    case 'recusado':
      return handlers.recusado(o);
    case 'denegado':
      return handlers.denegado(o);
    case 'pendente':
      return handlers.pendente(o);
  }
}

/** Devolve o valor autorizado ou lança `SefazError` com o código do desfecho e o `cStat` oficial. */
export function exigirAutorizado<T, D>(o: ResultadoSefaz<T, D>): T {
  switch (o.tipo) {
    case 'autorizado':
      return o.valor;
    case 'recusado':
      return throwSefaz('sefaz_rejeitou', o);
    case 'denegado':
      return throwSefaz('sefaz_denegou', o);
    case 'pendente':
      return throwSefaz('sefaz_pendente', o);
  }
}

function throwSefaz(code: 'sefaz_rejeitou' | 'sefaz_denegou' | 'sefaz_pendente', o: ResultadoSefaz<unknown>): never {
  throw new ErroSefaz(code, o.cStat, o.xMotivo, { detalhes: { status: o.tipo } });
}

/** Resultado genérico para operações locais que podem falhar sem exceção (parse tolerante, validação). */
export type Resultado<T, E = Error> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erro: E };

export function ok<T>(value: T): { readonly ok: true; readonly valor: T } {
  return { ok: true, valor: value };
}

export function falha<E>(error: E): { readonly ok: false; readonly erro: E } {
  return { ok: false, erro: error };
}
