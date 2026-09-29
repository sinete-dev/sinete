import { fixedClock, SineteError } from '@sinete/core';
import { condition, randomId } from '@sinete/core/runtime';
import { element, stamp } from '@sinete/xml';
let instanceofOk = false;
try { element('1bad', 'x'); } catch (e) { instanceofOk = e instanceof SineteError; }
globalThis.__result = { rt: navigator.userAgent, condition, id: randomId().length, stamp: stamp(fixedClock('2026-09-25T12:00:00Z')), instanceofOk };
