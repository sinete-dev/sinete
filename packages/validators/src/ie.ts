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

import type { FonteDeDados, Ocorrencia, Resultado, Uf } from '@sinete/core';
import { ehUf, falha, ok } from '@sinete/core';
import type { LerOpcoes } from './cpf.ts';
import table from './data/ie.json' with { type: 'json' };
import { applyMask, charValue, issue, stripMask, throwInvalid } from './digits.ts';

/** Faixa de números em que a regra de um dígito muda (Amapá, Goiás). */
export interface FaixaIe {
  /** Posições `[início, fim)` cujo valor numérico é comparado com a faixa. */
  readonly posicoes: readonly number[];
  readonly minimo: number;
  readonly maximo: number;
  readonly acrescimo?: number;
  readonly troca?: Readonly<Record<string, number | readonly number[]>>;
}

/** Um dígito verificador. */
export interface CalculoDvIe {
  /** Posição do dígito na inscrição normalizada. */
  readonly posicao: number;
  /** Posições que entram na soma; padrão: `0` a `weights.length - 1`. */
  readonly posicoesSomadas?: readonly number[];
  readonly pesos: readonly number[];
  readonly modulo: number;
  /** `complement`: módulo menos o resto; `remainder`: o próprio resto. */
  readonly resultado: 'complemento' | 'resto';
  /** Troca o resultado pelo dígito aceito; lista aceita qualquer um deles. */
  readonly troca?: Readonly<Record<string, number | readonly number[]>>;
  /** Soma os algarismos de cada produto em vez dos produtos (Minas Gerais, D1). */
  readonly somarAlgarismos?: boolean;
  /** Multiplica a soma antes do módulo (Alagoas, Rio Grande do Norte). */
  readonly multiplicador?: number;
  readonly acrescimo?: number;
  readonly faixas?: readonly FaixaIe[];
}

export interface VarianteIe {
  readonly id: string;
  readonly tamanho: number;
  readonly padrao: string;
  readonly mascara?: string;
  readonly legado?: boolean;
  readonly digitosVerificadores: readonly CalculoDvIe[];
}

export interface RegraIeUf {
  readonly fontes: readonly FonteDeDados[];
  readonly notas?: string;
  readonly variantes: readonly VarianteIe[];
}

export interface DescricaoTabelaIe {
  readonly versaoDoFormato: number;
  readonly versao: string;
  readonly fontes: readonly FonteDeDados[];
}

/** Metadados da tabela de regras de IE: versão e fontes gerais. As fontes por UF estão em `ieRule(uf).sources`. */
export const TABELA_IE: DescricaoTabelaIe = {
  versaoDoFormato: table.versaoDoFormato,
  versao: table.versao,
  fontes: table.fontes,
};

const RULES = table.ufs as unknown as Readonly<Record<Uf, RegraIeUf>>;

/** Regra de IE da UF (variantes, máscaras e fontes). */
export function regraIe(uf: Uf): RegraIeUf {
  return RULES[uf];
}

/** Literal do leiaute para contribuinte isento de inscrição (TIe e TIeDest do schema). */
export const IE_ISENTO = 'ISENTO' as const;

/** Inscrição reconhecida. */
export type InscricaoEstadual =
  | { readonly tipo: 'isento'; readonly valor: typeof IE_ISENTO }
  | {
      readonly tipo: 'numero';
      readonly uf: Uf;
      /** Normalizada no tamanho da variante, sem máscara (a forma do XML). */
      readonly valor: string;
      readonly formatada: string;
      /** Variante que casou (`padrao`, `produtor-rural`, `9-mod11`...). */
      readonly variante: string;
      /** Formato anterior ao vigente (Rondônia antes de 08/2000, Tocantins antes de 2002, CACEPE de Pernambuco). */
      readonly legado: boolean;
    };

export interface LerIeOpcoes extends LerOpcoes {
  /** Aceita o literal `ISENTO` (qualquer caixa). Padrão: `true`. */
  readonly aceitarIsento?: boolean;
  /** Aceita formatos anteriores ao vigente (`legacy` na tabela). Padrão: `true`. */
  readonly aceitarLegado?: boolean;
}

/** Verdadeiro se o texto é o literal `ISENTO`, ignorando caixa e espaços nas pontas. */
export function ieIsenta(input: string): boolean {
  return input.trim().toUpperCase() === IE_ISENTO;
}

function pick(map: Readonly<Record<string, number | readonly number[]>> | undefined, v: number): readonly number[] {
  const m = map?.[String(v)];
  if (m === undefined) return v <= 9 ? [v] : [];
  return typeof m === 'number' ? [m] : m;
}

/** Dígitos aceitos na posição `check.at` de `value` (as demais posições do cálculo já preenchidas). */
export function calcularDvIe(value: string, check: CalculoDvIe): readonly number[] {
  const over = check.posicoesSomadas ?? check.pesos.map((_, i) => i);
  let add = check.acrescimo ?? 0;
  let map = check.troca;
  for (const r of check.faixas ?? []) {
    const n = Number(value.slice(r.posicoes[0], r.posicoes[1]));
    if (n >= r.minimo && n <= r.maximo) {
      add = r.acrescimo ?? add;
      map = r.troca ?? map;
      break;
    }
  }
  let sum = add;
  for (let i = 0; i < over.length; i++) {
    const p = charValue(value[over[i] ?? 0] ?? '0') * (check.pesos[i] ?? 0);
    sum += check.somarAlgarismos ? Math.floor(p / 10) + (p % 10) : p;
  }
  sum *= check.multiplicador ?? 1;
  const r = sum % check.modulo;
  return pick(map, check.resultado === 'complemento' ? check.modulo - r : r);
}

function checksPass(value: string, variant: VarianteIe): boolean {
  return variant.digitosVerificadores.every((c) => calcularDvIe(value, c).includes(charValue(value[c.posicao] ?? '')));
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
export function completarIe(base: string, uf: Uf, variantId?: string): string {
  if (!ehUf(uf)) throwInvalid('IE', 'ie_uf_invalida', `UF desconhecida: ${String(uf)}`);
  const variant = regraIe(uf).variantes.find((v) => variantId === undefined || v.id === variantId);
  if (!variant || base.length !== variant.tamanho) {
    throwInvalid('IE', 'ie_base_invalida', `Base fora do tamanho da variante (${uf})`);
  }
  const chars = base.split('');
  for (const c of variant.digitosVerificadores) chars[c.posicao] = String(calcularDvIe(chars.join(''), c)[0] ?? 0);
  return chars.join('');
}

/**
 * Valida e normaliza a inscrição estadual para a UF. Aceita máscara (ponto, hífen, barra, espaço), minúsculas e zeros
 * à esquerda a mais ou a menos.
 */
export function lerIe(input: string, uf: Uf, options: LerIeOpcoes = {}): Resultado<InscricaoEstadual, Ocorrencia> {
  const path = options.caminho ?? 'IE';
  if (!ehUf(uf)) return falha(issue(path, 'ie_uf_invalida', `UF desconhecida: ${String(uf)}`));
  if (ieIsenta(input)) {
    return options.aceitarIsento === false
      ? falha(issue(path, 'ie_isento_nao_permitido', 'ISENTO não é aceito neste campo'))
      : ok({ tipo: 'isento', valor: IE_ISENTO });
  }
  const value = stripMask(input.trim()).toUpperCase();
  if (value === '' || !/^P?\d+$/.test(value)) {
    return falha(
      issue(path, 'ie_caractere_invalido', 'Inscrição estadual só tem algarismos (ou P no produtor rural de SP)'),
    );
  }
  // Só zeros é IE ausente, não número (MOC 7.0 Anexo I, RV C17-10, rejeição 229). Sem esta trava o ajuste de zeros
  // à esquerda levaria '0' ao tamanho da UF e o DV de uma sequência de zeros é 0 em quase todas.
  if (/^P?0+$/.test(value)) return falha(issue(path, 'ie_zerada', 'Inscrição estadual só com zeros'));
  const variants = regraIe(uf).variantes.filter((v) => options.aceitarLegado !== false || !v.legado);
  // Tamanho exato primeiro; o ajuste de zeros só entra se nenhuma variante do mesmo tamanho servir.
  const ordered = [
    ...variants.filter((v) => v.tamanho === value.length),
    ...variants.filter((v) => v.tamanho !== value.length),
  ];
  let best: 'tamanho' | 'formato' | 'dv' = 'tamanho';
  for (const variant of ordered) {
    const candidate = fit(value, variant.tamanho);
    if (candidate === undefined) continue;
    if (!new RegExp(variant.padrao).test(candidate)) {
      if (best === 'tamanho') best = 'formato';
      continue;
    }
    if (!checksPass(candidate, variant)) {
      best = 'dv';
      continue;
    }
    return ok({
      tipo: 'numero',
      uf,
      valor: candidate,
      formatada: variant.mascara ? applyMask(candidate, variant.mascara) : candidate,
      variante: variant.id,
      legado: variant.legado === true,
    });
  }
  const messages = {
    tamanho: ['ie_tamanho_invalido', `Tamanho da inscrição estadual inválido para ${uf}`],
    formato: ['ie_formato_invalido', `Composição da inscrição estadual inválida para ${uf}`],
    dv: ['ie_dv_invalido', `Dígito verificador da inscrição estadual não confere (${uf})`],
  } as const;
  const [code, message] = messages[best];
  return falha(issue(path, code, message));
}

export function ieValida(input: string, uf: Uf, options?: LerIeOpcoes): boolean {
  return lerIe(input, uf, options).ok;
}

/** Formata com a máscara da UF se a inscrição for válida; senão devolve a entrada sem mudança. */
export function formatarIe(input: string, uf: Uf): string {
  const r = lerIe(input, uf);
  return r.ok ? (r.valor.tipo === 'isento' ? IE_ISENTO : r.valor.formatada) : input;
}
