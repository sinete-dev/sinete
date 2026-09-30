import { describe, expect, test } from 'bun:test';
import { relogioFixo } from '@sinete/core';
import type { TTribNFe } from '@sinete/schemas/nfe/PL_010f';
import { ibsCbsDoItem, somaCampo, totalIbsCbs } from '../../src/build/ibscbs.ts';
import { camposForaDoPl, escolherPl } from '../../src/build/pl.ts';
import { Issues } from '../../src/issues.ts';

const regular = {
  CST: '000',
  cClassTrib: '000001',
  gIBSCBS: {
    vBC: '100.00',
    gIBSUF: {
      pIBSUF: '0.1000',
      gDif: { pDif: '10.0000', vDif: '0.01' },
      gDevTrib: { vDevTrib: '0.02' },
      vIBSUF: '0.09',
    },
    gIBSMun: { pIBSMun: '0.0000', vIBSMun: '0.00' },
    vIBS: '0.09',
    gCBS: { pCBS: '0.9000', gDevTrib: { vDevTrib: '0.03' }, vCBS: '0.90' },
  },
  gCredPresOper: {
    vBCCredPres: '100.00',
    cCredPres: '1',
    gIBSCredPres: { pCredPres: '1.0000', vCredPres: '1.00' },
    gCBSCredPres: { pCredPres: '1.0000', vCredPresCondSus: '0.50' },
  },
  gEstornoCred: { vIBSEstCred: '0.10', vCBSEstCred: '0.20' },
} as unknown as TTribNFe;

const mono = {
  CST: '620',
  cClassTrib: '620001',
  gIBSCBSMono: {
    gIBSMonoAdRem: {
      gMonoPadrao: { qBCMono: '10.0000', adRemIBS: '1.0000', vIBSMono: '10.00' },
      gMonoReten: { qBCMonoReten: '5.0000', adRemIBSReten: '1.0000', vIBSMonoReten: '5.00' },
    },
    gCBSMonoAdValorem: { gMonoRet: { vCBSMonoRet: '2.00' } },
    vTotIBSMonoItem: '15.00',
    vTotCBSMonoItem: '2.00',
  },
} as unknown as TTribNFe;

describe('IBSCBSTot', () => {
  test('soma os grupos dos itens (W35 a W59g)', () => {
    expect(totalIbsCbs([regular, regular, mono])).toEqual({
      vBCIBSCBS: '200.00',
      gIBS: {
        gIBSUF: { vDif: '0.02', vDevTrib: '0.04', vIBSUF: '0.18' },
        gIBSMun: { vDif: '0.00', vDevTrib: '0.00', vIBSMun: '0.00' },
        vIBS: '0.18',
        vCredPres: '2.00',
        vCredPresCondSus: '0.00',
      },
      gCBS: { vDif: '0.00', vDevTrib: '0.06', vCBS: '1.80', vCredPres: '0.00', vCredPresCondSus: '1.00' },
      gMono: {
        vIBSMono: '10.00',
        vCBSMono: '0.00',
        vIBSMonoReten: '5.00',
        vCBSMonoReten: '0.00',
        vIBSMonoRet: '0.00',
        vCBSMonoRet: '2.00',
      },
      gEstornoCred: { vIBSEstCred: '0.20', vCBSEstCred: '0.40' },
    });
  });

  test('crédito presumido sem gIBSCBS entra no total', () => {
    const credito = {
      CST: '000',
      cClassTrib: '000001',
      gCredPresOper: {
        vBCCredPres: '10.00',
        cCredPres: '1',
        gIBSCredPres: { pCredPres: '15.0000', vCredPres: '1.50' },
      },
    } as unknown as TTribNFe;
    expect(totalIbsCbs([credito])).toMatchObject({
      gIBS: { vIBS: '0.00', vCredPres: '1.50' },
      gCBS: { vCredPres: '0.00' },
    });
  });

  test('só monofásico: sem gIBS e gCBS', () => {
    const t = totalIbsCbs([mono]) as Record<string, unknown>;
    expect(t.gIBS).toBeUndefined();
    expect(t.vBCIBSCBS).toBe('0.00');
  });

  test('valores do item que entram no vItem', () => {
    expect(Object.fromEntries(Object.entries(ibsCbsDoItem(mono)).map(([k, v]) => [k, v.toString()]))).toEqual({
      vIBS: '0',
      vCBS: '0',
      vTotIBSMonoItem: '15',
      vTotCBSMonoItem: '2',
    });
    expect(ibsCbsDoItem(regular).vCBS.toString()).toBe('0.9');
    expect(somaCampo(null, 'x').isZero()).toBe(true);
  });
});

describe('PL por vigência', () => {
  test('data fora das vigências conhecidas propaga o erro do schemas', () => {
    expect(() => escolherPl('producao', relogioFixo('2020-01-01T00:00:00Z'))).toThrow();
  });

  test('campos que o PL não conhece são apontados, inclusive em listas', () => {
    const { infNFe } = escolherPl('homologacao', relogioFixo('2026-09-26T12:00:00Z'));
    const issues = new Issues();
    camposForaDoPl(
      infNFe,
      { ide: { campoNovo: '1' }, det: [{ nItem: '1', prod: { outro: '1' } }], inexistente: 'x', total: undefined },
      'infNFe',
      'PL_010f',
      issues,
    );
    expect(issues.list.map((i) => i.caminho)).toEqual([
      'infNFe.ide.campoNovo',
      'infNFe.det[0].prod.outro',
      'infNFe.inexistente',
    ]);
    expect(issues.list[0]?.code).toBe('campo_fora_do_pl');
  });
});
