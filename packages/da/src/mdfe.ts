/**
 * `@sinete/da/mdfe`: DAMDFE a partir do XML autorizado do MDF-e (MOC MDF-e 3.00a, Anexo II). Não carrega nenhum layout
 * nem schema da NF-e. Os renderizadores (`toPdf`, `toHtml`, `toSvg`) são reexportados aqui para bastar um import.
 */

import { readMdfe } from './input/mdfe.ts';
import type { DamdfeOptions } from './layout/damdfe.ts';
import { damdfeLayout } from './layout/damdfe.ts';
import type { Doc } from './model.ts';

export type { DanfeErrorCode } from './errors.ts';
export { DanfeError } from './errors.ts';
export type { CommonOptions } from './layout/common.ts';
export type { DamdfeOptions } from './layout/damdfe.ts';
export type { Doc } from './model.ts';
export { toHtml, toSvg } from './render/html.ts';
export type { PdfOptions } from './render/pdf.ts';
export { toPdf } from './render/pdf.ts';

/** DAMDFE a partir do `mdfeProc` (ou do `MDFe` em contingência). */
export function damdfe(xml: string, options: DamdfeOptions = {}): Doc {
  return damdfeLayout(readMdfe(xml), options);
}
