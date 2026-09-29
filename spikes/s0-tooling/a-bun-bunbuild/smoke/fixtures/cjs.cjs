const { fixedClock, SineteError } = require('@sinete/core');
const { condition } = require('@sinete/core/runtime');
const { element, stamp } = require('@sinete/xml');
let err;
try { element('1bad', 'x'); } catch (e) { err = e; }
console.log(JSON.stringify({ rt: typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`, mode: 'require', condition, stamp: stamp(fixedClock('2026-09-25T12:00:00Z')), instanceofOk: err instanceof SineteError }));
