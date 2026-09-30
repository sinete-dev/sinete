/**
 * `@sinete/da/cce`: DACCE, o documento auxiliar da Carta de Correção Eletrônica da NF-e. Os renderizadores (`toPdf`,
 * `toHtml`, `toSvg`) são reexportados aqui para bastar um import.
 */

import { DanfeError } from './errors.ts';
import { readEvento } from './input/evento.ts';
import { readNota } from './input/nfe.ts';
import type { DacceOptions } from './layout/dacce.ts';
import { dacceLayout } from './layout/dacce.ts';
import type { Doc } from './model.ts';

export type { DanfeErrorCode } from './errors.ts';
export { DanfeError } from './errors.ts';
export type { CommonOptions } from './layout/common.ts';
export type { DacceOptions } from './layout/dacce.ts';
export type { Doc } from './model.ts';
export { toHtml, toSvg } from './render/html.ts';
export type { PdfOptions } from './render/pdf.ts';
export { toPdf } from './render/pdf.ts';

/** DACCE a partir do `procEventoNFe` da Carta de Correção (110110). */
export function dacce(xmlEvento: string, options: DacceOptions = {}): Doc {
  const ev = readEvento(xmlEvento, ['110110']);
  const nota = options.nfe ? readNota(options.nfe) : undefined;
  if (nota && nota.chave !== ev.chNFe) {
    throw new DanfeError('evento_incompativel', 'a carta de correção é de outra NF-e', {
      detalhes: { chave: nota.chave, chaveEvento: ev.chNFe },
    });
  }
  return dacceLayout(ev, nota, options);
}
