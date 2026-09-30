/** Leitura de campos da área de dados já validada pelo schema, por caminho de nomes locais (`ide/cUF`). */

import type { ElementoXml } from '@sinete/core/xml';
import { elementosFilhos, textoDe } from '@sinete/core/xml';
import type { Documento } from './state.ts';

/** Primeiro elemento no caminho, ou `undefined`. */
export function at(el: ElementoXml | undefined, path: string): ElementoXml | undefined {
  let cur = el;
  for (const step of path.split('/')) {
    if (cur === undefined) return undefined;
    cur = elementosFilhos(cur).find((c) => c.local === step);
  }
  return cur;
}

/** Todos os filhos com o nome local. */
export function all(el: ElementoXml | undefined, local: string): ElementoXml[] {
  return el === undefined ? [] : elementosFilhos(el).filter((c) => c.local === local);
}

/** Texto do elemento no caminho, ou `undefined` se ele não existir. */
export function text(el: ElementoXml | undefined, path: string): string | undefined {
  const found = at(el, path);
  return found === undefined ? undefined : textoDe(found);
}

/** Texto obrigatório (o schema já garantiu a presença); vazio se faltar. */
export function req(el: ElementoXml | undefined, path: string): string {
  return text(el, path) ?? '';
}

/** CNPJ ou CPF do grupo (emit, dest, autor do evento). */
export function documento(el: ElementoXml | undefined): Documento {
  const cnpj = text(el, 'CNPJ');
  if (cnpj !== undefined) return { CNPJ: cnpj };
  const cpf = text(el, 'CPF');
  return cpf === undefined ? {} : { CPF: cpf };
}

/** Todos os elementos da árvore com prefixo de namespace (regra D02, 404). */
export function hasPrefix(el: ElementoXml): boolean {
  if (el.prefixo !== '' || el.atributos.some((a) => a.prefixo !== '' && a.prefixo !== 'xml')) return true;
  return elementosFilhos(el).some(hasPrefix);
}
