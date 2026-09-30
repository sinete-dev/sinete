/**
 * Módulos da NFS-e Nacional: a correção documentada do `TSSerieDPS` no pacote 20260209, o CNPJ alfanumérico do
 * 20260727, a `Signature` como XML bruto e a vigência por ambiente.
 */
import { describe, expect, test } from 'bun:test';
import { relogioFixo } from '@sinete/core';
import { decodificarXml, selecionarPl, serializarRaiz, validarRaiz } from '../src/index.ts';
import * as n0209 from '../src/nfse/1.01-20260209.ts';
import * as n0727 from '../src/nfse/1.01-20260727.ts';

const NS = 'http://www.sped.fazenda.gov.br/nfse';

function infDps(over: { CNPJ?: string; serie?: string } = {}): n0727.TCInfDPS {
  const cnpj = over.CNPJ ?? '11222333000181';
  const serie = over.serie ?? '1';
  return {
    Id: `DPS35503082${cnpj}${serie.padStart(5, '0')}000000000000001`,
    tpAmb: '2',
    dhEmi: '2026-09-25T10:00:00-03:00',
    verAplic: 'sinete-teste',
    serie,
    nDPS: '1',
    dCompet: '2026-09-25',
    tpEmit: '1',
    cLocEmi: '3550308',
    prest: { CNPJ: cnpj, regTrib: { opSimpNac: '3', regApTribSN: '1', regEspTrib: '0' } },
    serv: { locPrest: { cLocPrestacao: '3550308' }, cServ: { cTribNac: '010101', xDescServ: 'SERVICO DE TESTE' } },
    valores: {
      vServPrest: { vServ: '1.00' },
      trib: { tribMun: { tribISSQN: '1', tpRetISSQN: '1' }, totTrib: { indTotTrib: '0' } },
    },
  };
}

describe('NFS-e Nacional 1.01', () => {
  test('o 20260209 registra a correção do TSSerieDPS e o 20260727 usa o XSD como está', () => {
    expect(n0209.schema.ajustes).toHaveLength(1);
    expect(n0209.schema.ajustes?.[0]).toMatchObject({
      tipo: 'TSSerieDPS',
      de: '^0{0,4}\\d{1,5}$',
      para: '0{0,4}\\d{1,5}',
    });
    expect(n0727.schema.ajustes).toBeUndefined();
    expect(n0209.schema.documento).toBe('nfse');
  });

  test('a DPS mínima serializa e valida nos dois pacotes, com série sem as âncoras literais', () => {
    for (const m of [n0209, n0727]) {
      const xml = serializarRaiz(m.DPSElement, { versao: '1.01', infDPS: infDps() });
      expect(xml.startsWith(`<DPS xmlns="${NS}" versao="1.01"><infDPS Id="DPS3550308211222333000181`)).toBe(true);
      expect(validarRaiz(m.DPSElement, xml)).toEqual([]);
    }
    const literal = serializarRaiz(n0209.DPSElement, { versao: '1.01', infDPS: infDps({ serie: '^1$' }) });
    expect(validarRaiz(n0209.DPSElement, literal).map((i) => i.caminho)).toContain('/DPS/infDPS/serie');
  });

  test('CNPJ alfanumérico só no 20260727', () => {
    const inf = infDps({ CNPJ: '12ABC34501DE35' });
    const x27 = serializarRaiz(n0727.DPSElement, { versao: '1.01', infDPS: inf });
    expect(validarRaiz(n0727.DPSElement, x27)).toEqual([]);
    const x09 = serializarRaiz(n0209.DPSElement, { versao: '1.01', infDPS: inf });
    expect(validarRaiz(n0209.DPSElement, x09).length).toBeGreaterThan(0);
  });

  test('a Signature fica como XML bruto em $any', () => {
    const sig = '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo/></Signature>';
    const xml = serializarRaiz(n0727.DPSElement, { versao: '1.01', infDPS: infDps() }).replace(
      '</DPS>',
      `${sig}</DPS>`,
    );
    expect(validarRaiz(n0727.DPSElement, xml)).toEqual([]);
    const { valor: value, ocorrencias: issues } = decodificarXml(n0727.DPSElement, xml);
    expect(issues).toEqual([]);
    expect(value.$any?.[0]).toContain('<SignedInfo');
  });

  test('vigência: 20260209 até 09/08/2026 em produção; 20260727 desde 27/07 na produção restrita e 10/08 em produção', () => {
    const at = (iso: string) => relogioFixo(iso);
    expect(selecionarPl('nfse', 'producao', at('2026-08-09T23:59:00-03:00')).modulo).toBe('nfse/1.01-20260209');
    expect(selecionarPl('nfse', 'producao', at('2026-08-10T00:00:00-03:00')).modulo).toBe('nfse/1.01-20260727');
    expect(selecionarPl('nfse', 'homologacao', at('2026-07-26T12:00:00-03:00')).modulo).toBe('nfse/1.01-20260209');
    expect(selecionarPl('nfse', 'homologacao', at('2026-07-27T00:00:00-03:00')).modulo).toBe('nfse/1.01-20260727');
    expect(() => selecionarPl('nfse', 'producao', at('2026-01-01T12:00:00-03:00'))).toThrow('nenhum PL de nfse');
  });
});
