/** Relógio injetável: nenhuma função do sinete chama `new Date()` por conta própria. */
export interface Clock {
  now(): Date;
}

export function fixedClock(iso: string): Clock {
  const d = new Date(iso);
  return { now: () => new Date(d.getTime()) };
}

export type ErrorCode = `E${number}`;

export class SineteError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'SineteError';
    this.code = code;
  }
}

export const VERSION: string = '0.0.0';
