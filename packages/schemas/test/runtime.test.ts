import { describe, expect, test } from 'bun:test';
import type { SchemaIssue, SimpleType } from '../src/index.ts';
import {
  checkSimple,
  compareCalendar,
  compareDecimal,
  compileXsdRegex,
  isComplexType,
  maxOccurs,
  minOccurs,
  XsdRegexError,
  xsdRegexToJs,
} from '../src/index.ts';

function codes(t: SimpleType, v: string): string[] {
  const out: SchemaIssue[] = [];
  checkSimple(t, v, '/x', out);
  return out.map((o) => o.code);
}

describe('regex do XSD para JS', () => {
  test('ancorada, \\d é dígito Unicode, \\s é só whitespace XML, ^ e $ literais', () => {
    expect(compileXsdRegex('[0-9]{3}').test('1234')).toBe(false);
    expect(compileXsdRegex('\\d{2}').test('\u0661\u0662')).toBe(true);
    expect(compileXsdRegex('a\\sb').test('a\tb')).toBe(true);
    expect(compileXsdRegex('a\\sb').test('a\u00A0b')).toBe(false);
    expect(compileXsdRegex('[a\\s]+').test('a a')).toBe(true);
    expect(compileXsdRegex('\\S+').test('ab')).toBe(true);
    expect(compileXsdRegex('\\D').test('a')).toBe(true);
    expect(compileXsdRegex('a^b$').test('a^b$')).toBe(true);
    expect(compileXsdRegex('a\\-b').test('a-b')).toBe(true);
    expect(compileXsdRegex('[a\\-z]').test('-')).toBe(true);
    expect(compileXsdRegex('\\p{Lu}+').test('ÁB')).toBe(true);
    expect(compileXsdRegex('[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}').test('M&M Açúcar')).toBe(true);
  });

  test('\\S e \\D dentro de classe positiva viram alternância (XSD da NFS-e)', () => {
    const naoBranco = compileXsdRegex('[\\s\\S]*[^\\s][\\s\\S]*');
    expect(naoBranco.test(' a\n')).toBe(true);
    expect(naoBranco.test(' \t\n')).toBe(false);
    expect(naoBranco.test('')).toBe(false);
    expect(xsdRegexToJs('[\\S]')).toBe('^(?:(?:[^ \\t\\n\\r]))$');
    const desc = compileXsdRegex('[\\s\\S!-ÿ]{1}[\\s\\S -ÿ]{0,}[\\s\\S!-ÿ]{1}|[\\s\\S!-ÿ]{1}');
    expect(desc.test('x')).toBe(true);
    expect(desc.test('linha\noutra')).toBe(true);
    const digito = compileXsdRegex('[a\\D]');
    expect(digito.test('b')).toBe(true);
    expect(digito.test('1')).toBe(false);
    expect(compileXsdRegex('[\\S\\S]').test('x')).toBe(true);
    // `[` escapado é literal, não subtração de classe, com ou sem os escapes negados.
    expect(compileXsdRegex('[\\[]').test('[')).toBe(true);
    const colchete = compileXsdRegex('[\\[\\D]');
    expect(colchete.test('[')).toBe(true);
    expect(colchete.test('1')).toBe(false);
    expect(xsdRegexToJs('a|b')).toBe('^(?:a|b)$');
  });

  test('construções não implementadas abortam', () => {
    for (const p of [
      '\\i',
      '\\c',
      '\\w',
      '\\W',
      '\\I',
      '\\C',
      '\\p{IsBasicLatin}',
      '[a-z-[aeiou]]',
      '[^\\D]',
      '[^a\\S]',
      '[a-z-[\\S]]',
      'a\\',
      '\\pL',
    ]) {
      expect(() => xsdRegexToJs(p)).toThrow(XsdRegexError);
      expect(() => xsdRegexToJs(p)).toThrow(expect.objectContaining({ code: 'nao_suportado' }));
    }
  });
});

describe('checkSimple', () => {
  test('facetas de string e whitespace preserve', () => {
    const t: SimpleType = { b: 'string', mn: 2, mx: 3, e: ['ab', 'abc', ' ab'], nm: 'TX' };
    expect(codes(t, 'ab')).toEqual([]);
    expect(codes(t, 'a')).toEqual(['enumeracao', 'tamanho_minimo']);
    expect(codes(t, 'abcd')).toEqual(['enumeracao', 'tamanho_maximo']);
    expect(codes(t, ' ab')).toEqual([]);
    expect(codes({ b: 'string', l: 2 }, 'ção')).toEqual(['tamanho']);
    expect(codes({ b: 'string', p: [['[0-9]+'], ['1.*']] }, '21')).toEqual(['padrao']);
  });

  test('whiteSpace replace e collapse antes das facetas', () => {
    expect(codes({ b: 'string', ws: 'c', e: ['a b'] }, '  a \n b ')).toEqual([]);
    expect(codes({ b: 'string', ws: 'r', e: ['a  b'] }, 'a\t b')).toEqual([]);
    expect(codes({ b: 'normalizedString', e: ['a b'] }, 'a\nb')).toEqual([]);
    expect(codes({ b: 'token' }, ' a  b ')).toEqual([]);
    expect(codes({ b: 'decimal' }, ' 1.5 ')).toEqual([]);
    // O collapse só mexe em #x20, #x9, #xA e #xD: NBSP e outros espaços Unicode ficam no valor.
    expect(codes({ b: 'decimal' }, '\u00A04.00\u00A0')).toEqual(['tipo_base']);
    expect(codes({ b: 'string', ws: 'c', e: ['a'] }, '\u2003a')).toEqual(['enumeracao']);
  });

  test('decimal, dígitos e limites', () => {
    const t: SimpleType = { b: 'decimal', td: 5, fd: 2, mi: '0', ma: '100.00' };
    expect(codes(t, '99.99')).toEqual([]);
    expect(codes(t, '1.234')).toEqual(['digitos_fracionarios']);
    expect(codes(t, '1234.56')).toEqual(['digitos_totais', 'valor_maximo']);
    expect(codes(t, '-1')).toEqual(['valor_minimo']);
    expect(codes(t, '1.2.3')).toEqual(['tipo_base']);
    expect(codes(t, '000100.0000')).toEqual([]);
    expect(codes({ b: 'decimal', me: '0', mxe: '10' }, '0')).toEqual(['valor_minimo']);
    expect(codes({ b: 'decimal', me: '0', mxe: '10' }, '10')).toEqual(['valor_maximo']);
    expect(codes({ b: 'decimal', me: '0', mxe: '10' }, '.5')).toEqual([]);
  });

  test('inteiros e intervalos', () => {
    expect(codes({ b: 'int' }, '2147483647')).toEqual([]);
    expect(codes({ b: 'int' }, '2147483648')).toEqual(['tipo_base']);
    expect(codes({ b: 'unsignedByte' }, '-1')).toEqual(['tipo_base']);
    expect(codes({ b: 'unsignedByte' }, '255')).toEqual([]);
    expect(codes({ b: 'positiveInteger' }, '0')).toEqual(['tipo_base']);
    expect(codes({ b: 'nonNegativeInteger' }, '0')).toEqual([]);
    expect(codes({ b: 'integer' }, '1.0')).toEqual(['tipo_base']);
  });

  test('datas, binários, ID e anyURI', () => {
    expect(codes({ b: 'date' }, '2026-09-25')).toEqual([]);
    expect(codes({ b: 'date' }, '2026-13-01')).toEqual(['tipo_base']);
    expect(codes({ b: 'date' }, '2026-02-31')).toEqual(['tipo_base']);
    expect(codes({ b: 'date' }, '2026-04-31')).toEqual(['tipo_base']);
    expect(codes({ b: 'date' }, '2026-02-29')).toEqual(['tipo_base']);
    expect(codes({ b: 'date' }, '2028-02-29')).toEqual([]);
    expect(codes({ b: 'date' }, '2100-02-29Z')).toEqual(['tipo_base']);
    expect(codes({ b: 'date' }, '2000-02-29-03:00')).toEqual([]);
    expect(codes({ b: 'dateTime' }, '2026-02-29T10:00:00-03:00')).toEqual(['tipo_base']);
    expect(codes({ b: 'dateTime' }, '2026-09-25T24:00:00Z')).toEqual([]);
    expect(codes({ b: 'dateTime' }, '2026-09-25T24:00:00.000-03:00')).toEqual([]);
    expect(codes({ b: 'dateTime' }, '2026-09-25T24:00:01Z')).toEqual(['tipo_base']);
    expect(codes({ b: 'dateTime' }, '2026-09-25T24:00:00.5Z')).toEqual(['tipo_base']);
    expect(codes({ b: 'time' }, '24:00:00')).toEqual([]);
    expect(codes({ b: 'date' }, '0000-01-01')).toEqual(['tipo_base']);
    expect(codes({ b: 'gYearMonth' }, '0000-01')).toEqual(['tipo_base']);
    expect(codes({ b: 'gYear' }, '0000')).toEqual(['tipo_base']);
    expect(codes({ b: 'toString' }, 'x')).toEqual([]);
    expect(codes({ b: 'dateTime' }, '2026-09-25T10:00:00-03:00')).toEqual([]);
    expect(codes({ b: 'dateTime' }, '2026-09-25 10:00:00')).toEqual(['tipo_base']);
    expect(codes({ b: 'time' }, '23:59:59.5Z')).toEqual([]);
    expect(codes({ b: 'gYearMonth' }, '2026-09')).toEqual([]);
    expect(codes({ b: 'gYearMonth' }, '2026-9')).toEqual(['tipo_base']);
    expect(codes({ b: 'gYear' }, '2026')).toEqual([]);
    expect(codes({ b: 'hexBinary', l: 2 }, 'CAFE')).toEqual([]);
    expect(codes({ b: 'hexBinary' }, 'CAF')).toEqual(['tipo_base']);
    expect(codes({ b: 'base64Binary', l: 20 }, 'MP34UW1mQwIfY1DRzR2ONjWcKFs=')).toEqual([]);
    expect(codes({ b: 'base64Binary', l: 28 }, 'MP34UW1mQwIfY1DRzR2ONjWcKFs=')).toEqual(['tamanho']);
    expect(codes({ b: 'base64Binary' }, 'abc')).toEqual(['tipo_base']);
    // Bits de padding diferentes de zero: o último caractere antes de '=' precisa ser B16, e antes de '==' B04.
    expect(codes({ b: 'base64Binary' }, 'AAB=')).toEqual(['tipo_base']);
    expect(codes({ b: 'base64Binary' }, 'AAA=')).toEqual([]);
    expect(codes({ b: 'base64Binary' }, 'AB==')).toEqual(['tipo_base']);
    expect(codes({ b: 'base64Binary' }, 'AQ==')).toEqual([]);
    expect(codes({ b: 'base64Binary' }, 'AAAA AAAA\nAA==')).toEqual([]);
    expect(codes({ b: 'base64Binary' }, '')).toEqual([]);
    expect(codes({ b: 'ID' }, 'NFe1')).toEqual([]);
    expect(codes({ b: 'ID' }, '1NFe')).toEqual(['tipo_base']);
    expect(codes({ b: 'anyURI', mn: 2 }, '#x')).toEqual([]);
  });

  test('faceta de intervalo em tipos de calendário (TCompetApur: minInclusive 2025-01)', () => {
    const compet: SimpleType = { b: 'gYearMonth', mi: '2025-01' };
    expect(codes(compet, '2025-01')).toEqual([]);
    expect(codes(compet, '2031-12')).toEqual([]);
    expect(codes(compet, '2024-12')).toEqual(['valor_minimo']);
    expect(codes({ b: 'gYearMonth', ma: '2025-01' }, '2025-02')).toEqual(['valor_maximo']);
    expect(codes({ b: 'gYear', me: '2025' }, '2025')).toEqual(['valor_minimo']);
    expect(codes({ b: 'gYear', me: '2025' }, '2026-03:00')).toEqual([]);
    expect(codes({ b: 'date', mxe: '2026-01-01' }, '2025-12-31')).toEqual([]);
    expect(codes({ b: 'dateTime', mi: '2026-09-25T10:00:00-03:00' }, '2026-09-25T13:00:00Z')).toEqual([]);
    expect(codes({ b: 'dateTime', mi: '2026-09-25T10:00:00-03:00' }, '2026-09-25T12:59:59.9Z')).toEqual([
      'valor_minimo',
    ]);
    expect(codes({ b: 'time', ma: '12:00:00' }, '12:00:00.000')).toEqual([]);
  });

  test('compareCalendar: fuso em só um lado dá ordem parcial', () => {
    expect(compareCalendar('dateTime', '2026-09-25T10:00:00Z', '2026-09-25T10:00:00.5Z')).toBe(-1);
    expect(compareCalendar('dateTime', '2026-09-25T24:00:00Z', '2026-09-26T00:00:00Z')).toBe(0);
    expect(compareCalendar('dateTime', '2026-09-25T10:00:00Z', '2026-09-26T10:00:00')).toBe(-1);
    expect(compareCalendar('dateTime', '2026-09-25T10:00:00Z', '2026-09-25T12:00:00')).toBeNaN();
    expect(compareCalendar('date', '-0044-03-15', '2026-01-01')).toBe(-1);
    expect(codes({ b: 'dateTime', mi: '2026-09-25T10:00:00Z' }, '2026-09-25T12:00:00')).toEqual(['valor_minimo']);
  });

  test('compareDecimal sem perder precisão', () => {
    expect(compareDecimal('0.10', '.1')).toBe(0);
    expect(compareDecimal('-0', '+0.0')).toBe(0);
    expect(compareDecimal('12345678901234567890.1', '12345678901234567890.09')).toBe(1);
    expect(compareDecimal('-2', '-10')).toBe(1);
    expect(compareDecimal('-2', '1')).toBe(-2);
    expect(compareDecimal('9', '10')).toBe(-1);
  });

  test('utilitários de descritor', () => {
    expect(isComplexType({ b: 'string' })).toBe(false);
    expect(minOccurs({ w: 1 })).toBe(1);
    expect(maxOccurs({ w: 1, x: -1 })).toBe(Number.POSITIVE_INFINITY);
    expect(maxOccurs({ w: 1, x: 5 })).toBe(5);
  });
});
