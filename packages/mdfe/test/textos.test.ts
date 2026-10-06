/**
 * Texto e tamanho dos campos de texto conferidos na entrada do MDF-e (ADR 0011): caminho da entrada, `origem:
 * 'entrada'`, `campo_invalido` e a mensagem para quem preenche, com o tipo vindo do schema do PL.
 */
import { describe, expect, test } from 'bun:test';
import type { Ocorrencia } from '@sinete/core';
import { camposSemElemento } from '@sinete/schemas';
import { TMDFe_infMDFe } from '@sinete/schemas/mdfe/3.00b';
import { CAMPOS } from '../src/build/textos.ts';
import type { DadosMdfeRodoviario, ResultadoMontagemMdfe } from '../src/index.ts';
import { montarMdfe, rotuloDoCaminho } from '../src/index.ts';
import { cargaPropria, opcoes, prestador } from './helpers/mdfe.ts';

function falha(r: ResultadoMontagemMdfe): readonly Ocorrencia[] {
  if (r.ok) throw new Error('esperava ocorrências');
  return r.ocorrencias;
}

async function ocorrencias(e: DadosMdfeRodoviario): Promise<readonly Ocorrencia[]> {
  const issues = falha(await montarMdfe(e, opcoes()));
  for (const i of issues) {
    expect(i.caminho.startsWith('infMDFe') || i.caminho.startsWith('/')).toBe(false);
    expect(i.origem).toBe('entrada');
  }
  return issues;
}

const texto = (caminho: string, mensagem: string): Ocorrencia => ({
  caminho,
  code: 'campo_invalido',
  mensagem,
  origem: 'entrada',
});

const emitente = (xNome: string): DadosMdfeRodoviario => {
  const e = cargaPropria().emitente;
  return cargaPropria({ emitente: { ...e, xNome } });
};

describe('montarMdfe: texto conferido na entrada', () => {
  test('todo campo da tabela tem elemento no infMDFe do PL', () => {
    expect(camposSemElemento(TMDFe_infMDFe as never, CAMPOS)).toEqual([]);
  });

  test('tamanho máximo e mínimo do tipo do elemento', async () => {
    expect(await ocorrencias(emitente('A'.repeat(61)))).toEqual([
      texto('emitente.xNome', 'no máximo 60 caracteres (tem 61)'),
    ]);
    expect(await ocorrencias(emitente('A'))).toEqual([texto('emitente.xNome', 'no mínimo 2 caracteres (tem 1)')]);
    const fisco = cargaPropria({ informacoesAdicionais: { infAdFisco: 'X'.repeat(2001) } });
    expect(await ocorrencias(fisco)).toEqual([
      texto('informacoesAdicionais.infAdFisco', 'no máximo 2000 caracteres (tem 2001)'),
    ]);
  });

  test('em branco, caractere fora do conjunto e duas regras no mesmo campo', async () => {
    expect(await ocorrencias(emitente('   '))).toEqual([texto('emitente.xNome', 'não pode ficar em branco')]);
    expect(await ocorrencias(emitente(''))).toEqual([texto('emitente.xNome', 'não pode ficar em branco')]);
    expect(await ocorrencias(emitente('PRODUTOR € SINTETICO'))).toEqual([
      texto('emitente.xNome', 'caractere não aceito: “€”'),
    ]);
    expect(await ocorrencias(emitente(`${'A'.repeat(61)} `))).toEqual([
      texto('emitente.xNome', 'no máximo 60 caracteres (tem 62)'),
      texto('emitente.xNome', 'sem espaço no começo nem no fim'),
    ]);
  });

  test('listas saem com o índice e o nome da entrada', async () => {
    const base = cargaPropria();
    const condutores = [...base.rodoviario.tracao.condutores, { xNome: 'OUTRO CONDUTOR ', CPF: '11144477735' }];
    const e = cargaPropria({ rodoviario: { ...base.rodoviario, tracao: { ...base.rodoviario.tracao, condutores } } });
    expect(await ocorrencias(e)).toEqual([
      texto('rodoviario.tracao.condutores[1].xNome', 'sem espaço no começo nem no fim'),
    ]);
    const carregamento = [base.carregamento[0], { cMun: '5108402', xMun: 'A'.repeat(61) }] as never;
    expect(await ocorrencias(cargaPropria({ carregamento }))).toEqual([
      texto('carregamento[1].xMun', 'no máximo 60 caracteres (tem 61)'),
    ]);
  });

  test('caractere que o XML não representa, em qualquer texto, e junto com outro campo', async () => {
    const base = cargaPropria();
    const cep = cargaPropria({
      emitente: { ...base.emitente, endereco: { ...base.emitente.endereco, CEP: '78000-000\u0001' } },
    });
    const invisivel = 'caractere não aceito (símbolo ou caractere de controle)';
    expect(await ocorrencias(cep)).toEqual([texto('emitente.endereco.CEP', invisivel)]);
    const descarregamentos = [{ ...base.descarregamentos[0], xMun: 'SAO \u0001 PAULO' }] as never;
    const dois = cargaPropria({ emitente: { ...base.emitente, xNome: 'A'.repeat(61) }, descarregamentos });
    expect(await ocorrencias(dois)).toEqual([
      texto('descarregamentos[0].xMun', invisivel),
      texto('emitente.xNome', 'no máximo 60 caracteres (tem 61)'),
    ]);
  });

  test('o tipo de grupos de modal e de pagamento também vem do schema', async () => {
    const base = prestador();
    const pagamentos = [
      { ...base.rodoviario.pagamentos?.[0], componentes: [{ tpComp: '99', vComp: '4250.50', xComp: ' OUTRO' }] },
    ] as never;
    expect(await ocorrencias(prestador({ rodoviario: { ...base.rodoviario, pagamentos } }))).toEqual([
      texto('rodoviario.pagamentos[0].componentes[0].xComp', 'sem espaço no começo nem no fim'),
    ]);
  });

  test('campos que a montagem transforma continuam aceitos e conferidos por ela', async () => {
    const base = cargaPropria();
    const v = await montarMdfe(
      cargaPropria({
        emitente: { ...base.emitente, endereco: { ...base.emitente.endereco, fone: '(65) 3333-4444' } },
        rodoviario: { ...base.rodoviario, tracao: { ...base.rodoviario.tracao, placa: 'abc-1d23' } },
      }),
      opcoes(),
    );
    expect(
      v.ok && v.valor.xml.includes('<fone>6533334444</fone>') && v.valor.xml.includes('<placa>ABC1D23</placa>'),
    ).toBe(true);
    const fone = cargaPropria({
      emitente: { ...base.emitente, endereco: { ...base.emitente.endereco, fone: '1234567890123' } },
    });
    expect(falha(await montarMdfe(fone, opcoes()))).toEqual([
      expect.objectContaining({ caminho: '/infMDFe/emit/enderEmit/fone', code: 'schema', origem: 'montagem' }),
    ]);
  });

  test('o mesmo texto vem da entrada ou das opções', async () => {
    const rt = { CNPJ: '11444777000161', xContato: 'C'.repeat(61), email: 'rt@exemplo.invalid', fone: '6533334444' };
    expect(await ocorrencias(cargaPropria({ respTec: rt }))).toEqual([
      texto('respTec.xContato', 'no máximo 60 caracteres (tem 61)'),
    ]);
    expect(falha(await montarMdfe(cargaPropria(), opcoes({ respTec: rt })))).toEqual([
      expect.objectContaining({ caminho: '/infMDFe/infRespTec/xContato', code: 'schema', origem: 'montagem' }),
    ]);
  });

  test('o campo que já tem ocorrência da entrada não ganha outra pelo texto', async () => {
    const rt = { CNPJ: '1\u0001', xContato: 'SUPORTE', email: 'rt@exemplo.invalid', fone: '6533334444' };
    const issues = await ocorrencias(cargaPropria({ respTec: rt }));
    expect(issues.map((i) => [i.caminho, i.code])).toEqual([['respTec.CNPJ', 'documento_invalido']]);
  });

  test('os caminhos novos têm grupo e campo no rótulo', () => {
    expect(rotuloDoCaminho('respTec.xContato')).toBe('Responsável técnico, Contato');
    expect(rotuloDoCaminho('informacoesAdicionais.infAdFisco')).toBe(
      'Informações adicionais, Informações de interesse do fisco',
    );
    expect(rotuloDoCaminho('rodoviario.pagamentos[0].componentes[0].xComp')).toBe(
      'Pagamento do frete, Descrição do componente',
    );
    expect(rotuloDoCaminho('produtoPredominante.cEAN')).toBe('Produto predominante, GTIN');
  });
});
