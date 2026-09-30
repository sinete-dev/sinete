/**
 * `@sinete/da/nfce`: DANFE NFC-e (modelo 65) em bobina, a partir do XML autorizado (MOC 7.0, Anexo II, e NT 2026.003).
 * Não carrega os layouts A4 e Simplificado da NF-e. Os renderizadores (`gerarPdf`, `gerarHtml`, `gerarSvg`) são reexportados
 * aqui para bastar um import.
 */

import { ErroDa } from './errors.ts';
import { cancelamentoNfe } from './input/cancelamento.ts';
import { readNota } from './input/nfe.ts';
import type { BobinaOpcoes } from './layout/bobina.ts';
import { bobina } from './layout/bobina.ts';
import { carimbo, situacaoNfe } from './layout/marcas.ts';
import type { Documento } from './model.ts';

export type { CodigoErroDa } from './errors.ts';
export { ErroDa } from './errors.ts';
export type { BobinaOpcoes } from './layout/bobina.ts';
export type { DaOpcoes } from './layout/common.ts';
export type { Documento } from './model.ts';
export { gerarHtml, gerarSvg } from './render/html.ts';
export type { PdfOpcoes } from './render/pdf.ts';
export { gerarPdf } from './render/pdf.ts';

export interface DanfceOpcoes extends BobinaOpcoes {
  /**
   * NFC-e cancelada: o `procEventoNFe` do cancelamento (110111) ou do cancelamento por substituição (110112), que dá o
   * protocolo ao carimbo, ou `true` para carimbar sem protocolo. Sem ele, o `protNFe` com cStat de cancelamento (101,
   * 151 ou 155) também carimba.
   */
  readonly cancelamento?: string | true;
}

/** DANFE NFC-e a partir do `nfeProc` (ou do `NFe` emitido em contingência off-line) do modelo 65. */
export function danfce(xml: string, opcoes: DanfceOpcoes = {}): Documento {
  const nota = readNota(xml);
  if (nota.mod !== '65') {
    throw new ErroDa('formato_incompativel', `o DANFE NFC-e não se aplica ao modelo ${nota.mod}`, {
      detalhes: { mod: nota.mod, usar: nota.mod === '55' ? '@sinete/da/nfe' : '' },
    });
  }
  const situacao = situacaoNfe(nota, false);
  return bobina(nota, 'nfce', opcoes, situacao, carimbo(situacao, cancelamentoNfe(nota, opcoes.cancelamento)));
}
