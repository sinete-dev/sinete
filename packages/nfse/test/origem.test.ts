/** Classificação das ocorrências do `montarDps` (ADR 0011). */
import { describe, expect, test } from 'bun:test';
import { contextoDeTempo, relogioManual } from '@sinete/core';
import { montarDps, rotuloDoCaminho } from '../src/index.ts';
import { dps, EMISSAO } from './helpers.ts';

const opcoes = { ambiente: 'homologacao', tempo: contextoDeTempo({ emissao: relogioManual(EMISSAO) }) } as const;

test('dado da entrada é entrada', async () => {
  const r = await montarDps(dps({ serie: 'X', nDPS: '0' }), opcoes);
  if (r.ok) throw new Error('esperava ocorrências');
  expect(r.ocorrencias.length).toBeGreaterThan(1);
  expect(r.ocorrencias.every((i) => i.origem === 'entrada')).toBe(true);
});

test('schema do XML montado é montagem', async () => {
  const base = dps();
  const r = await montarDps(dps({ servico: { ...base.servico, xDescServ: 'X'.repeat(3000) } }), opcoes);
  if (r.ok) throw new Error('esperava ocorrências');
  expect(r.ocorrencias.length).toBeGreaterThan(0);
  expect(r.ocorrencias.every((i) => i.code === 'schema' && i.origem === 'montagem')).toBe(true);
});

describe('rotuloDoCaminho da DPS', () => {
  test('todo caminho da entrada que o montador produz tem rótulo próprio', async () => {
    const base = dps();
    const provocadas = await Promise.all([
      montarDps(dps({ serie: 'X', nDPS: '0', cLocEmi: '1' }), opcoes),
      montarDps(
        dps({
          prestador: { ...base.prestador, CNPJ: undefined, CPF: '11144477736' } as never,
          tomador: { CNPJ: '44555666000180', xNome: 'X' } as never,
          intermediario: { CPF: '11144477736', xNome: 'Y' } as never,
          servico: { ...base.servico, cTribNac: 'abc' },
          valores: { vServ: '1.234', vReceb: 'x', vDescIncond: 'x', vDescCond: 'x' },
          tributacao: { issqn: { tribISSQN: '1', tpRetISSQN: '1', pAliq: '2.123' }, totTrib: { indTotTrib: '0' } },
          ibsCbs: {
            cIndOp: '100301',
            indDest: '0',
            classificacao: {
              CST: '000',
              cClassTrib: '000001',
              diferimento: { pDifUF: 'x', pDifMun: 'x', pDifCBS: 'x' },
            },
          },
        }),
        opcoes,
      ),
    ]);
    const caminhos = new Set<string>();
    for (const r of provocadas) if (!r.ok) for (const o of r.ocorrencias) caminhos.add(o.caminho);
    for (const c of ['dCompet', 'prestador', 'tomador', 'intermediario', 'tributacao.totTrib.pTotTribSN'])
      caminhos.add(c);
    expect(caminhos.size).toBeGreaterThan(15);
    for (const c of caminhos) {
      const r = rotuloDoCaminho(c);
      expect([c, r]).not.toEqual([c, 'Dados da DPS']);
      expect(r).not.toBe(c);
    }
    expect(rotuloDoCaminho('prestador.CPF')).toBe('Prestador, CPF');
    expect(rotuloDoCaminho('valores.vServ')).toBe('Valores, Valor do serviço');
    expect(rotuloDoCaminho('ibsCbs.classificacao.diferimento.pDifUF')).toBe(
      'Diferimento do IBS/CBS, Diferimento da UF',
    );
  });

  test('documentos repetidos numerados a partir de um, na entrada e no XML', () => {
    expect(rotuloDoCaminho('valores.deducaoReducao.documentos.docDedRed[0].vDedutivelRedutivel')).toBe(
      'Documento de dedução 1, Valor dedutível ou redutível',
    );
    expect(rotuloDoCaminho('ibsCbs.reembolsos.documentos[2].vDeducaoReducao')).toBe(
      'Documento de reembolso 3, Valor da dedução ou redução',
    );
    expect(rotuloDoCaminho('/DPS/infDPS/IBSCBS/valores/gReeRepRes/documentos[3]/vDeducaoReducao')).toBe(
      'Documento de reembolso 3, Valor da dedução ou redução',
    );
  });

  test('o mesmo campo em grupos diferentes não colapsa', () => {
    expect(rotuloDoCaminho('prestador.CNPJ')).toBe('Prestador, CNPJ');
    expect(rotuloDoCaminho('tomador.CNPJ')).toBe('Tomador, CNPJ');
    expect(rotuloDoCaminho('intermediario.CNPJ')).toBe('Intermediário, CNPJ');
  });

  test('caminhos do documento montado, com pontos e no formato do validador de XSD', async () => {
    const base = dps();
    const r = await montarDps(dps({ servico: { ...base.servico, xDescServ: 'X'.repeat(3000) } }), opcoes);
    if (r.ok) throw new Error('esperava ocorrências');
    expect(r.ocorrencias[0]?.caminho).toBe('/DPS/infDPS/serv/cServ/xDescServ');
    expect(rotuloDoCaminho('/DPS/infDPS/serv/cServ/xDescServ')).toBe('Serviço, Descrição do serviço');
    for (const [ponto, barra] of [
      ['infDPS.toma.xNome', '/DPS/infDPS/toma/xNome'],
      ['infDPS.prest.CNPJ', '/DPS/infDPS/prest/CNPJ'],
      ['infDPS.serv.cServ.xDescServ', '/DPS/infDPS/serv/cServ/xDescServ'],
      [
        'infDPS.valores.vDedRed.documentos.docDedRed[1].vDedutivelRedutivel',
        '/DPS/infDPS/valores/vDedRed/documentos/docDedRed[2]/vDedutivelRedutivel',
      ],
    ] as const) {
      expect(rotuloDoCaminho(barra)).toBe(rotuloDoCaminho(ponto));
    }
    expect(rotuloDoCaminho('/DPS/infDPS/toma/xNome')).toBe('Tomador, Nome');
    expect(rotuloDoCaminho('/infDPS/toma/xNome')).toBe('Tomador, Nome');
    expect(rotuloDoCaminho('/DPS/infDPS/valores/vDedRed/documentos/docDedRed[2]/vDedutivelRedutivel')).toBe(
      'Documento de dedução 2, Valor dedutível ou redutível',
    );
    expect(rotuloDoCaminho('/DPS/infDPS/IBSCBS/valores/trib/gIBSCBS/cClassTrib')).toBe(
      'Classificação do IBS/CBS, Classificação tributária',
    );
  });

  test('sem grupo nem campo conhecido', () => {
    for (const c of ['qualquer', '', '/']) expect(rotuloDoCaminho(c)).toBe('Dados da DPS');
  });
});
