/**
 * `@sinete/da/nfse`: DANFSe v2, o documento auxiliar da NFS-e Nacional, a partir do XML autorizado (o `NFSe` que a
 * Sefin Nacional devolve, com a DPS dentro), pela NT SE/CGNFS-e 008/2026 v1.02. A API de geração do DANFSe do ADN foi
 * suspensa em 03/08/2026 (NT 008/2026, 1), e o documento passou a ser gerado pelo emissor. Não carrega nenhum layout
 * nem schema da NF-e ou do MDF-e. Os renderizadores (`toPdf`, `toHtml`, `toSvg`) são reexportados aqui para bastar um
 * import.
 */

import { EVENTOS_DANFSE } from './data/leiaute-danfse.ts';
import { DanfeError } from './errors.ts';
import type { NfseView } from './input/nfse.ts';
import { readEventoNfse, readNfse } from './input/nfse.ts';
import type { DanfseOptions, MarcaDanfse } from './layout/danfse.ts';
import { danfseLayout } from './layout/danfse.ts';
import type { Doc } from './model.ts';

export type { DanfeErrorCode } from './errors.ts';
export { DanfeError } from './errors.ts';
export type { DanfseOptions } from './layout/danfse.ts';
export type { Doc } from './model.ts';
export { toHtml, toSvg } from './render/html.ts';
export type { PdfOptions } from './render/pdf.ts';
export { toPdf } from './render/pdf.ts';

/** Confere o evento passado para a marca: do tipo esperado e desta NFS-e. */
function conferir(n: NfseView, evento: string | true | undefined, tipos: readonly string[], doQue: string): boolean {
  if (evento === undefined) return false;
  if (evento === true) return true;
  const ev = readEventoNfse(evento, tipos);
  if (ev.chNFSe !== n.chave) {
    throw new DanfeError('evento_incompativel', `o evento de ${doQue} é de outra NFS-e`, {
      details: { chave: n.chave, chaveEvento: ev.chNFSe },
    });
  }
  return true;
}

/**
 * DANFSe a partir do `NFSe` autorizado. Cancelada e substituída vêm das opções, com o evento registrado pela Sefin ou
 * `true`: o XML da NFS-e não muda depois da autorização, e o DANFSe precisa da marca d'água (NT 008/2026, 2.5.1 e
 * 2.5.2). As duas marcas juntas são `evento_incompativel`: a substituição já é um cancelamento.
 */
export function danfse(xml: string, options: DanfseOptions = {}): Doc {
  const n = readNfse(xml);
  const cancelada = conferir(n, options.cancelamento, EVENTOS_DANFSE.cancelamento, 'cancelamento');
  const substituida = conferir(n, options.substituicao, EVENTOS_DANFSE.substituicao, 'substituição');
  if (cancelada && substituida) {
    throw new DanfeError('evento_incompativel', 'NFS-e cancelada e substituída ao mesmo tempo', {
      details: { chave: n.chave },
    });
  }
  const marca: MarcaDanfse | undefined = cancelada ? 'cancelada' : substituida ? 'substituida' : undefined;
  return danfseLayout(n, options, marca);
}
