/** Classificação das ocorrências do `buildDps` (ADR 0011). */
import { expect, test } from 'bun:test';
import { contextoDeTempo, relogioManual } from '@sinete/core';
import { buildDps } from '../src/index.ts';
import { dps, EMISSAO } from './helpers.ts';

const opcoes = { ambiente: 'homologacao', time: contextoDeTempo({ emissao: relogioManual(EMISSAO) }) } as const;

test('dado da entrada é entrada', () => {
  const r = buildDps(dps({ serie: 'X', nDPS: '0' }), opcoes);
  if (r.ok) throw new Error('esperava ocorrências');
  expect(r.issues.length).toBeGreaterThan(1);
  expect(r.issues.every((i) => i.origem === 'entrada')).toBe(true);
});

test('schema do XML montado é montagem', () => {
  const base = dps();
  const r = buildDps(dps({ servico: { ...base.servico, xDescServ: 'X'.repeat(3000) } }), opcoes);
  if (r.ok) throw new Error('esperava ocorrências');
  expect(r.issues.length).toBeGreaterThan(0);
  expect(r.issues.every((i) => i.code === 'schema' && i.origem === 'montagem')).toBe(true);
});
