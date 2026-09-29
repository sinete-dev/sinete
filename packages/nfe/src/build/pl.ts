/**
 * Escolha do pacote de liberação por vigência e conferência do objeto contra o descritor do PL escolhido.
 *
 * O builder monta sempre na forma do PL mais novo (`PL_010f`). Quando a vigência escolhe um PL mais antigo, o objeto é
 * serializado com o descritor dele; o serializer ignora campos que o descritor não conhece, então antes de serializar
 * `camposForaDoPl` aponta cada campo que sumiria em silêncio.
 */

import type { Ambiente, Clock } from '@sinete/core';
import { UnsupportedError } from '@sinete/core';
import type { ComplexType, Particle, VigenciaEntry } from '@sinete/schemas';
import { isComplexType, isElementParticle, isWildcard, selecionarPl } from '@sinete/schemas';
import { TNFe_infNFe as Inf010e } from '@sinete/schemas/nfe/PL_010e';
import { TNFe_infNFe as Inf010f } from '@sinete/schemas/nfe/PL_010f';
import type { Issues } from '../issues.ts';

/** Descritor de `infNFe` de cada módulo da família `nfe` da tabela de vigências. */
const INF_NFE: Readonly<Record<string, ComplexType>> = {
  'nfe/PL_010e': Inf010e as ComplexType,
  'nfe/PL_010f': Inf010f as ComplexType,
};

export interface PlEscolhido {
  readonly vigencia: VigenciaEntry;
  readonly infNFe: ComplexType;
}

/** PL da NF-e vigente para o ambiente no relógio de emissão (ADR 0002, decisão 6). */
export function escolherPl(ambiente: Ambiente, emissao: Clock): PlEscolhido {
  const vigencia = selecionarPl('nfe', ambiente, emissao);
  const infNFe = INF_NFE[vigencia.modulo];
  if (infNFe === undefined) {
    // A tabela de vigências ganhou um PL que este pacote ainda não conhece: falha explícita, nunca tentativa.
    throw new UnsupportedError(`@sinete/nfe não conhece o módulo ${vigencia.modulo}; atualize o pacote`);
  }
  return { vigencia, infNFe };
}

function memberNames(p: Particle, acc: Set<string>): Set<string> {
  if (isWildcard(p)) acc.add('$any');
  else if (isElementParticle(p)) acc.add(p.e);
  else for (const i of p.i) memberNames(i, acc);
  return acc;
}

function elementTypes(p: Particle, acc: Map<string, ComplexType>): Map<string, ComplexType> {
  if (isWildcard(p)) return acc;
  if (isElementParticle(p)) {
    if (isComplexType(p.t)) acc.set(p.e, p.t);
  } else for (const i of p.i) elementTypes(i, acc);
  return acc;
}

/** Aponta cada chave do objeto que o descritor não declara (o serializer a descartaria sem aviso). */
export function camposForaDoPl(ct: ComplexType, value: unknown, path: string, pl: string, issues: Issues): void {
  if (typeof value !== 'object' || value === null) return;
  const allowed = new Set<string>(['$attrs', '$text']);
  for (const a of ct.a ?? []) allowed.add(a.a);
  if (ct.c) memberNames(ct.c, allowed);
  const children = ct.c ? elementTypes(ct.c, new Map()) : new Map<string, ComplexType>();
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    if (!allowed.has(k)) {
      issues.montagem(`${path}.${k}`, 'campo_fora_do_pl', `o campo não existe no ${pl} vigente para esta emissão`);
      continue;
    }
    const child = children.get(k);
    if (!child) continue;
    if (Array.isArray(v)) {
      for (const [n, x] of v.entries()) camposForaDoPl(child, x, `${path}.${k}[${n}]`, pl, issues);
    } else camposForaDoPl(child, v, `${path}.${k}`, pl, issues);
  }
}
