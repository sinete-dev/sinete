import { describe, expect, test } from 'bun:test';
import type { OcorrenciaSchema, SimpleType } from '../src/index.ts';
import {
  compararCalendario,
  compararDecimal,
  compilarRegexXsd,
  conferirTipoSimples,
  ErroRegexXsd,
  ehComplexType,
  maxOccurs,
  minOccurs,
  regexXsdParaJs,
} from '../src/index.ts';

function codes(t: SimpleType, v: string): string[] {
  const out: OcorrenciaSchema[] = [];
  conferirTipoSimples(t, v, '/x', out);
  return out.map((o) => o.code);
}

describe('regex do XSD para JS', () => {
  test('ancorada, \\d é dígito Unicode, \\s é só whitespace XML, ^ e $ literais', () => {
    expect(compilarRegexXsd('[0-9]{3}').test('1234')).toBe(false);
    expect(compilarRegexXsd('\\d{2}').test('\u0661\u0662')).toBe(true);
    expect(compilarRegexXsd('a\\sb').test('a\tb')).toBe(true);
    expect(compilarRegexXsd('a\\sb').test('a\u00A0b')).toBe(false);
    expect(compilarRegexXsd('[a\\s]+').test('a a')).toBe(true);
    expect(compilarRegexXsd('\\S+').test('ab')).toBe(true);
    expect(compilarRegexXsd('\\D').test('a')).toBe(true);
    expect(compilarRegexXsd('a^b$').test('a^b$')).toBe(true);
    expect(compilarRegexXsd('a\\-b').test('a-b')).toBe(true);
    expect(compilarRegexXsd('[a\\-z]').test('-')).toBe(true);
    expect(compilarRegexXsd('\\p{Lu}+').test('ÁB')).toBe(true);
    expect(compilarRegexXsd('[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}').test('M&M Açúcar')).toBe(true);
  });

  test('\\S e \\D dentro de classe positiva viram alternância (XSD da NFS-e)', () => {
    const naoBranco = compilarRegexXsd('[\\s\\S]*[^\\s][\\s\\S]*');
    expect(naoBranco.test(' a\n')).toBe(true);
    expect(naoBranco.test(' \t\n')).toBe(false);
    expect(naoBranco.test('')).toBe(false);
    expect(regexXsdParaJs('[\\S]')).toBe('^(?:(?:[^ \\t\\n\\r]))$');
    const desc = compilarRegexXsd('[\\s\\S!-ÿ]{1}[\\s\\S -ÿ]{0,}[\\s\\S!-ÿ]{1}|[\\s\\S!-ÿ]{1}');
    expect(desc.test('x')).toBe(true);
    expect(desc.test('linha\noutra')).toBe(true);
    const digito = compilarRegexXsd('[a\\D]');
    expect(digito.test('b')).toBe(true);
    expect(digito.test('1')).toBe(false);
    expect(compilarRegexXsd('[\\S\\S]').test('x')).toBe(true);
    // `[` escapado é literal, não subtração de classe, com ou sem os escapes negados.
    expect(compilarRegexXsd('[\\[]').test('[')).toBe(true);
    const colchete = compilarRegexXsd('[\\[\\D]');
    expect(colchete.test('[')).toBe(true);
    expect(colchete.test('1')).toBe(false);
    expect(regexXsdParaJs('a|b')).toBe('^(?:a|b)$');
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
      expect(() => regexXsdParaJs(p)).toThrow(ErroRegexXsd);
      expect(() => regexXsdParaJs(p)).toThrow(expect.objectContaining({ code: 'nao_suportado' }));
    }
  });
});

describe('conferirTipoSimples', () => {
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

  test('compararCalendario: fuso em só um lado dá ordem parcial', () => {
    expect(compararCalendario('dateTime', '2026-09-25T10:00:00Z', '2026-09-25T10:00:00.5Z')).toBe(-1);
    expect(compararCalendario('dateTime', '2026-09-25T24:00:00Z', '2026-09-26T00:00:00Z')).toBe(0);
    expect(compararCalendario('dateTime', '2026-09-25T10:00:00Z', '2026-09-26T10:00:00')).toBe(-1);
    expect(compararCalendario('dateTime', '2026-09-25T10:00:00Z', '2026-09-25T12:00:00')).toBeNaN();
    expect(compararCalendario('date', '-0044-03-15', '2026-01-01')).toBe(-1);
    expect(codes({ b: 'dateTime', mi: '2026-09-25T10:00:00Z' }, '2026-09-25T12:00:00')).toEqual(['valor_minimo']);
  });

  test('compararDecimal sem perder precisão', () => {
    expect(compararDecimal('0.10', '.1')).toBe(0);
    expect(compararDecimal('-0', '+0.0')).toBe(0);
    expect(compararDecimal('12345678901234567890.1', '12345678901234567890.09')).toBe(1);
    expect(compararDecimal('-2', '-10')).toBe(1);
    expect(compararDecimal('-2', '1')).toBe(-2);
    expect(compararDecimal('9', '10')).toBe(-1);
  });

  test('utilitários de descritor', () => {
    expect(ehComplexType({ b: 'string' })).toBe(false);
    expect(minOccurs({ w: 1 })).toBe(1);
    expect(maxOccurs({ w: 1, x: -1 })).toBe(Number.POSITIVE_INFINITY);
    expect(maxOccurs({ w: 1, x: 5 })).toBe(5);
  });
});
