import { expect, test } from 'bun:test';
import { criarRotuloDoCaminho, normalizarCaminho } from '../src/index.ts';

test('normalizarCaminho leva o caminho do XSD à forma com pontos e índice a partir de zero', () => {
  expect(normalizarCaminho('/infNFe/det[2]/prod/xProd')).toBe('infNFe.det[1].prod.xProd');
  expect(normalizarCaminho('/infNFe/ide/natOp')).toBe('infNFe.ide.natOp');
  expect(normalizarCaminho('/infNFe/@Id')).toBe('infNFe.@Id');
  expect(normalizarCaminho('itens[0].produto.xProd')).toBe('itens[0].produto.xProd');
  expect(normalizarCaminho('')).toBe('');
});

const rotulo = criarRotuloDoCaminho({
  grupos: [
    { padrao: /^itens\[(\d+)\]\.sub\[(\d+)\]/, rotulo: (i, s) => `Sub ${s} do item ${i}` },
    { padrao: /^itens\[(\d+)\]/, rotulo: (n) => `Item ${n}` },
    { padrao: /^doc\.det(?:\[(\d+)\])?/, rotulo: (n) => `Item ${n}` },
    { padrao: /^emitente\b/, rotulo: 'Emitente' },
  ],
  campos: { IE: 'Inscrição estadual', xProd: 'Descrição', Emitente: 'Emitente' },
  padrao: 'Dados do documento',
});

test('criarRotuloDoCaminho: grupo e campo, índices somados de um', () => {
  expect(rotulo('emitente.IE')).toBe('Emitente, Inscrição estadual');
  expect(rotulo('itens[1].xProd')).toBe('Item 2, Descrição');
  expect(rotulo('itens[0].sub[2].xProd')).toBe('Sub 3 do item 1, Descrição');
});

test('criarRotuloDoCaminho: caminho do XSD, com e sem índice no elemento repetido', () => {
  expect(rotulo('/doc/det[3]/xProd')).toBe('Item 3, Descrição');
  expect(rotulo('/doc/det/xProd')).toBe('Item 1, Descrição');
});

test('criarRotuloDoCaminho: só o grupo, só o campo ou o padrão', () => {
  expect(rotulo('emitente.endereco')).toBe('Emitente');
  expect(rotulo('outro.IE')).toBe('Inscrição estadual');
  expect(rotulo('outro.x')).toBe('Dados do documento');
  expect(rotulo('')).toBe('Dados do documento');
  // Não repete o grupo quando o campo tem o mesmo rótulo.
  expect(rotulo('emitente.Emitente')).toBe('Emitente');
});
