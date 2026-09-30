/**
 * `@sinete/da/cce`: DACCE, o documento auxiliar da Carta de Correção Eletrônica da NF-e. Os renderizadores (`gerarPdf`,
 * `gerarHtml`, `gerarSvg`) são reexportados aqui para bastar um import.
 */

import { ErroDa } from './errors.ts';
import { readEvento } from './input/evento.ts';
import { readNota } from './input/nfe.ts';
import type { DacceOpcoes } from './layout/dacce.ts';
import { dacceLayout } from './layout/dacce.ts';
import type { Documento } from './model.ts';

export type { CodigoErroDa } from './errors.ts';
export { ErroDa } from './errors.ts';
export type { DaOpcoes } from './layout/common.ts';
export type { DacceOpcoes } from './layout/dacce.ts';
export type { Documento } from './model.ts';
export { gerarHtml, gerarSvg } from './render/html.ts';
export type { PdfOpcoes } from './render/pdf.ts';
export { gerarPdf } from './render/pdf.ts';

/** DACCE a partir do `procEventoNFe` da Carta de Correção (110110). */
export function dacce(xmlEvento: string, opcoes: DacceOpcoes = {}): Documento {
  const ev = readEvento(xmlEvento, ['110110']);
  const nota = opcoes.nfe ? readNota(opcoes.nfe) : undefined;
  if (nota && nota.chave !== ev.chNFe) {
    throw new ErroDa('evento_incompativel', 'a carta de correção é de outra NF-e', {
      detalhes: { chave: nota.chave, chaveEvento: ev.chNFe },
    });
  }
  return dacceLayout(ev, nota, opcoes);
}
