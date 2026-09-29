import { expect, test } from 'bun:test';
import * as f from '../src/format.ts';

test('num: pt-BR em string, com arredondamento meio para cima', () => {
  expect(f.num('1234567.5')).toBe('1.234.567,50');
  expect(f.num('0.125')).toBe('0,13');
  expect(f.num('9.995')).toBe('10,00');
  expect(f.num('-3.4')).toBe('-3,40');
  expect(f.num('-0.001')).toBe('0,00');
  expect(f.num('+1')).toBe('1,00');
  expect(f.num('.5')).toBe('0,50');
  expect(f.num('2.5000', 0, 4)).toBe('2,5');
  expect(f.num('2.0000', 0, 4)).toBe('2');
  expect(f.num('12.3456789012', 2, 10)).toBe('12,3456789012');
  expect(f.num('')).toBe('');
  expect(f.num(undefined)).toBe('');
  expect(f.num('abc')).toBe('abc');
});

test('positivo e soma2', () => {
  expect(f.positivo('0.00')).toBe(false);
  expect(f.positivo('0.01')).toBe(true);
  expect(f.positivo('-1')).toBe(false);
  expect(f.positivo(undefined)).toBe(false);
  expect(f.soma2('1.5', '2.25', undefined, '-0.75')).toBe('3.00');
  expect(f.soma2('-5')).toBe('-5.00');
  expect(f.soma2('0.1')).toBe('0.10');
});

test('documentos, CEP, fone, datas, chave e número', () => {
  expect(f.cnpjCpf('11222333000181')).toBe('11.222.333/0001-81');
  expect(f.cnpjCpf('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
  expect(f.cnpjCpf('11144477735')).toBe('111.444.777-35');
  expect(f.cnpjCpf('X1')).toBe('X1');
  expect(f.cnpjCpf(undefined)).toBe('');
  expect(f.cep('01001000')).toBe('01001-000');
  expect(f.cep('123')).toBe('123');
  expect(f.cep(undefined)).toBe('');
  expect(f.fone('1133334444')).toBe('(11) 3333-4444');
  expect(f.fone('11999998888')).toBe('(11) 99999-8888');
  expect(f.fone('123')).toBe('123');
  expect(f.fone(undefined)).toBe('');
  expect(f.dataHora('2026-09-01T10:20:30-03:00')).toBe('01/09/2026 10:20:30');
  expect(f.data('2026-09-01')).toBe('01/09/2026');
  expect(f.hora('2026-09-01')).toBe('');
  expect(f.data('x')).toBe('');
  expect(f.chave('12345678')).toBe('1234 5678');
  expect(f.numero('1234')).toBe('000.001.234');
  expect(f.numero('X')).toBe('00000000X');
  expect(f.serie('1')).toBe('001');
  expect(f.serie(undefined)).toBe('000');
});
