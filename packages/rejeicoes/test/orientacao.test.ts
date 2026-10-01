import { describe, expect, test } from 'bun:test';
import { criarRecusado } from '@sinete/core';
import { completarRecusado, dicaRejeicao, REJEICOES, rejeicaoPorCodigo } from '../src/index.ts';
import { dicaRejeicaoMdfe, REJEICOES_MDFE } from '../src/mdfe.ts';

// A orientação é lida por quem emite (produtor, contador): nada de termo de integração, nada que dependa de saber o
// que é um cStat ou um XML.
const PROIBIDOS = /[—–]|rejei[çc][ãa]o|\bcStat\b|xMotivo|\bXML\b|schema|nfeProc|mdfeProc|web ?service|\bsinete\b/i;
// Nomes de tag, com a caixa do leiaute: o literal SEM CBENEF, que a UF pede na tela, não é tag.
const TAGS =
  /\b(indIEDest|finNFe|idDest|cBenef|tpEmit|tpTransp|infCIOT|prodPred|infLotacao|xNome|cMun|dhEmi|enderDest|idEstrangeiro|vICMSDeson|motDesICMS|cClassTrib|indFinal|ISUF|CRT)\b/;

/** Frases: ponto, exclamação ou interrogação seguidos de espaço ou do fim do texto. */
const frases = (t: string): number => t.split(/[.!?](?:\s+|$)/).filter((s) => s.trim().length > 0).length;

const todas = [
  ...REJEICOES.map((r) => ({ id: `nfe:${r.codigo}`, ...r })),
  ...REJEICOES_MDFE.map((r) => ({ id: `mdfe:${r.codigo}`, ...r })),
];

describe('orientacao', () => {
  test('só sobre curadoria completa, no máximo duas frases, sem termo de integração', () => {
    const com = todas.filter((r) => r.orientacao !== undefined);
    expect(com.length).toBeGreaterThan(0);
    for (const r of com) {
      expect(r.causaProvavel, r.id).toBeDefined();
      const t = r.orientacao ?? '';
      expect(t.trim(), r.id).toBe(t);
      expect(t.length, r.id).toBeGreaterThan(20);
      expect(t, r.id).not.toMatch(PROIBIDOS);
      expect(t, r.id).not.toMatch(TAGS);
      expect(t, r.id).not.toContain(r.codigo);
      expect(frases(t), r.id).toBeLessThanOrEqual(2);
    }
  });

  test('falhas do sistema emissor ficam sem orientação', () => {
    for (const c of ['204', '215', '225', '297', '539', '656'])
      expect(rejeicaoPorCodigo(c)?.orientacao, c).toBeUndefined();
    for (const c of ['204', '539']) expect(REJEICOES_MDFE.find((r) => r.codigo === c)?.orientacao, c).toBeUndefined();
  });

  test('dica traz a orientação quando existe', () => {
    const r221 = rejeicaoPorCodigo('221');
    expect(r221?.orientacao).toBeDefined();
    expect(dicaRejeicao('221')?.orientacao).toBe(r221?.orientacao);
    expect(completarRecusado(criarRecusado({ cStat: '221', xMotivo: 'x' })).dica?.orientacao).toBe(r221?.orientacao);
    expect(dicaRejeicao('204')).toBeDefined();
    expect(dicaRejeicao('204')).not.toHaveProperty('orientacao');
    expect(dicaRejeicaoMdfe('611')?.orientacao).toBeDefined();
    expect(dicaRejeicaoMdfe('204')).not.toHaveProperty('orientacao');
  });
});
