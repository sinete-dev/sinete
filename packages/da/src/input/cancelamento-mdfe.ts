/**
 * Cancelamento do MDF-e para o carimbo, a partir do `procEventoMDFe` do evento 110111 (MOC MDF-e 3.00b, Visão Geral,
 * 5.1). Só o schema de eventos do MDF-e entra aqui: o subpath `@sinete/da/mdfe` não leva nada da NF-e (ADR 0008).
 */

import type { TProcEvento } from '@sinete/schemas/mdfe/eventos/3.00b';
import { procEventoMDFeElement } from '@sinete/schemas/mdfe/eventos/3.00b';
import { ErroDa } from '../errors.ts';
import type { Cancelamento } from '../layout/marcas.ts';
import type { MdfeView } from './mdfe.ts';
import { decodeAs, parse } from './xml.ts';

/** Eventos do MDF-e registrados: 135 (vinculado), 134 e 136 (vinculação com ressalva), como no `@sinete/mdfe`. */
export const REGISTRADO_MDFE: ReadonlySet<string> = new Set(['135', '134', '136']);

/** O `procEventoMDFe` do cancelamento deste MDF-e, registrado: dá o protocolo e a data ao carimbo. */
export function cancelamentoMdfe(m: MdfeView, xml: string): Cancelamento {
  const v = decodeAs<TProcEvento>(parse(xml), [procEventoMDFeElement], 'procEventoMDFe').value;
  const inf = v.eventoMDFe?.infEvento;
  const tpEvento = inf?.tpEvento ?? '';
  if (tpEvento !== '110111') {
    throw new ErroDa('evento_incompativel', `evento ${tpEvento || 'sem tipo'} não é 110111`, {
      detalhes: { tpEvento, esperado: ['110111'] },
    });
  }
  if (inf?.chMDFe !== m.chave) {
    throw new ErroDa('evento_incompativel', 'o cancelamento é de outro MDF-e', {
      detalhes: { chave: m.chave, chaveEvento: inf?.chMDFe ?? '' },
    });
  }
  const ret = v.retEventoMDFe?.infEvento;
  if (ret === undefined || !REGISTRADO_MDFE.has(ret.cStat)) {
    throw new ErroDa('evento_incompativel', 'cancelamento sem retorno de evento registrado', {
      detalhes: { cStat: ret?.cStat ?? '' },
    });
  }
  // O retorno tem de ser deste pedido: a mesma chave, o mesmo tipo e a mesma sequência.
  if (
    ret.chMDFe !== inf.chMDFe ||
    ret.tpEvento !== tpEvento ||
    ret.nSeqEvento === undefined ||
    Number(ret.nSeqEvento) !== Number(inf.nSeqEvento)
  ) {
    throw new ErroDa('evento_incompativel', 'o retorno do evento não é o deste cancelamento', {
      detalhes: {
        chaveRetorno: ret.chMDFe ?? '',
        tpEventoRetorno: ret.tpEvento ?? '',
        nSeqRetorno: ret.nSeqEvento ?? '',
      },
    });
  }
  return {
    ...(ret.nProt === undefined ? {} : { nProt: ret.nProt }),
    ...(ret.dhRegEvento === undefined ? {} : { dhRegEvento: ret.dhRegEvento }),
  };
}
