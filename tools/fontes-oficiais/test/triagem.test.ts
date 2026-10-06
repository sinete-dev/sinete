/**
 * A triagem mais recente (`docs/triagem-fontes-oficiais.md`) e o estado gravado andam juntos: o `--gravar` sai no mesmo
 * PR, então toda publicação dela tem de estar no `estado.json`, na versão triada, senão o vigia volta a acusá-la e a issue
 * reabre com o que já foi decidido. As triagens anteriores ficam de fora: o `--gravar` seguinte tira do estado a versão que
 * o portal substituiu.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Estado } from '../src/comparar.ts';

const raiz = path.join(import.meta.dir, '../../..');
const triagem = readFileSync(path.join(raiz, 'docs/triagem-fontes-oficiais.md'), 'utf8');
const estado = JSON.parse(readFileSync(path.join(raiz, 'tools/fontes-oficiais/estado.json'), 'utf8')) as Estado;

/** Sem acento, sem caixa e sem pontuação de versão: `Nota Técnica 2025.002 v.1.52` e `NT 2025.002 v1.52` se encontram. */
const normalizar = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/versao/g, 'v')
    .replace(/[\s.\-–º°]+/g, '');

interface Publicacao {
  /** A célula de onde ela saiu, para o nome do teste. */
  readonly linha: string;
  /** Como o título do portal começa, já normalizado (`notatecnica`, `informetecnico`, `anexovi`). */
  readonly tipo: string;
  readonly numero?: string;
  readonly versao?: string;
}

const TIPOS: readonly (readonly [RegExp, (m: RegExpExecArray) => string])[] = [
  [/^(?:NFS-e )?NT\b/, () => 'notatecnica'],
  [/^IT\b/, () => 'informetecnico'],
  [/^Ato Técnico Conjunto\b/, () => 'atotecnicoconjunto'],
  [/^Anexo ([IVX]+)\b/, (m) => `anexo${(m[1] ?? '').toLowerCase()}`],
];

/**
 * Primeira coluna das tabelas: uma ou mais publicações separadas por vírgula (`NFS-e NT 009 v1.01, Anexo VI v1.04.01`),
 * cada uma com o tipo, o número quando houver e a versão inteira.
 */
function publicacoes(md: string): Publicacao[] {
  const out: Publicacao[] = [];
  for (const linha of md.split('\n')) {
    const celula = /^\| ([^|]+) \|/.exec(linha)?.[1]?.trim();
    if (celula === undefined || celula === 'Publicação' || /^-+$/.test(celula)) continue;
    for (const parte of celula.split(/,\s*/)) {
      const casou = TIPOS.map(([re, f]) => {
        const m = re.exec(parte);
        return m === null ? undefined : f(m);
      }).find((t) => t !== undefined);
      if (casou === undefined) throw new Error(`publicação de tipo desconhecido na triagem: ${parte}`);
      const numero = /\d{4}\.\d{3}|\d{2}\/\d{4}|\b\d{3}\b/.exec(parte)?.[0];
      const versao = /v(\d+(?:\.\d+)+)/.exec(parte)?.[1];
      if (numero === undefined && versao === undefined) throw new Error(`publicação sem número nem versão: ${parte}`);
      out.push({
        linha: parte,
        tipo: casou,
        ...(numero === undefined ? {} : { numero }),
        ...(versao === undefined ? {} : { versao }),
      });
    }
  }
  return out;
}

/** O título começa pelo tipo e traz o número e a versão inteiros, sem dígito colado antes ou depois. */
function casa(titulo: string, p: Publicacao): boolean {
  if (!titulo.startsWith(p.tipo)) return false;
  const inteiro = (x: string): RegExp => new RegExp(`(?<!\\d)${x}(?!\\d)`);
  if (p.numero !== undefined && !inteiro(normalizar(p.numero)).test(titulo)) return false;
  return p.versao === undefined || new RegExp(`v${normalizar(p.versao)}(?!\\d)`).test(titulo);
}

/** A seção `## dd/mm/aaaa` de data mais recente. */
function maisRecente(md: string): string {
  const secoes = md.split(/^## /m).slice(1);
  const datada = secoes
    .map((s) => ({ s, d: /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s) }))
    .filter((x): x is { s: string; d: RegExpExecArray } => x.d !== null)
    .map(({ s, d }) => ({ s, chave: `${d[3]}${d[2]}${d[1]}` }))
    .sort((a, b) => b.chave.localeCompare(a.chave));
  if (datada[0] === undefined) throw new Error('triagem sem seção datada');
  return datada[0].s;
}

describe('triagem das fontes oficiais', () => {
  const titulos = Object.values(estado.fontes).flatMap((f) => f.itens.map((i) => normalizar(i.titulo)));
  const lidas = publicacoes(maisRecente(triagem));

  test('só a seção mais recente conta', () => {
    const md =
      '## 01/01/2026\n\n| Publicação |\n| NT 1999.001 v9.99 |\n\n## 06/10/2026\n\n| Publicação |\n| NT 2025.002 v1.52 |\n';
    expect(publicacoes(maisRecente(md)).map((p) => p.numero)).toEqual(['2025.002']);
  });

  test('cada publicação de uma linha agrupada conta sozinha, pelo tipo', () => {
    const [nt, anexo] = publicacoes('| NFS-e NT 009 v1.01, Anexo VI v1.04.01 | x |');
    const tituloDoAnexo = normalizar('AnexoVI-LeiautesRN_RTC_IBSCBS-v1.04.01 - NT009 v1.01');
    expect(nt && casa(tituloDoAnexo, nt)).toBe(false);
    expect(anexo && casa(tituloDoAnexo, anexo)).toBe(true);
    expect(nt && casa(normalizar('Nota Técnica 2026.009 v.1.01'), nt)).toBe(false);
  });

  test('a seção mais recente tem publicações', () => {
    expect(lidas.length).toBeGreaterThan(0);
  });

  test.each(lidas.map((p) => [p.linha, p] as const))('%s está no estado gravado', (_, p) => {
    expect(titulos.some((t) => casa(t, p))).toBe(true);
  });
});
