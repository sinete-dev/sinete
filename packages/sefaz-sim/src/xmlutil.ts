/** Leitura de campos da área de dados já validada pelo schema, por caminho de nomes locais (`ide/cUF`). */

import type { XmlElement } from '@sinete/core/xml';
import { childElements, textOf } from '@sinete/core/xml';
import type { Documento } from './state.ts';

/** Primeiro elemento no caminho, ou `undefined`. */
export function at(el: XmlElement | undefined, path: string): XmlElement | undefined {
  let cur = el;
  for (const step of path.split('/')) {
    if (cur === undefined) return undefined;
    cur = childElements(cur).find((c) => c.local === step);
  }
  return cur;
}

/** Todos os filhos com o nome local. */
export function all(el: XmlElement | undefined, local: string): XmlElement[] {
  return el === undefined ? [] : childElements(el).filter((c) => c.local === local);
}

/** Texto do elemento no caminho, ou `undefined` se ele não existir. */
export function text(el: XmlElement | undefined, path: string): string | undefined {
  const found = at(el, path);
  return found === undefined ? undefined : textOf(found);
}

/** Texto obrigatório (o schema já garantiu a presença); vazio se faltar. */
export function req(el: XmlElement | undefined, path: string): string {
  return text(el, path) ?? '';
}

/** CNPJ ou CPF do grupo (emit, dest, autor do evento). */
export function documento(el: XmlElement | undefined): Documento {
  const cnpj = text(el, 'CNPJ');
  if (cnpj !== undefined) return { CNPJ: cnpj };
  const cpf = text(el, 'CPF');
  return cpf === undefined ? {} : { CPF: cpf };
}

/** Todos os elementos da árvore com prefixo de namespace (regra D02, 404). */
export function hasPrefix(el: XmlElement): boolean {
  if (el.prefix !== '' || el.attributes.some((a) => a.prefix !== '' && a.prefix !== 'xml')) return true;
  return childElements(el).some(hasPrefix);
}
