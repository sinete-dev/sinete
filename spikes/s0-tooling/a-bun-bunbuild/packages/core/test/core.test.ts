import { describe, expect, test } from 'bun:test';
import { fixedClock, SineteError } from '../src/index.ts';
import * as nod from '../src/runtime.node.ts';
import * as def from '../src/runtime.ts';

describe('core', () => {
  test('fixedClock devolve sempre o mesmo instante e cópias independentes', () => {
    const c = fixedClock('2026-09-25T12:00:00Z');
    const a = c.now();
    a.setFullYear(2000);
    expect(c.now().toISOString()).toBe('2026-09-25T12:00:00.000Z');
  });
  test('SineteError carrega código tipado', () => {
    const e = new SineteError('E42', 'x');
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('E42');
  });
  test('as duas entradas de runtime têm a mesma forma', () => {
    expect(def.condition).toBe('default');
    expect(nod.condition).toBe('node');
    expect(def.randomId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(nod.randomId()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
