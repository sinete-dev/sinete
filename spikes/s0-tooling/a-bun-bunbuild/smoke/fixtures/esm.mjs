import { fixedClock, SineteError, VERSION } from '@sinete/core';
import { condition, randomId } from '@sinete/core/runtime';
import { element, stamp } from '@sinete/xml';
const rt = typeof Deno !== 'undefined' ? `deno ${Deno.version.deno}` : typeof Bun !== 'undefined' ? `bun ${Bun.version}` : `node ${process.version}`;
let err;
try { element('1bad', 'x'); } catch (e) { err = e; }
console.log(JSON.stringify({ rt, mode: 'esm', VERSION, condition, id: randomId().length, stamp: stamp(fixedClock('2026-09-25T12:00:00Z')), instanceofOk: err instanceof SineteError, code: err?.code }));
