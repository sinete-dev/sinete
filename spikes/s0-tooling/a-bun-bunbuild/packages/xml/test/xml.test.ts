import { expect, test } from 'bun:test';
import { fixedClock, SineteError } from '@sinete/core';
import { element, escapeXml, stamp } from '../src/index.ts';

test('escapa os cinco caracteres reservados', () => {
  expect(escapeXml(`<a & "b" 'c'>`)).toBe('&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;');
});
test('nome inválido vira SineteError E100', () => {
  expect(() => element('1x', 'a')).toThrow(SineteError);
});
test('stamp usa o relógio injetado', () => {
  expect(stamp(fixedClock('2026-09-25T12:00:00Z'))).toBe('<dhEmi>2026-09-25T12:00:00.000Z</dhEmi>');
});
