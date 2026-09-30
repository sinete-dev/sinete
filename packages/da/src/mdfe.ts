/**
 * `@sinete/da/mdfe`: DAMDFE a partir do XML autorizado do MDF-e (MOC MDF-e 3.00a, Anexo II). Não carrega nenhum layout
 * nem schema da NF-e. Os renderizadores (`gerarPdf`, `gerarHtml`, `gerarSvg`) são reexportados aqui para bastar um import.
 */

import { readMdfe } from './input/mdfe.ts';
import type { DamdfeOpcoes } from './layout/damdfe.ts';
import { damdfeLayout } from './layout/damdfe.ts';
import type { Documento } from './model.ts';

export type { CodigoErroDa } from './errors.ts';
export { ErroDa } from './errors.ts';
export type { DaOpcoes } from './layout/common.ts';
export type { DamdfeOpcoes } from './layout/damdfe.ts';
export type { Documento } from './model.ts';
export { gerarHtml, gerarSvg } from './render/html.ts';
export type { PdfOpcoes } from './render/pdf.ts';
export { gerarPdf } from './render/pdf.ts';

/** DAMDFE a partir do `mdfeProc` (ou do `MDFe` em contingência). */
export function damdfe(xml: string, opcoes: DamdfeOpcoes = {}): Documento {
  return damdfeLayout(readMdfe(xml), opcoes);
}
