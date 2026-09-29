// Utilidades comuns do spike S7: JSON canônico, sha256, decimal em ponto fixo (BigInt) com HALF_EVEN.
import { createHash } from "node:crypto";

export const sha256 = (b: string | Uint8Array) => createHash("sha256").update(b).digest("hex");

/** JSON canônico: chaves ordenadas, 2 espaços, newline final. Mesma entrada, mesmos bytes. */
export function canonical(v: unknown): string {
  const norm = (x: any): any => {
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === "object") {
      const o: Record<string, any> = {};
      for (const k of Object.keys(x).sort()) if (x[k] !== undefined) o[k] = norm(x[k]);
      return o;
    }
    return x;
  };
  return JSON.stringify(norm(v), null, 2) + "\n";
}

/** REAL do SQLite para string decimal. Number#toString dá a menor representação que volta ao mesmo double. */
export const dec = (n: number | null | undefined): string | null =>
  n === null || n === undefined ? null : Number.isInteger(n) ? n.toFixed(1).replace(/\.0$/, "") : String(n);

// ---------- Decimal em ponto fixo, imitando java.math.BigDecimal com setScale(8, HALF_EVEN) ----------
export const SCALE = 8n;
const TEN = 10n;
const pow10 = (n: bigint) => TEN ** n;
export type D = bigint; // valor * 10^8

export function D(s: string | number): D {
  const str = typeof s === "number" ? String(s) : s.trim();
  const neg = str.startsWith("-");
  const [i, f = ""] = str.replace(/^[-+]/, "").split(".");
  const frac = (f + "0".repeat(Number(SCALE))).slice(0, Number(SCALE));
  const rest = f.slice(Number(SCALE));
  let v = BigInt(i || "0") * pow10(SCALE) + BigInt(frac || "0");
  if (rest && /[1-9]/.test(rest)) {
    // arredonda HALF_EVEN no excesso de casas
    const first = Number(rest[0]);
    const tail = /[1-9]/.test(rest.slice(1));
    if (first > 5 || (first === 5 && (tail || v % 2n === 1n))) v += 1n;
  }
  return neg ? -v : v;
}

/** divide a/b em inteiro com HALF_EVEN */
function divRound(a: bigint, b: bigint): bigint {
  const neg = (a < 0n) !== (b < 0n);
  const A = a < 0n ? -a : a, B = b < 0n ? -b : b;
  let q = A / B; const r = A % B;
  const twice = r * 2n;
  if (twice > B || (twice === B && q % 2n === 1n)) q += 1n;
  return neg ? -q : q;
}
export const add = (a: D, b: D) => a + b;
export const sub = (a: D, b: D) => a - b;
export const mul = (a: D, b: D) => divRound(a * b, pow10(SCALE)); // setScale(8, HALF_EVEN)
export const div = (a: D, b: D) => divRound(a * pow10(SCALE), b);
export const ONE = pow10(SCALE);
export const HUNDRED = 100n * pow10(SCALE);
/** arredonda para n casas (HALF_EVEN) e devolve string com n casas */
export function fmt(a: D, n: number): string {
  const q = divRound(a, pow10(SCALE - BigInt(n)));
  const neg = q < 0n; const s = (neg ? -q : q).toString().padStart(n + 1, "0");
  return (neg ? "-" : "") + (n ? s.slice(0, -n) + "." + s.slice(-n) : s);
}
export const toNum = (a: D) => Number(a) / 1e8;
