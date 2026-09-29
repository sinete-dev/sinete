import { describe, expect, test } from 'bun:test';
import { authorized, isCStat, pending, rejected } from '@sinete/core';
import table from '../src/data/rejeicoes.json' with { type: 'json' };
import {
  enrichOutcome,
  enrichRejected,
  REJEICAO_CATEGORIES,
  REJEICOES,
  REJEICOES_TABLE,
  rejectionHint,
  rejeicaoByCode,
} from '../src/index.ts';

describe('catálogo', () => {
  test('formato de cada entrada', () => {
    const docs = new Set(REJEICOES_TABLE.sources.map((s) => s.id));
    let prev = 0;
    for (const r of REJEICOES) {
      expect(isCStat(r.code), r.code).toBe(true);
      expect(Number(r.code)).toBeGreaterThan(prev);
      prev = Number(r.code);
      expect(r.message.length, r.code).toBeGreaterThan(5);
      expect(r.message, r.code).not.toMatch(/^Rejeição/);
      expect(r.modelos.length).toBeGreaterThan(0);
      for (const m of r.modelos) expect(['55', '65']).toContain(m);
      expect(REJEICAO_CATEGORIES).toContain(r.category);
      expect(r.source).toMatch(
        /^(MOC 7\.0 Anexo I|NT 2025\.002 v1\.40|NT 2025\.001 v1\.03|NT 2024\.003 v1\.10), (tabela 4\.4\.[23]|regra \S+)$|^(NT 2025\.001 v1\.03, item 90\.1|NT 2023\.002 v1\.01, item 7)$/,
      );
      for (const rule of r.rules) expect(docs.has(rule.doc), `${r.code} ${rule.doc}`).toBe(true);
      // curadoria vem sempre completa e com a regra citada
      const curated = [r.causaProvavel, r.comoCorrigir, r.referencia].filter((x) => x !== undefined).length;
      expect([0, 3], r.code).toContain(curated);
    }
  });

  test('cobertura mínima: MOC 7.0 (tabela 4.4.2 e regras), denegações e reforma tributária', () => {
    expect(REJEICOES.length).toBeGreaterThanOrEqual(810);
    expect(REJEICOES.filter((r) => r.effect === 'denegacao').map((r) => r.code)).toEqual(['301', '302', '303']);
    const reforma = REJEICOES.filter((r) => r.category === 'reforma');
    expect(reforma.length).toBeGreaterThanOrEqual(200);
    for (const r of reforma) expect(Number(r.code)).toBeGreaterThanOrEqual(1000);
    // códigos que só existem no corpo das regras (a tabela 4.4.2 não é exaustiva)
    for (const c of ['108', '109', '491', '492', '493', '764', '776']) expect(rejeicaoByCode(c), c).toBeDefined();
    expect(REJEICOES.filter((r) => r.causaProvavel).length).toBeGreaterThanOrEqual(40);
  });

  test('mensagens oficiais conferidas no documento', () => {
    expect(rejeicaoByCode('204')?.message).toBe('Duplicidade de NF-e [nRec:999999999999999]');
    expect(rejeicaoByCode('233')?.message).toBe('IE do destinatário não cadastrada');
    expect(rejeicaoByCode('1037')?.message).toBe('Alíquota da CBS inválida [nItem: 999]');
    expect(rejeicaoByCode('1179')?.message).toBe(
      'CFOP inválido para Nota Fiscal de devolução ou de retorno de mercadoria emitida por MEI',
    );
    expect(rejeicaoByCode('1154')?.message).toBe('Data de previsão de entrega posterior ao permitido');
    expect(rejeicaoByCode('640')?.messages).toHaveLength(2);
    // regressão: a célula de id em duas linhas (B32-10/BB02-10) cortava a mensagem na primeira linha
    expect(rejeicaoByCode('1008')?.message).toBe(
      'Nota de compra governamental e alíquota dos outros entes informada incorretamente',
    );
    expect(rejeicaoByCode('1212')?.message).toBe(
      'DFe referenciado em operação com ente governamental com a mesma Chave de Acesso da Nota Fiscal atual [nOcor:nnn]',
    );
    expect(rejeicaoByCode('1020')?.rules).toEqual([{ doc: 'nt2025002', id: 'UB13-10' }]);
    expect(rejeicaoByCode('209')?.rules.map((r) => r.id)).toContain('C17-20');
    expect(rejeicaoByCode('1003')?.modelos).toEqual(['55']);
  });

  test('nenhuma mensagem com sinal de corte', () => {
    // Mesma checagem do builder: artigo, preposição ou conjunção no fim, ou parêntese/colchete sem fechar.
    // As exceções estão assim no PDF oficial (tabela 4.4.2 do Anexo I).
    const officialOddities = new Set(['396', '397', '400', '562']);
    const dangling = /\s(a|o|as|os|ao|aos|e|ou|de|da|do|das|dos|com|para|por|no|na|nos|nas|em|um|uma|que|se|sem)$/i;
    const count = (m: string, c: string): number => m.split(c).length - 1;
    const bad: string[] = [];
    for (const r of REJEICOES) {
      for (const m of r.messages ?? [r.message]) {
        if (dangling.test(m)) bad.push(`${r.code}: ${m}`);
        if (officialOddities.has(r.code)) continue;
        if (count(m, '(') !== count(m, ')') || count(m, '[') !== count(m, ']')) bad.push(`${r.code}: ${m}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test('categorias de referência', () => {
    const cat = (c: string): string | undefined => rejeicaoByCode(c)?.category;
    expect(cat('215')).toBe('schema');
    expect(cat('297')).toBe('assinatura');
    expect(cat('290')).toBe('certificado');
    expect(cat('213')).toBe('certificado');
    expect(cat('230')).toBe('cadastro');
    expect(cat('302')).toBe('cadastro');
    expect(cat('204')).toBe('duplicidade');
    expect(cat('539')).toBe('duplicidade');
    expect(cat('610')).toBe('regra-negocio');
    expect(cat('1022')).toBe('reforma');
  });

  test('metadados e fontes', () => {
    expect(REJEICOES_TABLE.schemaVersion).toBe(1);
    expect(REJEICOES_TABLE.version).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    for (const s of REJEICOES_TABLE.sources) {
      expect(s.url).toStartWith('https://www.nfe.fazenda.gov.br/');
      expect(s.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(table.generatedBy).toBe('tools/rejeicoes-data/build.ts');
  });
});

describe('consulta e enriquecimento', () => {
  test('lookup por código de 3 e 4 dígitos', () => {
    expect(rejeicaoByCode(' 539 ')?.code).toBe('539');
    expect(rejeicaoByCode('1041')?.category).toBe('reforma');
    expect(rejeicaoByCode('100')).toBeUndefined();
    expect(rejeicaoByCode('9999')).toBeUndefined();
  });

  test('rejectionHint só com curadoria', () => {
    expect(rejectionHint('204')).toEqual({
      probableCause: rejeicaoByCode('204')?.causaProvavel ?? '',
      suggestedFix: rejeicaoByCode('204')?.comoCorrigir ?? '',
      source: 'MOC 7.0 Anexo I, RV 2B08-20',
    });
    const semCuradoria = REJEICOES.find((r) => !r.causaProvavel);
    expect(semCuradoria && rejectionHint(semCuradoria.code)).toBeUndefined();
    expect(rejectionHint('100')).toBeUndefined();
  });

  test('enrichRejected preenche o hint sem sobrescrever', () => {
    const r = rejected({ cStat: '297', xMotivo: 'Rejeição: Assinatura difere do calculado' });
    const e = enrichRejected(r);
    expect(e.hint?.source).toBe('MOC 7.0 Anexo I, RV F02');
    expect(e.cStat).toBe('297');
    const manual = rejected({ cStat: '297', xMotivo: 'x' }, { probableCause: 'a', suggestedFix: 'b', source: 'c' });
    expect(enrichRejected(manual)).toBe(manual);
    const unknown = rejected({ cStat: '9998', xMotivo: 'x' });
    expect(enrichRejected(unknown)).toBe(unknown);
  });

  test('enrichOutcome só mexe no rejected', () => {
    const a = authorized({ cStat: '100', xMotivo: 'Autorizado o uso da NF-e' }, { nProt: '1' });
    expect(enrichOutcome(a)).toBe(a);
    const p = pending({ cStat: '105', xMotivo: 'Lote em processamento' });
    expect(enrichOutcome(p)).toBe(p);
    const r = enrichOutcome(rejected({ cStat: '1037', xMotivo: 'Rejeição: Alíquota da CBS inválida' }));
    expect(r.status === 'rejected' && r.hint?.source).toBe('NT 2025.002 v1.40, RV UB56-10 e UB56-20');
  });
});
