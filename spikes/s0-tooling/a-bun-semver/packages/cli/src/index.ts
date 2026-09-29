#!/usr/bin/env node
import { fixedClock, VERSION } from '@sinete/core';
import { condition, randomId } from '@sinete/core/runtime';
import { element, stamp } from '@sinete/xml';

const args = process.argv.slice(2);
const clock = fixedClock('2026-09-25T12:00:00.000Z');
if (args[0] === 'doctor') {
  console.log(JSON.stringify({ core: VERSION, condition, id: randomId().length, xml: stamp(clock), el: element('x', 'a&b') }));
} else {
  console.log('uso: sinete doctor');
}
