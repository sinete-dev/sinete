/**
 * Decimal exato para os valores da NF-e. Nada de `number` nas contas: um valor é `coef × 10^-scale` com `coef` em
 * `bigint`, então soma, subtração e multiplicação são exatas e só o arredondamento, feito de propósito e com o modo
 * escolhido, descarta dígitos.
 *
 * Os modos são os que os leiautes usam:
 * - `HALF_EVEN` (arredondamento bancário, NBR 5891): o que a Calculadora da RFB aplica ao IBS e à CBS (ADR 0007).
 * - `HALF_UP` (metade para longe do zero): o arredondamento comercial usual nos demais tributos. O MOC 7.0 Anexo I,
 *   nota (*4) das regras de valor, só exige duas casas e aceita tolerância de R$ 0,01, sem fixar o modo.
 * - `DOWN` (trunca em direção ao zero), para quem precisa reproduzir um sistema legado.
 *
 * Qual modo vale para qual campo é dado (`data/arredondamento.json`), não regra espalhada no código.
 */

import { ConfigError } from '@sinete/core';

export type RoundingMode = 'HALF_EVEN' | 'HALF_UP' | 'DOWN';

/** O que as APIs de entrada aceitam como número. Prefira `string` (`'12.34'`): `number` perde dígitos acima de 15 algarismos. */
export type DecimalInput = string | number | bigint | Decimal;

const DECIMAL_TEXT = /^([+-])?(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$|^([+-])?\.(\d+)(?:[eE]([+-]?\d+))?$/;
const MAX_SCALE = 64;

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

/** Valor decimal imutável: `coef × 10^-scale`. */
export class Decimal {
  /** Coeficiente inteiro (com sinal). */
  readonly coef: bigint;
  /** Casas decimais do coeficiente (0 ou mais). */
  readonly scale: number;

  private constructor(coef: bigint, scale: number) {
    this.coef = coef;
    this.scale = scale;
  }

  static readonly ZERO: Decimal = new Decimal(0n, 0);
  static readonly ONE: Decimal = new Decimal(1n, 0);
  static readonly HUNDRED: Decimal = new Decimal(100n, 0);

  /** Constrói a partir do coeficiente e da escala (`fromParts(1234n, 2)` = 12.34). */
  static fromParts(coef: bigint, scale: number): Decimal {
    if (!Number.isInteger(scale) || scale < 0 || scale > MAX_SCALE) throw new ConfigError(`escala inválida: ${scale}`);
    return new Decimal(coef, scale);
  }

  /**
   * Converte a entrada. Aceita texto com ponto decimal e expoente opcional (`'12.34'`, `'1e-3'`), `number` finito e
   * `bigint`. Vírgula, separador de milhar e espaço são recusados: o texto é a forma do XML, não a da tela.
   */
  static of(input: DecimalInput): Decimal {
    const d = Decimal.tryOf(input);
    if (d === undefined) throw new ConfigError(`número decimal inválido: ${JSON.stringify(String(input))}`);
    return d;
  }

  /** Como `of`, mas devolve `undefined` em vez de lançar. */
  static tryOf(input: DecimalInput): Decimal | undefined {
    if (input instanceof Decimal) return input;
    if (typeof input === 'bigint') return new Decimal(input, 0);
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) return undefined;
      // String(n) é a representação mais curta que volta ao mesmo double (ECMA-262 Number::toString).
      return Decimal.tryOf(String(input));
    }
    if (typeof input !== 'string') return undefined;
    const m = DECIMAL_TEXT.exec(input);
    if (!m) return undefined;
    const sign = (m[1] ?? m[5]) === '-' ? -1n : 1n;
    const intPart = m[2] ?? '';
    const frac = m[3] ?? m[6] ?? '';
    const exp = Number(m[4] ?? m[7] ?? '0');
    if (!Number.isSafeInteger(exp) || Math.abs(exp) > MAX_SCALE) return undefined;
    let coef = BigInt(`${intPart}${frac}` || '0') * sign;
    let scale = frac.length - exp;
    if (scale < 0) {
      coef *= pow10(-scale);
      scale = 0;
    }
    if (scale > MAX_SCALE) return undefined;
    return new Decimal(coef, scale);
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

  times(other: DecimalInput): Decimal {
    const o = Decimal.of(other);
    const scale = this.scale + o.scale;
    if (scale > MAX_SCALE) {
      // Produto de muitas casas: arredonda (HALF_EVEN) para caber, com folga muito acima de qualquer campo do leiaute.
      return new Decimal(this.coef * o.coef, scale).round(MAX_SCALE, 'HALF_EVEN');
    }
    return new Decimal(this.coef * o.coef, scale);
  }

  /** Divisão com o resultado arredondado em `scale` casas pelo modo dado. */
  dividedBy(other: DecimalInput, scale: number, mode: RoundingMode): Decimal {
    const o = Decimal.of(other);
    if (o.coef === 0n) throw new ConfigError('divisão por zero');
    // (a / 10^sa) / (b / 10^sb) = a * 10^(sb + scale + 1 - sa) / b, com uma casa de guarda para o arredondamento.
    const shift = o.scale + scale + 1 - this.scale;
    const num = shift >= 0 ? this.coef * pow10(shift) : this.coef;
    const den = shift >= 0 ? o.coef : o.coef * pow10(-shift);
    const q = num / den;
    const exact = q * den === num;
    return roundCoef(q, scale + 1, scale, mode, !exact);
  }

  /** Percentual: `this × rate / 100`, sem arredondar. */
  percent(rate: DecimalInput): Decimal {
    const product = this.times(rate);
    return new Decimal(product.coef, product.scale + 2);
  }

  negate(): Decimal {
    return new Decimal(-this.coef, this.scale);
  }

  abs(): Decimal {
    return this.coef < 0n ? this.negate() : this;
  }

  /** Arredonda para `scale` casas. Com `scale` maior que a atual, só completa com zeros. */
  round(scale: number, mode: RoundingMode): Decimal {
    if (!Number.isInteger(scale) || scale < 0) throw new ConfigError(`casas decimais inválidas: ${scale}`);
    if (scale >= this.scale) return new Decimal(this.coef * pow10(scale - this.scale), scale);
    return roundCoef(this.coef, this.scale, scale, mode, false);
  }

  compare(other: DecimalInput): -1 | 0 | 1 {
    const [a, b] = this.aligned(Decimal.of(other));
    return a < b ? -1 : a > b ? 1 : 0;
  }

  eq(other: DecimalInput): boolean {
    return this.compare(other) === 0;
  }

  lt(other: DecimalInput): boolean {
    return this.compare(other) < 0;
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

  /** Quantas casas decimais o valor precisa (sem os zeros à direita). */
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

  /** Texto com exatamente `scale` casas (arredonda pelo modo dado quando precisa). */
  toFixed(scale: number, mode: RoundingMode = 'HALF_UP'): string {
    const r = this.round(scale, mode);
    const neg = r.coef < 0n;
    const digits = (neg ? -r.coef : r.coef).toString().padStart(scale + 1, '0');
    const int = digits.slice(0, digits.length - scale);
    const frac = digits.slice(digits.length - scale);
    return `${neg ? '-' : ''}${int}${scale > 0 ? `.${frac}` : ''}`;
  }

  /** Forma mínima, sem zeros à direita (`'12.3'`, `'0'`). */
  toString(): string {
    return this.toFixed(this.significantScale());
  }

  toJSON(): string {
    return this.toString();
  }
}

/** Reduz `coef × 10^-from` para `to` casas (`to < from`). `sticky` diz se há resto não nulo além dos dígitos dados. */
function roundCoef(coef: bigint, from: number, to: number, mode: RoundingMode, sticky: boolean): Decimal {
  const div = pow10(from - to);
  const neg = coef < 0n;
  const abs = neg ? -coef : coef;
  let q = abs / div;
  const r = abs % div;
  if (mode !== 'DOWN' && (r !== 0n || sticky)) {
    const twice = r * 2n;
    const above = twice > div || (twice === div && sticky);
    const tie = twice === div && !sticky;
    if (above || (tie && (mode === 'HALF_UP' || (mode === 'HALF_EVEN' && q % 2n === 1n)))) q += 1n;
  }
  return Decimal.fromParts(neg ? -q : q, to);
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
