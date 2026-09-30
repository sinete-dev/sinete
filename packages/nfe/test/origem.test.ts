/**
 * Classificação das ocorrências do `buildNfe` (ADR 0011): `entrada` para o que foi conferido na `NfeInput`, `montagem`
 * para o que foi conferido no que o sinete produziu (XML contra o XSD e o PL, calculadora de IBS/CBS). E o rótulo em
 * português dos dois formatos de caminho.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import type { BuildNfeResult, IbsCbsCalculator, Item } from '../src/index.ts';
import { buildNfe, rotuloDoCaminho } from '../src/index.ts';
import { item, nota, opcoes } from './helpers/nota.ts';

function falha(r: BuildNfeResult): readonly Ocorrencia[] {
  if (r.ok) throw new Error('esperava ocorrências');
  return r.issues;
}

describe('buildNfe: origem das ocorrências', () => {
  test('dado da entrada é entrada, inclusive a ocorrência vinda de um validador', async () => {
    const e = nota().emitente;
    const issues = falha(await buildNfe(nota({ emitente: { ...e, IE: '123' } }), opcoes()));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.origem === 'entrada')).toBe(true);
    expect(issues.map((i) => i.caminho)).toContain('emitente.IE');
  });

  test('cNF informado recusado pela regra da chave é entrada, no campo cNF', async () => {
    const issues = falha(await buildNfe(nota({ cNF: '00000000' }), opcoes()));
    expect(issues).toEqual([expect.objectContaining({ caminho: 'cNF', code: 'chave_invalida', origem: 'entrada' })]);
  });

  test('schema do XML montado é montagem', async () => {
    const issues = falha(await buildNfe(nota({ natOp: 'X'.repeat(61) }), opcoes()));
    expect(issues).toEqual([
      expect.objectContaining({ code: 'schema', caminho: '/infNFe/ide/natOp', origem: 'montagem' }),
    ]);
  });

  test('caractere fora do XML é conferido no documento montado', async () => {
    const issues = falha(await buildNfe(nota({ natOp: 'VENDA \u0001' }), opcoes()));
    expect(issues).toEqual([
      expect.objectContaining({ caminho: 'infNFe.ide.natOp', code: 'campo_invalido', origem: 'montagem' }),
    ]);
  });

  test('ocorrência da calculadora sem origem é montagem; a marcada fica como veio', async () => {
    const calculadora: IbsCbsCalculator = {
      calcular: () => ({
        itens: [],
        issues: [
          { caminho: 'itens[0].impostos.ibsCbs', code: 'ibscbs_calculo', mensagem: 'sem origem' },
          { caminho: 'itens[0].impostos.ibsCbs', code: 'ibscbs_nao_suportado', mensagem: 'marcada', origem: 'entrada' },
        ],
      }),
    };
    const b = item();
    const it: Item = {
      ...b,
      impostos: { ...b.impostos, ibsCbs: { classificacao: { CST: '000', cClassTrib: '000001', vBC: '10.00' } } },
    };
    const issues = falha(await buildNfe(nota({ itens: [it] }), opcoes({ ibsCbs: calculadora })));
    expect(issues.find((i) => i.mensagem === 'sem origem')?.origem).toBe('montagem');
    expect(issues.find((i) => i.mensagem === 'marcada')?.origem).toBe('entrada');
  });

  test('grupo IBSCBS pronto com erro de schema é da entrada', async () => {
    const b = item();
    const grupo = { CST: '000', cClassTrib: '000001', gIBSCBS: { vBC: '15.00' } };
    const it: Item = {
      ...b,
      impostos: { ...b.impostos, ibsCbs: { grupo } as unknown as NonNullable<Item['impostos']['ibsCbs']> },
    };
    const issues = falha(await buildNfe(nota({ itens: [it] }), opcoes()));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.code === 'schema' && i.origem === 'entrada')).toBe(true);
  });
});

describe('rotuloDoCaminho da NF-e', () => {
  test('caminhos da entrada', () => {
    expect(rotuloDoCaminho('emitente.IE')).toBe('Emitente, Inscrição estadual');
    expect(rotuloDoCaminho('destinatario.endereco.CEP')).toBe('Destinatário, CEP');
    expect(rotuloDoCaminho('itens[1].produto.xProd')).toBe('Item 2, Descrição do produto');
    expect(rotuloDoCaminho('itens[0].impostos.icms.CST')).toBe('ICMS do item 1, CST');
    expect(rotuloDoCaminho('itens[2].impostos.ibsCbs.classificacao.vBC')).toBe('IBS/CBS do item 3, Base de cálculo');
    expect(rotuloDoCaminho('referenciadas[0].refNFP.AAMM')).toBe(
      'Nota referenciada, Mês de emissão da nota referenciada',
    );
    expect(rotuloDoCaminho('pagamento.detPag[0].tPag')).toBe('Pagamento, Meio de pagamento');
  });

  test('caminhos do documento montado, nos dois formatos', () => {
    expect(rotuloDoCaminho('/infNFe/ide/natOp')).toBe('Identificação da nota, Natureza da operação');
    expect(rotuloDoCaminho('/infNFe/det[2]/prod/xProd')).toBe('Item 2, Descrição do produto');
    expect(rotuloDoCaminho('/infNFe/det/prod/xProd')).toBe('Item 1, Descrição do produto');
    expect(rotuloDoCaminho('infNFe.det[0].prod.xProd')).toBe('Item 1, Descrição do produto');
    expect(rotuloDoCaminho('/infNFe/det[3]/imposto/IBSCBS/gIBSCBS/vBC')).toBe('IBS/CBS do item 3, Base de cálculo');
  });

  test('sem grupo nem campo conhecido', () => {
    expect(rotuloDoCaminho('modelo')).toBe('Dados da NF-e');
    expect(rotuloDoCaminho('serie')).toBe('Série');
  });
});
