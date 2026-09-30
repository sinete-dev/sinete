import { describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao } from '@sinete/core';
import type { RatesDataError, RatesTable } from '../../src/aliquotas/index.ts';
import {
  isSimulated,
  officialRates,
  RATE_TRIBUTOS,
  RATES_SCHEMA_VERSION,
  RATES_TABLE,
  RateUnknownError,
  requireRate,
  withOverrides,
} from '../../src/aliquotas/index.ts';

const official = officialRates();
const place = { uf: 'RS', cMun: '4314902' };

function clone(t: RatesTable): RatesTable {
  return JSON.parse(JSON.stringify(t)) as RatesTable;
}

describe('tabela oficial', () => {
  test('formato e fontes', () => {
    expect(RATES_TABLE.schemaVersion).toBe(RATES_SCHEMA_VERSION);
    expect(RATE_TRIBUTOS).toEqual(['CBS', 'IBSUF', 'IBSMun']);
    const ids = new Set(RATES_TABLE.sources.map((s) => s.id));
    for (const r of RATES_TABLE.reference) for (const s of r.sources) expect(ids.has(s)).toBe(true);
    expect(official.id).toBe(`oficial ${RATES_TABLE.dataVersion}`);
  });

  test('2026: alíquotas de teste (LC 214/2025, arts. 343 e 346)', () => {
    const r = official.nominal('2026-06-15', place);
    expect([r.CBS.value, r.IBSUF.value, r.IBSMun.value]).toEqual(['0.9', '0.1', '0']);
    expect(r.CBS).toMatchObject({ status: 'official', legal: 'LC 214/2025, art. 346' });
    expect(isSimulated(r)).toBe(false);
    expect(official.reference('2026-12-31').CBS.value).toBe('0.9');
  });

  test('2027 e 2028: IBS 0,05% + 0,05% oficial (art. 344), CBS desconhecida até a resolução do Senado', () => {
    const r = official.nominal('2027-01-01', place);
    expect(r.IBSUF).toMatchObject({ status: 'official', value: '0.05' });
    expect(r.IBSMun).toMatchObject({ status: 'official', value: '0.05' });
    expect(r.CBS).toMatchObject({ status: 'unknown', value: null });
    expect(r.CBS.note).toMatch(/Senado/);
    expect(isSimulated(r)).toBe(true);
    expect(() => requireRate(r.CBS, '2027-01-01')).toThrow(RateUnknownError);
    expect(requireRate(r.IBSUF, '2027-01-01')).toBe('0.05');
  });

  test('2029 em diante: tudo desconhecido; antes de 2026 não há IBS/CBS', () => {
    const r = official.nominal('2031-05-05');
    for (const t of RATE_TRIBUTOS) expect(r[t].status).toBe('unknown');
    const before = official.reference('2025-12-31');
    expect(before.CBS.status).toBe('unknown');
    expect(before.CBS.note).toMatch(/antes de 2026/);
  });

  test('RateUnknownError é tipado e explica como simular', () => {
    try {
      requireRate(official.nominal('2027-03-01').CBS, '2027-03-01');
      throw new Error('não lançou');
    } catch (e) {
      const err = e as RateUnknownError;
      expect(err).toBeInstanceOf(RateUnknownError);
      expect(err.code).toBe('ibscbs_aliquota_desconhecida');
      expect(err.tributo).toBe('CBS');
      expect(err.date).toBe('2027-03-01');
      expect(err.message).toMatch(/withOverrides/);
    }
  });

  test('data inválida é ConfigError', () => {
    expect(() => official.nominal('2026-1-1')).toThrow(ErroDeConfiguracao);
    expect(() => official.reference(20260101 as unknown as string)).toThrow(ErroDeConfiguracao);
  });

  test('alíquota própria do ente prevalece sobre a de referência (art. 14)', () => {
    const t = clone(RATES_TABLE);
    (t.standard as unknown[]).push(
      {
        tributo: 'IBSUF',
        ente: 'RS',
        validity: { from: '2029-01-01', to: null },
        rate: '17.5',
        legal: 'Lei RS',
        sources: ['lc214-2025'],
      },
      {
        tributo: 'IBSMun',
        ente: '4314902',
        validity: { from: '2029-01-01', to: null },
        rate: '2.5',
        legal: 'Lei municipal',
        sources: ['lc214-2025'],
      },
    );
    const p = officialRates(t);
    const r = p.nominal('2029-06-01', place);
    expect(r.IBSUF).toMatchObject({ status: 'official', value: '17.5', legal: 'Lei RS' });
    expect(r.IBSMun.value).toBe('2.5');
    expect(r.CBS.status).toBe('unknown');
    expect(p.nominal('2029-06-01', { uf: 'SP', cMun: '3550308' }).IBSUF.status).toBe('unknown');
    expect(p.nominal('2029-06-01').IBSUF.status).toBe('unknown');
  });
});

describe('validação da tabela', () => {
  const broken = (mut: (t: RatesTable & Record<string, unknown>) => void): RatesDataError => {
    const t = clone(RATES_TABLE) as RatesTable & Record<string, unknown>;
    mut(t);
    try {
      officialRates(t);
    } catch (e) {
      return e as RatesDataError;
    }
    throw new Error('não lançou');
  };

  test('recusa tabela inconsistente', () => {
    expect(broken((t) => Object.assign(t, { schemaVersion: 2 })).code).toBe('ibscbs_aliquotas_invalidas');
    expect(broken((t) => Object.assign(t.reference[0] as object, { rate: '1,5' })).message).toMatch(/formato/);
    expect(broken((t) => Object.assign(t.reference[0] as object, { rate: '150' })).message).toMatch(/formato/);
    expect(broken((t) => Object.assign(t.reference[3] as object, { rate: '1' })).message).toMatch(
      /desconhecida com valor/,
    );
    expect(broken((t) => Object.assign(t.reference[0] as object, { sources: ['nada'] })).message).toMatch(/fonte nada/);
    expect(
      broken((t) => Object.assign(t.reference[0] as object, { validity: { from: '2026-1-1', to: null } })).message,
    ).toMatch(/vigência inválida/);
    expect(
      broken((t) =>
        (t.reference as unknown[]).push({ ...(t.reference[0] as object), validity: { from: '2026-06-01', to: null } }),
      ).message,
    ).toMatch(/sobreposta/);
    const std = {
      tributo: 'IBSUF',
      ente: 'RS',
      validity: { from: '2029-01-01', to: null },
      rate: '17',
      legal: 'x',
      sources: ['lc214-2025'],
    };
    expect(broken((t) => (t.standard as unknown[]).push(std, std)).message).toMatch(/sobreposta/);
    expect(broken((t) => (t.standard as unknown[]).push({ ...std, rate: 'x' })).message).toMatch(/formato/);
  });
});

describe('alíquotas informadas pelo usuário', () => {
  test('sobrepõe só o que casar, marca user-provided com motivo e fonte', () => {
    const p = withOverrides(official, [
      {
        tributo: 'CBS',
        value: '8.8',
        reason: 'projeção da resolução do Senado',
        source: 'https://exemplo.invalid/estudo',
      },
    ]);
    expect(p.id).toBe(`oficial ${RATES_TABLE.dataVersion} + 1 informada(s)`);
    const r = p.nominal('2027-02-01', place);
    expect(r.CBS).toMatchObject({
      status: 'user-provided',
      value: '8.8',
      reason: 'projeção da resolução do Senado',
      sources: ['user', 'https://exemplo.invalid/estudo'],
    });
    expect(r.IBSUF.status).toBe('official');
    expect(isSimulated(r)).toBe(true);
    expect(p.reference('2027-02-01').CBS.value).toBe('8.8');
  });

  test('filtros por vigência, local e tipo de alíquota', () => {
    const p = withOverrides(official, [
      {
        tributo: 'IBSUF',
        value: '17',
        reason: 'lei RS',
        place: { uf: 'RS' },
        validity: { from: '2029-01-01', to: null },
        applies: 'nominal',
      },
      { tributo: 'IBSMun', value: '3', reason: 'lei municipal', place: { cMun: '4314902' } },
      { tributo: 'CBS', value: '9', reason: 'referência', applies: 'reference' },
    ]);
    expect(p.nominal('2029-02-01', place).IBSUF).toMatchObject({
      value: '17',
      validity: { from: '2029-01-01', to: null },
    });
    expect(p.nominal('2028-02-01', place).IBSUF.value).toBe('0.05');
    expect(p.nominal('2029-02-01', { uf: 'SC', cMun: '4205407' }).IBSUF.status).toBe('unknown');
    expect(p.nominal('2029-02-01').IBSUF.status).toBe('unknown');
    expect(p.reference('2029-02-01').IBSUF.status).toBe('unknown');
    expect(p.nominal('2029-02-01', place).IBSMun.value).toBe('3');
    expect(p.nominal('2029-02-01', place).CBS.status).toBe('unknown');
    expect(p.reference('2029-02-01').CBS.value).toBe('9');
  });

  test('sobreposição inválida é ConfigError', () => {
    const bad = (o: object) => () => withOverrides(official, [o as never]);
    expect(bad({ tributo: 'IS', value: '1', reason: 'x' })).toThrow(ErroDeConfiguracao);
    expect(bad({ tributo: 'CBS', value: '1,5', reason: 'x' })).toThrow(/alíquota inválida/);
    expect(bad({ tributo: 'CBS', value: '101', reason: 'x' })).toThrow(/alíquota inválida/);
    expect(bad({ tributo: 'CBS', value: 1, reason: 'x' })).toThrow(/alíquota inválida/);
    expect(bad({ tributo: 'CBS', value: '1', reason: '  ' })).toThrow(/motivo/);
    expect(bad({ tributo: 'CBS', value: '1', reason: 'x', validity: { from: '2027-1-1', to: null } })).toThrow(
      ErroDeConfiguracao,
    );
    expect(
      bad({ tributo: 'CBS', value: '1', reason: 'x', validity: { from: '2027-01-01', to: '2027-13-01' } }),
    ).toThrow(ErroDeConfiguracao);
  });
});
