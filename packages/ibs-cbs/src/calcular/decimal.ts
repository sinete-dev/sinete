/**
 * Decimal exato em ponto fixo sobre `BigInt`, com as regras de arredondamento da Calculadora da RFB.
 *
 * A Calculadora faz as contas em `java.math.BigDecimal`: soma, subtração e multiplicação no contexto `DECIMAL128` (34
 * dígitos significativos, HALF_EVEN), divisão também em `DECIMAL128`, e o resultado de cada expressão arredondado para
 * 8 casas com HALF_EVEN (`ArredondamentoUtils`, citando o art. 349, § 14, da LC 214/2025). Com as grandezas de um
 * documento fiscal (valor com até 13 dígitos inteiros, alíquotas com até 8 casas), soma e multiplicação cabem com folga
 * em 34 dígitos e aqui são exatas; a divisão arredonda para 34 dígitos significativos, como o `DECIMAL128`.
 *
 * Nunca usa `number` para valor: a entrada é texto decimal e a saída também.
 */

export type RoundingMode = 'HALF_EVEN' | 'HALF_UP' | 'DOWN';

const DECIMAL_TEXT = /^([+-])?(\d+)(?:\.(\d+))?$/;
const TEN = 10n;

function pow10(n: number): bigint {
  return TEN ** BigInt(n);
}

function abs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

/** Divide inteiros arredondando o resultado para inteiro pelo modo pedido. */
function divRound(a: bigint, b: bigint, mode: RoundingMode): bigint {
  if (b === 0n) throw new RangeError('divisão por zero');
  const negative = a < 0n !== b < 0n;
  const A = abs(a);
  const B = abs(b);
  let q = A / B;
  const r = A % B;
  if (r !== 0n && mode !== 'DOWN') {
    const twice = r * 2n;
    if (twice > B || (twice === B && (mode === 'HALF_UP' || q % 2n === 1n))) q += 1n;
  }
  return negative ? -q : q;
}

function digits(x: bigint): number {
  return abs(x).toString().length;
}

/** Valor decimal imutável: `unscaled × 10^-scale`. */
export class Decimal {
  readonly unscaled: bigint;
  readonly scale: number;

  private constructor(unscaled: bigint, scale: number) {
    this.unscaled = unscaled;
    this.scale = scale;
  }

  static readonly ZERO: Decimal = new Decimal(0n, 0);
  static readonly ONE: Decimal = new Decimal(1n, 0);
  static readonly HUNDRED: Decimal = new Decimal(100n, 0);

  static of(unscaled: bigint, scale: number): Decimal {
    if (!Number.isInteger(scale) || scale < 0) throw new RangeError(`escala inválida: ${scale}`);
    return new Decimal(unscaled, scale);
  }

  /** Lê texto decimal (`'123.45'`, `'-0.5'`, `'7'`). Recusa notação científica, vírgula e espaços. */
  static parse(text: string): Decimal {
    const m = typeof text === 'string' ? DECIMAL_TEXT.exec(text) : null;
    if (!m) throw new SyntaxError(`decimal inválido: ${JSON.stringify(text)}`);
    const frac = m[3] ?? '';
    const v = BigInt(`${m[2]}${frac}`);
    return new Decimal(m[1] === '-' ? -v : v, frac.length);
  }

  static isDecimalText(text: unknown): text is string {
    return typeof text === 'string' && DECIMAL_TEXT.test(text);
  }

  private align(other: Decimal): [bigint, bigint, number] {
    const s = Math.max(this.scale, other.scale);
    return [this.unscaled * pow10(s - this.scale), other.unscaled * pow10(s - other.scale), s];
  }

  add(other: Decimal): Decimal {
    const [a, b, s] = this.align(other);
    return new Decimal(a + b, s);
  }

  sub(other: Decimal): Decimal {
    const [a, b, s] = this.align(other);
    return new Decimal(a - b, s);
  }

  mul(other: Decimal): Decimal {
    return new Decimal(this.unscaled * other.unscaled, this.scale + other.scale);
  }

  /** Divisão com `precision` dígitos significativos (padrão 34, o `MathContext.DECIMAL128` do Java). */
  div(other: Decimal, precision = 34, mode: RoundingMode = 'HALF_EVEN'): Decimal {
    if (other.unscaled === 0n) throw new RangeError('divisão por zero');
    if (this.unscaled === 0n) return Decimal.ZERO;
    const negative = this.unscaled < 0n !== other.unscaled < 0n;
    // valor = N / D, com N e D inteiros positivos
    const preferred = Math.max(0, this.scale - other.scale);
    const N = abs(this.unscaled) * pow10(other.scale);
    const D = abs(other.unscaled) * pow10(this.scale);
    let S = Math.max(0, precision + digits(D) - digits(N) + 1);
    for (;;) {
      const scaled = N * pow10(S);
      const q = scaled / D;
      const r = scaled % D;
      const qd = digits(q);
      if (qd <= precision && r !== 0n) {
        S += precision - qd + 1;
        continue;
      }
      if (qd <= precision) {
        return new Decimal(negative ? -q : q, S).trimTo(preferred);
      }
      const drop = qd - precision;
      const base = pow10(drop);
      let qq = q / base;
      const rem = q % base;
      const half = base / 2n;
      if (mode !== 'DOWN') {
        const up = rem > half || (rem === half && (r !== 0n || mode === 'HALF_UP' || qq % 2n === 1n));
        if (up) qq += 1n;
      }
      const scale = S - drop;
      const u = negative ? -qq : qq;
      const out = scale >= 0 ? new Decimal(u, scale) : new Decimal(u * pow10(-scale), 0);
      // Quociente exato: como no Java, a escala desce até a preferida (dividendo menos divisor) sem perder dígito.
      return r === 0n && rem === 0n ? out.trimTo(preferred) : out;
    }
  }

  /** Arredonda para `precision` dígitos significativos. */
  roundSignificant(precision: number, mode: RoundingMode = 'HALF_EVEN'): Decimal {
    const d = digits(this.unscaled);
    if (d <= precision) return this;
    const newScale = this.scale - (d - precision);
    if (newScale >= 0) return this.setScale(newScale, mode);
    // Valor com mais dígitos inteiros que a precisão: não acontece com grandezas fiscais.
    throw new RangeError(`valor fora da precisão de ${precision} dígitos: ${this.toString()}`);
  }

  /** Muda a escala arredondando pelo modo pedido (`setScale` do Java). */
  setScale(scale: number, mode: RoundingMode = 'HALF_EVEN'): Decimal {
    if (!Number.isInteger(scale) || scale < 0) throw new RangeError(`escala inválida: ${scale}`);
    if (scale === this.scale) return this;
    if (scale > this.scale) return new Decimal(this.unscaled * pow10(scale - this.scale), scale);
    return new Decimal(divRound(this.unscaled, pow10(this.scale - scale), mode), scale);
  }

  /** Remove zeros à direita até a escala `min`, sem arredondar. */
  private trimTo(min: number): Decimal {
    let u = this.unscaled;
    let sc = this.scale;
    while (sc > min && u % 10n === 0n) {
      u /= 10n;
      sc--;
    }
    return new Decimal(u, sc);
  }

  /** Remove zeros à direita da parte fracionária. */
  stripZeros(): Decimal {
    return this.trimTo(0);
  }

  /** Multiplica por 10^n sem arredondar (`movePointRight`). */
  movePointRight(n: number): Decimal {
    return n <= this.scale
      ? new Decimal(this.unscaled, this.scale - n)
      : new Decimal(this.unscaled * pow10(n - this.scale), 0);
  }

  neg(): Decimal {
    return new Decimal(-this.unscaled, this.scale);
  }

  cmp(other: Decimal): -1 | 0 | 1 {
    const [a, b] = this.align(other);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  eq(other: Decimal): boolean {
    return this.cmp(other) === 0;
  }

  isZero(): boolean {
    return this.unscaled === 0n;
  }

  isNegative(): boolean {
    return this.unscaled < 0n;
  }

  /** Texto com exatamente a escala atual (`toPlainString`). */
  toString(): string {
    const neg = this.unscaled < 0n;
    const s = abs(this.unscaled)
      .toString()
      .padStart(this.scale + 1, '0');
    const body = this.scale === 0 ? s : `${s.slice(0, s.length - this.scale)}.${s.slice(s.length - this.scale)}`;
    return neg ? `-${body}` : body;
  }

  /** Texto com `places` casas, arredondado pelo modo pedido. */
  toFixed(places: number, mode: RoundingMode = 'HALF_EVEN'): string {
    return this.setScale(places, mode).toString();
  }

  toJSON(): string {
    return this.toString();
  }
}

/** Atalho para `Decimal.parse`. */
export function dec(texto: string): Decimal {
  return Decimal.parse(texto);
}

/** Soma de uma lista (zero para lista vazia). */
export function sum(valores: readonly Decimal[]): Decimal {
  return valores.reduce((a, b) => a.add(b), Decimal.ZERO);
}
