// Mesma suíte com a API do vitest + node:assert: roda em Node, Bun e Deno sem dependência.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { fixedClock, SineteError } from '@sinete/core';
import { condition } from '@sinete/core/runtime';
import { element, stamp } from '@sinete/xml';

test('stamp usa o relógio injetado', () => {
  assert.equal(stamp(fixedClock('2026-09-25T12:00:00Z')), '<dhEmi>2026-09-25T12:00:00.000Z</dhEmi>');
});
test('erro tipado atravessa pacotes', () => {
  assert.throws(() => element('1x', 'a'), (e: unknown) => e instanceof SineteError && e.code === 'E100');
});
test('condição node resolvida no servidor', () => {
  assert.equal(condition, 'node');
});
test('registra a runtime real do worker', async () => {
  const g = globalThis as { Deno?: { version: { deno: string } }; Bun?: { version: string } };
  const rt = g.Deno ? `deno ${g.Deno.version.deno}` : g.Bun ? `bun ${g.Bun.version}` : `node ${process.version}`;
  const { appendFileSync } = await import('node:fs');
  appendFileSync('worker-runtime.log', `${rt}\n`);
});
