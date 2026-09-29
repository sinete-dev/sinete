import { describe, expect, test } from 'bun:test';
import { authorized, isCStat, rejected } from '@sinete/core';
import { rejeicaoByCode } from '../src/index.ts';
import {
  enrichOutcomeMdfe,
  enrichRejectedMdfe,
  REJEICOES_MDFE,
  REJEICOES_MDFE_TABLE,
  rejectionHintMdfe,
  rejeicaoMdfeByCode,
} from '../src/mdfe.ts';

describe('catálogo do MDF-e', () => {
  test('formato de cada entrada', () => {
    const docs = new Set(REJEICOES_MDFE_TABLE.sources.map((s) => s.id));
    expect(docs.size).toBe(6);
    let prev = 0;
    for (const r of REJEICOES_MDFE) {
      expect(isCStat(r.code), r.code).toBe(true);
      expect(Number(r.code)).toBeGreaterThan(prev);
      prev = Number(r.code);
      expect(r.effect).toBe('rejeicao');
      expect(r.modelos).toEqual(['58']);
      expect(r.message.length, r.code).toBeGreaterThan(5);
      expect(r.message, r.code).not.toMatch(/^Rejeição/);
      expect(r.source).toMatch(/^(MOC MDF-e 3\.00b (Anexo I|Visão Geral)|MDF-e NT 202[456]\.00\d v1\.0\d)/);
      for (const rule of r.rules) expect(docs.has(rule.doc), `${r.code} ${rule.doc}`).toBe(true);
      const curated = [r.causaProvavel, r.comoCorrigir, r.referencia].filter((x) => x !== undefined).length;
      expect([0, 3], r.code).toContain(curated);
    }
    expect(REJEICOES_MDFE.length).toBeGreaterThanOrEqual(200);
  });

  test('mensagens das regras, com marcadores reconstituídos e continuação de linha', () => {
    expect(rejeicaoMdfeByCode('609')?.message).toBe(
      'MDFe já está encerrado na base de dados da SEFAZ [nProt:999999999999999][dhEnc: AAAA-MM-DDTHH:MM:SS TZD].',
    );
    expect(rejeicaoMdfeByCode('609')?.messages).toBeUndefined();
    expect(rejeicaoMdfeByCode('611')?.message).toMatch(/\[nProt:999999999999999\]$/);
    expect(rejeicaoMdfeByCode('578')?.message).toBe('Informações dos tomadores é obrigatória para esta operação');
    expect(rejeicaoMdfeByCode('731')?.message).toBe(
      'A categoria de combinação veicular deve ser preenchida para o grupo vale pedágio',
    );
    expect(rejeicaoMdfeByCode('108')?.message).toBe('Serviço Paralisado Momentaneamente (curto prazo)');
    expect(rejeicaoMdfeByCode('678')?.message).toBe('Consumo Indevido');
    expect(rejeicaoMdfeByCode('684')?.messages).toEqual([
      'CIOT obrigatório para RNTRC informado.',
      'CIOT deverá ser informado',
    ]);
    expect(rejeicaoMdfeByCode('301')?.source).toBe('MDF-e NT 2025.001 v1.03, regra F55a');
  });

  test('os códigos colidem com os da NF-e com outro significado', () => {
    expect(rejeicaoMdfeByCode('611')?.message).not.toBe(rejeicaoByCode('611')?.message);
    expect(rejeicaoMdfeByCode('220')?.message).toBe('MDFe autorizado há mais de 24 horas');
  });

  test('enriquecimento do desfecho', () => {
    const r = enrichRejectedMdfe(rejected({ cStat: '686', xMotivo: 'Rejeição: Existe MDFe não encerrado' }));
    expect(r.hint?.source).toBe('MOC MDF-e 3.00b Anexo I, regra F86');
    expect(rejectionHintMdfe('999')).toBeUndefined();
    const sem = rejected({ cStat: '405', xMotivo: 'x' });
    expect(enrichRejectedMdfe(sem)).toBe(sem);
    const comHint = rejected({ cStat: '686', xMotivo: 'x' }, { probableCause: 'a', suggestedFix: 'b', source: 'c' });
    expect(enrichRejectedMdfe(comHint)).toBe(comHint);
    const ok = authorized({ cStat: '100', xMotivo: 'Autorizado' }, 1);
    expect(enrichOutcomeMdfe(ok)).toBe(ok);
    expect(enrichOutcomeMdfe(rejected({ cStat: '663', xMotivo: 'x' })).status).toBe('rejected');
  });
});
