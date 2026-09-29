/**
 * Inscrição estadual das 27 UFs.
 *
 * As regras vivem em `data/ie.json` (princípio "dados como dados"): cada UF tem uma ou mais variantes de formato, com
 * tamanho, padrão, máscara e a lista de dígitos verificadores, e cada UF traz a URL do roteiro oficial de onde a
 * regra saiu. Este módulo só interpreta a tabela; nenhuma decisão aqui depende da sigla.
 *
 * Normalização (MOC 7.0, Anexo I, nota *2 das regras C17-20, E16a e afins): a SEFAZ despreza os zeros não
 * significativos antes de conferir o dígito, então uma inscrição com zeros à esquerda a menos ou a mais é aceita e
 * devolvida no tamanho da variante.
 *
 * O literal `ISENTO` (MOC 7.0, Anexo I) é reconhecido à parte: ver `IE_ISENTO` e o README para as regras de uso
 * (C17-30, E16a nota 3, E17-30, X07-20).
 */

import type { DataSource, Result, Uf, ValidationIssue } from '@sinete/core';
import { err, isUf, ok } from '@sinete/core';
import type { ParseOptions } from './cpf.ts';
import table from './data/ie.json' with { type: 'json' };
import { applyMask, charValue, issue, stripMask, throwInvalid } from './digits.ts';

/** Faixa de números em que a regra de um dígito muda (Amapá, Goiás). */
export interface IeRange {
  /** Posições `[início, fim)` cujo valor numérico é comparado com a faixa. */
  readonly slice: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly add?: number;
  readonly map?: Readonly<Record<string, number | readonly number[]>>;
}

/** Um dígito verificador. */
export interface IeCheck {
  /** Posição do dígito na inscrição normalizada. */
  readonly at: number;
  /** Posições que entram na soma; padrão: `0` a `weights.length - 1`. */
  readonly over?: readonly number[];
  readonly weights: readonly number[];
  readonly mod: number;
  /** `complement`: módulo menos o resto; `remainder`: o próprio resto. */
  readonly result: 'complement' | 'remainder';
  /** Troca o resultado pelo dígito aceito; lista aceita qualquer um deles. */
  readonly map?: Readonly<Record<string, number | readonly number[]>>;
  /** Soma os algarismos de cada produto em vez dos produtos (Minas Gerais, D1). */
  readonly digitSum?: boolean;
  /** Multiplica a soma antes do módulo (Alagoas, Rio Grande do Norte). */
  readonly times?: number;
  readonly add?: number;
  readonly ranges?: readonly IeRange[];
}

export interface IeVariant {
  readonly id: string;
  readonly length: number;
  readonly pattern: string;
  readonly mask?: string;
  readonly legacy?: boolean;
  readonly checks: readonly IeCheck[];
}

export interface IeUfRule {
  readonly sources: readonly DataSource[];
  readonly notes?: string;
  readonly variants: readonly IeVariant[];
}

export interface IeTableInfo {
  readonly schemaVersion: number;
  readonly version: string;
  readonly sources: readonly DataSource[];
}

/** Metadados da tabela de regras de IE: versão e fontes gerais. As fontes por UF estão em `ieRule(uf).sources`. */
export const IE_TABLE: IeTableInfo = {
  schemaVersion: table.schemaVersion,
  version: table.version,
  sources: table.sources,
};

const RULES = table.ufs as unknown as Readonly<Record<Uf, IeUfRule>>;

/** Regra de IE da UF (variantes, máscaras e fontes). */
export function ieRule(uf: Uf): IeUfRule {
  return RULES[uf];
}

/** Literal do leiaute para contribuinte isento de inscrição (TIe e TIeDest do schema). */
export const IE_ISENTO = 'ISENTO' as const;

/** Inscrição reconhecida. */
export type InscricaoEstadual =
  | { readonly kind: 'isento'; readonly value: typeof IE_ISENTO }
  | {
      readonly kind: 'numero';
      readonly uf: Uf;
      /** Normalizada no tamanho da variante, sem máscara (a forma do XML). */
      readonly value: string;
      readonly formatted: string;
      /** Variante que casou (`padrao`, `produtor-rural`, `9-mod11`...). */
      readonly variant: string;
      /** Formato anterior ao vigente (Rondônia antes de 08/2000, Tocantins antes de 2002, CACEPE de Pernambuco). */
      readonly legacy: boolean;
    };

export interface IeParseOptions extends ParseOptions {
  /** Aceita o literal `ISENTO` (qualquer caixa). Padrão: `true`. */
  readonly allowIsento?: boolean;
  /** Aceita formatos anteriores ao vigente (`legacy` na tabela). Padrão: `true`. */
  readonly allowLegacy?: boolean;
}

/** Verdadeiro se o texto é o literal `ISENTO`, ignorando caixa e espaços nas pontas. */
export function isIeIsento(input: string): boolean {
  return input.trim().toUpperCase() === IE_ISENTO;
}

function pick(map: Readonly<Record<string, number | readonly number[]>> | undefined, v: number): readonly number[] {
  const m = map?.[String(v)];
  if (m === undefined) return v <= 9 ? [v] : [];
  return typeof m === 'number' ? [m] : m;
}

/** Dígitos aceitos na posição `check.at` de `value` (as demais posições do cálculo já preenchidas). */
export function ieCheckDigits(value: string, check: IeCheck): readonly number[] {
  const over = check.over ?? check.weights.map((_, i) => i);
  let add = check.add ?? 0;
  let map = check.map;
  for (const r of check.ranges ?? []) {
    const n = Number(value.slice(r.slice[0], r.slice[1]));
    if (n >= r.min && n <= r.max) {
      add = r.add ?? add;
      map = r.map ?? map;
      break;
    }
  }
  let sum = add;
  for (let i = 0; i < over.length; i++) {
    const p = charValue(value[over[i] ?? 0] ?? '0') * (check.weights[i] ?? 0);
    sum += check.digitSum ? Math.floor(p / 10) + (p % 10) : p;
  }
  sum *= check.times ?? 1;
  const r = sum % check.mod;
  return pick(map, check.result === 'complement' ? check.mod - r : r);
}

function checksPass(value: string, variant: IeVariant): boolean {
  return variant.checks.every((c) => ieCheckDigits(value, c).includes(charValue(value[c.at] ?? '')));
}

/** Ajusta os zeros à esquerda ao tamanho da variante (nota *2 do Anexo I); `undefined` se não couber. */
function fit(value: string, length: number): string | undefined {
  if (!/^\d+$/.test(value)) return value.length === length ? value : undefined;
  if (value.length < length) return value.padStart(length, '0');
  const extra = value.length - length;
  return /^0*$/.test(value.slice(0, extra)) ? value.slice(extra) : undefined;
}

/**
 * Preenche os dígitos verificadores de uma inscrição, na ordem da tabela (útil para gerar massa de teste).
 * `base` tem o tamanho da variante; o que estiver nas posições dos DV é sobrescrito.
 */
export function completeIe(base: string, uf: Uf, variantId?: string): string {
  if (!isUf(uf)) throwInvalid('IE', 'ie_uf_invalida', `UF desconhecida: ${String(uf)}`);
  const variant = ieRule(uf).variants.find((v) => variantId === undefined || v.id === variantId);
  if (!variant || base.length !== variant.length) {
    throwInvalid('IE', 'ie_base_invalida', `Base fora do tamanho da variante (${uf})`);
  }
  const chars = base.split('');
  for (const c of variant.checks) chars[c.at] = String(ieCheckDigits(chars.join(''), c)[0] ?? 0);
  return chars.join('');
}

/**
 * Valida e normaliza a inscrição estadual para a UF. Aceita máscara (ponto, hífen, barra, espaço), minúsculas e zeros
 * à esquerda a mais ou a menos.
 */
export function parseIe(
  input: string,
  uf: Uf,
  options: IeParseOptions = {},
): Result<InscricaoEstadual, ValidationIssue> {
  const path = options.path ?? 'IE';
  if (!isUf(uf)) return err(issue(path, 'ie_uf_invalida', `UF desconhecida: ${String(uf)}`));
  if (isIeIsento(input)) {
    return options.allowIsento === false
      ? err(issue(path, 'ie_isento_nao_permitido', 'ISENTO não é aceito neste campo'))
      : ok({ kind: 'isento', value: IE_ISENTO });
  }
  const value = stripMask(input.trim()).toUpperCase();
  if (value === '' || !/^P?\d+$/.test(value)) {
    return err(
      issue(path, 'ie_caractere_invalido', 'Inscrição estadual só tem algarismos (ou P no produtor rural de SP)'),
    );
  }
  // Só zeros é IE ausente, não número (MOC 7.0 Anexo I, RV C17-10, rejeição 229). Sem esta trava o ajuste de zeros
  // à esquerda levaria '0' ao tamanho da UF e o DV de uma sequência de zeros é 0 em quase todas.
  if (/^P?0+$/.test(value)) return err(issue(path, 'ie_zerada', 'Inscrição estadual só com zeros'));
  const variants = ieRule(uf).variants.filter((v) => options.allowLegacy !== false || !v.legacy);
  // Tamanho exato primeiro; o ajuste de zeros só entra se nenhuma variante do mesmo tamanho servir.
  const ordered = [
    ...variants.filter((v) => v.length === value.length),
    ...variants.filter((v) => v.length !== value.length),
  ];
  let best: 'tamanho' | 'formato' | 'dv' = 'tamanho';
  for (const variant of ordered) {
    const candidate = fit(value, variant.length);
    if (candidate === undefined) continue;
    if (!new RegExp(variant.pattern).test(candidate)) {
      if (best === 'tamanho') best = 'formato';
      continue;
    }
    if (!checksPass(candidate, variant)) {
      best = 'dv';
      continue;
    }
    return ok({
      kind: 'numero',
      uf,
      value: candidate,
      formatted: variant.mask ? applyMask(candidate, variant.mask) : candidate,
      variant: variant.id,
      legacy: variant.legacy === true,
    });
  }
  const messages = {
    tamanho: ['ie_tamanho_invalido', `Tamanho da inscrição estadual inválido para ${uf}`],
    formato: ['ie_formato_invalido', `Composição da inscrição estadual inválida para ${uf}`],
    dv: ['ie_dv_invalido', `Dígito verificador da inscrição estadual não confere (${uf})`],
  } as const;
  const [code, message] = messages[best];
  return err(issue(path, code, message));
}

export function isValidIe(input: string, uf: Uf, options?: IeParseOptions): boolean {
  return parseIe(input, uf, options).ok;
}

/** Formata com a máscara da UF se a inscrição for válida; senão devolve a entrada sem mudança. */
export function formatIe(input: string, uf: Uf): string {
  const r = parseIe(input, uf);
  return r.ok ? (r.value.kind === 'isento' ? IE_ISENTO : r.value.formatted) : input;
}
