/**
 * Tradução de expressão regular do XSD (XML Schema Part 2, apêndice F) para RegExp do JavaScript com flag `u`.
 *
 * A regex do XSD é implicitamente ancorada, `\d` é qualquer dígito Unicode (`\p{Nd}`, como aplica o libxml2) e `\s`
 * é só espaço, TAB, CR e LF. `^` e `$` são literais. `\S` e `\D` dentro de uma classe positiva (`[\s\S]`, comum nos XSD
 * da NFS-e) viram alternância com a classe complementar, porque o JavaScript não aceita classe negada dentro de classe.
 * Construções que o tradutor não implementa (`\i`, `\c`, `\w`, blocos `\p{Is...}`, subtração de classe e `\S` ou
 * `\D` em classe negada) lançam erro, e o gerador aborta em vez de gerar um validador frouxo.
 */

import { ErroNaoSuportado } from '@sinete/core';

/** Construção de regex do XSD que o tradutor não implementa: `nao_suportado`, com o `pattern` em `detalhes`. */
export class XsdRegexError extends ErroNaoSuportado {
  constructor(message: string, pattern?: string) {
    super(`regex do XSD: ${message}`, pattern === undefined ? undefined : { detalhes: { pattern } });
    this.name = 'XsdRegexError';
  }
}

const NEGATED_IN_CLASS: Readonly<Record<string, string>> = { S: '[^ \\t\\n\\r]', D: '\\P{Nd}' };

/** Fim (índice do `]`) da classe que abre em `start`, respeitando escapes; -1 se não fecha. */
function classEnd(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') i++;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return i;
  }
  return -1;
}

/**
 * Classe de primeiro nível com `\S` ou `\D`: `[a\S]` vira `(?:[a]|[^ \t\n\r])`. Devolve a tradução e o índice do
 * `]`, ou `undefined` quando a classe não tem esses escapes.
 */
function splitNegatedEscapes(src: string, start: number): { readonly out: string; readonly end: number } | undefined {
  const end = classEnd(src, start);
  if (end === -1) return undefined;
  const body = src.slice(start + 1, end);
  let rest = '';
  const alts: string[] = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\') {
      const n = body[i + 1] as string;
      const neg = NEGATED_IN_CLASS[n];
      if (neg !== undefined) {
        if (body.startsWith('^')) throw new XsdRegexError(`\\${n} dentro de classe negada`, src);
        if (!alts.includes(neg)) alts.push(neg);
      } else rest += `\\${n}`;
      i++;
    } else if (c === '[') {
      // Classe aninhada sem escape (subtração): o translate recusa com a mensagem própria.
      return undefined;
    } else rest += c;
  }
  if (alts.length === 0) return undefined;
  const parts = rest === '' ? alts : [translate(`[${rest}]`), ...alts];
  return { out: `(?:${parts.join('|')})`, end };
}

export function xsdRegexToJs(src: string): string {
  return `^(?:${translate(src)})$`;
}

function translate(src: string): string {
  let out = '';
  let inClass = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string;
    if (c === '\\') {
      const n = src[++i];
      switch (n) {
        case 'd':
          out += '\\p{Nd}';
          break;
        case 'D':
          if (inClass) throw new XsdRegexError('\\D dentro de classe', src);
          out += '\\P{Nd}';
          break;
        case 's':
          out += inClass ? ' \\t\\n\\r' : '[ \\t\\n\\r]';
          break;
        case 'S':
          if (inClass) throw new XsdRegexError('\\S dentro de classe', src);
          out += '[^ \\t\\n\\r]';
          break;
        case 'i':
        case 'I':
        case 'c':
        case 'C':
        case 'w':
        case 'W':
          throw new XsdRegexError(`escape \\${n} do XSD não implementado`, src);
        case 'p':
        case 'P': {
          const e = src.indexOf('}', i);
          const name = src.slice(i + 2, e);
          if (src[i + 1] !== '{' || e === -1) throw new XsdRegexError('\\p sem chaves', src);
          if (name.startsWith('Is')) throw new XsdRegexError(`bloco ${name} não implementado`, src);
          out += `\\${n}{${name}}`;
          i = e;
          break;
        }
        case '-':
          out += inClass ? '\\-' : '-';
          break;
        case undefined:
          throw new XsdRegexError('barra invertida no fim do pattern', src);
        default:
          out += `\\${n}`;
      }
      continue;
    }
    if (c === '[') {
      if (inClass && src[i - 1] === '-') throw new XsdRegexError('subtração de classe não implementada', src);
      if (!inClass) {
        const split = splitNegatedEscapes(src, i);
        if (split !== undefined) {
          out += split.out;
          i = split.end;
          continue;
        }
      }
      inClass++;
    } else if (c === ']') inClass--;
    else if (!inClass && (c === '^' || c === '$')) {
      out += `\\${c}`;
      continue;
    }
    out += c;
  }
  return out;
}

/** Compila um pattern do XSD. */
export function compileXsdRegex(src: string): RegExp {
  return new RegExp(xsdRegexToJs(src), 'u');
}
