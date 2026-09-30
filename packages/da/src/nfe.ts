/**
 * `@sinete/da/nfe`: DANFE da NF-e (modelo 55) a partir do XML autorizado, nos formatos do MOC 7.0 e da NT 2026.003:
 * retrato, paisagem, Simplificado, Simplificado - Etiqueta e Simplificado Tipo 2. O `danfe` também aceita a NFC-e
 * (modelo 65), para quem imprime os dois modelos pela mesma chamada: a bobina já está aqui por causa do Tipo 2, então
 * isso não custa nada ao bundle. Quem só imprime NFC-e usa `@sinete/da/nfce`, que não carrega os layouts A4 e
 * Simplificado. Os renderizadores (`gerarPdf`, `gerarHtml`, `gerarSvg`) são reexportados aqui para bastar um import.
 */

import { PAISAGEM, RETRATO } from './data/leiaute-a4.ts';
import { ErroDa } from './errors.ts';
import { cancelamentoNfe } from './input/cancelamento.ts';
import { readNota } from './input/nfe.ts';
import type { BobinaOpcoes } from './layout/bobina.ts';
import { bobina } from './layout/bobina.ts';
import type { DanfeA4Opcoes } from './layout/danfe-a4.ts';
import { danfeA4 } from './layout/danfe-a4.ts';
import { carimbo, situacaoNfe } from './layout/marcas.ts';
import type { SimplificadoOpcoes } from './layout/simplificado.ts';
import { simplificado } from './layout/simplificado.ts';
import type { Documento } from './model.ts';

export type { CodigoErroDa } from './errors.ts';
export { ErroDa } from './errors.ts';
export type { BobinaOpcoes } from './layout/bobina.ts';
export type { DaOpcoes } from './layout/common.ts';
export type { DanfeA4Opcoes } from './layout/danfe-a4.ts';
export type { SimplificadoOpcoes } from './layout/simplificado.ts';
export type { Documento } from './model.ts';
export { gerarHtml, gerarSvg } from './render/html.ts';
export type { PdfOpcoes } from './render/pdf.ts';
export { gerarPdf } from './render/pdf.ts';

/**
 * Formato do documento auxiliar:
 * - `retrato` e `paisagem`: DANFE A4 (MOC 7.0, Anexo II, 3.8.1 e 3.8.2);
 * - `simplificado` e `etiqueta`: DANFE Simplificado e Simplificado - Etiqueta (3.11 e 3.12);
 * - `simplificado-tipo2`: DANFE Simplificado Tipo 2 da NF-e (NT 2026.003);
 * - `nfce`: DANFE NFC-e (modelo 65), o mesmo do `danfce` de `@sinete/da/nfce`.
 */
export type FormatoDanfe = 'retrato' | 'paisagem' | 'simplificado' | 'etiqueta' | 'simplificado-tipo2' | 'nfce';

export interface DanfeOpcoes
  extends DanfeA4Opcoes,
    Omit<BobinaOpcoes, 'largura'>,
    Omit<SimplificadoOpcoes, 'largura' | 'epec'> {
  /** Sem ele, vem do XML: modelo 65 é `nfce`; no 55, `tpImp` 2 é paisagem, 3 simplificado, 6 Tipo 2, o resto retrato. */
  readonly formato?: FormatoDanfe;
  /** Largura do papel dos formatos em bobina ou etiqueta, em mm. */
  readonly largura?: number;
  /**
   * NF-e cancelada: o `procEventoNFe` do cancelamento (110111) ou do cancelamento por substituição (110112), que dá o
   * protocolo ao carimbo, ou `true` para carimbar sem protocolo. Sem ele, o `protNFe` com cStat de cancelamento (101,
   * 151 ou 155), como gravam os sistemas que importam a nota, também carimba.
   */
  readonly cancelamento?: string | true;
}

const POR_TPIMP: Readonly<Record<string, FormatoDanfe>> = {
  '2': 'paisagem',
  '3': 'simplificado',
  '6': 'simplificado-tipo2',
};

/** DANFE de NF-e (modelo 55) ou NFC-e (modelo 65) a partir do `nfeProc` (ou do `NFe` em contingência). */
export function danfe(xml: string, opcoes: DanfeOpcoes = {}): Documento {
  const nota = readNota(xml);
  const formato = opcoes.formato ?? (nota.mod === '65' ? 'nfce' : (POR_TPIMP[nota.tpImp] ?? 'retrato'));
  if ((formato === 'nfce') !== (nota.mod === '65')) {
    throw new ErroDa('formato_incompativel', `formato ${formato} não se aplica ao modelo ${nota.mod}`, {
      detalhes: { formato, mod: nota.mod },
    });
  }
  // Sem protocolo de autorização, denegada, cancelada pelo cStat ou em contingência: decide a marca e o campo do
  // protocolo (ADR 0006, decisões 14 e 15). O evento de cancelamento, quando passado, prevalece no carimbo.
  const situacao = situacaoNfe(nota, Boolean(opcoes.epec?.nProt));
  const cancel = carimbo(situacao, cancelamentoNfe(nota, opcoes.cancelamento));
  switch (formato) {
    case 'retrato':
      return danfeA4(nota, RETRATO, opcoes, situacao, cancel);
    case 'paisagem':
      return danfeA4(nota, PAISAGEM, opcoes, situacao, cancel);
    case 'simplificado':
    case 'etiqueta':
      return simplificado(nota, formato === 'etiqueta', opcoes, situacao, cancel);
    case 'simplificado-tipo2':
      return bobina(nota, 'tipo2', opcoes, situacao, cancel);
    default:
      return bobina(nota, 'nfce', opcoes, situacao, cancel);
  }
}
