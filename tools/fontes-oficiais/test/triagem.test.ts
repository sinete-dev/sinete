/**
 * A triagem (`docs/triagem-fontes-oficiais.md`) e o estado gravado andam juntos: toda publicação triada tem de estar no
 * `estado.json`, na versão triada, senão o vigia volta a acusá-la e a issue reabre com o que já foi decidido.
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

/** Primeira coluna das tabelas de cada data: o número e a versão da publicação. */
function publicacoes(md: string): { linha: string; numero: string; versao?: string }[] {
  const out: { linha: string; numero: string; versao?: string }[] = [];
  for (const linha of md.split('\n')) {
    const celula = /^\| ([^|]+) \|/.exec(linha)?.[1]?.trim();
    if (celula === undefined || celula === 'Publicação' || /^-+$/.test(celula)) continue;
    const numero = /\d{4}\.\d{3}|\d{2}\/\d{4}|\b\d{3}\b/.exec(celula)?.[0];
    if (numero === undefined) throw new Error(`publicação sem número na triagem: ${celula}`);
    const versao = /v(\d+\.\d+)/.exec(celula)?.[1];
    out.push({ linha: celula, numero, ...(versao === undefined ? {} : { versao }) });
  }
  return out;
}

describe('triagem das fontes oficiais', () => {
  const titulos = Object.values(estado.fontes).flatMap((f) => f.itens.map((i) => normalizar(i.titulo)));
  const lidas = publicacoes(triagem);

  test('a tabela tem publicações', () => {
    expect(lidas.length).toBeGreaterThan(10);
  });

  test.each(lidas.map((p) => [p.linha, p] as const))('%s está no estado gravado', (_, p) => {
    const numero = normalizar(p.numero);
    const versao = p.versao === undefined ? undefined : `v${normalizar(p.versao)}`;
    const achou = titulos.some((t) => t.includes(numero) && (versao === undefined || t.includes(versao)));
    expect(achou).toBe(true);
  });
});
