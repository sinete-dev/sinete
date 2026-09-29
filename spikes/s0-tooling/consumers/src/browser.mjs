import { fixedClock } from '@sinete/core';
import { condition, randomId } from '@sinete/core/runtime';
import { stamp } from '@sinete/xml';
console.log(JSON.stringify({ browserBundle: true, condition, id: randomId().length, stamp: stamp(fixedClock('2026-09-25T12:00:00Z')) }));
