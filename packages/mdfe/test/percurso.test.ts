import { describe, expect, test } from 'bun:test';
import type { Uf } from '@sinete/core';
import { UFS } from '@sinete/core';
import tabela from '../src/data/ufs-vizinhas.json' with { type: 'json' };
import { conferirPercurso, saoVizinhas, sugerirPercurso } from '../src/index.ts';

const SIGLAS: readonly Uf[] = UFS.map((u) => u.sigla);

describe('tabela de divisas', () => {
  const viz: Record<string, string[]> = tabela.vizinhas;

  test('cobre as 27 UFs, sem EX', () => {
    expect(Object.keys(viz).sort()).toEqual([...SIGLAS].sort());
  });

  test('é simétrica e sem laço', () => {
    for (const [uf, lista] of Object.entries(viz)) {
      expect(lista).not.toContain(uf);
      for (const v of lista) expect(viz[v]).toContain(uf);
    }
  });

  test('o grafo é conexo: toda UF alcança qualquer outra', () => {
    for (const a of SIGLAS) for (const b of SIGLAS) expect(sugerirPercurso(a, b)).toBeDefined();
  });
});

describe('conferirPercurso (F90, 663)', () => {
  test('mesma UF ou UFs vizinhas sem percurso', () => {
    expect(conferirPercurso('MT', [], 'MT')).toBeUndefined();
    expect(conferirPercurso('MT', [], 'GO')).toBeUndefined();
  });

  test('percurso por divisas, na ordem', () => {
    expect(conferirPercurso('MT', ['MS'], 'SP')).toBeUndefined();
    expect(conferirPercurso('RS', ['SC', 'PR', 'SP'], 'MG')).toBeUndefined();
  });

  test('aponta o primeiro trecho sem divisa', () => {
    expect(conferirPercurso('MT', [], 'SP')).toEqual({ indice: 0, de: 'MT', para: 'SP' });
    expect(conferirPercurso('MT', ['PR'], 'SP')).toEqual({ indice: 0, de: 'MT', para: 'PR' });
    expect(conferirPercurso('RS', ['SC', 'SP'], 'MG')).toEqual({ indice: 1, de: 'SC', para: 'SP' });
  });

  test('UF repetida em seguida não é trecho válido', () => {
    expect(conferirPercurso('MT', ['MT', 'MS'], 'SP')?.de).toBe('MT');
  });

  test('trecho com o exterior não é conferido', () => {
    expect(conferirPercurso('EX', ['RS'], 'SC')).toBeUndefined();
    expect(conferirPercurso('SP', ['PR'], 'EX')).toBeUndefined();
  });
});

describe('sugerirPercurso', () => {
  test('vazio para vizinhas; caminho mínimo por divisas nas demais', () => {
    expect(sugerirPercurso('MT', 'GO')).toEqual([]);
    const s = sugerirPercurso('RS', 'BA') ?? [];
    expect(s.length).toBe(4);
    expect(conferirPercurso('RS', s, 'BA')).toBeUndefined();
    expect(saoVizinhas('AP', 'PA')).toBe(true);
    expect(saoVizinhas('AP', 'AM')).toBe(false);
  });
});
