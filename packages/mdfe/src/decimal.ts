/**
 * Decimal exato para os valores do MDF-e (`vCarga`, `qCarga`, componentes e parcelas do pagamento, vale-pedágio). Um
 * valor é `coef × 10^-scale` com `coef` em `bigint`: soma e comparação são exatas. O MDF-e não calcula tributo, então
 * não há arredondamento: um valor com mais casas do que o campo aceita é recusado, nunca arredondado em silêncio.
 */

import { ErroDeConfiguracao } from '@sinete/core';

/** O que as APIs de entrada aceitam como número. Prefira `string` (`'12.34'`): `number` perde dígitos acima de 15 algarismos. */
export type DecimalInput = string | number | bigint | Decimal;

const DECIMAL_TEXT = /^([+-])?(\d+)(?:\.(\d*))?$|^([+-])?\.(\d+)$/;
const MAX_SCALE = 32;

const pow10 = (n: number): bigint => 10n ** BigInt(n);

/** Valor decimal imutável: `coef × 10^-scale`. */
export class Decimal {
  readonly coef: bigint;
  readonly scale: number;

  private constructor(coef: bigint, scale: number) {
    this.coef = coef;
    this.scale = scale;
  }

  static readonly ZERO: Decimal = new Decimal(0n, 0);

  /** Converte a entrada; texto com ponto decimal, sem milhar nem vírgula (a forma do XML). */
  static of(input: DecimalInput): Decimal {
    const d = Decimal.tryOf(input);
    if (d === undefined) throw new ErroDeConfiguracao(`número decimal inválido: ${JSON.stringify(String(input))}`);
    return d;
  }

  /** Como `of`, mas devolve `undefined` em vez de lançar. */
  static tryOf(input: DecimalInput): Decimal | undefined {
    if (input instanceof Decimal) return input;
    if (typeof input === 'bigint') return new Decimal(input, 0);
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) return undefined;
      // String(n) é a representação mais curta que volta ao mesmo double; expoente só aparece fora de 1e-7 a 1e21.
      const s = String(input);
      return /e/i.test(s) ? undefined : Decimal.tryOf(s);
    }
    if (typeof input !== 'string') return undefined;
    const m = DECIMAL_TEXT.exec(input);
    if (!m) return undefined;
    const sign = (m[1] ?? m[4]) === '-' ? -1n : 1n;
    const frac = m[3] ?? m[5] ?? '';
    if (frac.length > MAX_SCALE) return undefined;
    return new Decimal(BigInt(`${m[2] ?? ''}${frac}` || '0') * sign, frac.length);
  }

  private aligned(other: Decimal): [bigint, bigint, number] {
    if (this.scale === other.scale) return [this.coef, other.coef, this.scale];
    if (this.scale > other.scale) return [this.coef, other.coef * pow10(this.scale - other.scale), this.scale];
    return [this.coef * pow10(other.scale - this.scale), other.coef, other.scale];
  }

  plus(other: DecimalInput): Decimal {
    const [a, b, s] = this.aligned(Decimal.of(other));
    return new Decimal(a + b, s);
  }

  minus(other: DecimalInput): Decimal {
    const [a, b, s] = this.aligned(Decimal.of(other));
    return new Decimal(a - b, s);
  }

  abs(): Decimal {
    return this.coef < 0n ? new Decimal(-this.coef, this.scale) : this;
  }

  compare(other: DecimalInput): -1 | 0 | 1 {
    const [a, b] = this.aligned(Decimal.of(other));
    return a < b ? -1 : a > b ? 1 : 0;
  }

  eq(other: DecimalInput): boolean {
    return this.compare(other) === 0;
  }

  gt(other: DecimalInput): boolean {
    return this.compare(other) > 0;
  }

  isZero(): boolean {
    return this.coef === 0n;
  }

  isNegative(): boolean {
    return this.coef < 0n;
  }

  /** Casas decimais sem os zeros à direita. */
  significantScale(): number {
    if (this.coef === 0n) return 0;
    let c = this.coef;
    let s = this.scale;
    while (s > 0 && c % 10n === 0n) {
      c /= 10n;
      s--;
    }
    return s;
  }

  /** Dígitos da parte inteira (0 para valores abaixo de 1). */
  intDigits(): number {
    const int = (this.coef < 0n ? -this.coef : this.coef) / pow10(this.scale);
    return int === 0n ? 0 : int.toString().length;
  }

  /** Texto com exatamente `scale` casas; só completa com zeros (valor com mais casas é `ConfigError`). */
  toFixed(scale: number): string {
    if (this.significantScale() > scale) throw new ErroDeConfiguracao(`${this.toString()} tem mais de ${scale} casas`);
    const coef = scale >= this.scale ? this.coef * pow10(scale - this.scale) : this.coef / pow10(this.scale - scale);
    const neg = coef < 0n;
    const digits = (neg ? -coef : coef).toString().padStart(scale + 1, '0');
    const int = digits.slice(0, digits.length - scale);
    return `${neg ? '-' : ''}${int}${scale > 0 ? `.${digits.slice(digits.length - scale)}` : ''}`;
  }

  /** Forma mínima, sem zeros à direita. */
  toString(): string {
    return this.toFixed(this.significantScale());
  }

  toJSON(): string {
    return this.toString();
  }
}

/** Atalho para `Decimal.of`. */
export function dec(input: DecimalInput): Decimal {
  return Decimal.of(input);
}

/** Soma uma lista (vazia = zero). */
export function sum(values: Iterable<Decimal>): Decimal {
  let acc = Decimal.ZERO;
  for (const v of values) acc = acc.plus(v);
  return acc;
}

/** Formato de um campo decimal do leiaute: dígitos inteiros e casas (ADR 0002: as casas vêm do pattern do XSD). */
export interface DecimalFormat {
  readonly name: string;
  readonly intDigits: number;
  /** Casas fixas na saída. */
  readonly casas: number;
  /** O pattern recusa zero (`TDec_1302Opc`). */
  readonly nonZero?: boolean;
}

/** `TDec_1302`: 13 inteiros e 2 casas. */
export const D1302: DecimalFormat = { name: 'TDec_1302', intDigits: 13, casas: 2 };
/** `TDec_1302Opc`: como `TDec_1302`, sem zero. */
export const D1302_OPC: DecimalFormat = { name: 'TDec_1302Opc', intDigits: 13, casas: 2, nonZero: true };
/** `TDec_1104`: 11 inteiros e 4 casas. */
export const D1104: DecimalFormat = { name: 'TDec_1104', intDigits: 11, casas: 4 };

/** Por que o valor não cabe no formato, ou `undefined` se cabe sem perder dígitos. */
export function formatProblem(value: Decimal, format: DecimalFormat): string | undefined {
  if (value.isNegative()) return 'valor negativo';
  if (format.nonZero && value.isZero()) return 'valor zero não é aceito neste campo';
  if (value.significantScale() > format.casas) return `mais de ${format.casas} casas decimais`;
  if (value.intDigits() > format.intDigits) return `mais de ${format.intDigits} dígitos inteiros`;
  return undefined;
}

/**
 * Texto do valor no formato. O pattern de `TDec_1302` e `TDec_1104` aceita `0` e o inteiro sem casas, mas as casas
 * fixas são sempre aceitas e são a forma que os autorizadores devolvem; zero sai como `0.00`/`0.0000`.
 */
export function formatDecimal(value: Decimal, format: DecimalFormat): string {
  return value.toFixed(format.casas);
}
