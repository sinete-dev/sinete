/**
 * Eventos do MDF-e lidos do `procEventoMDFe` (MOC MDF-e 3.00b, Visão Geral, 5.1): o envelope e o `detEvento` vêm do
 * mesmo módulo de schema, com o grupo de cada tipo (`evCancMDFe`, `evEncMDFe`, `evIncCondutorMDFe`...).
 */

import type { DocumentoXml } from '@sinete/core/xml';
import type { TProcEvento } from '@sinete/schemas/mdfe/eventos/3.00b';
import { procEventoMDFeElement } from '@sinete/schemas/mdfe/eventos/3.00b';
import { ErroDa } from '../errors.ts';
import type { Rec } from './xml.ts';
import { choice, decodeAs } from './xml.ts';

export interface EventoMdfeView {
  readonly tpEvento: string;
  readonly chMDFe: string;
  readonly cOrgao: string;
  readonly tpAmb: string;
  readonly autor: string;
  readonly dhEvento: string;
  readonly nSeqEvento: string;
  /** O grupo do tipo dentro do `detEvento` (o `evEncMDFe` do encerramento, por exemplo). */
  readonly det: Rec;
  readonly ret?: {
    readonly cStat: string;
    readonly xMotivo: string;
    readonly nProt: string;
    readonly dhRegEvento: string;
    readonly chMDFe: string;
    readonly tpEvento: string;
    readonly nSeqEvento: string;
  };
}

/** Lê um `procEventoMDFe` do tipo pedido; evento de outro tipo é `evento_incompativel`. */
export function lerEventoMdfe(doc: DocumentoXml, tipos: readonly string[]): EventoMdfeView {
  const v = decodeAs<TProcEvento>(doc, [procEventoMDFeElement], 'procEventoMDFe').value;
  const inf = v.eventoMDFe?.infEvento;
  const tpEvento = inf?.tpEvento ?? '';
  if (!tipos.includes(tpEvento)) {
    throw new ErroDa('evento_incompativel', `evento ${tpEvento || 'sem tipo'} não é ${tipos.join(' nem ')}`, {
      detalhes: { tpEvento, esperado: tipos },
    });
  }
  const ret = v.retEventoMDFe?.infEvento;
  return {
    tpEvento,
    chMDFe: inf?.chMDFe ?? '',
    cOrgao: inf?.cOrgao ?? '',
    tpAmb: inf?.tpAmb ?? '',
    autor: inf?.CNPJ ?? inf?.CPF ?? '',
    dhEvento: inf?.dhEvento ?? '',
    nSeqEvento: inf?.nSeqEvento ?? '',
    det: choice(inf?.detEvento),
    ...(ret
      ? {
          ret: {
            cStat: ret.cStat ?? '',
            xMotivo: ret.xMotivo ?? '',
            nProt: ret.nProt ?? '',
            dhRegEvento: ret.dhRegEvento ?? '',
            chMDFe: ret.chMDFe ?? '',
            tpEvento: ret.tpEvento ?? '',
            nSeqEvento: ret.nSeqEvento ?? '',
          },
        }
      : {}),
  };
}
