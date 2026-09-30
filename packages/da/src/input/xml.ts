/**
 * Entrada dos layouts: o XML autorizado chega como string e é lido pelo decoder tolerante do `@sinete/schemas`
 * (ADR 0006, decisão 6), nunca por parse próprio. Ocorrências do decoder (elemento desconhecido de um PL mais antigo
 * ou mais novo) não impedem o documento auxiliar: ele só mostra o que o leiaute conhece.
 */

import type { DocumentoXml } from '@sinete/core/xml';
import { lerXml } from '@sinete/core/xml';
import type { ElementoRaiz } from '@sinete/schemas';
import { decodificarRaiz } from '@sinete/schemas';
import { ErroDa } from '../errors.ts';

export function parse(xml: string): DocumentoXml {
  try {
    return lerXml(xml);
  } catch (e) {
    throw new ErroDa('xml_invalido', 'XML malformado', { cause: e });
  }
}

/** Decodifica pela raiz esperada entre as aceitas; outra raiz é `documento_inesperado`. */
export function decodeAs<T>(
  doc: DocumentoXml,
  roots: readonly ElementoRaiz<T>[],
  what: string,
): { root: string; value: T } {
  const root = roots.find((r) => r.nome === doc.raiz.local && r.ns === doc.raiz.ns);
  if (!root) {
    throw new ErroDa('documento_inesperado', `esperado ${what}, recebido <${doc.raiz.local}>`, {
      detalhes: { raiz: doc.raiz.local, esperado: roots.map((r) => r.nome) },
    });
  }
  return { root: root.nome, value: decodificarRaiz(root, doc).valor };
}

/** Registro solto para os grupos de escolha do leiaute (ICMS00, ICMS10...), lidos por nome de campo. */
export type Rec = Readonly<Record<string, unknown>>;

/** Primeiro grupo filho de um grupo de escolha (ex.: o `ICMS00` dentro de `ICMS`). */
export function choice(v: unknown): Rec {
  if (typeof v !== 'object' || v === null) return {};
  for (const x of Object.values(v)) if (typeof x === 'object' && x !== null && !Array.isArray(x)) return x as Rec;
  return {};
}

/** Campo simples de um registro solto. */
export function str(r: Rec | undefined, k: string): string | undefined {
  const v = r?.[k];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Monta a visão de um documento que o decoder tolerante aceitou. O decoder não garante os grupos obrigatórios do XSD,
 * então grupo ausente num ponto que a visão não trata vira `campo_ausente`, e nunca um `TypeError` solto.
 */
export function vista<T>(what: string, build: () => T): T {
  try {
    return build();
  } catch (e) {
    if (e instanceof TypeError) {
      throw new ErroDa('campo_ausente', `${what} sem um grupo obrigatório`, { cause: e });
    }
    throw e;
  }
}
