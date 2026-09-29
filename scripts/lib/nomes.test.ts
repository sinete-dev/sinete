/** A checagem dos nomes proibidos acha o nome em qualquer grafia e o repositório versionado não tem nenhum. */
import { expect, test } from 'bun:test';
import { nomesNoRepositorio, nomesNoTexto } from './nomes.ts';

const nome = ['Fazenda', 'Nota'];

test('acha o nome nas grafias comuns e a sigla, e deixa passar o resto', () => {
  const grafias = [
    nome.join(''),
    nome.join(' '),
    nome.join('-').toLowerCase(),
    `${nome.join('-').toLowerCase()}-server`,
  ];
  for (const g of grafias) expect(nomesNoTexto('x.md', `o ${g} usa`)).toHaveLength(1);
  expect(nomesNoTexto('x.md', `o container do ${'F'}${'N'} caiu`)).toHaveLength(1);
  expect(nomesNoTexto('x.ts', 'const fn = () => nota; // fazenda, nota fiscal')).toEqual([]);
  expect(nomesNoTexto('x.md', `linha 1\nlinha 2 com ${nome.join('')}`)[0]).toMatchObject({ arquivo: 'x.md', linha: 2 });
});

test('nenhum arquivo versionado do escopo cita o nome', async () => {
  expect(await nomesNoRepositorio()).toEqual([]);
});
