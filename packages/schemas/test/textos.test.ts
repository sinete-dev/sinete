/**
 * Conferência de texto e tamanho na entrada de um montador (`conferirTextos`), com um schema sintético: o tipo vem do
 * elemento apontado pela tabela, os grupos repassados são conferidos campo a campo e o caractere que o XML não
 * representa é recusado em qualquer texto.
 */
import { describe, expect, test } from 'bun:test';
import type { ComplexType, SimpleType } from '../src/index.ts';
import { camposSemElemento, conferirTextos, textoXmlValido } from '../src/index.ts';

const TSTRING = '[!-ÿ]{1}[ -ÿ]{0,}[!-ÿ]{1}|[!-ÿ]{1}';
const nome: SimpleType = { b: 'string', p: [[TSTRING]], mn: 2, mx: 10 };
const codigo: SimpleType = { b: 'string', l: 3 };
const motivo: SimpleType = { b: 'string', e: ['01', '02'] };
const solto: SimpleType = { b: 'string', p: [['[0-9]+']] };

const endereco: ComplexType = {
  id: 'TEnd',
  ns: '',
  c: {
    g: 's',
    i: [
      { e: 'xLgr', t: nome },
      { e: 'nro', t: codigo },
    ],
  },
};
const pessoa: ComplexType = {
  id: 'TPessoa',
  ns: '',
  c: {
    g: 's',
    i: [
      { e: 'xNome', t: nome },
      { e: 'end', t: endereco, n: 0 },
      { e: 'tel', t: solto, n: 0, x: -1 },
    ],
  },
};
const raiz: ComplexType = {
  id: 'TRaiz',
  ns: '',
  c: {
    g: 's',
    i: [
      {
        e: 'emit',
        t: {
          id: 'TEmit',
          ns: '',
          c: {
            g: 'c',
            i: [
              { e: 'xNome', t: nome },
              { e: 'cod', t: codigo },
            ],
          },
        },
      },
      { e: 'item', t: { id: 'TItem', ns: '', c: { g: 's', i: [{ e: 'xProd', t: nome }] } }, x: -1 },
      { e: 'toma', t: pessoa, n: 0 },
      { e: 'motivo', t: motivo, n: 0 },
      { e: 'num', t: solto, n: 0 },
      { w: 1, n: 0 },
    ],
  },
};

const CAMPOS = [
  ['emitente.xNome', 'emit.xNome'],
  ['emitente.cod', 'emit.cod'],
  ['itens[].produto.xProd', 'item.xProd'],
  ['tomador', 'toma'],
  ['motivo', 'motivo'],
  ['numero', 'num'],
] as const;

describe('conferirTextos', () => {
  test('cada regra do tipo vira uma mensagem para quem preenche', () => {
    const r = conferirTextos(
      { emitente: { xNome: `${'A'.repeat(11)} `, cod: 'AB' }, motivo: '03', numero: '1x' },
      raiz,
      CAMPOS,
    );
    expect(r).toEqual([
      { caminho: 'emitente.xNome', mensagem: 'no máximo 10 caracteres (tem 12)' },
      { caminho: 'emitente.xNome', mensagem: 'sem espaço no começo nem no fim' },
      { caminho: 'emitente.cod', mensagem: 'exatamente 3 caracteres (tem 2)' },
      { caminho: 'motivo', mensagem: 'valor não aceito neste campo' },
      { caminho: 'numero', mensagem: 'formato não aceito' },
    ]);
    expect(conferirTextos({ emitente: { xNome: 'A' } }, raiz, CAMPOS)).toEqual([
      { caminho: 'emitente.xNome', mensagem: 'no mínimo 2 caracteres (tem 1)' },
    ]);
    expect(conferirTextos({ emitente: { xNome: 'AB€' } }, raiz, CAMPOS)).toEqual([
      { caminho: 'emitente.xNome', mensagem: 'caractere não aceito: “€”' },
    ]);
    expect(conferirTextos({ emitente: { xNome: 'A​B' } }, raiz, CAMPOS)).toEqual([
      { caminho: 'emitente.xNome', mensagem: 'caractere não aceito (símbolo ou caractere de controle)' },
    ]);
    expect(conferirTextos({ emitente: { xNome: '  ' } }, raiz, CAMPOS)).toEqual([
      { caminho: 'emitente.xNome', mensagem: 'não pode ficar em branco' },
    ]);
  });

  test('listas e grupos repassados no tipo do schema, com o caminho da entrada', () => {
    const entrada = {
      itens: [{ produto: { xProd: 'OK' } }, { produto: { xProd: 'X' } }],
      tomador: { xNome: 'NOME', end: { xLgr: ' RUA', nro: '1' }, tel: ['12', 'a'], extra: 'fora do schema' },
    };
    expect(conferirTextos(entrada, raiz, CAMPOS)).toEqual([
      { caminho: 'itens[1].produto.xProd', mensagem: 'no mínimo 2 caracteres (tem 1)' },
      { caminho: 'tomador.end.xLgr', mensagem: 'sem espaço no começo nem no fim' },
      { caminho: 'tomador.end.nro', mensagem: 'exatamente 3 caracteres (tem 1)' },
      { caminho: 'tomador.tel[1]', mensagem: 'formato não aceito' },
    ]);
  });

  test('caractere que o XML não representa, em qualquer texto, uma vez só', () => {
    const entrada = {
      emitente: { xNome: 'A\u0001B', cod: 'ABC' },
      outro: ['ok', '\u0002'],
      data: new Date(0),
      instancia: new (class {
        readonly x = '\u0003';
      })(),
    };
    expect(conferirTextos(entrada, raiz, CAMPOS)).toEqual([
      { caminho: 'emitente.xNome', mensagem: 'caractere não aceito (símbolo ou caractere de controle)' },
      { caminho: 'outro[1]', mensagem: 'caractere não aceito (símbolo ou caractere de controle)' },
    ]);
  });

  test('o caminho em pular não é conferido, e o campo ausente também não', () => {
    expect(conferirTextos({ emitente: { xNome: 'A\u0001' } }, raiz, CAMPOS, new Set(['emitente.xNome']))).toEqual([]);
    expect(conferirTextos({ emitente: { xNome: 'A' } }, raiz, CAMPOS, new Set(['emitente.xNome']))).toEqual([]);
    expect(conferirTextos({}, raiz, CAMPOS)).toEqual([]);
    expect(conferirTextos({ itens: 'não é lista', tomador: ['não é grupo'] }, raiz, CAMPOS)).toEqual([]);
  });

  test('a tabela aponta para elementos que existem', () => {
    expect(camposSemElemento(raiz, CAMPOS)).toEqual([]);
    expect(
      camposSemElemento(raiz, [
        ['a', 'emit.xNomee'],
        ['b', 'emit.xNome.mais'],
        ['c', 'nada'],
      ]),
    ).toEqual(['a', 'b', 'c']);
  });

  test('textoXmlValido segue a produção Char do XML 1.0', () => {
    expect(textoXmlValido('a\tb\nc\rd ~ é ퟿  � 😀')).toBe(true);
    for (const c of ['\u0000', '\u0008', '\u000b', '\u001f', '￾', '￿', '\ud800']) {
      expect(textoXmlValido(`a${c}`)).toBe(false);
    }
  });
});
