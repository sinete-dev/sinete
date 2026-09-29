import { describe, expect, test } from 'bun:test';
import { isCStat, rejected } from '@sinete/core';
import {
  enrichNfseRejected,
  NFSE_ERRO_CATEGORIAS,
  NFSE_ERROS,
  NFSE_ERROS_TABLE,
  nfseErroByCode,
  nfseRejectionHint,
} from '../src/nfse.ts';

describe('catálogo da NFS-e', () => {
  test('formato de cada entrada', () => {
    const docs = new Set(NFSE_ERROS_TABLE.sources.map((s) => s.id));
    let prev = '';
    for (const e of NFSE_ERROS) {
      expect(e.code, e.code).toMatch(/^E\d{4}$/);
      expect(isCStat(e.code)).toBe(true);
      expect(e.code > prev).toBe(true);
      prev = e.code;
      expect(e.mensagem.length, e.code).toBeGreaterThan(5);
      expect(e.mensagem, e.code).not.toMatch(/\s{2}|^\s|\s$/);
      expect(NFSE_ERRO_CATEGORIAS).toContain(e.categoria);
      expect(e.fonte).toMatch(/^Anexo (I v1\.01 \(20260209\)|II v1\.01 \(20260122\)), aba \S/);
      expect(e.regras.length).toBeGreaterThan(0);
      for (const r of e.regras) {
        expect(docs.has(r.doc), `${e.code} ${r.doc}`).toBe(true);
        expect(r.linha).toMatch(/^\d+$/);
        if (r.nivel !== undefined) expect(['1', '2', '3']).toContain(r.nivel);
      }
      const niveis = e.regras.map((r) => r.nivel).filter((n) => n !== undefined);
      expect(e.nivel).toBe(niveis.length > 0 ? niveis.sort()[0] : undefined);
      const curated = [e.causaProvavel, e.comoCorrigir, e.referencia].filter((x) => x !== undefined).length;
      expect([0, 3], e.code).toContain(curated);
    }
  });

  test('cobertura dos dois anexos e proveniência', () => {
    expect(NFSE_ERROS.length).toBeGreaterThanOrEqual(490);
    const s = NFSE_ERROS_TABLE.sources;
    expect(s.map((x) => x.id)).toEqual(['anexo-i', 'anexo-ii']);
    for (const x of s) {
      expect(x.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(x.url).toStartWith('https://www.gov.br/nfse/');
    }
    expect(NFSE_ERROS.filter((e) => e.regras.some((r) => r.doc === 'anexo-ii')).length).toBeGreaterThanOrEqual(55);
    expect(NFSE_ERROS.filter((e) => e.categoria === 'parametrizacao-municipal').length).toBeGreaterThan(20);
    expect(NFSE_ERROS.filter((e) => e.categoria === 'reforma').length).toBeGreaterThan(50);
  });

  test('E0312: mensagem oficial, nível 3, caminho do cTribNac e curadoria', () => {
    const e = nfseErroByCode('E0312');
    expect(e?.mensagem).toStartWith(
      'O código de tributação nacional informado não está administrado pelo município de incidência do ISSQN',
    );
    expect(e?.nivel).toBe('3');
    expect(e?.categoria).toBe('parametrizacao-municipal');
    expect(e?.regras[0]?.caminho).toBe('NFSe/infNFSe/DPS/infDPS/serv/cServ/cTribNac');
    expect(e?.comoCorrigir).toContain('01.01.01.000');
  });

  test('E1570 tem duas mensagens oficiais', () => {
    const e = nfseErroByCode('E1570');
    expect(e?.mensagens?.length).toBe(2);
    expect(e?.mensagem).toBe(e?.mensagens?.[0] ?? '');
  });

  test('E1260 aparece nos dois anexos', () => {
    const e = nfseErroByCode('E1260');
    expect(new Set(e?.regras.map((r) => r.doc))).toEqual(new Set(['anexo-i', 'anexo-ii']));
  });

  test('recepção, assinatura e certificado', () => {
    expect(nfseErroByCode('E1229')?.categoria).toBe('recepcao');
    expect(nfseErroByCode('E1229')?.regras[0]?.aba).toBe('RN_RECEPCAO_DPS');
    expect(nfseErroByCode('E1229')?.nivel).toBeUndefined();
    expect(nfseErroByCode('E1200')?.categoria).toBe('certificado');
    expect(nfseErroByCode('E0714')?.categoria).toBe('assinatura');
    expect(nfseErroByCode('E1235')?.categoria).toBe('schema');
    expect(nfseErroByCode('E0014')?.categoria).toBe('duplicidade');
  });

  test('lookup normaliza espaço e caixa; código fora do catálogo', () => {
    expect(nfseErroByCode(' e0312 ')?.code).toBe('E0312');
    expect(nfseErroByCode('E9999')).toBeUndefined();
  });
});

describe('dicas', () => {
  test('hint com curadoria e sem curadoria', () => {
    const h = nfseRejectionHint('E1229');
    expect(h?.suggestedFix).toContain('encoding="UTF-8"');
    expect(h?.source).toContain('RN_RECEPCAO_DPS');
    expect(nfseRejectionHint('E1570')).toBeUndefined();
    expect(nfseRejectionHint('E9999')).toBeUndefined();
  });

  test('enrichNfseRejected', () => {
    const r = enrichNfseRejected(rejected({ cStat: 'E0312', xMotivo: 'O código de tributação nacional...' }));
    expect(r.hint?.source).toContain('linha 317');
    const sem = rejected({ cStat: 'E1570', xMotivo: 'x' });
    expect(enrichNfseRejected(sem)).toBe(sem);
    const hint = { probableCause: 'a', suggestedFix: 'b', source: 'c' };
    const com = rejected({ cStat: 'E0312', xMotivo: 'x' }, hint);
    expect(enrichNfseRejected(com)).toBe(com);
  });
});
