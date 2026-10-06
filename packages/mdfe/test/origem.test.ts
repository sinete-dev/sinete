/**
 * Classificação das ocorrências do `montarMdfe` (ADR 0011) e rótulo em português dos caminhos do MDF-e.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import type { ResultadoMontagemMdfe } from '../src/index.ts';
import { montarMdfe, rotuloDoCaminho } from '../src/index.ts';
import { cargaPropria, opcoes } from './helpers/mdfe.ts';

function falha(r: ResultadoMontagemMdfe): readonly Ocorrencia[] {
  if (r.ok) throw new Error('esperava ocorrências');
  return r.ocorrencias;
}

describe('montarMdfe: origem das ocorrências', () => {
  test('dado da entrada é entrada, inclusive a regra do MOC', async () => {
    const issues = falha(await montarMdfe(cargaPropria({ serie: 1000, percurso: ['MT'] }), opcoes()));
    expect(issues.length).toBeGreaterThan(1);
    expect(issues.every((i) => i.origem === 'entrada')).toBe(true);
  });

  test('tpEmis das opções é montagem', async () => {
    const issues = falha(await montarMdfe(cargaPropria(), opcoes({ tpEmis: '3' as '1' })));
    expect(issues).toEqual([expect.objectContaining({ caminho: 'tpEmis', origem: 'montagem' })]);
  });

  test('caractere fora do XML na entrada é entrada, com o caminho da entrada', async () => {
    const base = cargaPropria();
    const issues = falha(
      await montarMdfe(
        cargaPropria({ produtoPredominante: { ...base.produtoPredominante, xProd: 'SOJA \u0001' } as never }),
        opcoes(),
      ),
    );
    expect(issues).toEqual([
      expect.objectContaining({ caminho: 'produtoPredominante.xProd', code: 'campo_invalido', origem: 'entrada' }),
    ]);
  });

  test('caractere fora do XML nas opções continua sendo do documento montado', async () => {
    const rt = { CNPJ: '11444777000161', xContato: 'SUPORTE \u0001', email: 'rt@exemplo.invalid', fone: '6530000000' };
    const issues = falha(await montarMdfe(cargaPropria(), opcoes({ respTec: rt })));
    expect(issues).toEqual([
      expect.objectContaining({ caminho: 'infMDFe.infRespTec.xContato', code: 'campo_invalido', origem: 'montagem' }),
    ]);
  });
});

describe('rotuloDoCaminho do MDF-e', () => {
  test('caminhos da entrada', () => {
    expect(rotuloDoCaminho('rodoviario.tracao.condutores[0].CPF')).toBe('Condutor 1, CPF');
    expect(rotuloDoCaminho('rodoviario.reboques[1].proprietario.RNTRC')).toBe('Proprietário do reboque 2, RNTRC');
    expect(rotuloDoCaminho('descarregamentos[0].nfe[2].chave')).toBe(
      'Documento 3 do descarregamento 1, Chave de acesso',
    );
    expect(rotuloDoCaminho('emitente.IE')).toBe('Emitente, Inscrição estadual');
    expect(rotuloDoCaminho('percurso')).toBe('Percurso');
  });

  test('caminhos do documento montado, nos dois formatos', () => {
    expect(rotuloDoCaminho('/infMDFe/infDoc/infMunDescarga[2]/infNFe[3]/chNFe')).toBe(
      'Documento 3 do descarregamento 2, Chave de acesso',
    );
    expect(rotuloDoCaminho('/infMDFe/infDoc/infMunDescarga/xMunDescarga')).toBe('Descarregamento 1');
    expect(rotuloDoCaminho('infMDFe.prodPred.xProd')).toBe('Produto predominante, Descrição do produto');
    expect(rotuloDoCaminho('/infMDFe/emit/xNome')).toBe('Emitente, Nome');
  });

  test('sem grupo nem campo conhecido', () => {
    expect(rotuloDoCaminho('qualquer')).toBe('Dados do MDF-e');
  });
});
