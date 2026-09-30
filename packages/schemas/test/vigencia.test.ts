import { describe, expect, test } from 'bun:test';
import type { Ambiente } from '@sinete/core';
import { ehErroSinete, relogioFixo } from '@sinete/core';
import type { FamiliaSchema } from '../src/index.ts';
import { ErroVigencia, selecionarPl, VIGENCIAS, VIGENCIAS_ATUALIZADAS_EM } from '../src/index.ts';

const at = (iso: string): ReturnType<typeof relogioFixo> => relogioFixo(iso);

describe('selecionarPl', () => {
  test('NF-e: produção e homologação têm datas próprias', () => {
    expect(selecionarPl('nfe', 'producao', at('2026-09-25T12:00:00-03:00')).modulo).toBe('nfe/PL_010e');
    expect(selecionarPl('nfe', 'homologacao', at('2026-09-25T12:00:00-03:00')).modulo).toBe('nfe/PL_010f');
    expect(selecionarPl('nfe', 'producao', at('2026-11-03T00:00:00-03:00')).modulo).toBe('nfe/PL_010f');
    expect(selecionarPl('nfe', 'producao', at('2026-11-02T23:59:59-03:00')).modulo).toBe('nfe/PL_010e');
  });

  test('o dia é o de Brasília, não o UTC', () => {
    // 02:30 UTC do dia 3 ainda é dia 2 em Brasília.
    expect(selecionarPl('nfe', 'producao', at('2026-11-03T02:30:00Z')).modulo).toBe('nfe/PL_010e');
    expect(selecionarPl('nfe', 'producao', at('2026-11-03T03:00:00Z')).modulo).toBe('nfe/PL_010f');
  });

  test('antes de toda vigência é erro tipado, nunca tentativa', () => {
    try {
      selecionarPl('nfe', 'producao', at('2026-01-01T12:00:00-03:00'));
      throw new Error('deveria lançar');
    } catch (e) {
      expect(e).toBeInstanceOf(ErroVigencia);
      expect(ehErroSinete(e, 'pl_sem_vigencia')).toBe(true);
      expect((e as ErroVigencia).message).toContain('2026-08-03');
    }
    expect(() => selecionarPl('nfe/evento-cancelamento', 'homologacao', at('2026-06-14T12:00:00-03:00'))).toThrow(
      ErroVigencia,
    );
    expect(() => selecionarPl('nada' as FamiliaSchema, 'producao', at('2026-06-14T12:00:00-03:00'))).toThrow(
      ErroVigencia,
    );
    expect(() => selecionarPl('toString' as FamiliaSchema, 'producao', at('2026-06-14T12:00:00-03:00'))).toThrow(
      ErroVigencia,
    );
    expect(() => selecionarPl('nfe', 'constructor' as Ambiente, at('2026-06-14T12:00:00-03:00'))).toThrow(ErroVigencia);
  });

  test('entrada sem data de início vale para qualquer data', () => {
    expect(selecionarPl('nfe/status-servico', 'producao', at('2020-01-01T00:00:00Z')).pl).toBe(
      'PL_009q_NT2025_001_v1.00',
    );
    expect(selecionarPl('mdfe', 'producao', at('2025-10-06T08:00:00-03:00')).modulo).toBe('mdfe/3.00b');
    expect(selecionarPl('mdfe/eventos', 'homologacao', at('2026-09-26T08:00:00-03:00')).modulo).toBe(
      'mdfe/eventos/3.00b',
    );
    expect(selecionarPl('mdfe/servicos', 'producao', at('2026-09-26T08:00:00-03:00')).modulo).toBe(
      'mdfe/servicos/3.00b',
    );
  });

  test('a tabela é dado com fonte, e todo módulo aparece nela', () => {
    expect(VIGENCIAS_ATUALIZADAS_EM).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const modulos = Object.values(VIGENCIAS).flatMap((l) => l.map((e) => e.modulo));
    expect(modulos.length).toBe(19);
    for (const list of Object.values(VIGENCIAS)) {
      for (const e of list) {
        expect(e.fonte.length).toBeGreaterThan(20);
        for (const d of [e.homologacao, e.producao]) if (d !== null) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
