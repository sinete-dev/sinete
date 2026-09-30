import { describe, expect, test } from 'bun:test';
import type { Uf } from '@sinete/core';
import { UFS } from '@sinete/core';
import table from '../src/data/ie.json' with { type: 'json' };
import { calcularDvIe, completarIe, formatarIe, ieIsenta, ieValida, lerIe, regraIe, TABELA_IE } from '../src/index.ts';
import { expectValidationError } from './helpers.ts';

/**
 * Exemplos oficiais: cada número abaixo aparece como inscrição válida no roteiro da UF (Sintegra, Cad_Estados/cad_XX,
 * e as páginas extras registradas em `fontes` do ie.json). Onde o roteiro não traz exemplo, a UF fica só com os testes
 * de propriedade.
 */
const OFFICIAL_VALID: Record<string, readonly string[]> = {
  AC: ['01.004.823/001-12'],
  AL: ['240000048'],
  AP: ['030123459'],
  BA: ['123456-63', '612345-57', '1000003-06', '1234567-48', '1623456-51'],
  CE: ['06000001-5'],
  DF: ['07300001001-09'],
  ES: ['999999990'],
  GO: ['10.987.654-7'],
  MA: ['120000385'],
  MG: ['062.307.904/0081'],
  MT: ['0013000001-9'],
  PA: ['159999995', '750000023'],
  PB: ['06000001-5'],
  PE: ['0321418-40', '18.1.001.0000004-9'],
  PI: ['012345679'],
  PR: ['123.45678-50'],
  RN: ['20.040.040-1', '20.0.040.040-0'],
  RO: ['101.62521-3', '0000000062521-3'],
  RR: [
    '24006628-1',
    '24001755-6',
    '24003429-0',
    '24001360-3',
    '24008266-8',
    '24006153-6',
    '24007356-2',
    '24005467-4',
    '24004145-5',
    '24001340-7',
  ],
  RS: ['224/3658792'],
  SC: ['251.040.852'],
  SE: ['27123456-3'],
  SP: ['110.042.490.114', 'P-01100424.3/002'],
  TO: ['29 01 022783 6', '290227836'],
};

/** O mesmo número com o último dígito trocado, para cada exemplo oficial. */
function bumpLast(v: string): string {
  const m = /\d(?=\D*$)/.exec(v);
  if (!m) return v;
  return v.slice(0, m.index) + String((Number(m[0]) + 1) % 10) + v.slice(m.index + 1);
}

/** Gerador pseudoaleatório determinístico (mulberry32), para os testes de propriedade serem reprodutíveis. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uma base aleatória que casa com o padrão da variante (prefixos fixos lidos do próprio padrão). */
function randomBase(pattern: string, length: number, rand: () => number): string {
  for (let attempt = 0; attempt < 10_000; attempt++) {
    let s = pattern.startsWith('^P') ? 'P' : '';
    while (s.length < length) s += String(Math.floor(rand() * 10));
    // força prefixos comuns para acertar o padrão mais depressa
    const fixed = /^\^\(?(\d{2})/.exec(pattern)?.[1];
    if (fixed && !pattern.startsWith('^(') && !pattern.startsWith('^\\d')) s = fixed + s.slice(2);
    if (new RegExp(pattern).test(s)) return s;
  }
  throw new Error(`sem base para ${pattern}`);
}

describe('exemplos oficiais por UF', () => {
  for (const [uf, values] of Object.entries(OFFICIAL_VALID)) {
    test(`${uf}: válidos e, com o DV trocado, inválidos`, () => {
      for (const v of values) {
        const r = lerIe(v, uf as Uf);
        expect(r.ok, `${uf} ${v}`).toBe(true);
        // No produtor rural de SP os 3 últimos algarismos ficam fora do cálculo: troca-se o DV (10ª posição).
        const bad = v.startsWith('P')
          ? v.replace(/\.(\d)/, (_m, d: string) => `.${(Number(d) + 1) % 10}`)
          : bumpLast(v);
        expect(ieValida(bad, uf as Uf), `${uf} ${bad}`).toBe(false);
      }
    });
  }
});

describe('tabela de regras', () => {
  test('cobre as 27 UFs, cada uma com fonte e variantes coerentes', () => {
    expect(Object.keys(table.ufs).sort()).toEqual(UFS.map((u) => u.sigla).sort());
    for (const { sigla } of UFS) {
      const rule = regraIe(sigla);
      expect(rule.fontes.length, sigla).toBeGreaterThan(0);
      for (const s of rule.fontes) expect(s.url).toMatch(/^https?:\/\//);
      for (const v of rule.variantes) {
        expect(() => new RegExp(v.padrao)).not.toThrow();
        if (v.mascara) expect(v.mascara.split('').filter((c) => c === '#').length, `${sigla} ${v.id}`).toBe(v.tamanho);
        for (const c of v.digitosVerificadores) {
          expect(c.posicao).toBeLessThan(v.tamanho);
          expect((c.posicoesSomadas ?? c.pesos.map((_, i) => i)).length).toBe(c.pesos.length);
        }
      }
    }
    expect(TABELA_IE.versao).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(TABELA_IE.fontes.length).toBeGreaterThan(0);
  });
});

describe('propriedades', () => {
  const rand = rng(20260925);
  for (const { sigla } of UFS) {
    test(`${sigla}: IE gerada valida e qualquer algarismo trocado falha`, () => {
      for (const variant of regraIe(sigla).variantes) {
        for (let i = 0; i < 60; i++) {
          const ie = completarIe(randomBase(variant.padrao, variant.tamanho, rand), sigla, variant.id);
          const r = lerIe(ie, sigla);
          expect(r.ok, `${sigla} ${variant.id} ${ie}`).toBe(true);
          // Troca um dos dígitos verificadores: o DV tem de detectar. (Trocar a base pode cair noutra variante.)
          const pos = variant.digitosVerificadores[i % variant.digitosVerificadores.length]?.posicao ?? 0;
          const accepted = variant.digitosVerificadores
            .filter((c) => c.posicao === pos)
            .flatMap((c) => calcularDvIe(ie, c))
            .map(String);
          const others = '0123456789'.split('').filter((d) => !accepted.includes(d));
          const d = others[i % others.length] ?? '0';
          const mutated = ie.slice(0, pos) + d + ie.slice(pos + 1);
          const m = lerIe(mutated, sigla, { aceitarLegado: variant.legado === true });
          if (m.ok && m.valor.tipo === 'numero') expect(m.valor.variante, `${sigla} ${mutated}`).not.toBe(variant.id);
        }
      }
    });
  }
});

describe('propriedade: algarismo da base trocado', () => {
  test('o DV detecta a grande maioria das trocas de um algarismo da base, em toda UF', () => {
    const rand = rng(7);
    for (const { sigla } of UFS) {
      for (const variant of regraIe(sigla).variantes) {
        const used = new Set(
          variant.digitosVerificadores.flatMap((c) => c.posicoesSomadas ?? c.pesos.map((_, i) => i)),
        );
        const positions = [...used].filter((p) => !variant.digitosVerificadores.some((c) => c.posicao === p) && p > 1);
        let tries = 0;
        let caught = 0;
        for (let i = 0; i < 200; i++) {
          const ie = completarIe(randomBase(variant.padrao, variant.tamanho, rand), sigla, variant.id);
          const pos = positions[i % positions.length] ?? 2;
          const d = String((Number(ie[pos]) + 1 + Math.floor(rand() * 9)) % 10);
          const mutated = ie.slice(0, pos) + d + ie.slice(pos + 1);
          if (!new RegExp(variant.padrao).test(mutated)) continue;
          tries++;
          const m = lerIe(mutated, sigla);
          if (!(m.ok && m.valor.tipo === 'numero' && m.valor.variante === variant.id)) caught++;
        }
        // Módulo 11 com resto 0 e 1 levados a 0 deixa passar cerca de 1 em 11; módulo 10 e 9 um pouco mais.
        expect(caught / tries, `${sigla} ${variant.id}`).toBeGreaterThan(0.75);
      }
    }
  });
});

describe('normalização e ocorrências', () => {
  test('zeros à esquerda a menos ou a mais (Anexo I, nota *2)', () => {
    const r = lerIe('130000019', 'MT');
    expect(r.ok && r.valor.tipo === 'numero' && r.valor.valor).toBe('00130000019');
    const extra = lerIe('00251040852', 'SC');
    expect(extra.ok && extra.valor.tipo === 'numero' && extra.valor.valor).toBe('251040852');
    expect(ieValida('10251040852', 'SC')).toBe(false);
  });

  test('máscara oficial e forma normalizada', () => {
    const r = lerIe('0100482300112', 'AC');
    expect(r.ok && r.valor.tipo === 'numero' && r.valor.formatada).toBe('01.004.823/001-12');
    expect(formatarIe('110042490114', 'SP')).toBe('110.042.490.114');
    expect(formatarIe('P011004243002', 'SP')).toBe('P-01100424.3/002');
    expect(formatarIe('240000048', 'AL')).toBe('240000048');
    expect(formatarIe('nada', 'AL')).toBe('nada');
    expect(formatarIe('isento', 'MT')).toBe('ISENTO');
  });

  test('ISENTO', () => {
    expect(ieIsenta(' Isento ')).toBe(true);
    const r = lerIe('isento', 'MT');
    expect(r.ok && r.valor).toEqual({ tipo: 'isento', valor: 'ISENTO' });
    const no = lerIe('ISENTO', 'MT', { aceitarIsento: false, caminho: 'emit.IE' });
    expect(!no.ok && no.erro).toEqual({
      caminho: 'emit.IE',
      code: 'ie_isento_nao_permitido',
      mensagem: 'ISENTO não é aceito neste campo',
    });
  });

  test('códigos de ocorrência', () => {
    const code = (v: string, uf: Uf): string | undefined => {
      const r = lerIe(v, uf);
      return r.ok ? undefined : r.erro.code;
    };
    expect(code('12a', 'SP')).toBe('ie_caractere_invalido');
    expect(code('', 'SP')).toBe('ie_caractere_invalido');
    expect(code('1234567890123456', 'SP')).toBe('ie_tamanho_invalido');
    expect(code('990000019', 'MA')).toBe('ie_formato_invalido');
    expect(code('120000386', 'MA')).toBe('ie_dv_invalido');
    expect(code('1', 'XX' as Uf)).toBe('ie_uf_invalida');
  });

  test('formatos antigos só com allowLegacy', () => {
    const r = lerIe('101625213', 'RO');
    expect(r.ok && r.valor.tipo === 'numero' && r.valor.legado).toBe(true);
    expect(ieValida('101625213', 'RO', { aceitarLegado: false })).toBe(false);
  });

  test('faixas especiais de Goiás e Amapá', () => {
    // Goiás: resto 1 dá DV 1 na faixa 10103105 a 10119997
    expect(ieValida(completarIe('101031050', 'GO'), 'GO')).toBe(true);
    expect(ieValida('110944020', 'GO')).toBe(true);
    expect(ieValida('110944021', 'GO')).toBe(true);
    // Amapá: p = 9 e d = 1 na faixa 03017001 a 03019022
    const ap = completarIe('030170010', 'AP');
    expect(ieValida(ap, 'AP')).toBe(true);
    expectValidationError(() => completarIe('1', 'AP'), 'ie_base_invalida');
    expectValidationError(() => completarIe('1', 'XX' as Uf), 'ie_uf_invalida');
    expectValidationError(() => completarIe('030170010', 'AP', 'nao-existe'), 'ie_base_invalida');
  });
});

describe('IE só com zeros (regressão)', () => {
  test('qualquer quantidade de zeros, com ou sem máscara e P, é recusada em toda UF', () => {
    for (const { sigla } of UFS) {
      const lengths = new Set([1, 2, ...regraIe(sigla).variantes.map((v) => v.tamanho), 14, 15, 20]);
      for (const n of lengths) {
        for (const v of ['0'.repeat(n), `P${'0'.repeat(n)}`, `${'0'.repeat(n)}-0`.slice(0, n + 2)]) {
          const r = lerIe(v, sigla);
          expect(r.ok, `${sigla} ${v}`).toBe(false);
          if (!r.ok && /^[P0-]+$/.test(v)) expect(['ie_zerada', 'ie_caractere_invalido']).toContain(r.erro.code);
        }
      }
      expect(lerIe('000.000.000', sigla)).toMatchObject({ ok: false, erro: { code: 'ie_zerada' } });
    }
  });

  test('IE válida com zeros à esquerda continua aceita', () => {
    expect(ieValida('00130000019', 'MT')).toBe(true);
    expect(ieValida('0000000062521-3', 'RO')).toBe(true);
  });
});
