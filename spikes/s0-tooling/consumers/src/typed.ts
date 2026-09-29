import type { Clock } from '@sinete/core';
import { fixedClock, SineteError } from '@sinete/core';
import { condition } from '@sinete/core/runtime';
import { stamp } from '@sinete/xml';
const c: Clock = fixedClock('2026-09-25T12:00:00Z');
const cond: 'node' | 'default' = condition;
if (c === null) {
  // @ts-expect-error stamp exige Clock
  stamp('x');
}
const e = new SineteError('E1', 'm');
const code: `E${number}` = e.code;
console.log(stamp(c), cond, code);
