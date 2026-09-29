/**
 * Percurso do MDF-e rodoviário (MOC MDF-e 3.00b Anexo I, regra F90, rejeição 663): a sequência UF de carregamento,
 * UFs de percurso (`infPercurso`) e UF de descarregamento precisa andar entre UFs que fazem divisa, na ordem da viagem.
 * As divisas estão em `data/ufs-vizinhas.json`, com a fonte.
 */

import type { Uf } from '@sinete/core';
import tabela from './data/ufs-vizinhas.json' with { type: 'json' };

/** UF do leiaute do MDF-e (`TUf`): as 27 e `EX` (exterior). */
export type UfMdfe = Uf | 'EX';

const VIZINHAS: Readonly<Record<string, readonly string[]>> = tabela.vizinhas;

/** As duas UFs fazem divisa terrestre. */
export function saoVizinhas(a: string, b: string): boolean {
  return Object.hasOwn(VIZINHAS, a) && (VIZINHAS[a] as readonly string[]).includes(b);
}

/** Primeiro trecho do percurso que não é divisa, ou `undefined` quando o percurso é válido. */
export interface TrechoInvalido {
  /** Posição do trecho na sequência completa (0 = de `ufIni` para a primeira UF seguinte). */
  readonly indice: number;
  readonly de: string;
  readonly para: string;
}

/**
 * Confere o percurso. Um trecho que envolve `EX` não é conferido (a divisa com o exterior não está na tabela). UF
 * repetida em seguida é recusada: a UF de percurso é a atravessada entre as outras duas.
 */
export function conferirPercurso(
  ufIni: UfMdfe,
  percurso: readonly UfMdfe[],
  ufFim: UfMdfe,
): TrechoInvalido | undefined {
  const seq = [ufIni, ...percurso, ufFim];
  if (percurso.length === 0 && ufIni === ufFim) return undefined;
  for (let i = 0; i + 1 < seq.length; i++) {
    const de = seq[i] as string;
    const para = seq[i + 1] as string;
    if (de === 'EX' || para === 'EX') continue;
    if (!saoVizinhas(de, para)) return { indice: i, de, para };
  }
  return undefined;
}

/**
 * Um percurso mínimo (menos UFs atravessadas) entre duas UFs, por busca em largura na tabela de divisas; `[]` para
 * UFs vizinhas ou iguais. Serve de sugestão: a UF de percurso é a da rota real, que pode não ser a mais curta.
 */
export function sugerirPercurso(ufIni: Uf, ufFim: Uf): Uf[] | undefined {
  if (ufIni === ufFim || saoVizinhas(ufIni, ufFim)) return [];
  const anterior = new Map<string, string>([[ufIni, '']]);
  const fila: string[] = [ufIni];
  while (fila.length > 0) {
    const atual = fila.shift() as string;
    for (const v of VIZINHAS[atual] ?? []) {
      if (anterior.has(v)) continue;
      anterior.set(v, atual);
      if (v === ufFim) {
        const caminho: Uf[] = [];
        for (let p = anterior.get(v) as string; p !== ufIni; p = anterior.get(p) as string) caminho.unshift(p as Uf);
        return caminho;
      }
      fila.push(v);
    }
  }
  return undefined;
}
