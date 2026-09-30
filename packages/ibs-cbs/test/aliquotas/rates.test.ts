import { describe, expect, test } from 'bun:test';
import { ErroDeConfiguracao } from '@sinete/core';
import type { ErroDadosDeAliquotas, TabelaDeAliquotas } from '../../src/aliquotas/index.ts';
import {
  aliquotasOficiais,
  comAliquotasInformadas,
  ErroAliquotaDesconhecida,
  ehSimulada,
  exigirAliquota,
  TABELA_ALIQUOTAS,
  TRIBUTOS_DAS_ALIQUOTAS,
  VERSAO_DO_FORMATO_DAS_ALIQUOTAS,
} from '../../src/aliquotas/index.ts';

const official = aliquotasOficiais();
const place = { uf: 'RS', cMun: '4314902' };

function clone(t: TabelaDeAliquotas): TabelaDeAliquotas {
  return JSON.parse(JSON.stringify(t)) as TabelaDeAliquotas;
}

describe('tabela oficial', () => {
  test('formato e fontes', () => {
    expect(TABELA_ALIQUOTAS.versaoDoFormato).toBe(VERSAO_DO_FORMATO_DAS_ALIQUOTAS);
    expect(TRIBUTOS_DAS_ALIQUOTAS).toEqual(['CBS', 'IBSUF', 'IBSMun']);
    const ids = new Set(TABELA_ALIQUOTAS.fontes.map((s) => s.id));
    for (const r of TABELA_ALIQUOTAS.referencia) for (const s of r.fontes) expect(ids.has(s)).toBe(true);
    expect(official.id).toBe(`oficial ${TABELA_ALIQUOTAS.versaoDosDados}`);
  });

  test('2026: alíquotas de teste (LC 214/2025, arts. 343 e 346)', () => {
    const r = official.nominal('2026-06-15', place);
    expect([r.CBS.valor, r.IBSUF.valor, r.IBSMun.valor]).toEqual(['0.9', '0.1', '0']);
    expect(r.CBS).toMatchObject({ situacao: 'oficial', legal: 'LC 214/2025, art. 346' });
    expect(ehSimulada(r)).toBe(false);
    expect(official.referencia('2026-12-31').CBS.valor).toBe('0.9');
  });

  test('2027 e 2028: IBS 0,05% + 0,05% oficial (art. 344), CBS desconhecida até a resolução do Senado', () => {
    const r = official.nominal('2027-01-01', place);
    expect(r.IBSUF).toMatchObject({ situacao: 'oficial', valor: '0.05' });
    expect(r.IBSMun).toMatchObject({ situacao: 'oficial', valor: '0.05' });
    expect(r.CBS).toMatchObject({ situacao: 'desconhecida', valor: null });
    expect(r.CBS.nota).toMatch(/Senado/);
    expect(ehSimulada(r)).toBe(true);
    expect(() => exigirAliquota(r.CBS, '2027-01-01')).toThrow(ErroAliquotaDesconhecida);
    expect(exigirAliquota(r.IBSUF, '2027-01-01')).toBe('0.05');
  });

  test('2029 em diante: tudo desconhecido; antes de 2026 não há IBS/CBS', () => {
    const r = official.nominal('2031-05-05');
    for (const t of TRIBUTOS_DAS_ALIQUOTAS) expect(r[t].situacao).toBe('desconhecida');
    const before = official.referencia('2025-12-31');
    expect(before.CBS.situacao).toBe('desconhecida');
    expect(before.CBS.nota).toMatch(/antes de 2026/);
  });

  test('ErroAliquotaDesconhecida é tipado e explica como simular', () => {
    try {
      exigirAliquota(official.nominal('2027-03-01').CBS, '2027-03-01');
      throw new Error('não lançou');
    } catch (e) {
      const err = e as ErroAliquotaDesconhecida;
      expect(err).toBeInstanceOf(ErroAliquotaDesconhecida);
      expect(err.code).toBe('ibscbs_aliquota_desconhecida');
      expect(err.tributo).toBe('CBS');
      expect(err.data).toBe('2027-03-01');
      expect(err.message).toMatch(/comAliquotasInformadas/);
    }
  });

  test('data inválida é ErroDeConfiguracao', () => {
    expect(() => official.nominal('2026-1-1')).toThrow(ErroDeConfiguracao);
    expect(() => official.referencia(20260101 as unknown as string)).toThrow(ErroDeConfiguracao);
  });

  test('alíquota própria do ente prevalece sobre a de referência (art. 14)', () => {
    const t = clone(TABELA_ALIQUOTAS);
    (t.padrao as unknown[]).push(
      {
        tributo: 'IBSUF',
        ente: 'RS',
        vigencia: { inicio: '2029-01-01', fim: null },
        aliquota: '17.5',
        legal: 'Lei RS',
        fontes: ['lc214-2025'],
      },
      {
        tributo: 'IBSMun',
        ente: '4314902',
        vigencia: { inicio: '2029-01-01', fim: null },
        aliquota: '2.5',
        legal: 'Lei municipal',
        fontes: ['lc214-2025'],
      },
    );
    const p = aliquotasOficiais(t);
    const r = p.nominal('2029-06-01', place);
    expect(r.IBSUF).toMatchObject({ situacao: 'oficial', valor: '17.5', legal: 'Lei RS' });
    expect(r.IBSMun.valor).toBe('2.5');
    expect(r.CBS.situacao).toBe('desconhecida');
    expect(p.nominal('2029-06-01', { uf: 'SP', cMun: '3550308' }).IBSUF.situacao).toBe('desconhecida');
    expect(p.nominal('2029-06-01').IBSUF.situacao).toBe('desconhecida');
  });
});

describe('validação da tabela', () => {
  const broken = (mut: (t: TabelaDeAliquotas & Record<string, unknown>) => void): ErroDadosDeAliquotas => {
    const t = clone(TABELA_ALIQUOTAS) as TabelaDeAliquotas & Record<string, unknown>;
    mut(t);
    try {
      aliquotasOficiais(t);
    } catch (e) {
      return e as ErroDadosDeAliquotas;
    }
    throw new Error('não lançou');
  };

  test('recusa tabela inconsistente', () => {
    expect(broken((t) => Object.assign(t, { versaoDoFormato: 3 })).code).toBe('ibscbs_aliquotas_invalidas');
    expect(broken((t) => Object.assign(t.referencia[0] as object, { aliquota: '1,5' })).message).toMatch(/formato/);
    expect(broken((t) => Object.assign(t.referencia[0] as object, { aliquota: '150' })).message).toMatch(/formato/);
    expect(broken((t) => Object.assign(t.referencia[3] as object, { aliquota: '1' })).message).toMatch(
      /desconhecida com valor/,
    );
    expect(broken((t) => Object.assign(t.referencia[0] as object, { fontes: ['nada'] })).message).toMatch(/fonte nada/);
    expect(
      broken((t) => Object.assign(t.referencia[0] as object, { vigencia: { inicio: '2026-1-1', fim: null } })).message,
    ).toMatch(/vigência inválida/);
    expect(
      broken((t) =>
        (t.referencia as unknown[]).push({
          ...(t.referencia[0] as object),
          vigencia: { inicio: '2026-06-01', fim: null },
        }),
      ).message,
    ).toMatch(/sobreposta/);
    const std = {
      tributo: 'IBSUF',
      ente: 'RS',
      vigencia: { inicio: '2029-01-01', fim: null },
      aliquota: '17',
      legal: 'x',
      fontes: ['lc214-2025'],
    };
    expect(broken((t) => (t.padrao as unknown[]).push(std, std)).message).toMatch(/sobreposta/);
    expect(broken((t) => (t.padrao as unknown[]).push({ ...std, aliquota: 'x' })).message).toMatch(/formato/);
  });
});

describe('alíquotas informadas pelo usuário', () => {
  test('sobrepõe só o que casar, marca informada com motivo e fonte', () => {
    const p = comAliquotasInformadas(official, [
      {
        tributo: 'CBS',
        valor: '8.8',
        motivo: 'projeção da resolução do Senado',
        fonte: 'https://exemplo.invalid/estudo',
      },
    ]);
    expect(p.id).toBe(`oficial ${TABELA_ALIQUOTAS.versaoDosDados} + 1 informada(s)`);
    const r = p.nominal('2027-02-01', place);
    expect(r.CBS).toMatchObject({
      situacao: 'informada',
      valor: '8.8',
      motivo: 'projeção da resolução do Senado',
      fontes: ['usuario', 'https://exemplo.invalid/estudo'],
    });
    expect(r.IBSUF.situacao).toBe('oficial');
    expect(ehSimulada(r)).toBe(true);
    expect(p.referencia('2027-02-01').CBS.valor).toBe('8.8');
  });

  test('filtros por vigência, local e tipo de alíquota', () => {
    const p = comAliquotasInformadas(official, [
      {
        tributo: 'IBSUF',
        valor: '17',
        motivo: 'lei RS',
        local: { uf: 'RS' },
        vigencia: { inicio: '2029-01-01', fim: null },
        aplicaA: 'nominal',
      },
      { tributo: 'IBSMun', valor: '3', motivo: 'lei municipal', local: { cMun: '4314902' } },
      { tributo: 'CBS', valor: '9', motivo: 'referência', aplicaA: 'referencia' },
    ]);
    expect(p.nominal('2029-02-01', place).IBSUF).toMatchObject({
      valor: '17',
      vigencia: { inicio: '2029-01-01', fim: null },
    });
    expect(p.nominal('2028-02-01', place).IBSUF.valor).toBe('0.05');
    expect(p.nominal('2029-02-01', { uf: 'SC', cMun: '4205407' }).IBSUF.situacao).toBe('desconhecida');
    expect(p.nominal('2029-02-01').IBSUF.situacao).toBe('desconhecida');
    expect(p.referencia('2029-02-01').IBSUF.situacao).toBe('desconhecida');
    expect(p.nominal('2029-02-01', place).IBSMun.valor).toBe('3');
    expect(p.nominal('2029-02-01', place).CBS.situacao).toBe('desconhecida');
    expect(p.referencia('2029-02-01').CBS.valor).toBe('9');
  });

  test('sobreposição inválida é ErroDeConfiguracao', () => {
    const bad = (o: object) => () => comAliquotasInformadas(official, [o as never]);
    expect(bad({ tributo: 'IS', valor: '1', motivo: 'x' })).toThrow(ErroDeConfiguracao);
    expect(bad({ tributo: 'CBS', valor: '1,5', motivo: 'x' })).toThrow(/alíquota inválida/);
    expect(bad({ tributo: 'CBS', valor: '101', motivo: 'x' })).toThrow(/alíquota inválida/);
    expect(bad({ tributo: 'CBS', valor: 1, motivo: 'x' })).toThrow(/alíquota inválida/);
    expect(bad({ tributo: 'CBS', valor: '1', motivo: '  ' })).toThrow(/motivo/);
    expect(bad({ tributo: 'CBS', valor: '1', motivo: 'x', vigencia: { inicio: '2027-1-1', fim: null } })).toThrow(
      ErroDeConfiguracao,
    );
    expect(
      bad({ tributo: 'CBS', valor: '1', motivo: 'x', vigencia: { inicio: '2027-01-01', fim: '2027-13-01' } }),
    ).toThrow(ErroDeConfiguracao);
  });
});
