/** Classificação das ocorrências do `montarDps` (ADR 0011). */
import { expect, test } from 'bun:test';
import { contextoDeTempo, relogioManual } from '@sinete/core';
import { montarDps } from '../src/index.ts';
import { dps, EMISSAO } from './helpers.ts';

const opcoes = { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: relogioManual(EMISSAO) }) } as const;

test('dado da entrada é entrada', async () => {
  const r = await montarDps(dps({ serie: 'X', nDPS: '0' }), opcoes);
  if (r.ok) throw new Error('esperava ocorrências');
  expect(r.ocorrencias.length).toBeGreaterThan(1);
  expect(r.ocorrencias.every((i) => i.origem === 'entrada')).toBe(true);
});

test('schema do XML montado é montagem', async () => {
  const base = dps();
  const r = await montarDps(dps({ servico: { ...base.servico, xDescServ: 'X'.repeat(3000) } }), opcoes);
  if (r.ok) throw new Error('esperava ocorrências');
  expect(r.ocorrencias.length).toBeGreaterThan(0);
  expect(r.ocorrencias.every((i) => i.code === 'schema' && i.origem === 'montagem')).toBe(true);
});
