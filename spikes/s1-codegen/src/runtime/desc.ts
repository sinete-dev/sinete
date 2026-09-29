// Runtime schema descriptors. Generated modules export one const per complex type; the serializer,
// decoder and validator walk them in XSD order. Short keys keep generated code small.

/** simple type */
export interface ST {
  /** builtin base */
  b: string;
  /** patterns: outer AND (derivation steps), inner OR */
  p?: string[][];
  /** enumeration */
  e?: string[];
  /** length / minLength / maxLength */
  l?: number;
  mn?: number;
  mx?: number;
  /** totalDigits / fractionDigits */
  td?: number;
  fd?: number;
  /** min/maxInclusive (lexical) */
  mi?: string;
  ma?: string;
  /** named type (for error messages) */
  nm?: string;
}

/** element particle */
export interface E {
  e: string;
  t: CT | ST;
  /** minOccurs when != 1 */
  n?: number;
  /** maxOccurs when != 1 (-1 = unbounded) */
  x?: number;
  /** namespace when different from the owning complex type */
  ns?: string;
}

/** model group particle */
export interface G {
  g: "s" | "c";
  i: P[];
  n?: number;
  x?: number;
}

export type P = E | G;

export interface A {
  a: string;
  t: ST;
  r?: 1;
  f?: string;
}

/** complex type. T is a phantom parameter carrying the generated TS type. */
export interface CT<T = unknown> {
  id: string;
  ns: string;
  a?: A[];
  c?: P;
  /** simpleContent text type */
  tx?: ST;
  /** phantom */
  readonly __t?: T;
}

export const isCT = (t: CT | ST): t is CT => (t as CT).id !== undefined;
export const isE = (p: P): p is E => (p as E).e !== undefined;
export const minOf = (p: P) => p.n ?? 1;
export const maxOf = (p: P) => (p.x === undefined ? 1 : p.x === -1 ? Infinity : p.x);
