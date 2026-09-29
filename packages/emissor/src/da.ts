/**
 * Carga sob demanda do `@sinete/da` (peer dependency opcional) para o `pdf` e o `pdfCancelado` dos emissores.
 *
 * O especificador é montado em runtime: um import literal faria o bundler de quem não instalou o `@sinete/da` falhar
 * ao resolver o módulo. O custo é que o bundler também não o leva para quem instalou, então no browser e no Deno o
 * módulo vai pela opção `da`, importado de forma estática pelo app (ADR 0009, decisão 3).
 */

import { ConfigError } from '@sinete/core';

/** Carregador de um subpath do `@sinete/da`, com o módulo injetado quando houver. */
export function carregadorDa<M>(subpath: string, injetado: M | undefined): () => Promise<M> {
  let modulo = injetado;
  const especificador = ['@sinete/da', subpath].join('/');
  return async (): Promise<M> => {
    if (modulo !== undefined) return modulo;
    try {
      modulo = (await import(/* @vite-ignore */ /* webpackIgnore: true */ especificador)) as M;
    } catch (cause) {
      throw new ConfigError('o PDF usa o @sinete/da: instale o pacote ou passe o módulo na opção da', { cause });
    }
    return modulo;
  };
}
