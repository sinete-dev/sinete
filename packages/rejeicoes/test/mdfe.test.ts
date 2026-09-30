import { describe, expect, test } from 'bun:test';
import { criarAutorizado, criarRecusado, ehCStat } from '@sinete/core';
import { rejeicaoPorCodigo } from '../src/index.ts';
import {
  completarRecusadoMdfe,
  completarResultadoMdfe,
  dicaRejeicaoMdfe,
  REJEICOES_MDFE,
  rejeicaoMdfePorCodigo,
  TABELA_REJEICOES_MDFE,
} from '../src/mdfe.ts';

describe('catálogo do MDF-e', () => {
  test('formato de cada entrada', () => {
    const docs = new Set(TABELA_REJEICOES_MDFE.fontes.map((s) => s.id));
    expect(docs.size).toBe(6);
    let prev = 0;
    for (const r of REJEICOES_MDFE) {
      expect(ehCStat(r.codigo), r.codigo).toBe(true);
      expect(Number(r.codigo)).toBeGreaterThan(prev);
      prev = Number(r.codigo);
      expect(r.efeito).toBe('rejeicao');
      expect(r.modelos).toEqual(['58']);
      expect(r.mensagem.length, r.codigo).toBeGreaterThan(5);
      expect(r.mensagem, r.codigo).not.toMatch(/^Rejeição/);
      expect(r.fonte).toMatch(/^(MOC MDF-e 3\.00b (Anexo I|Visão Geral)|MDF-e NT 202[456]\.00\d v1\.0\d)/);
      for (const rule of r.regras) expect(docs.has(rule.documento), `${r.codigo} ${rule.documento}`).toBe(true);
      const curated = [r.causaProvavel, r.comoCorrigir, r.referencia].filter((x) => x !== undefined).length;
      expect([0, 3], r.codigo).toContain(curated);
    }
    expect(REJEICOES_MDFE.length).toBeGreaterThanOrEqual(200);
  });

  test('mensagens das regras, com marcadores reconstituídos e continuação de linha', () => {
    expect(rejeicaoMdfePorCodigo('609')?.mensagem).toBe(
      'MDFe já está encerrado na base de dados da SEFAZ [nProt:999999999999999][dhEnc: AAAA-MM-DDTHH:MM:SS TZD].',
    );
    expect(rejeicaoMdfePorCodigo('609')?.mensagens).toBeUndefined();
    expect(rejeicaoMdfePorCodigo('611')?.mensagem).toMatch(/\[nProt:999999999999999\]$/);
    expect(rejeicaoMdfePorCodigo('578')?.mensagem).toBe('Informações dos tomadores é obrigatória para esta operação');
    expect(rejeicaoMdfePorCodigo('731')?.mensagem).toBe(
      'A categoria de combinação veicular deve ser preenchida para o grupo vale pedágio',
    );
    expect(rejeicaoMdfePorCodigo('108')?.mensagem).toBe('Serviço Paralisado Momentaneamente (curto prazo)');
    expect(rejeicaoMdfePorCodigo('678')?.mensagem).toBe('Consumo Indevido');
    expect(rejeicaoMdfePorCodigo('684')?.mensagens).toEqual([
      'CIOT obrigatório para RNTRC informado.',
      'CIOT deverá ser informado',
    ]);
    expect(rejeicaoMdfePorCodigo('301')?.fonte).toBe('MDF-e NT 2025.001 v1.03, regra F55a');
  });

  test('os códigos colidem com os da NF-e com outro significado', () => {
    expect(rejeicaoMdfePorCodigo('611')?.mensagem).not.toBe(rejeicaoPorCodigo('611')?.mensagem);
    expect(rejeicaoMdfePorCodigo('220')?.mensagem).toBe('MDFe autorizado há mais de 24 horas');
  });

  test('enriquecimento do desfecho', () => {
    const r = completarRecusadoMdfe(criarRecusado({ cStat: '686', xMotivo: 'Rejeição: Existe MDFe não encerrado' }));
    expect(r.dica?.fonte).toBe('MOC MDF-e 3.00b Anexo I, regra F86');
    expect(dicaRejeicaoMdfe('999')).toBeUndefined();
    const sem = criarRecusado({ cStat: '405', xMotivo: 'x' });
    expect(completarRecusadoMdfe(sem)).toBe(sem);
    const comHint = criarRecusado(
      { cStat: '686', xMotivo: 'x' },
      { causaProvavel: 'a', comoCorrigir: 'b', fonte: 'c' },
    );
    expect(completarRecusadoMdfe(comHint)).toBe(comHint);
    const ok = criarAutorizado({ cStat: '100', xMotivo: 'Autorizado' }, 1);
    expect(completarResultadoMdfe(ok)).toBe(ok);
    expect(completarResultadoMdfe(criarRecusado({ cStat: '663', xMotivo: 'x' })).tipo).toBe('recusado');
  });
});
