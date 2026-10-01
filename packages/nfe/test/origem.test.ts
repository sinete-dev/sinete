/**
 * Classificação das ocorrências do `montarNfe` (ADR 0011): `entrada` para o que foi conferido na `DadosNfe`, `montagem`
 * para o que foi conferido no que o sinete produziu (XML contra o XSD e o PL, calculadora de IBS/CBS). E o rótulo em
 * português dos dois formatos de caminho.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import type { CalculadoraIbsCbs, Item, ResultadoMontagemNfe } from '../src/index.ts';
import { montarNfe, rotuloDoCaminho } from '../src/index.ts';
import { item, nota, opcoes } from './helpers/nota.ts';

function falha(r: ResultadoMontagemNfe): readonly Ocorrencia[] {
  if (r.ok) throw new Error('esperava ocorrências');
  return r.ocorrencias;
}

describe('montarNfe: origem das ocorrências', () => {
  test('dado da entrada é entrada, inclusive a ocorrência vinda de um validador', async () => {
    const e = nota().emitente;
    const issues = falha(await montarNfe(nota({ emitente: { ...e, IE: '123' } }), opcoes()));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.origem === 'entrada')).toBe(true);
    expect(issues.map((i) => i.caminho)).toContain('emitente.IE');
  });

  test('cNF informado recusado pela regra da chave é entrada, no campo cNF', async () => {
    const issues = falha(await montarNfe(nota({ cNF: '00000000' }), opcoes()));
    expect(issues).toEqual([expect.objectContaining({ caminho: 'cNF', code: 'chave_invalida', origem: 'entrada' })]);
  });

  test('texto longo num campo da entrada é da entrada, com o caminho da entrada', async () => {
    const issues = falha(await montarNfe(nota({ natOp: 'X'.repeat(61) }), opcoes()));
    expect(issues).toEqual([
      { caminho: 'natOp', code: 'campo_invalido', mensagem: 'no máximo 60 caracteres (tem 61)', origem: 'entrada' },
    ]);
  });

  test('caractere fora do XML na entrada é da entrada, com o caminho da entrada', async () => {
    const issues = falha(await montarNfe(nota({ natOp: 'VENDA \u0001' }), opcoes()));
    expect(issues).toEqual([
      {
        caminho: 'natOp',
        code: 'campo_invalido',
        mensagem: 'caractere não aceito (símbolo ou caractere de controle)',
        origem: 'entrada',
      },
    ]);
  });

  test('texto da entrada fora do tipo do leiaute sai como campo_invalido, com mensagem para quem preenche', async () => {
    const e = nota().emitente;
    const casos: [Partial<Parameters<typeof nota>[0]>, string][] = [
      [{ emitente: { ...e, xNome: 'X'.repeat(70) } }, 'no máximo 60 caracteres (tem 70)'],
      [{ natOp: ' VENDA' }, 'sem espaço no começo nem no fim'],
      [{ natOp: 'VENDA ' }, 'sem espaço no começo nem no fim'],
      [{ natOp: 'VENDA \u2013 BALCÃO' }, 'caractere não aceito: “\u2013”'],
      [{ natOp: 'VENDA \u{1F600}' }, 'caractere não aceito: “\u{1F600}”'],
      [{ natOp: 'VENDA\u200B' }, 'caractere não aceito (símbolo ou caractere de controle)'],
      [{ natOp: 'VENDA \u0007' }, 'caractere não aceito (símbolo ou caractere de controle)'],
      [{ natOp: '   ' }, 'não pode ficar em branco'],
    ];
    for (const [campos, mensagem] of casos) {
      const issues = falha(await montarNfe(nota(campos), opcoes()));
      expect(issues).toHaveLength(1);
      const [i] = issues;
      expect(i).toMatchObject({ code: 'campo_invalido', mensagem, origem: 'entrada' });
      expect(i?.mensagem).not.toMatch(/xml|schema|pattern|TString|tamanho_|padrao/i);
    }
  });

  test('texto com várias regras violadas tem uma ocorrência por regra, no mesmo caminho', async () => {
    const issues = falha(await montarNfe(nota({ natOp: ` ${'Y'.repeat(60)}\u2013` }), opcoes()));
    expect(issues).toEqual([
      { caminho: 'natOp', code: 'campo_invalido', mensagem: 'no máximo 60 caracteres (tem 62)', origem: 'entrada' },
      { caminho: 'natOp', code: 'campo_invalido', mensagem: 'sem espaço no começo nem no fim', origem: 'entrada' },
      { caminho: 'natOp', code: 'campo_invalido', mensagem: 'caractere não aceito: “\u2013”', origem: 'entrada' },
    ]);
  });

  test('schema de um grupo repassado que a entrada não confere campo a campo continua da montagem', async () => {
    const issues = falha(
      await montarNfe(
        nota({ infIntermed: { CNPJ: '11222333000181', idCadIntTran: 'X'.repeat(61) }, indIntermed: '1' }),
        opcoes(),
      ),
    );
    expect(issues).toEqual([
      expect.objectContaining({ code: 'schema', caminho: '/infNFe/infIntermed/idCadIntTran', origem: 'montagem' }),
    ]);
    // A montagem segue com a mensagem do validador: é falha de integração, não texto para a tela.
    expect(issues[0]?.mensagem).toContain('tamanho_maximo');
  });

  test('ocorrência da calculadora sem origem é montagem; a marcada fica como veio', async () => {
    const calculadora: CalculadoraIbsCbs = {
      calcular: () => ({
        itens: [],
        ocorrencias: [
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
    const issues = falha(await montarNfe(nota({ itens: [it] }), opcoes({ ibsCbs: calculadora })));
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
    const issues = falha(await montarNfe(nota({ itens: [it] }), opcoes()));
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
